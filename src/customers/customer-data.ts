import { useQuery } from '@powersync/react';

import type { LedgerEntry, LedgerType } from '@/domain/credit';
import { useShop } from '@/shop/shop-provider';

/** Lecture des clients et de leur carnet de dettes (base LOCALE, marche hors ligne). */

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  /** Plafond de crédit (null = pas de plafond) */
  creditLimit: number | null;
  notes: string | null;
  archived: boolean;
  /** Ce que le client doit = somme de son carnet */
  balance: number;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  credit_limit: number | null;
  notes: string | null;
  archived_at: string | null;
  balance: number;
};

const CUSTOMER_SELECT = `
  SELECT c.id, c.name, c.phone, c.credit_limit, c.notes, c.archived_at,
         COALESCE((SELECT SUM(l.amount) FROM customer_ledger l WHERE l.customer_id = c.id), 0)
           AS balance
    FROM customers c`;

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    creditLimit: row.credit_limit,
    notes: row.notes,
    archived: Boolean(row.archived_at),
    balance: row.balance,
  };
}

/** Les clients actifs, avec ce qu'ils doivent. */
export function useCustomers(): { customers: Customer[]; isLoading: boolean } {
  const { shop } = useShop();
  const { data, isLoading } = useQuery<CustomerRow>(
    `${CUSTOMER_SELECT}
      WHERE c.shop_id = ? AND c.archived_at IS NULL
      ORDER BY c.name COLLATE NOCASE`,
    [shop?.id ?? '']
  );
  return { customers: data.map(toCustomer), isLoading };
}

export function useCustomer(customerId: string | null): {
  customer: Customer | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery<CustomerRow>(`${CUSTOMER_SELECT} WHERE c.id = ?`, [
    customerId ?? '',
  ]);
  return { customer: data[0] ? toCustomer(data[0]) : null, isLoading };
}

export type LedgerLine = LedgerEntry & {
  id: string;
  note: string | null;
  memberName: string | null;
  invoiceNumber: string | null;
  saleId: string | null;
  paymentId: string | null;
  methodLabel: string | null;
};

type LedgerRow = {
  id: string;
  type: LedgerType;
  amount: number;
  occurred_at: string;
  note: string | null;
  member_name: string | null;
  invoice_number: string | null;
  sale_id: string | null;
  payment_id: string | null;
  method_label: string | null;
};

/** Le carnet d'un client, du plus récent au plus ancien. */
export function useCustomerLedger(customerId: string): LedgerLine[] {
  const { data } = useQuery<LedgerRow>(
    `SELECT l.id, l.type, l.amount, l.occurred_at, l.note, m.display_name AS member_name,
            s.invoice_number, l.sale_id, l.payment_id, pm.label AS method_label
       FROM customer_ledger l
       LEFT JOIN shop_members m ON m.id = l.created_by
       LEFT JOIN sales s ON s.id = l.sale_id
       LEFT JOIN payments p ON p.id = l.payment_id
       LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
      WHERE l.customer_id = ?
      ORDER BY l.occurred_at DESC`,
    [customerId]
  );
  return data.map((row) => ({
    id: row.id,
    type: row.type,
    amount: row.amount,
    occurredAt: row.occurred_at,
    note: row.note,
    memberName: row.member_name,
    invoiceNumber: row.invoice_number,
    saleId: row.sale_id,
    paymentId: row.payment_id,
    methodLabel: row.method_label,
  }));
}

type EntryRow = { customer_id: string; type: LedgerType; amount: number; occurred_at: string };

/** Toutes les lignes de carnet de la boutique, regroupées par client (pour l'ancienneté). */
export function useLedgerByCustomer(): Map<string, LedgerEntry[]> {
  const { shop } = useShop();
  const { data } = useQuery<EntryRow>(
    'SELECT customer_id, type, amount, occurred_at FROM customer_ledger WHERE shop_id = ?',
    [shop?.id ?? '']
  );
  const byCustomer = new Map<string, LedgerEntry[]>();
  for (const row of data) {
    const entries = byCustomer.get(row.customer_id) ?? [];
    entries.push({ type: row.type, amount: row.amount, occurredAt: row.occurred_at });
    byCustomer.set(row.customer_id, entries);
  }
  return byCustomer;
}
