import type { Transaction } from '@powersync/common';

import type { ActionContext } from '@/data/audit';
import { newId } from '@/data/ids';

import type { MovementType } from './stock-data';

export type LossReason = 'expired' | 'broken' | 'stolen' | 'other';

export type NewMovement = {
  productId: string;
  lotId: string | null;
  type: MovementType;
  /** Millièmes d'unité de base : + entrée, − sortie */
  quantity: number;
  /** Valeur au prix d'achat, du même signe que la quantité */
  costAmount: number;
  occurredAt: string;
  lossReason?: LossReason | null;
  receiptId?: string | null;
  saleId?: string | null;
  saleItemId?: string | null;
  inventoryCountId?: string | null;
  note?: string | null;
};

/**
 * Enregistre un mouvement de stock (entrée ou sortie). C'est la SEULE façon
 * de changer le stock : il n'est jamais modifié directement.
 */
export async function insertMovement(
  tx: Transaction,
  context: ActionContext,
  movement: NewMovement
): Promise<void> {
  await tx.execute(
    `INSERT INTO stock_movements
       (id, shop_id, product_id, lot_id, type, quantity, cost_amount, loss_reason, receipt_id,
        sale_id, sale_item_id, inventory_count_id, note, occurred_at, created_by, device_id,
        created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      context.shopId,
      movement.productId,
      movement.lotId,
      movement.type,
      movement.quantity,
      movement.costAmount,
      movement.lossReason ?? null,
      movement.receiptId ?? null,
      movement.saleId ?? null,
      movement.saleItemId ?? null,
      movement.inventoryCountId ?? null,
      movement.note ?? null,
      movement.occurredAt,
      context.memberId,
      context.deviceId,
      movement.occurredAt,
    ]
  );
}

/** Crée un lot (chaque entrée de stock en crée un, avec son prix d'achat et sa péremption). */
export async function insertLot(
  tx: Transaction,
  context: ActionContext,
  lot: {
    productId: string;
    receiptId: string | null;
    expiryDate: string | null;
    costPrice: number;
    costQuantity: number;
    initialQuantity: number;
    supplierName: string | null;
    receivedAt: string;
  }
): Promise<string> {
  const lotId = newId();
  await tx.execute(
    `INSERT INTO stock_lots
       (id, shop_id, product_id, receipt_id, expiry_date, cost_price, cost_quantity,
        initial_quantity, supplier_name, received_at, created_by, device_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      lotId,
      context.shopId,
      lot.productId,
      lot.receiptId,
      lot.expiryDate,
      lot.costPrice,
      lot.costQuantity,
      lot.initialQuantity,
      lot.supplierName,
      lot.receivedAt,
      context.memberId,
      context.deviceId,
      lot.receivedAt,
      lot.receivedAt,
    ]
  );
  return lotId;
}
