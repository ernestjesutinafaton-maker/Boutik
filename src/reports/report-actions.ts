import type { CommonPowerSyncDatabase } from '@powersync/common';

import { type ActionContext, logAction } from '@/data/audit';
import { newId, nowIso } from '@/data/ids';
import { today } from '@/domain/dates';
import { buildReport } from '@/domain/report';
import type { Reader } from '@/stock/stock-data';

import { loadReportInput } from './report-input';

/** Le tout début (pour le premier compte de la boutique : tout depuis le début). */
const BEGINNING = '2000-01-01T00:00:00.000Z';

/** La fin du dernier « compte », ou null s'il n'y en a pas encore. */
export async function lastAccountEnd(reader: Reader, shopId: string): Promise<string | null> {
  const rows = await reader.getAll<{ period_end: string }>(
    `SELECT period_end FROM reports WHERE shop_id = ? AND kind = 'account'
      ORDER BY period_end DESC LIMIT 1`,
    [shopId]
  );
  return rows[0]?.period_end ?? null;
}

/**
 * « Faire un compte » : bilan complet depuis le compte précédent (N-1) jusqu'à maintenant (N).
 * La fiche est archivée. Renvoie l'identifiant du rapport.
 */
export async function makeAccount(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  notes: string | null
): Promise<string> {
  const reportId = newId();
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    // Le compte commence juste après la fin du précédent : rien n'est compté deux fois
    const previousEnd = await lastAccountEnd(tx, context.shopId);
    const start = previousEnd ? new Date(Date.parse(previousEnd) + 1).toISOString() : BEGINNING;
    const report = buildReport(await loadReportInput(tx, context.shopId, start, now, today()));
    await tx.execute(
      `INSERT INTO reports
         (id, shop_id, kind, period_start, period_end, data, notes, created_by, device_id, created_at)
       VALUES (?, ?, 'account', ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportId,
        context.shopId,
        start,
        now,
        JSON.stringify(report),
        notes,
        context.memberId,
        context.deviceId,
        now,
      ]
    );
    await logAction(
      tx,
      context,
      'report.account',
      { type: 'report', id: reportId },
      {
        periodStart: start,
        periodEnd: now,
        revenue: report.sales.revenue,
        netProfit: report.netProfit,
      }
    );
  });
  return reportId;
}
