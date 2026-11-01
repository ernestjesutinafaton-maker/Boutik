import { useQuery } from '@powersync/react';

import { type ReportData, withCostDefaults } from '@/domain/report';
import { useShop } from '@/shop/shop-provider';

/** Lecture des rapports archivés (base LOCALE). */

export type ReportKind = 'day_close' | 'account';

export type ArchivedReport = {
  id: string;
  kind: ReportKind;
  periodStart: string;
  periodEnd: string;
  notes: string | null;
  createdByName: string | null;
  data: ReportData;
  /** Faux pour une clôture faite par un membre « équipe » : ni coûts ni bénéfices dans la fiche */
  costsKnown: boolean;
};

type ReportRow = {
  id: string;
  kind: ReportKind;
  period_start: string;
  period_end: string;
  notes: string | null;
  created_by_name: string | null;
  data: string;
};

function toReport(row: ReportRow): ArchivedReport {
  const { data, costsKnown } = withCostDefaults(JSON.parse(row.data) as ReportData);
  return {
    id: row.id,
    kind: row.kind,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    notes: row.notes,
    createdByName: row.created_by_name,
    data,
    costsKnown,
  };
}

const REPORT_SELECT = `
  SELECT r.id, r.kind, r.period_start, r.period_end, r.notes, m.display_name AS created_by_name, r.data
    FROM reports r
    LEFT JOIN shop_members m ON m.id = r.created_by`;

/** Les rapports archivés (des genres demandés), du plus récent au plus ancien. */
export function useReports(kinds: readonly ReportKind[]): ArchivedReport[] {
  const { shop } = useShop();
  const { data } = useQuery<ReportRow>(
    `${REPORT_SELECT}
      WHERE r.shop_id = ? AND r.kind IN (${kinds.map(() => '?').join(', ') || "''"})
      ORDER BY r.period_end DESC`,
    [shop?.id ?? '', ...kinds]
  );
  return data.map(toReport);
}

export function useReport(reportId: string): ArchivedReport | null {
  const { data } = useQuery<ReportRow>(`${REPORT_SELECT} WHERE r.id = ?`, [reportId]);
  return data[0] ? toReport(data[0]) : null;
}

/** La fin du dernier « compte » (null = aucun compte fait pour l'instant). */
export function useLastAccountEnd(): string | null {
  const { shop } = useShop();
  const { data } = useQuery<{ period_end: string }>(
    `SELECT period_end FROM reports WHERE shop_id = ? AND kind = 'account'
      ORDER BY period_end DESC LIMIT 1`,
    [shop?.id ?? '']
  );
  return data[0]?.period_end ?? null;
}
