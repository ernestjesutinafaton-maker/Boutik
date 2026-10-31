import type { CommonPowerSyncDatabase } from '@powersync/common';

import { type ActionContext, logAction } from '@/data/audit';
import { newId, nowIso } from '@/data/ids';

import type { SettingsValues } from './settings-values';
import type { ShopSettings } from './shop-settings';

/** Enregistre les paramètres de la boutique (noté au journal, avec l'avant / après). */
export async function updateShopSettings(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  before: ShopSettings,
  values: SettingsValues
): Promise<void> {
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE shops
          SET name = ?, phone = ?, address = ?, invoice_footer = ?, expiry_alert_days_first = ?,
              expiry_alert_days_second = ?, seller_max_discount_percent = ?,
              allow_sale_without_stock = ?, return_window_hours = ?, updated_at = ?
        WHERE id = ?`,
      [
        values.name,
        values.phone,
        values.address,
        values.invoiceFooter,
        values.expiryFirst,
        values.expirySecond,
        values.sellerMaxDiscount,
        values.allowSaleWithoutStock ? 1 : 0,
        values.returnWindowHours,
        now,
        context.shopId,
      ]
    );
    await logAction(
      tx,
      context,
      'settings.update',
      { type: 'shop', id: context.shopId },
      {
        before: {
          name: before.name,
          phone: before.phone,
          sellerMaxDiscount: before.sellerMaxDiscountPercent,
          allowSaleWithoutStock: before.allowSaleWithoutStock,
          returnWindowHours: before.returnWindowHours,
          expiry: before.expiryAlertDays,
        },
        after: values,
      }
    );
  });
}

export type PaymentMethodKind = 'cash' | 'mobile_money' | 'card' | 'other';

/** Ajoute un mode de paiement (ex. « Wave », « Carte bancaire »). */
export async function addPaymentMethod(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  input: { label: string; kind: PaymentMethodKind }
): Promise<string> {
  const id = newId();
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    const last = await tx.get<{ sort: number }>(
      'SELECT COALESCE(MAX(sort_order), 0) AS sort FROM payment_methods WHERE shop_id = ?',
      [context.shopId]
    );
    await tx.execute(
      `INSERT INTO payment_methods (id, shop_id, code, label, kind, sort_order, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        context.shopId,
        `custom_${id.slice(0, 8)}`,
        input.label,
        input.kind,
        last.sort + 1,
        now,
        now,
      ]
    );
    await logAction(
      tx,
      context,
      'payment_method.update',
      { type: 'payment_method', id },
      {
        added: input,
      }
    );
  });
  return id;
}

/** Renomme, active ou désactive un mode de paiement (jamais supprimé : l'historique le garde). */
export async function updatePaymentMethod(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  method: { id: string; label: string; active: boolean },
  changes: { label: string; active: boolean }
): Promise<void> {
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      'UPDATE payment_methods SET label = ?, active = ?, updated_at = ? WHERE id = ?',
      [changes.label, changes.active ? 1 : 0, now, method.id]
    );
    await logAction(
      tx,
      context,
      'payment_method.update',
      { type: 'payment_method', id: method.id },
      {
        before: { label: method.label, active: method.active },
        after: changes,
      }
    );
  });
}
