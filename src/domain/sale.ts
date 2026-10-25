import { lineAmount, mulDiv } from './quantity';

/**
 * La vente : panier, remise, paiements, monnaie à rendre, reste à crédit.
 * Tous les montants sont des nombres entiers (voir money.ts).
 */

/** Une ligne du panier : un produit, dans une unité de vente, avec sa quantité. */
export type CartLine = {
  key: string;
  productId: string;
  productName: string;
  unitId: string;
  unitName: string;
  /** Contenu de l'unité en millièmes d'unité de base (Sac 50 kg → 50000) */
  unitFactor: number;
  /** Quantité dans l'unité de vente, en millièmes (1,5 kilo → 1500) */
  quantity: number;
  /** Prix d'UNE unité de vente */
  unitPrice: number;
};

export function lineTotal(line: Pick<CartLine, 'unitPrice' | 'quantity'>): number {
  return lineAmount(line.unitPrice, line.quantity);
}

export function cartSubtotal(lines: readonly Pick<CartLine, 'unitPrice' | 'quantity'>[]): number {
  return lines.reduce((total, line) => total + lineTotal(line), 0);
}

/** La remise saisie : un montant, ou un pourcentage du sous-total. */
export type DiscountInput =
  { kind: 'amount'; amount: number } | { kind: 'percent'; percent: number };

/** Le montant de la remise (jamais plus que le sous-total). */
export function discountAmount(subtotal: number, discount: DiscountInput | null): number {
  if (!discount) {
    return 0;
  }
  const amount =
    discount.kind === 'amount' ? discount.amount : mulDiv(subtotal, discount.percent, 100);
  return Math.min(Math.max(amount, 0), subtotal);
}

/** La plus grosse remise permise, selon le pourcentage autorisé à la personne. */
export function maxDiscount(subtotal: number, maxPercent: number): number {
  return Math.floor((subtotal * maxPercent) / 100);
}

/** Un paiement saisi : tel montant, par tel mode (espèces, MTN MoMo…). */
export type PaymentInput = { methodId: string; isCash: boolean; amount: number };

/** Ce qui sera enregistré pour chaque mode de paiement. */
export type AppliedPayment = {
  methodId: string;
  /** Montant gardé pour la vente */
  amount: number;
  /** Espèces données par le client (seulement pour les espèces) */
  cashReceived: number | null;
  /** Monnaie rendue (seulement pour les espèces) */
  changeGiven: number | null;
};

export type Settlement = {
  /** Payé tout de suite */
  paid: number;
  /** Reste dû : passe en crédit (client obligatoire) */
  due: number;
  /** Monnaie à rendre au client */
  change: number;
  payments: AppliedPayment[];
  /** Trop payé par un mode autre que les espèces (impossible de rendre la monnaie) */
  overpaid: boolean;
};

/**
 * Calcule le règlement d'une vente.
 *   - Le client donne plus que le total en espèces → on rend la monnaie.
 *   - Le client paie moins que le total → le reste passe en crédit.
 *   - Paiement mixte : 10 000 en espèces + 5 000 par MoMo, par exemple.
 */
export function settle(total: number, inputs: readonly PaymentInput[]): Settlement {
  const payments = inputs.filter((payment) => payment.amount > 0);
  const sum = payments.reduce((total_, payment) => total_ + payment.amount, 0);

  if (sum <= total) {
    return {
      paid: sum,
      due: total - sum,
      change: 0,
      overpaid: false,
      payments: payments.map((payment) => ({
        methodId: payment.methodId,
        amount: payment.amount,
        cashReceived: payment.isCash ? payment.amount : null,
        changeGiven: payment.isCash ? 0 : null,
      })),
    };
  }

  // Trop donné : la différence est rendue, mais seulement sur les espèces
  const excess = sum - total;
  const cashSum = payments
    .filter((payment) => payment.isCash)
    .reduce((total_, payment) => total_ + payment.amount, 0);
  if (excess > cashSum) {
    return { paid: total, due: 0, change: 0, overpaid: true, payments: [] };
  }

  let changeLeft = excess;
  const applied: AppliedPayment[] = [];
  for (const payment of payments) {
    if (!payment.isCash) {
      applied.push({
        methodId: payment.methodId,
        amount: payment.amount,
        cashReceived: null,
        changeGiven: null,
      });
      continue;
    }
    const change = Math.min(changeLeft, payment.amount);
    changeLeft -= change;
    applied.push({
      methodId: payment.methodId,
      amount: payment.amount - change,
      cashReceived: payment.amount,
      changeGiven: change,
    });
  }
  return {
    paid: total,
    due: 0,
    change: excess,
    overpaid: false,
    // Un paiement entièrement rendu (0) n'est pas enregistré
    payments: applied.filter((payment) => payment.amount > 0),
  };
}

/** Numéro de facture unique, même hors ligne : F2-000123 = appareil n° 2, 123e facture. */
export function formatInvoiceNumber(deviceNumber: number, sequence: number): string {
  return `F${deviceNumber}-${String(sequence).padStart(6, '0')}`;
}

/** Les raisons pour lesquelles une vente ne peut pas encore être validée. */
export type SaleProblem =
  'emptyCart' | 'discountTooHigh' | 'overpaid' | 'customerRequired' | 'creditLimitExceeded';

/** Vérifie une vente avant de l'enregistrer. Renvoie la liste des problèmes (vide = tout va bien). */
export function checkSale(input: {
  lines: readonly Pick<CartLine, 'unitPrice' | 'quantity'>[];
  discount: number;
  maxDiscountPercent: number;
  settlement: Settlement;
  customer: { balance: number; creditLimit: number | null } | null;
}): SaleProblem[] {
  const problems: SaleProblem[] = [];
  const subtotal = cartSubtotal(input.lines);
  if (input.lines.length === 0) {
    problems.push('emptyCart');
  }
  if (input.discount > maxDiscount(subtotal, input.maxDiscountPercent)) {
    problems.push('discountTooHigh');
  }
  if (input.settlement.overpaid) {
    problems.push('overpaid');
  }
  if (input.settlement.due > 0) {
    if (!input.customer) {
      problems.push('customerRequired');
    } else if (
      input.customer.creditLimit !== null &&
      input.customer.balance + input.settlement.due > input.customer.creditLimit
    ) {
      problems.push('creditLimitExceeded');
    }
  }
  return problems;
}

/**
 * Remboursement d'un retour partiel : la valeur des articles rendus,
 * diminuée de la même proportion de remise que la vente.
 *   Ligne de 10 000 (4 pièces), remise de 10 % sur la vente → 1 pièce rendue = 2 250.
 */
export function returnValue(input: {
  lineTotal: number;
  lineBaseQuantity: number;
  returnedBaseQuantity: number;
  saleSubtotal: number;
  saleTotal: number;
}): number {
  const value = mulDiv(input.lineTotal, input.returnedBaseQuantity, input.lineBaseQuantity);
  return input.saleSubtotal === 0 ? 0 : mulDiv(value, input.saleTotal, input.saleSubtotal);
}
