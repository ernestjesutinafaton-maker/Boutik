import { useQuery } from '@powersync/react';

import { useShop } from '@/shop/shop-provider';

/** Lecture des ventes (base LOCALE, marche hors ligne). */

export type SaleStatus = 'completed' | 'cancelled';

export type SaleSummary = {
  id: string;
  invoiceNumber: string;
  status: SaleStatus;
  total: number;
  paid: number;
  due: number;
  occurredAt: string;
  customerName: string | null;
  sellerName: string | null;
};

type SaleSummaryRow = {
  id: string;
  invoice_number: string;
  status: SaleStatus;
  total: number;
  paid_amount: number;
  due_amount: number;
  occurred_at: string;
  customer_name: string | null;
  seller_name: string | null;
};

const SUMMARY_SELECT = `
  SELECT s.id, s.invoice_number, s.status, s.total, s.paid_amount, s.due_amount, s.occurred_at,
         c.name AS customer_name, m.display_name AS seller_name
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN shop_members m ON m.id = s.seller_id`;

function toSummary(row: SaleSummaryRow): SaleSummary {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    status: row.status,
    total: row.total,
    paid: row.paid_amount,
    due: row.due_amount,
    occurredAt: row.occurred_at,
    customerName: row.customer_name,
    sellerName: row.seller_name,
  };
}

/** Les ventes d'une période (moments universels : début inclus, fin exclue), les plus récentes d'abord. */
export function useSales(range: { start: string; end: string }): SaleSummary[] {
  const { shop } = useShop();
  const { data } = useQuery<SaleSummaryRow>(
    `${SUMMARY_SELECT}
      WHERE s.shop_id = ? AND s.occurred_at >= ? AND s.occurred_at < ?
      ORDER BY s.occurred_at DESC`,
    [shop?.id ?? '', range.start, range.end]
  );
  return data.map(toSummary);
}

/** Les ventes d'un client, les plus récentes d'abord. */
export function useCustomerSales(customerId: string): SaleSummary[] {
  const { data } = useQuery<SaleSummaryRow>(
    `${SUMMARY_SELECT} WHERE s.customer_id = ? ORDER BY s.occurred_at DESC LIMIT 100`,
    [customerId]
  );
  return data.map(toSummary);
}

export type SaleItem = {
  id: string;
  productId: string;
  productName: string;
  unitName: string;
  unitFactor: number;
  quantity: number;
  baseQuantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Quantité déjà reprise (retours), en millièmes d'unité de base */
  returnedQuantity: number;
};

export type SalePayment = {
  id: string;
  kind: 'sale' | 'refund' | 'repayment';
  methodLabel: string;
  amount: number;
  cashReceived: number | null;
  changeGiven: number | null;
  occurredAt: string;
};

export type SaleDetail = SaleSummary & {
  subtotal: number;
  discount: number;
  note: string | null;
  customerId: string | null;
  customerPhone: string | null;
  deviceNumber: number | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: SaleItem[];
  payments: SalePayment[];
};

type DetailRow = SaleSummaryRow & {
  subtotal: number;
  discount_amount: number;
  note: string | null;
  customer_id: string | null;
  customer_phone: string | null;
  device_number: number | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};

type ItemRow = {
  id: string;
  product_id: string;
  product_name: string;
  unit_name: string;
  unit_factor: number;
  quantity: number;
  base_quantity: number;
  unit_price: number;
  line_total: number;
  returned: number;
};

type PaymentRow = {
  id: string;
  kind: SalePayment['kind'];
  method_label: string | null;
  amount: number;
  cash_received: number | null;
  change_given: number | null;
  occurred_at: string;
};

/** Une vente complète : lignes, paiements, client, vendeur (pour la facture). */
export function useSale(saleId: string): { sale: SaleDetail | null; isLoading: boolean } {
  const { data: rows, isLoading } = useQuery<DetailRow>(
    `SELECT s.id, s.invoice_number, s.status, s.total, s.paid_amount, s.due_amount, s.occurred_at,
            c.name AS customer_name, m.display_name AS seller_name, s.subtotal, s.discount_amount,
            s.note, s.customer_id, c.phone AS customer_phone, d.device_number, s.cancelled_at,
            s.cancel_reason
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       LEFT JOIN shop_members m ON m.id = s.seller_id
       LEFT JOIN devices d ON d.id = s.device_id
      WHERE s.id = ?`,
    [saleId]
  );
  const { data: items } = useQuery<ItemRow>(
    `SELECT i.id, i.product_id, i.product_name, i.unit_name, i.unit_factor, i.quantity,
            i.base_quantity, i.unit_price, i.line_total,
            COALESCE((SELECT SUM(m.quantity) FROM stock_movements m
                       WHERE m.sale_item_id = i.id AND m.type = 'return'), 0) AS returned
       FROM sale_items i
      WHERE i.sale_id = ?
      ORDER BY i.created_at, i.id`,
    [saleId]
  );
  const { data: payments } = useQuery<PaymentRow>(
    `SELECT p.id, p.kind, pm.label AS method_label, p.amount, p.cash_received, p.change_given,
            p.occurred_at
       FROM payments p
       LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
      WHERE p.sale_id = ?
      ORDER BY p.occurred_at`,
    [saleId]
  );
  const row = rows[0];
  if (!row) {
    return { sale: null, isLoading };
  }
  return {
    isLoading,
    sale: {
      ...toSummary(row),
      subtotal: row.subtotal,
      discount: row.discount_amount,
      note: row.note,
      customerId: row.customer_id,
      customerPhone: row.customer_phone,
      deviceNumber: row.device_number,
      cancelledAt: row.cancelled_at,
      cancelReason: row.cancel_reason,
      items: items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        unitName: item.unit_name,
        unitFactor: item.unit_factor,
        quantity: item.quantity,
        baseQuantity: item.base_quantity,
        unitPrice: item.unit_price,
        lineTotal: item.line_total,
        returnedQuantity: item.returned,
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        kind: payment.kind,
        methodLabel: payment.method_label ?? '',
        amount: payment.amount,
        cashReceived: payment.cash_received,
        changeGiven: payment.change_given,
        occurredAt: payment.occurred_at,
      })),
    },
  };
}
