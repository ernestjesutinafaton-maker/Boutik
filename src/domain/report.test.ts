import { describe, expect, it } from 'vitest';

import { closingDifferences, expectedByMethod } from './cash';
import { buildReport, type ReportInput, withCostDefaults } from './report';

describe('Caisse du jour', () => {
  it('calcule l’argent attendu, mode par mode', () => {
    const expected = expectedByMethod({
      openingFloat: 10_000,
      cashMethodId: 'cash',
      payments: [
        { methodId: 'cash', amount: 45_000 }, // ventes en espèces
        { methodId: 'momo', amount: 20_000 }, // ventes par MoMo
        { methodId: 'cash', amount: 5000 }, // remboursement de crédit
        { methodId: 'cash', amount: -1050 }, // argent rendu (retour)
      ],
      movements: [
        { methodId: 'cash', type: 'expense', amount: 2000 }, // essence du livreur
        { methodId: 'cash', type: 'stock_purchase', amount: 15_000 }, // sac de riz payé par la caisse
        { methodId: 'cash', type: 'withdrawal', amount: 10_000 }, // retrait du propriétaire
        { methodId: 'cash', type: 'deposit', amount: 5000 }, // monnaie ajoutée
      ],
    });
    expect(expected).toEqual({ cash: 36_950, momo: 20_000 });
  });

  it('les écarts : compté − attendu', () => {
    expect(
      closingDifferences({ cash: 36_950, momo: 20_000 }, { cash: 36_500, momo: 20_000 })
    ).toEqual({
      byMethod: { cash: -450, momo: 0 },
      total: -450,
    });
  });
});

describe('Rapport (clôture ou compte)', () => {
  const input: ReportInput = {
    periodStart: '2026-10-25T00:00:00.000Z',
    periodEnd: '2026-10-25T20:00:00.000Z',
    sales: [
      { status: 'completed', total: 34_450, discount: 0 },
      { status: 'completed', total: 7000, discount: 500 },
      { status: 'cancelled', total: 1400, discount: 0 },
    ],
    saleMovements: [
      { type: 'sale', costAmount: -29_960, saleStatus: 'completed' },
      { type: 'sale', costAmount: -5600, saleStatus: 'completed' },
      { type: 'return', costAmount: 840, saleStatus: 'completed' },
      { type: 'sale', costAmount: -1120, saleStatus: 'cancelled' },
      { type: 'return', costAmount: 1120, saleStatus: 'cancelled' },
    ],
    refunds: [
      { amount: -1050, saleStatus: 'completed' },
      { amount: -1400, saleStatus: 'cancelled' },
    ],
    debtReductions: [],
    payments: [
      { methodId: 'cash', methodLabel: 'Espèces', amount: 34_450 },
      { methodId: 'momo', methodLabel: 'MTN MoMo', amount: 3000 },
      { methodId: 'cash', methodLabel: 'Espèces', amount: 1400 },
      { methodId: 'cash', methodLabel: 'Espèces', amount: -1050 },
      { methodId: 'cash', methodLabel: 'Espèces', amount: -1400 },
      { methodId: 'cash', methodLabel: 'Espèces', amount: 2000 }, // remboursement de crédit
    ],
    ledger: [
      { type: 'debt', amount: 4000 },
      { type: 'repayment', amount: -2000 },
    ],
    cashMovements: [
      { type: 'expense', category: 'fuel', amount: 2000 },
      { type: 'expense', category: 'transport', amount: 1500 },
      { type: 'expense', category: 'fuel', amount: 500 },
      { type: 'stock_purchase', category: null, amount: 15_000 },
      { type: 'withdrawal', category: null, amount: 10_000 },
    ],
    stockMovements: [
      { type: 'receipt', costAmount: 56_000 },
      { type: 'loss', costAmount: -1120 },
      { type: 'adjustment', costAmount: 225 },
    ],
    closedSessions: [{ difference: -450 }, { difference: null }],
    soldItems: [
      {
        productId: 'riz',
        productName: 'Riz',
        baseUnit: 'kg',
        baseQuantity: 53_500,
        lineTotal: 34_450,
        saleStatus: 'completed',
      },
      {
        productId: 'riz',
        productName: 'Riz',
        baseUnit: 'kg',
        baseQuantity: 10_000,
        lineTotal: 7000,
        saleStatus: 'completed',
      },
      {
        productId: 'lait',
        productName: 'Lait',
        baseUnit: 'boîte',
        baseQuantity: 3000,
        lineTotal: 1400,
        saleStatus: 'cancelled',
      },
    ],
    debtors: [
      { name: 'Awa', balance: 2000, ageDays: 0 },
      { name: 'Koffi', balance: 12_000, ageDays: 45 },
      { name: 'Ada', balance: 0, ageDays: 0 },
    ],
    stockValue: 25_340,
  };

  const report = buildReport(input);

  it('les ventes : annulées à part, retours déduits', () => {
    expect(report.sales).toEqual({
      count: 2,
      cancelledCount: 1,
      total: 41_450,
      discounts: 500,
      returns: 1050,
      revenue: 40_400,
    });
  });

  it('le bénéfice : brut, puis net après dépenses, pertes et écarts d’inventaire', () => {
    // Coût des marchandises : 29 960 + 5 600 − 840 (retour) = 34 720
    expect(report.costOfGoods).toBe(34_720);
    expect(report.grossProfit).toBe(40_400 - 34_720);
    expect(report.expenses).toEqual({ total: 4000, byCategory: { fuel: 2500, transport: 1500 } });
    expect(report.losses).toBe(1120);
    expect(report.adjustments).toBe(225);
    expect(report.netProfit).toBe(5680 - 4000 - 1120 + 225);
  });

  it('l’argent encaissé par mode, le crédit, les sorties de caisse', () => {
    expect(report.payments).toEqual({
      byMethod: [
        { label: 'Espèces', amount: 35_400 },
        { label: 'MTN MoMo', amount: 3000 },
      ],
      total: 38_400,
    });
    expect(report.credit).toEqual({ given: 4000, repaid: 2000, writtenOff: 0, oldDebts: 0 });
    // L'achat de marchandise payé par la caisse n'est pas une dépense
    expect(report.cash).toEqual({ stockPurchases: 15_000, withdrawals: 10_000, deposits: 0 });
  });

  it('le stock, les écarts de caisse, les meilleures ventes et les débiteurs', () => {
    expect(report.stock).toEqual({ receivedValue: 56_000, valueAtEnd: 25_340 });
    expect(report.cashDifferences).toEqual({ total: -450, sessions: 1 });
    expect(report.topProducts).toEqual([
      { name: 'Riz', baseUnit: 'kg', quantity: 63_500, revenue: 41_450 },
    ]);
    expect(report.debtors.map((debtor) => debtor.name)).toEqual(['Koffi', 'Awa']);
    expect(report.totalDebt).toBe(14_000);
  });
});

describe('Fiche archivée sans coûts (clôture faite par un membre de l’équipe)', () => {
  it('complète les parties manquantes à 0 et dit de ne pas les montrer', () => {
    const { data, costsKnown } = withCostDefaults({
      sales: {
        count: 3,
        cancelledCount: 0,
        total: 16_500,
        discounts: 0,
        returns: 0,
        revenue: 16_500,
      },
      cash: { withdrawals: 0, deposits: 0 } as never,
    });
    expect(costsKnown).toBe(false);
    expect(data.stock).toEqual({ receivedValue: 0, valueAtEnd: 0 });
    expect(data.cash.stockPurchases).toBe(0);
    expect(data.sales.total).toBe(16_500);
  });

  it('une fiche complète garde ses coûts', () => {
    const { data, costsKnown } = withCostDefaults({
      costOfGoods: 10_000,
      grossProfit: 6500,
      stock: { receivedValue: 50_000, valueAtEnd: 40_000 },
      cash: { stockPurchases: 20_000, withdrawals: 0, deposits: 0 },
    });
    expect(costsKnown).toBe(true);
    expect(data.grossProfit).toBe(6500);
    expect(data.cash.stockPurchases).toBe(20_000);
  });
});
