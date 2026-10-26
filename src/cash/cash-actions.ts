import type { CommonPowerSyncDatabase } from '@powersync/common';

import { type ActionContext, logAction, type WhenOptions } from '@/data/audit';
import { newId, nowIso } from '@/data/ids';
import { type CashMovementType, closingDifferences, expectedByMethod } from '@/domain/cash';
import { today } from '@/domain/dates';
import { buildReport, type ClosingData } from '@/domain/report';
import { loadReportInput } from '@/reports/report-input';
import { findOpenCashSession } from '@/sales/cash-session-data';
import { DeviceNotRegisteredError } from '@/sales/sale-actions';
import type { Reader } from '@/stock/stock-data';

/**
 * La caisse du jour : ouvrir (fond de caisse), noter les dépenses et sorties,
 * clôturer (compter l'argent, écarts, rapport archivé).
 */

export class CashSessionAlreadyOpenError extends Error {
  constructor() {
    super('Une caisse est déjà ouverte sur cet appareil.');
    this.name = 'CashSessionAlreadyOpenError';
  }
}

/** Ouvre la caisse de cet appareil, avec le fond de caisse (espèces de départ). */
export async function openCashSession(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  openingFloat: number
): Promise<string> {
  const deviceId = context.deviceId;
  if (!deviceId) {
    throw new DeviceNotRegisteredError();
  }
  const id = newId();
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    if (await findOpenCashSession(tx, deviceId)) {
      throw new CashSessionAlreadyOpenError();
    }
    await tx.execute(
      `INSERT INTO cash_sessions
         (id, shop_id, device_id, status, opening_float, opened_by, opened_at, created_at, updated_at)
       VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
      [id, context.shopId, deviceId, openingFloat, context.memberId, now, now, now]
    );
    await logAction(tx, context, 'cash.open', { type: 'cash_session', id }, { openingFloat });
  });
  return id;
}

/** Dépense, achat de marchandise payé par la caisse, retrait ou ajout d'argent. */
export async function recordCashMovement(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  input: {
    type: CashMovementType;
    category: string | null;
    methodId: string;
    amount: number;
    note: string | null;
  },
  options: WhenOptions = {}
): Promise<string> {
  const id = newId();
  const now = options.occurredAt ?? nowIso();
  await db.writeTransaction(async (tx) => {
    const session =
      context.deviceId && !options.occurredAt
        ? await findOpenCashSession(tx, context.deviceId)
        : null;
    await tx.execute(
      `INSERT INTO cash_movements
         (id, shop_id, cash_session_id, type, category, payment_method_id, amount, note,
          occurred_at, created_by, device_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        context.shopId,
        session?.id ?? null,
        input.type,
        input.type === 'expense' ? (input.category ?? 'other') : null,
        input.methodId,
        input.amount,
        input.note,
        now,
        context.memberId,
        context.deviceId,
        now,
      ]
    );
    await logAction(tx, context, 'cash.movement', { type: 'cash_movement', id }, { ...input }, now);
  });
  return id;
}

/** Les encaissements et sorties d'une caisse (pour calculer l'argent attendu). */
export async function loadSessionTotals(reader: Reader, sessionId: string) {
  const [payments, movements] = await Promise.all([
    reader.getAll<{ methodId: string; amount: number }>(
      `SELECT payment_method_id AS methodId, SUM(amount) AS amount FROM payments
        WHERE cash_session_id = ? GROUP BY payment_method_id`,
      [sessionId]
    ),
    reader.getAll<{ methodId: string; type: CashMovementType; amount: number }>(
      `SELECT payment_method_id AS methodId, type, SUM(amount) AS amount FROM cash_movements
        WHERE cash_session_id = ? GROUP BY payment_method_id, type`,
      [sessionId]
    ),
  ]);
  return { payments, movements };
}

/**
 * « Clôturer la journée » : on compte l'argent de chaque mode de paiement, les écarts
 * sont calculés, la caisse est fermée et la fiche du jour est archivée. Tout ou rien.
 * Renvoie l'identifiant du rapport archivé.
 */
export async function closeCashSession(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  input: {
    sessionId: string;
    /** Montant compté pour chaque mode de paiement */
    counted: Record<string, number>;
    methods: readonly { id: string; label: string; isCash: boolean }[];
    notes: string | null;
  }
): Promise<string> {
  const reportId = newId();
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    const session = await tx.get<{ opened_at: string; opening_float: number; status: string }>(
      'SELECT opened_at, opening_float, status FROM cash_sessions WHERE id = ?',
      [input.sessionId]
    );
    if (session.status !== 'open') {
      throw new Error('Cette caisse est déjà clôturée.');
    }
    const totals = await loadSessionTotals(tx, input.sessionId);
    const expected = expectedByMethod({
      openingFloat: session.opening_float,
      cashMethodId: input.methods.find((method) => method.isCash)?.id ?? null,
      payments: totals.payments,
      movements: totals.movements,
    });
    const differences = closingDifferences(expected, input.counted);
    const closing: ClosingData = {
      openingFloat: session.opening_float,
      methods: input.methods
        .filter(
          (method) => expected[method.id] !== undefined || input.counted[method.id] !== undefined
        )
        .map((method) => ({
          label: method.label,
          expected: expected[method.id] ?? 0,
          counted: input.counted[method.id] ?? 0,
          difference: differences.byMethod[method.id] ?? 0,
        })),
      totalDifference: differences.total,
    };

    await tx.execute(
      `UPDATE cash_sessions
          SET status = 'closed', expected_amounts = ?, counted_amounts = ?, difference_amount = ?,
              closed_by = ?, closed_at = ?, notes = ?, updated_at = ?
        WHERE id = ?`,
      [
        JSON.stringify(expected),
        JSON.stringify(input.counted),
        differences.total,
        context.memberId,
        now,
        input.notes,
        now,
        input.sessionId,
      ]
    );

    const report = buildReport(
      await loadReportInput(tx, context.shopId, session.opened_at, now, today())
    );
    await tx.execute(
      `INSERT INTO reports
         (id, shop_id, kind, period_start, period_end, data, notes, created_by, device_id, created_at)
       VALUES (?, ?, 'day_close', ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportId,
        context.shopId,
        session.opened_at,
        now,
        JSON.stringify({ ...report, closing }),
        input.notes,
        context.memberId,
        context.deviceId,
        now,
      ]
    );
    await logAction(
      tx,
      context,
      'cash.close',
      { type: 'cash_session', id: input.sessionId },
      {
        expected,
        counted: input.counted,
        difference: differences.total,
        reportId,
      }
    );
  });
  return reportId;
}
