import type { Transaction } from '@powersync/common';
import { useQuery } from '@powersync/react';

import { fefoOrder, type LotBalance } from '@/domain/stock';

/** Lecture des lots et des mouvements de stock (base LOCALE, marche hors ligne). */

/** Ce qu'il faut pour lire la base : une transaction en cours, ou la base elle-même. */
export type Reader = Pick<Transaction, 'getAll'>;

export type ProductLot = LotBalance & { supplierName: string | null };

type LotRow = {
  id: string;
  expiry_date: string | null;
  received_at: string;
  cost_price: number;
  cost_quantity: number;
  supplier_name: string | null;
  remaining: number;
};

// Ce qui reste dans un lot = la somme de SES mouvements
const LOTS_SQL = `
  SELECT l.id, l.expiry_date, l.received_at, l.cost_price, l.cost_quantity, l.supplier_name,
         COALESCE((SELECT SUM(m.quantity) FROM stock_movements m WHERE m.lot_id = l.id), 0) AS remaining
    FROM stock_lots l
   WHERE l.product_id = ?`;

function toLot(row: LotRow): ProductLot {
  return {
    id: row.id,
    expiryDate: row.expiry_date ? row.expiry_date.slice(0, 10) : null,
    receivedAt: row.received_at,
    costPrice: row.cost_price,
    costQuantity: row.cost_quantity,
    supplierName: row.supplier_name,
    remaining: row.remaining,
  };
}

/** Tous les lots d'un produit (même vides), dans l'ordre de sortie FEFO. */
export function useProductLots(productId: string): ProductLot[] {
  const { data } = useQuery<LotRow>(LOTS_SQL, [productId]);
  return fefoOrder(data.map(toLot));
}

/** Les lots d'un produit, lus à l'intérieur d'une écriture (vente, perte…). */
export async function loadLots(reader: Reader, productId: string): Promise<ProductLot[]> {
  const rows = await reader.getAll<LotRow>(LOTS_SQL, [productId]);
  return rows.map(toLot);
}

export type MovementType =
  'receipt' | 'sale' | 'return' | 'loss' | 'adjustment' | 'transfer_in' | 'transfer_out';

export type MovementLine = {
  id: string;
  type: MovementType;
  quantity: number;
  costAmount: number;
  lossReason: string | null;
  note: string | null;
  occurredAt: string;
  memberName: string | null;
  invoiceNumber: string | null;
  supplierName: string | null;
};

type MovementRow = {
  id: string;
  type: MovementType;
  quantity: number;
  cost_amount: number;
  loss_reason: string | null;
  note: string | null;
  occurred_at: string;
  member_name: string | null;
  invoice_number: string | null;
  supplier_name: string | null;
};

/** Les derniers mouvements d'un produit (qui, quoi, quand). */
export function useProductMovements(productId: string, limit = 50): MovementLine[] {
  const { data } = useQuery<MovementRow>(
    `SELECT m.id, m.type, m.quantity, m.cost_amount, m.loss_reason, m.note, m.occurred_at,
            sm.display_name AS member_name, s.invoice_number, r.supplier_name
       FROM stock_movements m
       LEFT JOIN shop_members sm ON sm.id = m.created_by
       LEFT JOIN sales s ON s.id = m.sale_id
       LEFT JOIN stock_receipts r ON r.id = m.receipt_id
      WHERE m.product_id = ?
      ORDER BY m.occurred_at DESC
      LIMIT ?`,
    [productId, limit]
  );
  return data.map((row) => ({
    id: row.id,
    type: row.type,
    quantity: row.quantity,
    costAmount: row.cost_amount,
    lossReason: row.loss_reason,
    note: row.note,
    occurredAt: row.occurred_at,
    memberName: row.member_name,
    invoiceNumber: row.invoice_number,
    supplierName: row.supplier_name,
  }));
}
