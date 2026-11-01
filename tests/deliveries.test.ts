import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLocalDb, type LocalTestDb } from './local-db';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

const {
  completeDelivery,
  createDelivery,
  declareExpense,
  recordHandover,
  reimburseExpense,
  rejectExpense,
  releaseDelivery,
  takeDelivery,
} = await import('@/deliveries/delivery-actions');
const { loadCourierBalances } = await import('@/deliveries/courier-money');
const { loadSessionTotals } = await import('@/cash/cash-actions');
const { expectedByMethod } = await import('@/domain/cash');

/**
 * Les livraisons dans l'appareil : du vendeur au livreur, l'argent encaissé « chez le livreur »,
 * sa remise à la caisse, et les dépenses du livreur remboursées comme une dépense de la caisse.
 */

const SHOP = 'shop-1';
const seller = { shopId: SHOP, memberId: 'awa', deviceId: 'tablette' };
const courier = { shopId: SHOP, memberId: 'koffi', deviceId: 'tel-koffi' };
const customer = {
  id: 'fatou',
  name: 'Fatou',
  phone: '+22997000001',
  creditLimit: null,
  notes: null,
  archived: false,
  balance: 15_000,
};
let db: LocalTestDb;

async function insert(table: string, row: Record<string, unknown>) {
  const columns = Object.keys(row);
  await db.execute(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    Object.values(row)
  );
}

beforeEach(async () => {
  db = createLocalDb();
  await insert('payment_methods', {
    id: 'cash',
    shop_id: SHOP,
    label: 'Espèces',
    kind: 'cash',
    active: 1,
  });
  await insert('payment_methods', {
    id: 'momo',
    shop_id: SHOP,
    label: 'MTN MoMo',
    kind: 'mobile_money',
    active: 1,
  });
  await insert('customers', { id: 'fatou', shop_id: SHOP, name: 'Fatou' });
  // La dette de la vente : 15 000 F à encaisser à la livraison
  await insert('customer_ledger', {
    id: 'dette',
    shop_id: SHOP,
    customer_id: 'fatou',
    type: 'debt',
    amount: 15_000,
    occurred_at: '2026-11-01T08:00:00.000Z',
  });
});

const newDelivery = (assignedTo: string | null = null) =>
  createDelivery(db, seller, {
    saleId: 'vente-1',
    customerId: 'fatou',
    contactName: 'Fatou',
    contactPhone: '+22997000001',
    address: 'Cadjehoun, rue 12',
    landmark: 'Derrière la pharmacie',
    requestedAt: null,
    amountToCollect: 15_000,
    assignedTo,
    note: null,
  });
const deliveryOf = (id: string) =>
  db.query<{ status: string; assigned_to: string | null; started_at: string | null }>(
    'SELECT status, assigned_to, started_at FROM deliveries WHERE id = ?',
    [id]
  )[0];

describe('Livraisons', () => {
  it('le livreur prend, livre et encaisse : la dette baisse, l’argent est « chez lui »', async () => {
    const id = await newDelivery();
    expect(deliveryOf(id)).toMatchObject({ status: 'pending', assigned_to: null });

    await takeDelivery(db, courier, id);
    expect(deliveryOf(id)).toMatchObject({ status: 'in_progress', assigned_to: 'koffi' });

    await completeDelivery(db, courier, {
      deliveryId: id,
      customer,
      amount: 15_000,
      methodId: 'cash',
    });
    expect(deliveryOf(id).status).toBe('delivered');
    const [payment] = db.query<{
      delivery_id: string;
      kind: string;
      cash_session_id: string | null;
    }>('SELECT delivery_id, kind, cash_session_id FROM payments');
    expect(payment).toEqual({ delivery_id: id, kind: 'repayment', cash_session_id: null });
    const [{ balance }] = db.query<{ balance: number }>(
      "SELECT SUM(amount) AS balance FROM customer_ledger WHERE customer_id = 'fatou'"
    );
    expect(balance).toBe(0);
    expect([...(await loadCourierBalances(db, SHOP))]).toEqual([['koffi', 15_000]]);
  });

  it('le Mobile Money arrive sur le numéro de la boutique : rien à remettre', async () => {
    const id = await newDelivery('koffi');
    await takeDelivery(db, courier, id);
    await completeDelivery(db, courier, {
      deliveryId: id,
      customer,
      amount: 15_000,
      methodId: 'momo',
    });
    expect((await loadCourierBalances(db, SHOP)).size).toBe(0);
  });

  it('la remise à la caisse : l’argent entre dans la caisse ouverte et n’est plus chez le livreur', async () => {
    const id = await newDelivery();
    await takeDelivery(db, courier, id);
    await completeDelivery(db, courier, {
      deliveryId: id,
      customer,
      amount: 15_000,
      methodId: 'cash',
    });
    await insert('cash_sessions', {
      id: 'caisse',
      shop_id: SHOP,
      device_id: 'tablette',
      status: 'open',
      opening_float: 5000,
      opened_by: 'awa',
      opened_at: '2026-11-01T07:00:00.000Z',
    });

    await recordHandover(db, seller, {
      courierId: 'koffi',
      courierName: 'Koffi',
      amount: 15_000,
      methodId: 'cash',
    });
    expect((await loadCourierBalances(db, SHOP)).size).toBe(0);
    const totals = await loadSessionTotals(db, 'caisse');
    const expected = expectedByMethod({
      openingFloat: 5000,
      cashMethodId: 'cash',
      payments: totals.payments,
      movements: totals.movements,
    });
    // Fond de caisse 5 000 + remise 15 000
    expect(expected.cash).toBe(20_000);
    await expect(
      recordHandover(db, seller, {
        courierId: 'koffi',
        courierName: 'Koffi',
        amount: 0,
        methodId: 'cash',
      })
    ).rejects.toThrow(/Montant/);
  });

  it('terminée par la boutique alors que personne ne l’avait prise : à son nom', async () => {
    const id = await newDelivery();
    await completeDelivery(db, seller, { deliveryId: id, customer, amount: 0, methodId: null });
    expect(deliveryOf(id)).toMatchObject({ status: 'delivered', assigned_to: 'awa' });
    expect(db.query('SELECT id FROM payments')).toHaveLength(0);
  });

  it('le livreur rend une livraison : elle redevient ouverte à tous', async () => {
    const id = await newDelivery();
    await takeDelivery(db, courier, id);
    await releaseDelivery(db, courier, id);
    expect(deliveryOf(id)).toEqual({ status: 'pending', assigned_to: null, started_at: null });
  });

  it('dépense du livreur : photo dans SON dossier, remboursée une fois comme dépense de la caisse', async () => {
    const id = await declareExpense(db, courier, {
      deliveryId: null,
      category: 'fuel',
      amount: 2000,
      note: 'Essence',
      photo: 'AAAA',
    });
    const [expense] = db.query<{ proof_path: string; status: string; courier_id: string }>(
      'SELECT proof_path, status, courier_id FROM delivery_expenses WHERE id = ?',
      [id]
    );
    expect(expense).toEqual({
      proof_path: `${SHOP}/koffi/${id}.jpg`,
      status: 'pending',
      courier_id: 'koffi',
    });
    // La photo attend dans le téléphone, avec le même chemin
    expect(db.query('SELECT path FROM local_proof_uploads')).toEqual([
      { path: expense.proof_path },
    ]);

    await reimburseExpense(db, seller, {
      expense: { id, amount: 2000, category: 'fuel', courierName: 'Koffi' },
      methodId: 'cash',
    });
    const [movement] = db.query<{
      type: string;
      category: string;
      amount: number;
      delivery_expense_id: string;
    }>('SELECT type, category, amount, delivery_expense_id FROM cash_movements');
    expect(movement).toEqual({
      type: 'expense',
      category: 'fuel',
      amount: 2000,
      delivery_expense_id: id,
    });
    expect(
      db.query<{ status: string }>('SELECT status FROM delivery_expenses WHERE id = ?', [id])[0]
        .status
    ).toBe('reimbursed');

    const refused = await declareExpense(db, courier, {
      deliveryId: null,
      category: 'transport',
      amount: 1500,
      note: null,
      photo: 'BBBB',
    });
    await rejectExpense(db, seller, refused, 'Reçu illisible');
    expect(
      db.query<{ status: string; review_note: string }>(
        'SELECT status, review_note FROM delivery_expenses WHERE id = ?',
        [refused]
      )[0]
    ).toEqual({ status: 'rejected', review_note: 'Reçu illisible' });
    await expect(
      declareExpense(db, courier, {
        deliveryId: null,
        category: 'fuel',
        amount: 0,
        note: null,
        photo: 'C',
      })
    ).rejects.toThrow(/Montant/);
  });
});
