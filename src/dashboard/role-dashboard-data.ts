import { useQuery } from '@powersync/react';

import { addDays, dayRange, today } from '@/domain/dates';

/**
 * Données des tableaux de bord par rôle (base LOCALE, à jour en direct).
 * Le vendeur ne voit que SES ventes : le filtre se fait sur son identifiant (seller_id).
 */

export type MySalesTotals = { count: number; total: number; onCredit: number };

export const MY_SALES_TOTALS_SQL = `
  SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total, COALESCE(SUM(due_amount), 0) AS onCredit
    FROM sales
   WHERE shop_id = ? AND seller_id = ? AND status = 'completed'
     AND occurred_at >= ? AND occurred_at < ?`;

export type MyRecentSale = {
  id: string;
  invoiceNumber: string;
  total: number;
  occurredAt: string;
  customerName: string | null;
};

export const MY_RECENT_SALES_SQL = `
  SELECT s.id, s.invoice_number AS invoiceNumber, s.total, s.occurred_at AS occurredAt,
         c.name AS customerName
    FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
   WHERE s.shop_id = ? AND s.seller_id = ? AND s.status = 'completed'
   ORDER BY s.occurred_at DESC
   LIMIT 5`;

/** Mes ventes : aujourd'hui, 7 derniers jours, et les 5 dernières. */
export function useMySales(
  shopId: string,
  memberId: string
): { today: MySalesTotals; week: MySalesTotals; recent: MyRecentSale[] } {
  const day = today();
  const todayRange = dayRange(day);
  const weekStart = dayRange(addDays(day, -6)).start;
  const empty: MySalesTotals = { count: 0, total: 0, onCredit: 0 };
  const { data: todayRows } = useQuery<MySalesTotals>(MY_SALES_TOTALS_SQL, [
    shopId,
    memberId,
    todayRange.start,
    todayRange.end,
  ]);
  const { data: weekRows } = useQuery<MySalesTotals>(MY_SALES_TOTALS_SQL, [
    shopId,
    memberId,
    weekStart,
    todayRange.end,
  ]);
  const { data: recent } = useQuery<MyRecentSale>(MY_RECENT_SALES_SQL, [shopId, memberId]);
  return { today: todayRows[0] ?? empty, week: weekRows[0] ?? empty, recent };
}

/** Nombre d'inventaires commencés mais pas encore validés. */
export function useOpenInventoryCount(shopId: string): number {
  const { data } = useQuery<{ count: number }>(
    "SELECT COUNT(*) AS count FROM inventory_counts WHERE shop_id = ? AND status = 'draft'",
    [shopId]
  );
  return data[0]?.count ?? 0;
}
