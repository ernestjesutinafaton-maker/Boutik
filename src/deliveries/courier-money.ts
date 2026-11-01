import { courierBalances } from '@/domain/delivery';
import type { Reader } from '@/stock/stock-data';

/**
 * L'argent liquide encaissé par les livreurs (hors caisse ouverte), et ce qu'ils ont remis.
 * Même calcul que le serveur : espèces, reliées à une livraison, pas dans une caisse.
 */
export const COURIER_COLLECTED_SQL = `
  SELECT p.created_by AS courierId, SUM(p.amount) AS amount
    FROM payments p JOIN payment_methods pm ON pm.id = p.payment_method_id
   WHERE p.shop_id = ? AND p.delivery_id IS NOT NULL AND p.cash_session_id IS NULL
     AND pm.kind = 'cash' AND p.created_by IS NOT NULL
   GROUP BY p.created_by`;

export const COURIER_HANDED_OVER_SQL = `
  SELECT courier_id AS courierId, SUM(amount) AS amount
    FROM cash_movements WHERE shop_id = ? AND type = 'handover' AND courier_id IS NOT NULL
   GROUP BY courier_id`;

/** L'argent que chaque livreur doit remettre à la caisse (lecture directe). */
export async function loadCourierBalances(
  reader: Reader,
  shopId: string
): Promise<Map<string, number>> {
  const [collected, handedOver] = await Promise.all([
    reader.getAll<{ courierId: string; amount: number }>(COURIER_COLLECTED_SQL, [shopId]),
    reader.getAll<{ courierId: string; amount: number }>(COURIER_HANDED_OVER_SQL, [shopId]),
  ]);
  return courierBalances(collected, handedOver);
}
