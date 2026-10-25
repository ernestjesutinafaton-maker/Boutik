import type { CommonPowerSyncDatabase } from '@powersync/common';

import { type ActionContext, logAction } from '@/data/audit';
import { newId, nowIso } from '@/data/ids';
import { receiptLine } from '@/domain/stock';

import { insertLot, insertMovement } from './movements';

/** Une ligne de réception, telle que saisie (quantité et prix dans l'unité d'achat). */
export type ReceiptLineInput = {
  productId: string;
  productName: string;
  unitName: string;
  unitFactor: number;
  /** Quantité dans l'unité d'achat, en millièmes (10 sacs → 10000) */
  quantityInUnit: number;
  /** Prix d'achat d'UNE unité d'achat */
  unitCost: number;
  /** « 2026-12-31 », ou null */
  expiryDate: string | null;
};

/**
 * Réception de marchandise : un bon d'entrée, puis pour chaque ligne un LOT
 * (prix d'achat, péremption) et un MOUVEMENT d'entrée. Tout ou rien.
 */
export async function receiveStock(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  input: { supplierName: string | null; reference: string | null; lines: ReceiptLineInput[] }
): Promise<string> {
  const receiptId = newId();
  const now = nowIso();
  let totalCost = 0;

  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO stock_receipts
         (id, shop_id, supplier_name, reference, received_at, created_by, device_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        receiptId,
        context.shopId,
        input.supplierName,
        input.reference,
        now,
        context.memberId,
        context.deviceId,
        now,
      ]
    );

    for (const line of input.lines) {
      const values = receiptLine(line);
      totalCost += values.costAmount;
      const lotId = await insertLot(tx, context, {
        productId: line.productId,
        receiptId,
        expiryDate: line.expiryDate,
        costPrice: values.costPrice,
        costQuantity: values.costQuantity,
        initialQuantity: values.baseQuantity,
        supplierName: input.supplierName,
        receivedAt: now,
      });
      await insertMovement(tx, context, {
        productId: line.productId,
        lotId,
        type: 'receipt',
        quantity: values.baseQuantity,
        costAmount: values.costAmount,
        receiptId,
        occurredAt: now,
      });
    }

    await logAction(
      tx,
      context,
      'stock.receive',
      { type: 'stock_receipt', id: receiptId },
      {
        supplier: input.supplierName,
        lines: input.lines.map((line) => ({
          product: line.productName,
          unit: line.unitName,
          quantity: line.quantityInUnit,
          unitCost: line.unitCost,
          expiry: line.expiryDate,
        })),
        totalCost,
      }
    );
  });
  return receiptId;
}
