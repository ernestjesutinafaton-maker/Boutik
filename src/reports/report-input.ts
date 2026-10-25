import { debtAging, type LedgerType } from '@/domain/credit';
import { daysBetween } from '@/domain/dates';
import type { ReportInput } from '@/domain/report';
import { stockValue } from '@/domain/stock';
import type { Reader } from '@/stock/stock-data';

/**
 * Lit dans la base locale toutes les opérations d'une période (début et fin inclus),
 * pour fabriquer un rapport. Les montants restent des nombres entiers.
 */
export async function loadReportInput(
  reader: Reader,
  shopId: string,
  start: string,
  end: string,
  today: string
): Promise<ReportInput> {
  const range = [shopId, start, end];
  const inRange = (column: string) => `${column} >= ? AND ${column} <= ?`;

  const [
    sales,
    saleMovements,
    refunds,
    debtReductions,
    payments,
    ledger,
    cashMovements,
    stockMovements,
    closedSessions,
    soldItems,
    ledgerAll,
    lots,
  ] = await Promise.all([
    reader.getAll<{ status: 'completed' | 'cancelled'; total: number; discount_amount: number }>(
      `SELECT status, total, discount_amount FROM sales WHERE shop_id = ? AND ${inRange('occurred_at')}`,
      range
    ),
    reader.getAll<{
      type: 'sale' | 'return';
      cost_amount: number;
      status: 'completed' | 'cancelled';
    }>(
      `SELECT m.type, m.cost_amount, s.status FROM stock_movements m JOIN sales s ON s.id = m.sale_id
        WHERE m.shop_id = ? AND m.type IN ('sale', 'return') AND ${inRange('m.occurred_at')}`,
      range
    ),
    reader.getAll<{ amount: number; status: 'completed' | 'cancelled' }>(
      `SELECT p.amount, s.status FROM payments p JOIN sales s ON s.id = p.sale_id
        WHERE p.shop_id = ? AND p.kind = 'refund' AND ${inRange('p.occurred_at')}`,
      range
    ),
    reader.getAll<{ amount: number; status: 'completed' | 'cancelled' }>(
      `SELECT l.amount, s.status FROM customer_ledger l JOIN sales s ON s.id = l.sale_id
        WHERE l.shop_id = ? AND l.type = 'cancellation' AND ${inRange('l.occurred_at')}`,
      range
    ),
    reader.getAll<{ payment_method_id: string; label: string | null; amount: number }>(
      `SELECT p.payment_method_id, pm.label, p.amount FROM payments p
         LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
        WHERE p.shop_id = ? AND ${inRange('p.occurred_at')}`,
      range
    ),
    reader.getAll<{ type: LedgerType; amount: number }>(
      `SELECT type, amount FROM customer_ledger WHERE shop_id = ? AND ${inRange('occurred_at')}`,
      range
    ),
    reader.getAll<{
      type: ReportInput['cashMovements'][number]['type'];
      category: string | null;
      amount: number;
    }>(
      `SELECT type, category, amount FROM cash_movements WHERE shop_id = ? AND ${inRange('occurred_at')}`,
      range
    ),
    reader.getAll<{ type: string; cost_amount: number }>(
      `SELECT type, cost_amount FROM stock_movements
        WHERE shop_id = ? AND type IN ('receipt', 'loss', 'adjustment') AND ${inRange('occurred_at')}`,
      range
    ),
    reader.getAll<{ difference_amount: number | null }>(
      `SELECT difference_amount FROM cash_sessions
        WHERE shop_id = ? AND status = 'closed' AND ${inRange('closed_at')}`,
      range
    ),
    reader.getAll<{
      product_id: string;
      product_name: string;
      base_unit: string | null;
      base_quantity: number;
      line_total: number;
      status: 'completed' | 'cancelled';
    }>(
      `SELECT i.product_id, i.product_name, p.base_unit, i.base_quantity, i.line_total, s.status
         FROM sale_items i
         JOIN sales s ON s.id = i.sale_id
         LEFT JOIN products p ON p.id = i.product_id
        WHERE s.shop_id = ? AND ${inRange('s.occurred_at')}`,
      range
    ),
    // Toutes les dettes (pas seulement la période) : la liste des débiteurs est celle d'aujourd'hui
    reader.getAll<{
      customer_id: string;
      name: string;
      type: LedgerType;
      amount: number;
      occurred_at: string;
    }>(
      `SELECT l.customer_id, c.name, l.type, l.amount, l.occurred_at
         FROM customer_ledger l JOIN customers c ON c.id = l.customer_id
        WHERE l.shop_id = ?`,
      [shopId]
    ),
    reader.getAll<{
      id: string;
      expiry_date: string | null;
      received_at: string;
      cost_price: number;
      cost_quantity: number;
      remaining: number;
    }>(
      `SELECT l.id, l.expiry_date, l.received_at, l.cost_price, l.cost_quantity,
              COALESCE((SELECT SUM(m.quantity) FROM stock_movements m WHERE m.lot_id = l.id), 0) AS remaining
         FROM stock_lots l WHERE l.shop_id = ?`,
      [shopId]
    ),
  ]);

  const byCustomer = new Map<
    string,
    { name: string; entries: { type: LedgerType; amount: number; occurredAt: string }[] }
  >();
  for (const row of ledgerAll) {
    const current = byCustomer.get(row.customer_id) ?? { name: row.name, entries: [] };
    current.entries.push({ type: row.type, amount: row.amount, occurredAt: row.occurred_at });
    byCustomer.set(row.customer_id, current);
  }
  const debtors = [...byCustomer.values()].map(({ name, entries }) => {
    const aging = debtAging(entries, today);
    return {
      name,
      balance: aging.balance,
      ageDays: aging.oldestUnpaidDay ? daysBetween(aging.oldestUnpaidDay, today) : 0,
    };
  });

  return {
    periodStart: start,
    periodEnd: end,
    sales: sales.map((sale) => ({
      status: sale.status,
      total: sale.total,
      discount: sale.discount_amount,
    })),
    saleMovements: saleMovements.map((movement) => ({
      type: movement.type,
      costAmount: movement.cost_amount,
      saleStatus: movement.status,
    })),
    refunds: refunds.map((refund) => ({ amount: refund.amount, saleStatus: refund.status })),
    debtReductions: debtReductions.map((row) => ({ amount: row.amount, saleStatus: row.status })),
    payments: payments.map((payment) => ({
      methodId: payment.payment_method_id,
      methodLabel: payment.label ?? '',
      amount: payment.amount,
    })),
    ledger,
    cashMovements,
    stockMovements: stockMovements.map((movement) => ({
      type: movement.type,
      costAmount: movement.cost_amount,
    })),
    closedSessions: closedSessions.map((session) => ({ difference: session.difference_amount })),
    soldItems: soldItems.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      baseUnit: item.base_unit ?? '',
      baseQuantity: item.base_quantity,
      lineTotal: item.line_total,
      saleStatus: item.status,
    })),
    debtors,
    stockValue: stockValue(
      lots.map((lot) => ({
        id: lot.id,
        expiryDate: lot.expiry_date,
        receivedAt: lot.received_at,
        costPrice: lot.cost_price,
        costQuantity: lot.cost_quantity,
        remaining: lot.remaining,
      }))
    ),
  };
}
