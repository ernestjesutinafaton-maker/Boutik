import { addDays, dayOfMoment, daysBetween } from './dates';

/**
 * Le tableau de bord : ventes jour par jour, produits qui « dorment ».
 * (Les autres chiffres viennent des rapports : voir report.ts.)
 */

/** Total des ventes (non annulées) de chaque jour, du plus ancien au plus récent. */
export function dailyTotals(
  sales: readonly { occurredAt: string; total: number; status: 'completed' | 'cancelled' }[],
  lastDay: string,
  days: number
): { day: string; total: number; count: number }[] {
  const result = Array.from({ length: days }, (_, index) => ({
    day: addDays(lastDay, index - days + 1),
    total: 0,
    count: 0,
  }));
  const byDay = new Map(result.map((entry) => [entry.day, entry]));
  for (const sale of sales) {
    if (sale.status !== 'completed') continue;
    const entry = byDay.get(dayOfMoment(sale.occurredAt));
    if (entry) {
      entry.total += sale.total;
      entry.count += 1;
    }
  }
  return result;
}

export type SleepingProduct = {
  id: string;
  name: string;
  stock: number;
  baseUnit: string;
  /** Jours depuis la dernière vente (null = jamais vendu) */
  daysWithoutSale: number | null;
};

/**
 * Les produits qui « dorment » : il y en a en stock, mais aucune vente depuis
 * au moins « days » jours (ou jamais). Les plus endormis d'abord.
 */
export function sleepingProducts(
  products: readonly {
    id: string;
    name: string;
    stock: number;
    baseUnit: string;
    lastSaleAt: string | null;
    /** Depuis quand le produit est en stock (première réception) */
    inStockSince: string | null;
  }[],
  today: string,
  days = 30
): SleepingProduct[] {
  return products
    .filter((product) => product.stock > 0)
    .map((product) => {
      const since = product.lastSaleAt ?? product.inStockSince;
      return {
        id: product.id,
        name: product.name,
        stock: product.stock,
        baseUnit: product.baseUnit,
        daysWithoutSale: product.lastSaleAt
          ? daysBetween(dayOfMoment(product.lastSaleAt), today)
          : null,
        idleDays: since ? daysBetween(dayOfMoment(since), today) : days,
      };
    })
    .filter((product) => product.idleDays >= days)
    .sort((a, b) => b.idleDays - a.idleDays)
    .map(({ idleDays: _idle, ...product }) => product);
}
