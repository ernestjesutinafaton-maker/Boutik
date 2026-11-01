import type { CommonPowerSyncDatabase } from '@powersync/common';

import { recordRepayment } from '@/customers/customer-actions';
import type { Customer } from '@/customers/customer-data';
import { type ActionContext, logAction } from '@/data/audit';
import { newId, nowIso } from '@/data/ids';
import { type CourierExpenseCategory, receiptPath } from '@/domain/delivery';
import { findOpenCashSession } from '@/sales/cash-session-data';

/**
 * Les écritures des livraisons. Chacune est « tout ou rien » et notée dans le journal.
 * Le serveur vérifie les mêmes règles (qui peut faire quoi, premier arrivé premier servi).
 */

export type DeliveryInput = {
  saleId: string | null;
  customerId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  address: string;
  landmark: string | null;
  /** Date et heure souhaitées (ISO), ou null : dès que possible */
  requestedAt: string | null;
  amountToCollect: number;
  /** Le livreur, ou null : ouverte à tous les livreurs */
  assignedTo: string | null;
  note: string | null;
};

/** Crée une livraison (depuis une vente). Renvoie son identifiant. */
export async function createDelivery(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  input: DeliveryInput
): Promise<string> {
  const id = newId();
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO deliveries
         (id, shop_id, sale_id, customer_id, contact_name, contact_phone, address, landmark,
          requested_at, amount_to_collect, assigned_to, status, note, created_by, device_id,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [
        id,
        context.shopId,
        input.saleId,
        input.customerId,
        input.contactName,
        input.contactPhone,
        input.address,
        input.landmark,
        input.requestedAt,
        input.amountToCollect,
        input.assignedTo,
        input.note,
        context.memberId,
        context.deviceId,
        now,
        now,
      ]
    );
    await logAction(
      tx,
      context,
      'delivery.create',
      { type: 'delivery', id },
      {
        address: input.address,
        amountToCollect: input.amountToCollect,
        courier: input.assignedTo,
      }
    );
  });
  return id;
}

/** La boutique corrige une livraison (adresse, heure, livreur, montant…). */
export async function updateDelivery(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  deliveryId: string,
  input: Omit<DeliveryInput, 'saleId' | 'customerId'>
): Promise<void> {
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE deliveries
          SET contact_name = ?, contact_phone = ?, address = ?, landmark = ?, requested_at = ?,
              amount_to_collect = ?, assigned_to = ?, note = ?, updated_at = ?
        WHERE id = ?`,
      [
        input.contactName,
        input.contactPhone,
        input.address,
        input.landmark,
        input.requestedAt,
        input.amountToCollect,
        input.assignedTo,
        input.note,
        nowIso(),
        deliveryId,
      ]
    );
    await logAction(
      tx,
      context,
      'delivery.update',
      { type: 'delivery', id: deliveryId },
      {
        address: input.address,
        amountToCollect: input.amountToCollect,
        courier: input.assignedTo,
      }
    );
  });
}

/** La boutique confie la livraison à un livreur (ou la rend ouverte à tous : null). */
export async function assignDelivery(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  deliveryId: string,
  courierId: string | null
): Promise<void> {
  await db.writeTransaction(async (tx) => {
    // Une livraison en cours rendue « ouverte » redevient « à faire »
    await tx.execute(
      `UPDATE deliveries
          SET assigned_to = ?,
              status = CASE WHEN ? IS NULL AND status = 'in_progress' THEN 'pending' ELSE status END,
              updated_at = ?
        WHERE id = ?`,
      [courierId, courierId, nowIso(), deliveryId]
    );
    await logAction(
      tx,
      context,
      'delivery.update',
      { type: 'delivery', id: deliveryId },
      {
        courier: courierId,
      }
    );
  });
}

/** « Je m'en occupe » : le livreur prend la livraison à son nom. */
export async function takeDelivery(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  deliveryId: string
): Promise<void> {
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE deliveries SET assigned_to = ?, status = 'in_progress', started_at = ?, updated_at = ?
        WHERE id = ?`,
      [context.memberId, now, now, deliveryId]
    );
    await logAction(tx, context, 'delivery.take', { type: 'delivery', id: deliveryId });
  });
}

/** Le livreur ne peut pas la faire : elle redevient ouverte à tous les livreurs. */
export async function releaseDelivery(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  deliveryId: string
): Promise<void> {
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE deliveries SET assigned_to = NULL, status = 'pending', started_at = NULL, updated_at = ?
        WHERE id = ?`,
      [nowIso(), deliveryId]
    );
    await logAction(tx, context, 'delivery.release', { type: 'delivery', id: deliveryId });
  });
}

/** « Pas livrée » (client absent…), avec la raison : la boutique la replanifie. */
export async function failDelivery(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  deliveryId: string,
  reason: string
): Promise<void> {
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE deliveries SET status = 'failed', failed_reason = ?, updated_at = ? WHERE id = ?`,
      [reason, nowIso(), deliveryId]
    );
    await logAction(tx, context, 'delivery.fail', { type: 'delivery', id: deliveryId }, { reason });
  });
}

/** Une livraison « pas livrée » est replanifiée : elle redevient « à faire », même livreur. */
export async function replanDelivery(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  deliveryId: string
): Promise<void> {
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE deliveries SET status = 'pending', started_at = NULL, updated_at = ? WHERE id = ?`,
      [nowIso(), deliveryId]
    );
    await logAction(
      tx,
      context,
      'delivery.update',
      { type: 'delivery', id: deliveryId },
      {
        replanned: true,
      }
    );
  });
}

/** La boutique annule la livraison, avec la raison. */
export async function cancelDelivery(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  deliveryId: string,
  reason: string
): Promise<void> {
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE deliveries SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?, updated_at = ?
        WHERE id = ?`,
      [now, reason, now, deliveryId]
    );
    await logAction(
      tx,
      context,
      'delivery.cancel',
      { type: 'delivery', id: deliveryId },
      { reason }
    );
  });
}

/**
 * Livraison terminée. L'argent reçu du client est enregistré D'ABORD, dans sa propre écriture :
 * même si la boutique a annulé la livraison entre-temps (hors ligne), l'argent reste noté
 * (le serveur l'accepte toujours) et compte « chez le livreur ».
 */
export async function completeDelivery(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  input: {
    deliveryId: string;
    customer: Customer | null;
    /** Argent reçu (0 : rien) */
    amount: number;
    methodId: string | null;
  }
): Promise<void> {
  if (input.amount > 0) {
    if (!input.customer || !input.methodId) {
      throw new Error('Encaissement impossible : client ou mode de paiement manquant.');
    }
    await recordRepayment(db, context, {
      customer: input.customer,
      amount: input.amount,
      methodId: input.methodId,
      cashReceived: null,
      changeGiven: null,
      deliveryId: input.deliveryId,
    });
  }
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    // Terminée par la boutique alors que personne ne l'avait prise : elle est à son nom
    // (le serveur veut un livreur pour une livraison livrée)
    await tx.execute(
      `UPDATE deliveries
          SET status = 'delivered', delivered_at = ?, assigned_to = COALESCE(assigned_to, ?), updated_at = ?
        WHERE id = ?`,
      [now, context.memberId, now, input.deliveryId]
    );
    await logAction(
      tx,
      context,
      'delivery.complete',
      { type: 'delivery', id: input.deliveryId },
      {
        collected: input.amount,
      }
    );
  });
}

/**
 * Un livreur remet l'argent encaissé : il entre dans la caisse ouverte de cet appareil
 * (s'il y en a une) et ne compte plus « chez le livreur ».
 */
export async function recordHandover(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  input: { courierId: string; courierName: string; amount: number; methodId: string }
): Promise<void> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error('Montant invalide.');
  }
  const id = newId();
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    const session = context.deviceId ? await findOpenCashSession(tx, context.deviceId) : null;
    await tx.execute(
      `INSERT INTO cash_movements
         (id, shop_id, cash_session_id, type, payment_method_id, amount, courier_id, occurred_at,
          created_by, device_id, created_at)
       VALUES (?, ?, ?, 'handover', ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        context.shopId,
        session?.id ?? null,
        input.methodId,
        input.amount,
        input.courierId,
        now,
        context.memberId,
        context.deviceId,
        now,
      ]
    );
    await logAction(
      tx,
      context,
      'delivery.handover',
      { type: 'cash_movement', id },
      {
        courier: input.courierName,
        amount: input.amount,
      }
    );
  });
}

/**
 * Le livreur note une dépense avec la photo du reçu. La photo attend dans l'appareil et part
 * dès qu'internet est là (stockage privé, dans SON dossier). Renvoie l'identifiant.
 */
export async function declareExpense(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  input: {
    deliveryId: string | null;
    category: CourierExpenseCategory;
    amount: number;
    note: string | null;
    /** La photo du reçu, en base64 (JPEG) */
    photo: string;
  }
): Promise<string> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error('Montant invalide.');
  }
  const id = newId();
  const now = nowIso();
  const path = receiptPath(context.shopId, context.memberId, id);
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO delivery_expenses
         (id, shop_id, courier_id, delivery_id, category, amount, note, proof_path, status,
          occurred_at, created_by, device_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [
        id,
        context.shopId,
        context.memberId,
        input.deliveryId,
        input.category,
        input.amount,
        input.note,
        path,
        now,
        context.memberId,
        context.deviceId,
        now,
        now,
      ]
    );
    await tx.execute(
      'INSERT INTO local_proof_uploads (id, path, data, created_at) VALUES (?, ?, ?, ?)',
      [newId(), path, input.photo, now]
    );
    await logAction(
      tx,
      context,
      'delivery.expense',
      { type: 'delivery_expense', id },
      {
        category: input.category,
        amount: input.amount,
      }
    );
  });
  return id;
}

/**
 * Rembourser une dépense de livreur : c'est une dépense de la caisse (comptée dans le prochain
 * « compte »), une seule fois, au même montant et dans la même catégorie.
 */
export async function reimburseExpense(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  input: {
    expense: { id: string; amount: number; category: CourierExpenseCategory; courierName: string };
    methodId: string;
  }
): Promise<void> {
  const now = nowIso();
  const movementId = newId();
  await db.writeTransaction(async (tx) => {
    const session = context.deviceId ? await findOpenCashSession(tx, context.deviceId) : null;
    await tx.execute(
      `INSERT INTO cash_movements
         (id, shop_id, cash_session_id, type, category, payment_method_id, amount, note,
          delivery_expense_id, occurred_at, created_by, device_id, created_at)
       VALUES (?, ?, ?, 'expense', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        movementId,
        context.shopId,
        session?.id ?? null,
        input.expense.category,
        input.methodId,
        input.expense.amount,
        input.expense.courierName,
        input.expense.id,
        now,
        context.memberId,
        context.deviceId,
        now,
      ]
    );
    await tx.execute(
      `UPDATE delivery_expenses SET status = 'reimbursed', reviewed_by = ?, reviewed_at = ?, updated_at = ?
        WHERE id = ?`,
      [context.memberId, now, now, input.expense.id]
    );
    await logAction(
      tx,
      context,
      'delivery.expense_review',
      { type: 'delivery_expense', id: input.expense.id },
      { decision: 'reimbursed', amount: input.expense.amount, courier: input.expense.courierName }
    );
  });
}

/** Refuser une dépense, avec la raison (le livreur la voit). */
export async function rejectExpense(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  expenseId: string,
  reason: string
): Promise<void> {
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE delivery_expenses
          SET status = 'rejected', review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
        WHERE id = ?`,
      [reason, context.memberId, now, now, expenseId]
    );
    await logAction(
      tx,
      context,
      'delivery.expense_review',
      { type: 'delivery_expense', id: expenseId },
      { decision: 'rejected', reason }
    );
  });
}
