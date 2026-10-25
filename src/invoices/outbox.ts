import type { CommonPowerSyncDatabase } from '@powersync/common';
import { useQuery } from '@powersync/react';

import { newId, nowIso } from '@/data/ids';

/**
 * La file « À envoyer » : factures et reçus à envoyer plus tard par WhatsApp
 * (pas de réseau, client pressé, numéro à demander…). Elle reste dans l'appareil.
 */

export type OutboxKind = 'invoice' | 'receipt' | 'reminder';

export type OutboxItem = {
  id: string;
  kind: OutboxKind;
  saleId: string | null;
  customerId: string | null;
  paymentId: string | null;
  label: string;
  createdAt: string;
};

type OutboxRow = {
  id: string;
  kind: OutboxKind;
  sale_id: string | null;
  customer_id: string | null;
  payment_id: string | null;
  label: string;
  created_at: string;
};

export function useOutbox(): OutboxItem[] {
  const { data } = useQuery<OutboxRow>(
    'SELECT id, kind, sale_id, customer_id, payment_id, label, created_at FROM local_outbox ORDER BY created_at'
  );
  return data.map((row) => ({
    id: row.id,
    kind: row.kind,
    saleId: row.sale_id,
    customerId: row.customer_id,
    paymentId: row.payment_id,
    label: row.label,
    createdAt: row.created_at,
  }));
}

/** Ajoute un envoi à faire plus tard (une seule fois par document). */
export async function addToOutbox(
  db: CommonPowerSyncDatabase,
  item: {
    shopId: string;
    kind: OutboxKind;
    saleId?: string | null;
    customerId?: string | null;
    paymentId?: string | null;
    label: string;
  }
): Promise<void> {
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `DELETE FROM local_outbox WHERE kind = ? AND COALESCE(sale_id, '') = ? AND COALESCE(payment_id, '') = ?
         AND COALESCE(customer_id, '') = ?`,
      [item.kind, item.saleId ?? '', item.paymentId ?? '', item.customerId ?? '']
    );
    await tx.execute(
      `INSERT INTO local_outbox (id, shop_id, kind, sale_id, customer_id, payment_id, label, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        item.shopId,
        item.kind,
        item.saleId ?? null,
        item.customerId ?? null,
        item.paymentId ?? null,
        item.label,
        nowIso(),
      ]
    );
  });
}

export async function removeFromOutbox(db: CommonPowerSyncDatabase, id: string): Promise<void> {
  await db.execute('DELETE FROM local_outbox WHERE id = ?', [id]);
}
