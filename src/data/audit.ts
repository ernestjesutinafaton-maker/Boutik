import type { Transaction } from '@powersync/common';

import { newId, nowIso } from './ids';

/**
 * Qui fait l'action, dans quelle boutique, sur quel appareil.
 * Chaque écriture dans la base porte ces informations.
 */
export type ActionContext = {
  shopId: string;
  /** La personne active (choisie avec son code PIN sur un appareil partagé) */
  memberId: string;
  /** L'appareil, s'il est déjà enregistré sur le serveur (sinon null) */
  deviceId: string | null;
};

/**
 * Options d'une écriture : « occurredAt » permet de dater une opération dans le passé
 * (données de démonstration). Par défaut : maintenant.
 */
export type WhenOptions = { occurredAt?: string };

/** Les actions sensibles notées dans le journal (qui, quoi, quand, sur quel appareil). */
export type AuditAction =
  | 'member.create'
  | 'member.update'
  | 'member.pin_change'
  | 'product.create'
  | 'product.update'
  | 'product.price_change'
  | 'product.archive'
  | 'stock.receive'
  | 'stock.loss'
  | 'stock.adjust'
  | 'inventory.validate'
  | 'sale.create'
  | 'sale.cancel'
  | 'sale.return'
  | 'sale.discount'
  | 'sale.expired_forced'
  | 'customer.create'
  | 'customer.update'
  | 'credit.repayment'
  | 'credit.manual_debt'
  | 'credit.write_off'
  | 'cash.open'
  | 'cash.close'
  | 'cash.movement'
  | 'report.account';

/**
 * Note une action dans le journal, DANS la même transaction que l'action elle-même :
 * soit tout est enregistré, soit rien.
 */
export async function logAction(
  tx: Transaction,
  context: ActionContext,
  action: AuditAction,
  entity: { type: string; id: string } | null,
  details: Record<string, unknown> = {},
  occurredAt?: string
): Promise<void> {
  const now = nowIso();
  await tx.execute(
    `INSERT INTO audit_log
       (id, shop_id, action, entity_type, entity_id, details, member_id, device_id, occurred_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      context.shopId,
      action,
      entity?.type ?? null,
      entity?.id ?? null,
      JSON.stringify(details),
      context.memberId,
      context.deviceId,
      occurredAt ?? now,
      now,
    ]
  );
}
