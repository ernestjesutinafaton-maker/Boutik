import { describe, expect, it, vi } from 'vitest';

import { createLocalDb } from './local-db';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

const { deleteCustomer } = await import('@/customers/customer-actions');

/** Supprimer un client : sa dette est effacée (et notée), puis il est archivé. */

const context = { shopId: 'shop-1', memberId: 'owner', deviceId: 'device-1' };

describe('Supprimer un client', () => {
  it('efface sa dette, l’archive et le note au journal', async () => {
    const db = createLocalDb();
    await db.execute("INSERT INTO customers (id, shop_id, name) VALUES ('c1', 'shop-1', 'Test')");
    await db.execute(
      "INSERT INTO customer_ledger (id, shop_id, customer_id, type, amount, occurred_at) VALUES ('l1', 'shop-1', 'c1', 'debt', 5000, '2026-10-01')"
    );

    await deleteCustomer(db, context, { id: 'c1', name: 'Test' });

    const balance = db.query<{ total: number }>(
      "SELECT SUM(amount) AS total FROM customer_ledger WHERE customer_id = 'c1'"
    )[0];
    expect(balance.total).toBe(0);
    const customer = db.query<{ archived_at: string | null }>(
      "SELECT archived_at FROM customers WHERE id = 'c1'"
    )[0];
    expect(customer.archived_at).not.toBeNull();
    expect(
      db
        .query<{ action: string }>('SELECT action FROM audit_log ORDER BY created_at')
        .map((row) => row.action)
    ).toEqual(['credit.write_off', 'customer.update']);
  });

  it('sans dette : simplement archivé, rien n’est effacé', async () => {
    const db = createLocalDb();
    await db.execute("INSERT INTO customers (id, shop_id, name) VALUES ('c2', 'shop-1', 'Awa')");
    await deleteCustomer(db, context, { id: 'c2', name: 'Awa' });
    expect(db.query("SELECT id FROM customer_ledger WHERE customer_id = 'c2'")).toEqual([]);
  });
});
