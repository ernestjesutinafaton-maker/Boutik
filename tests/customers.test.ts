import { describe, expect, it, vi } from 'vitest';

import { createLocalDb } from './local-db';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

const { addOldDebt, createCustomer, recordRepayment, updateCustomer, writeOffDebt } =
  await import('@/customers/customer-actions');

/** Les clients et leur carnet de dettes, sur une vraie base SQLite. */

const context = { shopId: 'shop-1', memberId: 'owner', deviceId: 'device-1' };

describe('Clients et crédit', () => {
  it('dette ancienne, remboursement, dette effacée : le carnet garde tout', async () => {
    const db = createLocalDb();
    const values = { name: 'Awa', phone: '+2290197000000', creditLimit: null, notes: null };
    const id = await createCustomer(db, context, values);
    const customer = { id, ...values, archived: false, balance: 0 };

    await addOldDebt(db, context, { customer, amount: 15_000, day: '2026-07-01', note: 'Cahier' });
    await recordRepayment(db, context, {
      customer: { ...customer, balance: 15_000 },
      amount: 5000,
      methodId: 'cash',
      cashReceived: 10_000,
      changeGiven: 5000,
    });
    await writeOffDebt(db, context, {
      customer: { ...customer, balance: 10_000 },
      amount: 10_000,
      note: 'Parti du quartier',
    });

    const ledger = db.query<{ type: string; amount: number; occurred_at: string }>(
      'SELECT type, amount, occurred_at FROM customer_ledger ORDER BY occurred_at'
    );
    expect(ledger.map((entry) => [entry.type, entry.amount])).toEqual([
      ['adjustment', 15_000],
      ['repayment', -5000],
      ['write_off', -10_000],
    ]);
    // La dette ancienne garde sa vraie date
    expect(ledger[0].occurred_at.slice(0, 10)).toBe('2026-07-01');
    // Le remboursement est aussi un paiement (l'argent entre dans la caisse)
    expect(db.query('SELECT kind, amount, change_given FROM payments')).toEqual([
      { kind: 'repayment', amount: 5000, change_given: 5000 },
    ]);
    expect(
      db
        .query<{ action: string }>('SELECT action FROM audit_log ORDER BY occurred_at')
        .map((row) => row.action)
    ).toEqual(['customer.create', 'credit.manual_debt', 'credit.repayment', 'credit.write_off']);
  });

  it('modifier un client garde l’avant / après dans le journal', async () => {
    const db = createLocalDb();
    const values = { name: 'Koffi', phone: null, creditLimit: 20_000, notes: null };
    const id = await createCustomer(db, context, values);
    await updateCustomer(
      db,
      context,
      { id, ...values, archived: false, balance: 0 },
      {
        ...values,
        creditLimit: 50_000,
      }
    );
    expect(db.query('SELECT credit_limit FROM customers')).toEqual([{ credit_limit: 50_000 }]);
    const details = db.query<{ details: string }>(
      "SELECT details FROM audit_log WHERE action = 'customer.update'"
    )[0];
    expect(JSON.parse(details.details)).toMatchObject({
      before: { creditLimit: 20_000 },
      after: { creditLimit: 50_000 },
    });
  });
});
