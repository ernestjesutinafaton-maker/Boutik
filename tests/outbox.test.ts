import { describe, expect, it, vi } from 'vitest';

import { createLocalDb } from './local-db';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

const { addToOutbox, removeFromOutbox } = await import('@/invoices/outbox');

describe('File « À envoyer »', () => {
  it('garde chaque document une seule fois, puis le retire une fois envoyé', async () => {
    const db = createLocalDb();
    const invoice = {
      shopId: 'shop',
      kind: 'invoice' as const,
      saleId: 'sale-1',
      label: 'F1-000001',
    };
    await addToOutbox(db, invoice);
    await addToOutbox(db, invoice);
    await addToOutbox(db, { ...invoice, saleId: 'sale-2', label: 'F1-000002' });
    const items = db.query<{ id: string; label: string }>(
      'SELECT id, label FROM local_outbox ORDER BY label'
    );
    expect(items.map((item) => item.label)).toEqual(['F1-000001', 'F1-000002']);

    await removeFromOutbox(db, items[0].id);
    expect(db.query('SELECT label FROM local_outbox')).toEqual([{ label: 'F1-000002' }]);
  });
});
