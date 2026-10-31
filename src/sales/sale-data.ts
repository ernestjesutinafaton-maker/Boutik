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
  sellerId: string | null;
  /** Vrai si cette vente a été modifiée (une vente corrigée la remplace) */
  replaced: boolean;
  /** Vrai si cette vente est la version corrigée d'une autre */
  corrected: boolean;
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
  seller_id: string | null;
  replaced: number;
  corrected: number;
};

const SUMMARY_SELECT = `
  SELECT s.id, s.invoice_number, s.status, s.total, s.paid_amount, s.due_amount, s.occurred_at,
         c.name AS customer_name, m.display_name AS seller_name, s.seller_id,
         EXISTS (SELECT 1 FROM sales r WHERE r.replaces_sale_id = s.id) AS replaced,
         s.replaces_sale_id IS NOT NULL AS corrected
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
    sellerId: row.seller_id,
    replaced: row.replaced === 1,
    corrected: row.corrected === 1,
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

/** La dernière vente faite sur cet appareil (raccourci « Dernière vente » de la caisse). */
export function useLastSale(deviceId: string | null): SaleSummary | null {
  const { data } = useQuery<SaleSummaryRow>(
    `${SUMMARY_SELECT}
      WHERE s.device_id = ? AND s.status = 'completed'
      ORDER BY s.occurred_at DESC LIMIT 1`,
    [deviceId ?? '']
  );
  return data[0] ? toSummary(data[0]) : null;
}

export type SaleItem = {
  id: string;
  productId: string;
  /** L'unité de vente (pour remettre la ligne dans le panier si on modifie la vente) */
  unitId: string;
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
  methodId: string;
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
  /** La vente modifiée que celle-ci remplace */
  replaces: { id: string; invoiceNumber: string } | null;
  /** La vente corrigée qui remplace celle-ci (si elle a été modifiée) */
  replacedBy: { id: string; invoiceNumber: string } | null;
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
  replaces_id: string | null;
  replaces_number: string | null;
  replaced_by_id: string | null;
  replaced_by_number: string | null;
};

type ItemRow = {
  id: string;
  product_id: string;
  product_unit_id: string;
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
  payment_method_id: string;
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
            c.name AS customer_name, m.display_name AS seller_name, s.seller_id, s.subtotal,
            s.discount_amount, s.note, s.customer_id, c.phone AS customer_phone, d.device_number,
            s.cancelled_at, s.cancel_reason,
            EXISTS (SELECT 1 FROM sales r WHERE r.replaces_sale_id = s.id) AS replaced,
            s.replaces_sale_id IS NOT NULL AS corrected,
            o.id AS replaces_id, o.invoice_number AS replaces_number,
            (SELECT r.id FROM sales r WHERE r.replaces_sale_id = s.id LIMIT 1) AS replaced_by_id,
            (SELECT r.invoice_number FROM sales r WHERE r.replaces_sale_id = s.id LIMIT 1)
              AS replaced_by_number
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       LEFT JOIN shop_members m ON m.id = s.seller_id
       LEFT JOIN devices d ON d.id = s.device_id
       LEFT JOIN sales o ON o.id = s.replaces_sale_id
      WHERE s.id = ?`,
    [saleId]
  );
  const { data: items, isLoading: itemsLoading } = useQuery<ItemRow>(
    `SELECT i.id, i.product_id, i.product_unit_id, i.product_name, i.unit_name, i.unit_factor,
            i.quantity,
            i.base_quantity, i.unit_price, i.line_total,
            COALESCE((SELECT SUM(m.quantity) FROM stock_movements m
                       WHERE m.sale_item_id = i.id AND m.type = 'return'), 0) AS returned
       FROM sale_items i
      WHERE i.sale_id = ?
      ORDER BY i.created_at, i.id`,
    [saleId]
  );
  const { data: payments, isLoading: paymentsLoading } = useQuery<PaymentRow>(
    `SELECT p.id, p.kind, p.payment_method_id, pm.label AS method_label, p.amount,
            p.cash_received, p.change_given,
            p.occurred_at
       FROM payments p
       LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
      WHERE p.sale_id = ?
      ORDER BY p.occurred_at`,
    [saleId]
  );
  const row = rows[0];
  if (!row) {
    return { sale: null, isLoading: isLoading || itemsLoading || paymentsLoading };
  }
  return {
    isLoading: isLoading || itemsLoading || paymentsLoading,
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
      replaces:
        row.replaces_id && row.replaces_number
          ? { id: row.replaces_id, invoiceNumber: row.replaces_number }
          : null,
      replacedBy:
        row.replaced_by_id && row.replaced_by_number
          ? { id: row.replaced_by_id, invoiceNumber: row.replaced_by_number }
          : null,
      items: items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        unitId: item.product_unit_id,
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
        methodId: payment.payment_method_id,
        methodLabel: payment.method_label ?? '',
        amount: payment.amount,
        cashReceived: payment.cash_received,
        changeGiven: payment.change_given,
        occurredAt: payment.occurred_at,
      })),
    },
  };
}
