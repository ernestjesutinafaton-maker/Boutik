import { useQuery } from '@powersync/react';

import type { Reader } from '@/stock/stock-data';

/** La caisse du jour ouverte sur un appareil (une seule à la fois par appareil). */
export type OpenCashSession = {
  id: string;
  openingFloat: number;
  openedAt: string;
  openedBy: string;
  openedByName: string | null;
};

type SessionRow = {
  id: string;
  opening_float: number;
  opened_at: string;
  opened_by: string;
  opened_by_name: string | null;
};

const OPEN_SESSION_SQL = `
  SELECT s.id, s.opening_float, s.opened_at, s.opened_by, m.display_name AS opened_by_name
    FROM cash_sessions s
    LEFT JOIN shop_members m ON m.id = s.opened_by
   WHERE s.device_id = ? AND s.status = 'open'
   ORDER BY s.opened_at DESC
   LIMIT 1`;

function toSession(row: SessionRow): OpenCashSession {
  return {
    id: row.id,
    openingFloat: row.opening_float,
    openedAt: row.opened_at,
    openedBy: row.opened_by,
    openedByName: row.opened_by_name,
  };
}

/** La caisse ouverte de cet appareil (lue pendant une écriture : vente, remboursement…). */
export async function findOpenCashSession(
  reader: Reader,
  deviceId: string
): Promise<OpenCashSession | null> {
  const rows = await reader.getAll<SessionRow>(OPEN_SESSION_SQL, [deviceId]);
  return rows[0] ? toSession(rows[0]) : null;
}

/** La caisse ouverte de cet appareil, mise à jour en direct (null = caisse fermée). */
export function useOpenCashSession(deviceId: string | null): {
  session: OpenCashSession | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery<SessionRow>(OPEN_SESSION_SQL, [deviceId ?? '']);
  return { session: data[0] ? toSession(data[0]) : null, isLoading };
}
