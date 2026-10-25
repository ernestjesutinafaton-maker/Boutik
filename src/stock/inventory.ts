import type { CommonPowerSyncDatabase } from '@powersync/common';
import { useQuery } from '@powersync/react';

import { type ActionContext, logAction } from '@/data/audit';
import { newId, nowIso } from '@/data/ids';
import { today } from '@/domain/dates';
import { adjustmentValue, inventoryDifference, planAdjustment } from '@/domain/inventory';
import { useShop } from '@/shop/shop-provider';

import { insertLot, insertMovement } from './movements';
import { loadLots } from './stock-data';

/**
 * L'inventaire : lecture et écritures.
 *
 * 1. Un responsable du stock lance un inventaire (statut « brouillon »).
 * 2. Les compteurs saisissent ce qu'ils comptent, produit par produit. Le compteur
 *    ne voit PAS le stock calculé (comptage « à l'aveugle », plus honnête).
 * 3. Le responsable valide : chaque écart devient un mouvement « ajustement ».
 *    Les produits non comptés ne changent pas (on peut compter un seul rayon).
 */

export type InventoryStatus = 'draft' | 'validated' | 'cancelled';

export type InventoryCount = {
  id: string;
  status: InventoryStatus;
  notes: string | null;
  startedAt: string;
  validatedAt: string | null;
  createdByName: string | null;
  lineCount: number;
};

type CountRow = {
  id: string;
  status: InventoryStatus;
  notes: string | null;
  started_at: string;
  validated_at: string | null;
  created_by_name: string | null;
  line_count: number;
};

const COUNT_SELECT = `
  SELECT c.id, c.status, c.notes, c.started_at, c.validated_at, m.display_name AS created_by_name,
         (SELECT COUNT(DISTINCT l.product_id) FROM inventory_lines l
           WHERE l.inventory_count_id = c.id) AS line_count
    FROM inventory_counts c
    LEFT JOIN shop_members m ON m.id = c.created_by`;

function toCount(row: CountRow): InventoryCount {
  return {
    id: row.id,
    status: row.status,
    notes: row.notes,
    startedAt: row.started_at,
    validatedAt: row.validated_at,
    createdByName: row.created_by_name,
    lineCount: row.line_count,
  };
}

/** Les inventaires de la boutique, les brouillons d'abord, puis du plus récent au plus ancien. */
export function useInventoryCounts(): InventoryCount[] {
  const { shop } = useShop();
  const { data } = useQuery<CountRow>(
    `${COUNT_SELECT}
      WHERE c.shop_id = ?
      ORDER BY CASE c.status WHEN 'draft' THEN 0 ELSE 1 END, c.started_at DESC`,
    [shop?.id ?? '']
  );
  return data.map(toCount);
}

export function useInventoryCount(countId: string): InventoryCount | null {
  const { data } = useQuery<CountRow>(`${COUNT_SELECT} WHERE c.id = ?`, [countId]);
  return data[0] ? toCount(data[0]) : null;
}

export type InventoryLine = {
  id: string;
  productId: string;
  expectedQuantity: number;
  countedQuantity: number;
  updatedAt: string;
};

type LineRow = {
  id: string;
  product_id: string;
  expected_quantity: number;
  counted_quantity: number;
  updated_at: string;
};

/**
 * Le dernier comptage de chaque produit (si deux appareils ont compté le même
 * produit, c'est la saisie la plus récente qui compte).
 */
const LATEST_LINES_SQL = `
  SELECT l.id, l.product_id, l.expected_quantity, l.counted_quantity, l.updated_at
    FROM inventory_lines l
   WHERE l.inventory_count_id = ?
     AND l.updated_at = (SELECT MAX(o.updated_at) FROM inventory_lines o
                          WHERE o.inventory_count_id = l.inventory_count_id
                            AND o.product_id = l.product_id)`;

function toLine(row: LineRow): InventoryLine {
  return {
    id: row.id,
    productId: row.product_id,
    expectedQuantity: row.expected_quantity,
    countedQuantity: row.counted_quantity,
    updatedAt: row.updated_at,
  };
}

/** Les comptages d'un inventaire, par produit. */
export function useInventoryLines(countId: string): Map<string, InventoryLine> {
  const { data } = useQuery<LineRow>(LATEST_LINES_SQL, [countId]);
  return new Map(data.map((row) => [row.product_id, toLine(row)]));
}

/** Lance un nouvel inventaire. */
export async function startInventory(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  notes: string | null
): Promise<string> {
  const id = newId();
  const now = nowIso();
  await db.execute(
    `INSERT INTO inventory_counts
       (id, shop_id, status, notes, started_at, created_by, device_id, created_at, updated_at)
     VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
    [id, context.shopId, notes, now, context.memberId, context.deviceId, now, now]
  );
  return id;
}

/**
 * Enregistre ce qui a été compté pour un produit. Le stock calculé à cet instant
 * est gardé à côté : l'écart sera calculé par rapport à lui (les ventes faites
 * après le comptage sont déjà des mouvements, elles ne faussent rien).
 */
export async function saveCount(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  input: { countId: string; productId: string; countedQuantity: number }
): Promise<void> {
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    const stock = await tx.get<{ stock: number }>(
      'SELECT COALESCE(SUM(quantity), 0) AS stock FROM stock_movements WHERE product_id = ?',
      [input.productId]
    );
    const existing = await tx.getOptional<{ id: string }>(
      `SELECT id FROM inventory_lines WHERE inventory_count_id = ? AND product_id = ?
        ORDER BY updated_at DESC LIMIT 1`,
      [input.countId, input.productId]
    );
    if (existing) {
      await tx.execute(
        `UPDATE inventory_lines SET expected_quantity = ?, counted_quantity = ?, updated_at = ?
          WHERE id = ?`,
        [stock.stock, input.countedQuantity, now, existing.id]
      );
    } else {
      await tx.execute(
        `INSERT INTO inventory_lines
           (id, shop_id, inventory_count_id, product_id, expected_quantity, counted_quantity,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          context.shopId,
          input.countId,
          input.productId,
          stock.stock,
          input.countedQuantity,
          now,
          now,
        ]
      );
    }
  });
}

/**
 * Valide l'inventaire : chaque écart devient un mouvement « ajustement »
 * (retiré des lots en FEFO, ou ajouté dans un nouveau lot). Tout ou rien.
 * Renvoie la valeur totale des écarts au prix d'achat (négative = marchandise manquante).
 */
export async function validateInventory(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  countId: string
): Promise<number> {
  const now = nowIso();
  const day = today();
  let totalValue = 0;

  await db.writeTransaction(async (tx) => {
    const lines = (await tx.getAll<LineRow>(LATEST_LINES_SQL, [countId])).map(toLine);
    const summary: { productId: string; difference: number; value: number }[] = [];

    for (const line of lines) {
      const difference = inventoryDifference(line.expectedQuantity, line.countedQuantity);
      const lots = await loadLots(tx, line.productId);
      const plan = planAdjustment(lots, difference, day);
      if (plan.kind === 'remove') {
        for (const part of plan.allocations) {
          await insertMovement(tx, context, {
            productId: line.productId,
            lotId: part.lotId,
            type: 'adjustment',
            quantity: -part.quantity,
            costAmount: -part.costAmount,
            inventoryCountId: countId,
            occurredAt: now,
          });
        }
      } else if (plan.kind === 'add') {
        const lotId = await insertLot(tx, context, {
          productId: line.productId,
          receiptId: null,
          expiryDate: null,
          costPrice: plan.costPrice,
          costQuantity: plan.costQuantity,
          initialQuantity: plan.quantity,
          supplierName: null,
          receivedAt: now,
        });
        await insertMovement(tx, context, {
          productId: line.productId,
          lotId,
          type: 'adjustment',
          quantity: plan.quantity,
          costAmount: plan.costAmount,
          inventoryCountId: countId,
          occurredAt: now,
        });
      }
      const value = adjustmentValue(plan);
      totalValue += value;
      if (difference !== 0) {
        summary.push({ productId: line.productId, difference, value });
      }
    }

    await tx.execute(
      `UPDATE inventory_counts
          SET status = 'validated', validated_at = ?, validated_by = ?, updated_at = ?
        WHERE id = ?`,
      [now, context.memberId, now, countId]
    );
    await logAction(
      tx,
      context,
      'inventory.validate',
      { type: 'inventory_count', id: countId },
      {
        countedProducts: lines.length,
        differences: summary,
        totalValue,
      }
    );
  });
  return totalValue;
}

/** Abandonne un inventaire en cours (rien n'est corrigé). */
export async function cancelInventory(db: CommonPowerSyncDatabase, countId: string): Promise<void> {
  const now = nowIso();
  await db.execute(
    "UPDATE inventory_counts SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'draft'",
    [now, countId]
  );
}
