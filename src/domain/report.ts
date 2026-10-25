import type { CashMovementType } from './cash';
import type { LedgerType } from './credit';

/**
 * Les rapports : « Clôturer la journée » et « Faire un compte ».
 * À partir des opérations d'une période, on calcule une fiche complète,
 * qui est ensuite ARCHIVÉE telle quelle (elle ne change plus).
 *
 *   Chiffre d'affaires = ventes − retours
 *   Bénéfice brut      = chiffre d'affaires − coût d'achat des marchandises vendues
 *   Bénéfice net       = bénéfice brut − dépenses − pertes ± écarts d'inventaire
 *
 * Une vente annulée ne compte pas du tout (ni la vente, ni son remboursement).
 * Un achat de marchandise payé par la caisse n'est PAS une dépense : la marchandise
 * entre en stock et son coût compte quand elle est vendue.
 */

type SaleStatus = 'completed' | 'cancelled';

export type ReportInput = {
  periodStart: string;
  periodEnd: string;
  /** Les ventes faites pendant la période */
  sales: readonly { status: SaleStatus; total: number; discount: number }[];
  /** Mouvements « vente » et « retour » de la période, avec l'état de leur vente */
  saleMovements: readonly { type: 'sale' | 'return'; costAmount: number; saleStatus: SaleStatus }[];
  /** Argent rendu aux clients pendant la période (montants négatifs) */
  refunds: readonly { amount: number; saleStatus: SaleStatus }[];
  /** Dettes diminuées par un retour pendant la période (montants négatifs) */
  debtReductions: readonly { amount: number; saleStatus: SaleStatus }[];
  /** Tout l'argent encaissé ou rendu pendant la période */
  payments: readonly { methodId: string; methodLabel: string; amount: number }[];
  ledger: readonly { type: LedgerType; amount: number }[];
  cashMovements: readonly {
    type: CashMovementType;
    category: string | null;
    amount: number;
  }[];
  /** Mouvements de stock de la période hors ventes (réceptions, pertes, ajustements) */
  stockMovements: readonly { type: string; costAmount: number }[];
  /** Écarts des caisses clôturées pendant la période */
  closedSessions: readonly { difference: number | null }[];
  /** Lignes vendues pendant la période */
  soldItems: readonly {
    productId: string;
    productName: string;
    baseUnit: string;
    baseQuantity: number;
    lineTotal: number;
    saleStatus: SaleStatus;
  }[];
  /** Les clients qui doivent de l'argent au moment du rapport */
  debtors: readonly { name: string; balance: number; ageDays: number }[];
  /** Valeur du stock au prix d'achat, au moment du rapport */
  stockValue: number;
};

export type ReportData = {
  version: 1;
  periodStart: string;
  periodEnd: string;
  sales: {
    count: number;
    cancelledCount: number;
    /** Total des ventes (non annulées), remises déduites */
    total: number;
    discounts: number;
    returns: number;
    /** Chiffre d'affaires = total − retours */
    revenue: number;
  };
  costOfGoods: number;
  grossProfit: number;
  expenses: { total: number; byCategory: Record<string, number> };
  losses: number;
  /** Écarts d'inventaire : + marchandise trouvée, − marchandise manquante */
  adjustments: number;
  netProfit: number;
  payments: { byMethod: { label: string; amount: number }[]; total: number };
  credit: { given: number; repaid: number; writtenOff: number; oldDebts: number };
  cash: { stockPurchases: number; withdrawals: number; deposits: number };
  stock: { receivedValue: number; valueAtEnd: number };
  cashDifferences: { total: number; sessions: number };
  topProducts: { name: string; baseUnit: string; quantity: number; revenue: number }[];
  debtors: { name: string; balance: number; ageDays: number }[];
  totalDebt: number;
  /** Seulement pour une clôture de journée : l'argent attendu et compté, mode par mode */
  closing?: ClosingData;
};

export type ClosingData = {
  openingFloat: number;
  methods: { label: string; expected: number; counted: number; difference: number }[];
  totalDifference: number;
};

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
/** Change le signe (sans produire de « −0 », qui gênerait les comparaisons). */
const negate = (value: number) => (value === 0 ? 0 : -value);

export function buildReport(input: ReportInput): ReportData {
  const completed = input.sales.filter((sale) => sale.status === 'completed');
  const total = sum(completed.map((sale) => sale.total));
  const returns = negate(
    sum(input.refunds.filter((r) => r.saleStatus === 'completed').map((r) => r.amount)) +
      sum(input.debtReductions.filter((d) => d.saleStatus === 'completed').map((d) => d.amount))
  );
  const revenue = total - returns;

  const live = input.saleMovements.filter((movement) => movement.saleStatus === 'completed');
  // Les sorties « vente » ont un coût négatif, les retours un coût positif
  const costOfGoods = negate(sum(live.map((movement) => movement.costAmount)));
  const grossProfit = revenue - costOfGoods;

  const expenses = input.cashMovements.filter((movement) => movement.type === 'expense');
  const byCategory: Record<string, number> = {};
  for (const expense of expenses) {
    const category = expense.category ?? 'other';
    byCategory[category] = (byCategory[category] ?? 0) + expense.amount;
  }
  const expensesTotal = sum(expenses.map((expense) => expense.amount));

  const costOf = (type: string) =>
    sum(input.stockMovements.filter((m) => m.type === type).map((m) => m.costAmount));
  const losses = negate(costOf('loss'));
  const adjustments = costOf('adjustment');
  const netProfit = grossProfit - expensesTotal - losses + adjustments;

  const byMethod = new Map<string, { label: string; amount: number }>();
  for (const payment of input.payments) {
    const current = byMethod.get(payment.methodId) ?? { label: payment.methodLabel, amount: 0 };
    current.amount += payment.amount;
    byMethod.set(payment.methodId, current);
  }

  const ledgerSum = (type: LedgerType) =>
    sum(input.ledger.filter((entry) => entry.type === type).map((entry) => entry.amount));
  const cashOf = (type: CashMovementType) =>
    sum(input.cashMovements.filter((m) => m.type === type).map((m) => m.amount));

  const products = new Map<
    string,
    { name: string; baseUnit: string; quantity: number; revenue: number }
  >();
  for (const item of input.soldItems) {
    if (item.saleStatus !== 'completed') continue;
    const current = products.get(item.productId) ?? {
      name: item.productName,
      baseUnit: item.baseUnit,
      quantity: 0,
      revenue: 0,
    };
    current.quantity += item.baseQuantity;
    current.revenue += item.lineTotal;
    products.set(item.productId, current);
  }

  const debtors = [...input.debtors]
    .filter((debtor) => debtor.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const sessionsWithDifference = input.closedSessions.filter(
    (session) => session.difference !== null
  );

  return {
    version: 1,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    sales: {
      count: completed.length,
      cancelledCount: input.sales.length - completed.length,
      total,
      discounts: sum(completed.map((sale) => sale.discount)),
      returns,
      revenue,
    },
    costOfGoods,
    grossProfit,
    expenses: { total: expensesTotal, byCategory },
    losses,
    adjustments,
    netProfit,
    payments: {
      byMethod: [...byMethod.values()].filter((method) => method.amount !== 0),
      total: sum(input.payments.map((payment) => payment.amount)),
    },
    credit: {
      given: ledgerSum('debt'),
      repaid: negate(ledgerSum('repayment')),
      writtenOff: negate(ledgerSum('write_off')),
      oldDebts: ledgerSum('adjustment'),
    },
    cash: {
      stockPurchases: cashOf('stock_purchase'),
      withdrawals: cashOf('withdrawal'),
      deposits: cashOf('deposit'),
    },
    stock: { receivedValue: costOf('receipt'), valueAtEnd: input.stockValue },
    cashDifferences: {
      total: sum(sessionsWithDifference.map((session) => session.difference ?? 0)),
      sessions: sessionsWithDifference.length,
    },
    topProducts: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    debtors: debtors.slice(0, 50),
    totalDebt: sum(debtors.map((debtor) => debtor.balance)),
  };
}
