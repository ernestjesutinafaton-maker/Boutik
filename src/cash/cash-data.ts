import { useQuery } from '@powersync/react';

import type { CashMovementType } from '@/domain/cash';

/** Lecture de la caisse du jour (base LOCALE, mise à jour en direct). */

/** Les encaissements et sorties d'une caisse, regroupés par mode de paiement. */
export function useSessionTotals(sessionId: string | null): {
  payments: { methodId: string; amount: number }[];
  movements: { methodId: string; type: CashMovementType; amount: number }[];
} {
  const { data: payments } = useQuery<{ methodId: string; amount: number }>(
    `SELECT payment_method_id AS methodId, SUM(amount) AS amount FROM payments
      WHERE cash_session_id = ? GROUP BY payment_method_id`,
    [sessionId ?? '']
  );
  const { data: movements } = useQuery<{
    methodId: string;
    type: CashMovementType;
    amount: number;
  }>(
    `SELECT payment_method_id AS methodId, type, SUM(amount) AS amount FROM cash_movements
      WHERE cash_session_id = ? GROUP BY payment_method_id, type`,
    [sessionId ?? '']
  );
  return { payments, movements };
}

export type CashMovementLine = {
  id: string;
  type: CashMovementType;
  category: string | null;
  amount: number;
  note: string | null;
  occurredAt: string;
  methodLabel: string;
  memberName: string | null;
};

type MovementRow = {
  id: string;
  type: CashMovementType;
  category: string | null;
  amount: number;
  note: string | null;
  occurred_at: string;
  method_label: string | null;
  member_name: string | null;
};

/** Les dépenses et sorties d'une caisse, les plus récentes d'abord. */
export function useSessionMovements(sessionId: string | null): CashMovementLine[] {
  const { data } = useQuery<MovementRow>(
    `SELECT c.id, c.type, c.category, c.amount, c.note, c.occurred_at, pm.label AS method_label,
            m.display_name AS member_name
       FROM cash_movements c
       LEFT JOIN payment_methods pm ON pm.id = c.payment_method_id
       LEFT JOIN shop_members m ON m.id = c.created_by
      WHERE c.cash_session_id = ?
      ORDER BY c.occurred_at DESC`,
    [sessionId ?? '']
  );
  return data.map((row) => ({
    id: row.id,
    type: row.type,
    category: row.category,
    amount: row.amount,
    note: row.note,
    occurredAt: row.occurred_at,
    methodLabel: row.method_label ?? '',
    memberName: row.member_name,
  }));
}
