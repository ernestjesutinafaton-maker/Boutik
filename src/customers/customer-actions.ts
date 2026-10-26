import type { CommonPowerSyncDatabase } from '@powersync/common';

import { type ActionContext, logAction, type WhenOptions } from '@/data/audit';
import { newId, nowIso } from '@/data/ids';
import { findOpenCashSession } from '@/sales/cash-session-data';

import type { Customer } from './customer-data';
import type { CustomerValues } from './customer-form-values';

/** Écritures sur les clients et leur carnet (base LOCALE, marche hors ligne). */

export async function createCustomer(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  values: CustomerValues
): Promise<string> {
  const id = newId();
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO customers
         (id, shop_id, name, phone, credit_limit, notes, created_by, device_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        context.shopId,
        values.name,
        values.phone,
        values.creditLimit,
        values.notes,
        context.memberId,
        context.deviceId,
        now,
        now,
      ]
    );
    await logAction(tx, context, 'customer.create', { type: 'customer', id }, { ...values });
  });
  return id;
}

export async function updateCustomer(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  customer: Customer,
  values: CustomerValues
): Promise<void> {
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE customers SET name = ?, phone = ?, credit_limit = ?, notes = ?, updated_at = ?
        WHERE id = ?`,
      [values.name, values.phone, values.creditLimit, values.notes, now, customer.id]
    );
    await logAction(
      tx,
      context,
      'customer.update',
      { type: 'customer', id: customer.id },
      {
        before: {
          name: customer.name,
          phone: customer.phone,
          creditLimit: customer.creditLimit,
        },
        after: values,
      }
    );
  });
}

/** Archive un client (il disparaît des listes ; son carnet reste dans l'historique). */
export async function archiveCustomer(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  customer: Customer
): Promise<void> {
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    await tx.execute('UPDATE customers SET archived_at = ?, updated_at = ? WHERE id = ?', [
      now,
      now,
      customer.id,
    ]);
    await logAction(
      tx,
      context,
      'customer.update',
      { type: 'customer', id: customer.id },
      { archived: true, balance: customer.balance }
    );
  });
}

/**
 * Remboursement (même partiel) : l'argent entre dans la caisse (paiement) et la dette
 * diminue (ligne négative dans le carnet). Renvoie l'identifiant du paiement (pour le reçu).
 */
export async function recordRepayment(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  input: {
    customer: Customer;
    amount: number;
    methodId: string;
    cashReceived: number | null;
    changeGiven: number | null;
  },
  options: WhenOptions = {}
): Promise<string> {
  const paymentId = newId();
  const now = options.occurredAt ?? nowIso();
  await db.writeTransaction(async (tx) => {
    const session =
      context.deviceId && !options.occurredAt
        ? await findOpenCashSession(tx, context.deviceId)
        : null;
    await tx.execute(
      `INSERT INTO payments
         (id, shop_id, kind, customer_id, payment_method_id, amount, cash_received, change_given,
          cash_session_id, occurred_at, created_by, device_id, created_at)
       VALUES (?, ?, 'repayment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId,
        context.shopId,
        input.customer.id,
        input.methodId,
        input.amount,
        input.cashReceived,
        input.changeGiven,
        session?.id ?? null,
        now,
        context.memberId,
        context.deviceId,
        now,
      ]
    );
    await tx.execute(
      `INSERT INTO customer_ledger
         (id, shop_id, customer_id, type, amount, payment_id, occurred_at, created_by, device_id,
          created_at)
       VALUES (?, ?, ?, 'repayment', ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        context.shopId,
        input.customer.id,
        -input.amount,
        paymentId,
        now,
        context.memberId,
        context.deviceId,
        now,
      ]
    );
    await logAction(
      tx,
      context,
      'credit.repayment',
      { type: 'customer', id: input.customer.id },
      {
        customer: input.customer.name,
        amount: input.amount,
        balanceBefore: input.customer.balance,
        balanceAfter: input.customer.balance - input.amount,
      },
      now
    );
  });
  return paymentId;
}

/**
 * Dette ancienne (d'avant Boutik, notée dans un cahier) : ajoutée au carnet
 * comme « ajustement », avec sa date réelle et une remarque.
 */
export async function addOldDebt(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  input: { customer: Customer; amount: number; day: string; note: string | null }
): Promise<void> {
  const now = nowIso();
  // Midi le jour indiqué : la date reste la bonne quel que soit le fuseau horaire
  const occurredAt = new Date(`${input.day}T12:00:00`).toISOString();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO customer_ledger
         (id, shop_id, customer_id, type, amount, note, occurred_at, created_by, device_id,
          created_at)
       VALUES (?, ?, ?, 'adjustment', ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        context.shopId,
        input.customer.id,
        input.amount,
        input.note,
        occurredAt,
        context.memberId,
        context.deviceId,
        now,
      ]
    );
    await logAction(
      tx,
      context,
      'credit.manual_debt',
      { type: 'customer', id: input.customer.id },
      { customer: input.customer.name, amount: input.amount, day: input.day, note: input.note }
    );
  });
}

/** Effacer une dette qui ne sera jamais payée (réservé au propriétaire, noté au journal). */
export async function writeOffDebt(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  input: { customer: Customer; amount: number; note: string | null }
): Promise<void> {
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO customer_ledger
         (id, shop_id, customer_id, type, amount, note, occurred_at, created_by, device_id,
          created_at)
       VALUES (?, ?, ?, 'write_off', ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        context.shopId,
        input.customer.id,
        -input.amount,
        input.note,
        now,
        context.memberId,
        context.deviceId,
        now,
      ]
    );
    await logAction(
      tx,
      context,
      'credit.write_off',
      { type: 'customer', id: input.customer.id },
      { customer: input.customer.name, amount: input.amount, note: input.note }
    );
  });
}
