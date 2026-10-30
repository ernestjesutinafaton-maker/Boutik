import type { CommonPowerSyncDatabase, Transaction } from '@powersync/common';

import { type ActionContext, logAction } from '@/data/audit';
import { newId, nowIso } from '@/data/ids';
import type { CatalogProduct } from '@/domain/catalog';

import type { ProductValues, UnitValues } from './product-form-values';

/**
 * Écritures sur le catalogue (base LOCALE : marche hors ligne, part au serveur ensuite).
 * Rien n'est supprimé : un produit ou une unité retirés sont « archivés ».
 */

async function insertUnit(
  tx: Transaction,
  context: ActionContext,
  productId: string,
  unit: UnitValues,
  now: string
) {
  await tx.execute(
    `INSERT INTO product_units
       (id, shop_id, product_id, name, factor, sale_price, purchase_price, barcode, is_default,
        sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      context.shopId,
      productId,
      unit.name,
      unit.factor,
      unit.salePrice,
      unit.purchasePrice,
      unit.barcode,
      unit.isDefault ? 1 : 0,
      unit.sortOrder,
      now,
      now,
    ]
  );
}

/** Garde une nouvelle photo de côté : elle partira vers le serveur dès qu'internet sera là. */
async function queuePhoto(
  tx: Transaction,
  context: ActionContext,
  productId: string,
  photoBase64: string
) {
  // Une seule photo en attente par produit : la plus récente remplace l'ancienne
  await tx.execute('DELETE FROM local_photo_uploads WHERE product_id = ?', [productId]);
  await tx.execute(
    `INSERT INTO local_photo_uploads (id, shop_id, product_id, data, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [newId(), context.shopId, productId, photoBase64, nowIso()]
  );
}

/** Crée un produit avec ses unités (et sa photo, s'il y en a une). */
export async function createProduct(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  values: ProductValues,
  photoBase64: string | null
): Promise<string> {
  const productId = newId();
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO products
         (id, shop_id, category_id, name, barcode, base_unit, allow_decimal, low_stock_threshold,
          track_expiry, created_by, device_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productId,
        context.shopId,
        values.categoryId,
        values.name,
        values.barcode,
        values.baseUnit,
        values.allowDecimal ? 1 : 0,
        values.lowStockThreshold,
        values.trackExpiry ? 1 : 0,
        context.memberId,
        context.deviceId,
        now,
        now,
      ]
    );
    for (const unit of values.units) {
      await insertUnit(tx, context, productId, unit, now);
    }
    if (photoBase64) {
      await queuePhoto(tx, context, productId, photoBase64);
    }
    await logAction(
      tx,
      context,
      'product.create',
      { type: 'product', id: productId },
      {
        name: values.name,
        prices: values.units.map((unit) => ({ unit: unit.name, price: unit.salePrice })),
      }
    );
  });
  return productId;
}

/**
 * Modifie un produit. Les unités sont comparées une à une : ajoutées, modifiées,
 * ou archivées si elles ont été retirées. Un changement de prix est noté à part dans le journal.
 */
export async function updateProduct(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  product: CatalogProduct,
  values: ProductValues,
  photoBase64: string | null
): Promise<void> {
  const now = nowIso();
  const keptIds = new Set(values.units.map((unit) => unit.id).filter(Boolean));
  const priceChanges: { unit: string; before: number | null; after: number | null }[] = [];

  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE products
          SET category_id = ?, name = ?, barcode = ?, base_unit = ?, allow_decimal = ?,
              low_stock_threshold = ?, track_expiry = ?, updated_at = ?
        WHERE id = ?`,
      [
        values.categoryId,
        values.name,
        values.barcode,
        values.baseUnit,
        values.allowDecimal ? 1 : 0,
        values.lowStockThreshold,
        values.trackExpiry ? 1 : 0,
        now,
        product.id,
      ]
    );

    for (const unit of values.units) {
      const previous = unit.id ? product.units.find((candidate) => candidate.id === unit.id) : null;
      if (!previous) {
        await insertUnit(tx, context, product.id, unit, now);
        continue;
      }
      if (previous.salePrice !== unit.salePrice) {
        priceChanges.push({ unit: unit.name, before: previous.salePrice, after: unit.salePrice });
      }
      const changed =
        previous.name !== unit.name ||
        previous.factor !== unit.factor ||
        previous.salePrice !== unit.salePrice ||
        previous.purchasePrice !== unit.purchasePrice ||
        previous.barcode !== unit.barcode ||
        previous.isDefault !== unit.isDefault ||
        previous.sortOrder !== unit.sortOrder;
      if (changed) {
        await tx.execute(
          `UPDATE product_units
              SET name = ?, factor = ?, sale_price = ?, purchase_price = ?, barcode = ?,
                  is_default = ?, sort_order = ?, updated_at = ?
            WHERE id = ?`,
          [
            unit.name,
            unit.factor,
            unit.salePrice,
            unit.purchasePrice,
            unit.barcode,
            unit.isDefault ? 1 : 0,
            unit.sortOrder,
            now,
            previous.id,
          ]
        );
      }
    }

    // Unités retirées du formulaire : archivées (les anciennes ventes les gardent)
    for (const unit of product.units) {
      if (!keptIds.has(unit.id)) {
        await tx.execute('UPDATE product_units SET archived_at = ?, updated_at = ? WHERE id = ?', [
          now,
          now,
          unit.id,
        ]);
      }
    }

    if (photoBase64) {
      await queuePhoto(tx, context, product.id, photoBase64);
    }

    await logAction(
      tx,
      context,
      'product.update',
      { type: 'product', id: product.id },
      {
        before: { name: product.name, baseUnit: product.baseUnit, barcode: product.barcode },
        after: { name: values.name, baseUnit: values.baseUnit, barcode: values.barcode },
      }
    );
    if (priceChanges.length > 0) {
      await logAction(
        tx,
        context,
        'product.price_change',
        { type: 'product', id: product.id },
        { name: values.name, changes: priceChanges }
      );
    }
  });
}

/** Archive un produit (il disparaît du catalogue, mais reste dans l'historique). */
export async function archiveProduct(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  product: CatalogProduct
): Promise<void> {
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    await tx.execute('UPDATE products SET archived_at = ?, updated_at = ? WHERE id = ?', [
      now,
      now,
      product.id,
    ]);
    await logAction(
      tx,
      context,
      'product.archive',
      { type: 'product', id: product.id },
      {
        name: product.name,
        stock: product.stock,
      }
    );
  });
}

/** Ajoute un rayon (catégorie). */
export async function createCategory(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  name: string
): Promise<string> {
  const id = newId();
  const now = nowIso();
  await db.execute(
    `INSERT INTO categories (id, shop_id, name, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?)`,
    [id, context.shopId, name, now, now]
  );
  return id;
}
