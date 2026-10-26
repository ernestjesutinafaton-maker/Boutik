import { useQuery } from '@powersync/react';

import { useShop } from '@/shop/shop-provider';

/** Une ligne du journal des actions : qui, quoi, quand, sur quel appareil. */
export type AuditEntry = {
  id: string;
  action: string;
  details: Record<string, unknown>;
  occurredAt: string;
  memberId: string | null;
  memberName: string | null;
  deviceNumber: number | null;
  entityType: string | null;
  entityId: string | null;
};

type AuditRow = {
  id: string;
  action: string;
  details: string | null;
  occurred_at: string;
  member_id: string | null;
  member_name: string | null;
  device_number: number | null;
  entity_type: string | null;
  entity_id: string | null;
};

function parseDetails(details: string | null): Record<string, unknown> {
  try {
    const value: unknown = details ? JSON.parse(details) : {};
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Le journal d'une période (moments universels, début inclus, fin exclue), le plus récent d'abord. */
export function useAuditLog(range: { start: string; end: string }): AuditEntry[] {
  const { shop } = useShop();
  const { data } = useQuery<AuditRow>(
    `SELECT a.id, a.action, a.details, a.occurred_at, a.member_id, m.display_name AS member_name,
            d.device_number, a.entity_type, a.entity_id
       FROM audit_log a
       LEFT JOIN shop_members m ON m.id = a.member_id
       LEFT JOIN devices d ON d.id = a.device_id
      WHERE a.shop_id = ? AND a.occurred_at >= ? AND a.occurred_at < ?
      ORDER BY a.occurred_at DESC`,
    [shop?.id ?? '', range.start, range.end]
  );
  return data.map((row) => ({
    id: row.id,
    action: row.action,
    details: parseDetails(row.details),
    occurredAt: row.occurred_at,
    memberId: row.member_id,
    memberName: row.member_name,
    deviceNumber: row.device_number,
    entityType: row.entity_type,
    entityId: row.entity_id,
  }));
}
