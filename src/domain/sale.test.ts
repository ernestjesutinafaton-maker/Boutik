import { describe, expect, it } from 'vitest';

import {
  cartSubtotal,
  checkSale,
  discountAmount,
  formatInvoiceNumber,
  lineTotal,
  maxDiscount,
  returnValue,
  settle,
} from './sale';

const CASH = 'especes';
const MOMO = 'mtn';

// 2 sacs de riz à 32 000 + 1,5 kg à 700 + 3 savons à 250
const lines = [
  { unitPrice: 32_000, quantity: 2000 },
  { unitPrice: 700, quantity: 1500 },
  { unitPrice: 250, quantity: 3000 },
];

describe('Le panier', () => {
  it('calcule chaque ligne et le sous-total', () => {
    expect(lineTotal(lines[1])).toBe(1050);
    expect(cartSubtotal(lines)).toBe(64_000 + 1050 + 750);
  });
});

describe('La remise', () => {
  it('en montant ou en pourcentage, jamais plus que le sous-total', () => {
    expect(discountAmount(10_000, { kind: 'amount', amount: 500 })).toBe(500);
    expect(discountAmount(10_000, { kind: 'percent', percent: 5 })).toBe(500);
    expect(discountAmount(10_000, { kind: 'amount', amount: 15_000 })).toBe(10_000);
    expect(discountAmount(10_000, null)).toBe(0);
  });

  it('un vendeur limité à 5 % ne peut pas donner plus', () => {
    expect(maxDiscount(65_800, 5)).toBe(3290);
    const settlement = settle(62_510, [{ methodId: CASH, isCash: true, amount: 62_510 }]);
    expect(
      checkSale({ lines, discount: 3290, maxDiscountPercent: 5, settlement, customer: null })
    ).toEqual([]);
    expect(
      checkSale({ lines, discount: 3291, maxDiscountPercent: 5, settlement, customer: null })
    ).toEqual(['discountTooHigh']);
  });

  it('le propriétaire (100 %) peut tout donner', () => {
    const settlement = settle(0, []);
    expect(
      checkSale({ lines, discount: 65_800, maxDiscountPercent: 100, settlement, customer: null })
    ).toEqual([]);
  });
});

describe('Le paiement', () => {
  it('le client donne 10 000 pour 7 500 : on rend 2 500', () => {
    const result = settle(7500, [{ methodId: CASH, isCash: true, amount: 10_000 }]);
    expect(result).toEqual({
      paid: 7500,
      due: 0,
      change: 2500,
      overpaid: false,
      payments: [{ methodId: CASH, amount: 7500, cashReceived: 10_000, changeGiven: 2500 }],
    });
  });

  it('paiement mixte : 5 000 par MoMo + 10 000 en espèces pour 12 000', () => {
    const result = settle(12_000, [
      { methodId: MOMO, isCash: false, amount: 5000 },
      { methodId: CASH, isCash: true, amount: 10_000 },
    ]);
    expect(result.change).toBe(3000);
    expect(result.payments).toEqual([
      { methodId: MOMO, amount: 5000, cashReceived: null, changeGiven: null },
      { methodId: CASH, amount: 7000, cashReceived: 10_000, changeGiven: 3000 },
    ]);
  });

  it('paiement partiel : le reste passe en crédit', () => {
    const result = settle(20_000, [{ methodId: CASH, isCash: true, amount: 15_000 }]);
    expect(result.paid).toBe(15_000);
    expect(result.due).toBe(5000);
    expect(result.change).toBe(0);
  });

  it('tout à crédit : rien payé', () => {
    const result = settle(20_000, []);
    expect(result).toMatchObject({ paid: 0, due: 20_000, payments: [] });
  });

  it('impossible de rendre la monnaie sur un paiement MoMo', () => {
    expect(settle(5000, [{ methodId: MOMO, isCash: false, amount: 6000 }]).overpaid).toBe(true);
  });
});

describe('La vente à crédit', () => {
  const settlement = settle(20_000, [{ methodId: CASH, isCash: true, amount: 15_000 }]);

  it('exige un client', () => {
    expect(
      checkSale({ lines, discount: 0, maxDiscountPercent: 0, settlement, customer: null })
    ).toEqual(['customerRequired']);
  });

  it('respecte le plafond de crédit du client', () => {
    const check = (balance: number, creditLimit: number | null) =>
      checkSale({
        lines,
        discount: 0,
        maxDiscountPercent: 0,
        settlement,
        customer: { balance, creditLimit },
      });
    expect(check(10_000, 15_000)).toEqual([]); // 10 000 + 5 000 = plafond atteint, pas dépassé
    expect(check(10_001, 15_000)).toEqual(['creditLimitExceeded']);
    expect(check(1_000_000, null)).toEqual([]); // pas de plafond
  });

  it('un panier vide ne se vend pas', () => {
    expect(
      checkSale({
        lines: [],
        discount: 0,
        maxDiscountPercent: 0,
        settlement: settle(0, []),
        customer: null,
      })
    ).toEqual(['emptyCart']);
  });
});

describe('Numéro de facture', () => {
  it('appareil n° 2, 123e facture → F2-000123', () => {
    expect(formatInvoiceNumber(2, 123)).toBe('F2-000123');
    expect(formatInvoiceNumber(12, 1)).toBe('F12-000001');
  });
});

describe('Retour d’articles', () => {
  it('rembourse la valeur rendue, moins la même part de remise', () => {
    // Ligne de 4 pièces à 10 000 ; vente de 20 000 avec 2 000 de remise (10 %)
    expect(
      returnValue({
        lineTotal: 10_000,
        lineBaseQuantity: 4000,
        returnedBaseQuantity: 1000,
        saleSubtotal: 20_000,
        saleTotal: 18_000,
      })
    ).toBe(2250);
  });
});
