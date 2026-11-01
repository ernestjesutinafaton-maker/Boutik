import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

import { asUser, createTestDatabase, createUser } from './fake-supabase';

/**
 * Les livraisons : créées par la boutique, prises par UN livreur (premier arrivé, premier
 * servi), l'argent encaissé à la livraison (dette du client), sa remise à la caisse, et les
 * dépenses des livreurs avec la photo du reçu (stockage privé), remboursées une seule fois.
 */

const PAYMENT_METHODS =
  '[{"code":"cash","label":"Espèces","kind":"cash"},{"code":"momo","label":"MTN MoMo","kind":"mobile_money"}]';

type Change = { op: 'PUT' | 'PATCH'; table: string; id: string; data: Record<string, unknown> };

describe('Livraisons', () => {
  let db: PGlite;
  let owner: string;
  let seller: string;
  let courierA: string;
  let courierB: string;
  let cashier: string;
  let manager: string;
  let stockManager: string;
  let otherOwner: string;
  let shop: string;
  let otherShop: string;
  let sellerMember: string;
  let courierAMember: string;
  let courierBMember: string;
  let otherShopMember: string;
  let cashMethod: string;
  let momoMethod: string;
  let customer: string;
  let otherCustomer: string;
  let sale: string;
  /** La livraison du premier client, prise par le livreur A puis livrée */
  let delivery: string;
  /** Une dépense du livreur A */
  let expense: string;

  const send = (userId: string, changes: Change[]) =>
    asUser(db, userId, (tx) =>
      tx.query('select public.apply_changes($1::jsonb)', [JSON.stringify(changes)])
    );
  const now = () => new Date().toISOString();

  async function createShop(userId: string, name: string) {
    const result = await asUser(db, userId, (tx) =>
      tx.query<{ id: string }>("select public.create_shop($1, 'BJ', 'XOF', 'Awa', $2::jsonb) as id", [
        name,
        PAYMENT_METHODS,
      ])
    );
    return result.rows[0].id;
  }

  /** Un membre invité par le propriétaire, qui accepte avec son propre compte. */
  async function join(roles: string[], name: string) {
    const userId = await createUser(db);
    const invited = await asUser(db, owner, (tx) =>
      tx.query<{ member_id: string; invite_code: string }>(
        'select * from public.invite_team_member($1, $2, $3::text[], null)',
        [shop, name, roles]
      )
    );
    const { member_id: memberId, invite_code: code } = invited.rows[0];
    await asUser(db, userId, (tx) =>
      tx.query('select public.accept_team_invite($1, $2, null, null)', [code, name])
    );
    return { userId, memberId };
  }

  const newDelivery = (data: Record<string, unknown>): Change => ({
    op: 'PUT',
    table: 'deliveries',
    id: crypto.randomUUID(),
    data: {
      shop_id: shop,
      address: 'Cadjehoun, rue 12',
      landmark: 'Derrière la pharmacie',
      created_by: sellerMember,
      ...data,
    },
  });
  const patchDelivery = (id: string, data: Record<string, unknown>): Change => ({
    op: 'PATCH',
    table: 'deliveries',
    id,
    data: { ...data, updated_at: now() },
  });
  const deliveryRow = (id: string) =>
    db
      .query<{ status: string; assigned_to: string | null; address: string }>(
        'select status, assigned_to, address from public.deliveries where id = $1',
        [id]
      )
      .then((result) => result.rows[0]);
  const visibleCount = (userId: string, table: string) =>
    asUser(db, userId, (tx) =>
      tx.query<{ n: number }>(`select count(*)::int as n from public.${table}`)
    ).then((result) => result.rows[0].n);

  /** L'argent liquide encaissé par ce livreur, pas encore remis à la caisse. */
  const heldBy = (memberId: string) =>
    db
      .query<{ held: number }>(
        `select (coalesce((select sum(p.amount) from public.payments p
                             join public.payment_methods pm on pm.id = p.payment_method_id
                            where p.delivery_id is not null and p.cash_session_id is null
                              and p.created_by = $1 and pm.kind = 'cash'), 0)
               - coalesce((select sum(m.amount) from public.cash_movements m
                            where m.type = 'handover' and m.courier_id = $1), 0))::int as held`,
        [memberId]
      )
      .then((result) => result.rows[0].held);

  beforeAll(async () => {
    db = await createTestDatabase();
    owner = await createUser(db);
    otherOwner = await createUser(db);
    shop = await createShop(owner, 'Quincaillerie Awa');
    otherShop = await createShop(otherOwner, 'Chez Koffi');
    otherShopMember = (
      await db.query<{ id: string }>('select id from public.shop_members where shop_id = $1', [
        otherShop,
      ])
    ).rows[0].id;
    cashMethod = (
      await db.query<{ id: string }>(
        "select id from public.payment_methods where shop_id = $1 and kind = 'cash'",
        [shop]
      )
    ).rows[0].id;
    momoMethod = (
      await db.query<{ id: string }>(
        "select id from public.payment_methods where shop_id = $1 and kind = 'mobile_money'",
        [shop]
      )
    ).rows[0].id;

    ({ userId: seller, memberId: sellerMember } = await join(['seller'], 'Awa'));
    ({ userId: courierA, memberId: courierAMember } = await join(['delivery'], 'Koffi'));
    ({ userId: courierB, memberId: courierBMember } = await join(['delivery'], 'Codjo'));
    ({ userId: cashier } = await join(['cashier'], 'Rachida'));
    ({ userId: manager } = await join(['manager'], 'Moussa'));
    ({ userId: stockManager } = await join(['stock_manager'], 'Bio'));

    customer = (
      await db.query<{ id: string }>(
        "insert into public.customers (shop_id, name, phone) values ($1, 'Fatou', '+22997000001') returning id",
        [shop]
      )
    ).rows[0].id;
    otherCustomer = (
      await db.query<{ id: string }>(
        "insert into public.customers (shop_id, name) values ($1, 'Ibrahim') returning id",
        [shop]
      )
    ).rows[0].id;
    const device = crypto.randomUUID();
    await db.query(
      "insert into public.devices (id, shop_id, device_number, name, platform) values ($1, $2, 1, 'Tablette', 'android')",
      [device, shop]
    );
    // Une vente payée en partie : 15 000 F à encaisser à la livraison (dette du client)
    sale = (
      await db.query<{ id: string }>(
        `insert into public.sales (shop_id, device_id, invoice_number, invoice_seq, customer_id, seller_id,
           subtotal, total, paid_amount, due_amount)
         values ($1, $2, 'F1-000001', 1, $3, $4, 20000, 20000, 5000, 15000) returning id`,
        [shop, device, customer, sellerMember]
      )
    ).rows[0].id;
    await db.query(
      `insert into public.customer_ledger (shop_id, customer_id, type, amount, sale_id)
       values ($1, $2, 'debt', 15000, $3)`,
      [shop, customer, sale]
    );
  });

  it('le vendeur crée une livraison : toute l’équipe la voit, une autre boutique non', async () => {
    const change = newDelivery({ sale_id: sale, customer_id: customer, amount_to_collect: 15000 });
    delivery = change.id;
    await send(seller, [change]);
    expect(await deliveryRow(delivery)).toMatchObject({ status: 'pending', assigned_to: null });
    expect(await visibleCount(courierA, 'deliveries')).toBe(1);
    expect(await visibleCount(cashier, 'deliveries')).toBe(1);
    expect(await visibleCount(otherOwner, 'deliveries')).toBe(0);
  });

  it('création refusée : livreur, autre boutique, déjà « livrée », argent sans client', async () => {
    await expect(send(courierA, [newDelivery({})])).rejects.toThrow(/row-level security/);
    await expect(send(otherOwner, [newDelivery({ created_by: otherShopMember })])).rejects.toThrow(
      /row-level security/
    );
    await expect(
      send(seller, [newDelivery({ status: 'delivered', delivered_at: now(), assigned_to: courierAMember })])
    ).rejects.toThrow(/à faire/);
    await expect(send(seller, [newDelivery({ amount_to_collect: 1000 })])).rejects.toThrow(
      /check constraint/
    );
    await expect(send(seller, [newDelivery({ assigned_to: otherShopMember })])).rejects.toThrow(
      /Livreur inconnu/
    );
    await expect(send(seller, [newDelivery({ address: '   ' })])).rejects.toThrow(
      /check constraint/
    );
  });

  it('premier arrivé, premier servi : le second livreur est refusé', async () => {
    await send(courierA, [
      patchDelivery(delivery, {
        assigned_to: courierAMember,
        status: 'in_progress',
        started_at: now(),
      }),
    ]);
    await expect(
      send(courierB, [
        patchDelivery(delivery, {
          assigned_to: courierBMember,
          status: 'in_progress',
          started_at: now(),
        }),
      ])
    ).rejects.toThrow(/déjà prise/);
    expect(await deliveryRow(delivery)).toMatchObject({
      status: 'in_progress',
      assigned_to: courierAMember,
    });
  });

  it('le livreur ne change que l’état de SA livraison : ni adresse, ni montant, ni annulation', async () => {
    await expect(send(courierA, [patchDelivery(delivery, { address: 'Ailleurs' })])).rejects.toThrow(
      /que l'état/
    );
    await expect(
      send(courierA, [patchDelivery(delivery, { amount_to_collect: 1 })])
    ).rejects.toThrow(/que l'état/);
    await expect(
      send(courierA, [patchDelivery(delivery, { status: 'pending', assigned_to: courierBMember })])
    ).rejects.toThrow(/autre livreur/);
    await expect(
      send(courierA, [
        patchDelivery(delivery, { status: 'cancelled', cancelled_at: now(), cancel_reason: 'Non' }),
      ])
    ).rejects.toThrow(/que l'état/);
    expect((await deliveryRow(delivery)).address).toBe('Cadjehoun, rue 12');
  });

  it('le livreur encaisse et termine : la dette du client baisse, l’argent est « chez lui »', async () => {
    const payment = crypto.randomUUID();
    await send(courierA, [
      {
        op: 'PUT',
        table: 'payments',
        id: payment,
        data: {
          shop_id: shop,
          kind: 'repayment',
          delivery_id: delivery,
          customer_id: customer,
          payment_method_id: cashMethod,
          amount: 15000,
          // Tricherie : l'argent au nom d'un autre livreur. Le serveur remet le vrai nom.
          created_by: courierBMember,
        },
      },
      {
        op: 'PUT',
        table: 'customer_ledger',
        id: crypto.randomUUID(),
        data: {
          shop_id: shop,
          customer_id: customer,
          type: 'repayment',
          amount: -15000,
          payment_id: payment,
          created_by: courierAMember,
        },
      },
      patchDelivery(delivery, { status: 'delivered', delivered_at: now() }),
    ]);
    expect((await deliveryRow(delivery)).status).toBe('delivered');
    const balance = await db.query<{ balance: number }>(
      'select sum(amount)::int as balance from public.customer_ledger where customer_id = $1',
      [customer]
    );
    expect(balance.rows[0].balance).toBe(0);
    const stored = await db.query<{ created_by: string }>(
      'select created_by from public.payments where id = $1',
      [payment]
    );
    expect(stored.rows[0].created_by).toBe(courierAMember);
    expect(await heldBy(courierAMember)).toBe(15000);

    // Une livraison terminée ne bouge plus, même pour le livreur
    await expect(
      send(courierA, [patchDelivery(delivery, { status: 'in_progress', delivered_at: null })])
    ).rejects.toThrow(/terminée/);
  });

  it('l’argent d’une livraison : un remboursement du client de CETTE livraison', async () => {
    const payment = (data: Record<string, unknown>): Change => ({
      op: 'PUT',
      table: 'payments',
      id: crypto.randomUUID(),
      data: {
        shop_id: shop,
        delivery_id: delivery,
        payment_method_id: cashMethod,
        amount: 500,
        ...data,
      },
    });
    await expect(
      send(courierA, [payment({ kind: 'repayment', customer_id: otherCustomer })])
    ).rejects.toThrow(/client de cette livraison/);
    await expect(
      send(courierA, [payment({ kind: 'sale', sale_id: sale, customer_id: customer })])
    ).rejects.toThrow(/check constraint/);
  });

  it('la boutique réorganise et annule ; un livreur ne prend pas la livraison d’un autre', async () => {
    const change = newDelivery({ customer_id: otherCustomer, assigned_to: courierBMember });
    await send(seller, [change]);
    await expect(
      send(courierA, [
        patchDelivery(change.id, { assigned_to: courierAMember, status: 'in_progress', started_at: now() }),
      ])
    ).rejects.toThrow(/déjà prise/);
    // Le vendeur la donne au livreur A, puis l'annule
    await send(seller, [patchDelivery(change.id, { assigned_to: courierAMember })]);
    expect((await deliveryRow(change.id)).assigned_to).toBe(courierAMember);
    await send(seller, [
      patchDelivery(change.id, {
        status: 'cancelled',
        cancelled_at: now(),
        cancel_reason: 'Le client a changé d’avis',
      }),
    ]);
    await expect(
      send(courierA, [patchDelivery(change.id, { status: 'in_progress', started_at: now() })])
    ).rejects.toThrow(/annulée/);
    // Hors ligne, le livreur avait déjà encaissé : l'argent reçu reste enregistré
    const late = crypto.randomUUID();
    await send(courierA, [
      {
        op: 'PUT',
        table: 'payments',
        id: late,
        data: {
          shop_id: shop,
          kind: 'repayment',
          delivery_id: change.id,
          customer_id: otherCustomer,
          payment_method_id: momoMethod,
          amount: 500,
        },
      },
    ]);
    const kept = await db.query<{ amount: number }>(
      'select amount::int from public.payments where id = $1',
      [late]
    );
    expect(kept.rows[0].amount).toBe(500);
    expect((await deliveryRow(change.id)).status).toBe('cancelled');
  });

  it('un livreur rend une livraison (à tous) ou la marque « pas livrée » avec une raison', async () => {
    const change = newDelivery({ customer_id: otherCustomer });
    await send(seller, [change]);
    const take = patchDelivery(change.id, {
      assigned_to: courierAMember,
      status: 'in_progress',
      started_at: now(),
    });
    await send(courierA, [take]);
    await send(courierA, [patchDelivery(change.id, { status: 'pending', assigned_to: null })]);
    expect(await deliveryRow(change.id)).toMatchObject({ status: 'pending', assigned_to: null });

    await send(courierB, [
      patchDelivery(change.id, { assigned_to: courierBMember, status: 'in_progress', started_at: now() }),
    ]);
    await expect(send(courierB, [patchDelivery(change.id, { status: 'failed' })])).rejects.toThrow(
      /check constraint/
    );
    await send(courierB, [
      patchDelivery(change.id, { status: 'failed', failed_reason: 'Client absent' }),
    ]);
    expect((await deliveryRow(change.id)).status).toBe('failed');
  });

  it('dépenses : chacun déclare LES SIENNES, la photo dans SON dossier, en attente', async () => {
    const newExpense = (data: Record<string, unknown>): Change => ({
      op: 'PUT',
      table: 'delivery_expenses',
      id: crypto.randomUUID(),
      data: {
        shop_id: shop,
        courier_id: courierAMember,
        delivery_id: delivery,
        category: 'fuel',
        amount: 2000,
        created_by: courierAMember,
        ...data,
      },
    });
    const first = newExpense({ proof_path: `${shop}/${courierAMember}/essence.jpg` });
    expense = first.id;
    await send(courierA, [first]);

    await expect(
      send(courierA, [newExpense({ proof_path: `${shop}/${courierBMember}/x.jpg` })])
    ).rejects.toThrow(/check constraint/);
    await expect(
      send(courierA, [
        newExpense({ proof_path: `${shop}/${courierAMember}/../${courierBMember}/x.jpg` }),
      ])
    ).rejects.toThrow(/check constraint/);
    await expect(
      send(courierA, [
        newExpense({ courier_id: courierBMember, proof_path: `${shop}/${courierBMember}/x.jpg` }),
      ])
    ).rejects.toThrow(/row-level security/);
    await expect(
      send(courierA, [
        newExpense({
          proof_path: `${shop}/${courierAMember}/y.jpg`,
          status: 'reimbursed',
          reviewed_at: now(),
        }),
      ])
    ).rejects.toThrow(/décision/);
    await expect(
      send(courierA, [newExpense({ category: 'rent', proof_path: `${shop}/${courierAMember}/z.jpg` })])
    ).rejects.toThrow(/check constraint/);

    // Le livreur voit les siennes ; les autres membres « équipe » rien ; les responsables tout
    expect(await visibleCount(courierA, 'delivery_expenses')).toBe(1);
    expect(await visibleCount(courierB, 'delivery_expenses')).toBe(0);
    expect(await visibleCount(seller, 'delivery_expenses')).toBe(0);
    expect(await visibleCount(manager, 'delivery_expenses')).toBe(1);
    expect(await visibleCount(stockManager, 'delivery_expenses')).toBe(1);
    expect(await visibleCount(owner, 'delivery_expenses')).toBe(1);
    expect(await visibleCount(otherOwner, 'delivery_expenses')).toBe(0);
  });

  it('rembourser : une dépense de la caisse, au bon montant, une seule fois', async () => {
    const reimbursement = (expenseId: string, data: Record<string, unknown> = {}): Change => ({
      op: 'PUT',
      table: 'cash_movements',
      id: crypto.randomUUID(),
      data: {
        shop_id: shop,
        type: 'expense',
        category: 'fuel',
        payment_method_id: cashMethod,
        amount: 2000,
        delivery_expense_id: expenseId,
        ...data,
      },
    });
    const decide = (expenseId: string, data: Record<string, unknown>): Change => ({
      op: 'PATCH',
      table: 'delivery_expenses',
      id: expenseId,
      data: { reviewed_at: now(), updated_at: now(), ...data },
    });

    // Ni le livreur, ni la caissière (qui ne voit pas les dépenses), ni le responsable du stock
    await expect(send(courierA, [decide(expense, { status: 'reimbursed' })])).rejects.toThrow(
      /refusée/
    );
    await expect(send(cashier, [reimbursement(expense)])).rejects.toThrow(/inconnue/);
    await expect(send(stockManager, [reimbursement(expense)])).rejects.toThrow(
      /row-level security/
    );
    await expect(send(owner, [reimbursement(expense, { amount: 2500 })])).rejects.toThrow(/montant/);

    await send(owner, [reimbursement(expense), decide(expense, { status: 'reimbursed' })]);
    await expect(send(manager, [reimbursement(expense)])).rejects.toThrow(/duplicate key/);
    await expect(send(manager, [decide(expense, { status: 'rejected', review_note: 'Non' })])).rejects.toThrow(
      /déjà été/
    );

    // Une autre dépense, refusée avec une raison : elle ne se rembourse plus
    const second = crypto.randomUUID();
    await send(courierA, [
      {
        op: 'PUT',
        table: 'delivery_expenses',
        id: second,
        data: {
          shop_id: shop,
          courier_id: courierAMember,
          category: 'transport',
          amount: 1500,
          proof_path: `${shop}/${courierAMember}/zem.jpg`,
        },
      },
    ]);
    await expect(send(manager, [decide(second, { status: 'rejected' })])).rejects.toThrow(
      /check constraint/
    );
    await send(manager, [decide(second, { status: 'rejected', review_note: 'Reçu illisible' })]);
    await expect(
      send(owner, [reimbursement(second, { category: 'transport', amount: 1500 })])
    ).rejects.toThrow(/refusée/);
  });

  it('remise à la caisse : par la caissière ou les responsables, jamais par le livreur', async () => {
    const handover = (data: Record<string, unknown>): Change => ({
      op: 'PUT',
      table: 'cash_movements',
      id: crypto.randomUUID(),
      data: {
        shop_id: shop,
        type: 'handover',
        payment_method_id: cashMethod,
        amount: 10000,
        courier_id: courierAMember,
        ...data,
      },
    });
    await expect(send(courierA, [handover({})])).rejects.toThrow(/row-level security/);
    await expect(send(seller, [handover({})])).rejects.toThrow(/row-level security/);
    await expect(send(cashier, [handover({ courier_id: null })])).rejects.toThrow(
      /check constraint/
    );
    await expect(send(cashier, [handover({ courier_id: otherShopMember })])).rejects.toThrow(
      /Livreur inconnu/
    );

    await send(cashier, [handover({})]);
    expect(await heldBy(courierAMember)).toBe(5000);
    await send(manager, [handover({ amount: 5000 })]);
    expect(await heldBy(courierAMember)).toBe(0);
  });

  it('photos des reçus : stockage privé, chacun dans son dossier', async () => {
    const upload = (userId: string, name: string) =>
      asUser(db, userId, (tx) =>
        tx.query("insert into storage.objects (bucket_id, name) values ('delivery-proofs', $1)", [
          name,
        ])
      );
    const sees = (userId: string, name: string) =>
      asUser(db, userId, (tx) =>
        tx.query<{ n: number }>(
          "select count(*)::int as n from storage.objects where bucket_id = 'delivery-proofs' and name = $1",
          [name]
        )
      ).then((result) => result.rows[0].n === 1);

    const receipt = `${shop}/${courierAMember}/essence.jpg`;
    await upload(courierA, receipt);
    await expect(upload(courierA, `${shop}/${courierBMember}/faux.jpg`)).rejects.toThrow(
      /row-level security/
    );
    await expect(upload(otherOwner, `${shop}/${otherShopMember}/x.jpg`)).rejects.toThrow(
      /row-level security/
    );
    // Le propriétaire peut l'envoyer pour un livreur
    await upload(owner, `${shop}/${courierBMember}/pour-codjo.jpg`);

    expect(await sees(courierA, receipt)).toBe(true);
    expect(await sees(manager, receipt)).toBe(true);
    expect(await sees(owner, receipt)).toBe(true);
    expect(await sees(courierB, receipt)).toBe(false);
    expect(await sees(seller, receipt)).toBe(false);
    expect(await sees(otherOwner, receipt)).toBe(false);
  });

  it('« Effacer les données de test » efface aussi livraisons, dépenses et remises', async () => {
    await asUser(db, owner, (tx) =>
      tx.query("select public.reset_shop_data($1, 'EFFACER')", [shop])
    );
    for (const table of ['deliveries', 'delivery_expenses', 'cash_movements', 'payments', 'sales']) {
      const left = await db.query<{ n: number }>(
        `select count(*)::int as n from public.${table} where shop_id = $1`,
        [shop]
      );
      expect(left.rows[0].n, table).toBe(0);
    }
  });
});
