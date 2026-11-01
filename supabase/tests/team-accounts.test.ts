import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

import { asAnonymous, asUser, createTestDatabase, createUser } from './fake-supabase';

/**
 * Un compte personnel pour chaque membre de l'équipe : invitation par lien (rôles fixés par le
 * propriétaire), niveau d'accès calculé par le serveur, et ce qu'un membre « équipe » peut faire
 * — ou pas — depuis son propre téléphone.
 */

const PAYMENT_METHODS = '[{"code":"cash","label":"Espèces","kind":"cash"}]';
const PIN_HASH = 'ab'.repeat(32);
const PIN_SALT = 'cd'.repeat(16);

type Change = { op: 'PUT' | 'PATCH'; table: string; id: string; data: Record<string, unknown> };

describe('Comptes des membres de l’équipe', () => {
  let db: PGlite;
  let owner: string;
  let seller: string;
  let manager: string;
  let stranger: string;
  let otherOwner: string;
  let shop: string;
  let ownerMember: string;
  let sellerMember: string;
  let product: string;
  let lot: string;
  let sellerDevice: string;
  let sellerCode: string;

  const createShop = (userId: string, name: string) =>
    asUser(db, userId, (tx) =>
      tx.query<{ id: string }>(
        "select public.create_shop($1, 'BJ', 'XOF', 'Awa', $2::jsonb) as id",
        [name, PAYMENT_METHODS]
      )
    ).then((result) => result.rows[0].id);

  const invite = (roles: string[], name: string | null = null, userId = owner) =>
    asUser(db, userId, (tx) =>
      tx.query<{ member_id: string; invite_code: string }>(
        'select * from public.invite_team_member($1, $2, $3::text[], null)',
        [shop, name, roles]
      )
    ).then((result) => result.rows[0]);

  const readInvite = (code: string) =>
    asAnonymous(db, (tx) =>
      tx.query<{
        invite_status: string;
        shop_name: string | null;
        member_name: string | null;
        member_roles: string[] | null;
      }>('select * from public.get_team_invite($1)', [code])
    ).then((result) => result.rows[0]);

  const accept = (userId: string, code: string, name: string | null, withPin = true) =>
    asUser(db, userId, (tx) =>
      tx.query<{ shop_id: string }>('select public.accept_team_invite($1, $2, $3, $4) as shop_id', [
        code,
        name,
        withPin ? PIN_HASH : null,
        withPin ? PIN_SALT : null,
      ])
    ).then((result) => result.rows[0].shop_id);

  const send = (userId: string, changes: Change[]) =>
    asUser(db, userId, (tx) =>
      tx.query('select public.apply_changes($1::jsonb)', [JSON.stringify(changes)])
    );

  const member = (memberId: string) =>
    db
      .query<{
        user_id: string | null;
        display_name: string;
        access_level: string;
        pin_hash: string | null;
        active: boolean;
      }>(
        'select user_id, display_name, access_level, pin_hash, active from public.shop_members where id = $1',
        [memberId]
      )
      .then((result) => result.rows[0]);

  const membershipStatus = (userId: string) =>
    asUser(db, userId, (tx) =>
      tx.query<{ status: string }>('select public.my_membership_status() as status')
    ).then((result) => result.rows[0].status);

  /** Une vente du vendeur (créée directement dans la base, comme si elle était déjà synchronisée). */
  async function insertSale(sellerId: string, hoursAgo: number, seq: number) {
    const id = crypto.randomUUID();
    await db.query(
      `insert into public.sales (id, shop_id, device_id, invoice_number, invoice_seq, seller_id,
         subtotal, total, paid_amount, due_amount, occurred_at)
       values ($1, $2, $3, $4, $5, $6, 11000, 11000, 11000, 0, now() - make_interval(hours => $7))`,
      [id, shop, sellerDevice, `F2-${String(seq).padStart(6, '0')}`, seq, sellerId, hoursAgo]
    );
    return id;
  }

  beforeAll(async () => {
    db = await createTestDatabase();
    owner = await createUser(db);
    seller = await createUser(db);
    manager = await createUser(db);
    stranger = await createUser(db);
    otherOwner = await createUser(db);
    shop = await createShop(owner, 'Quincaillerie Awa');
    await createShop(otherOwner, 'Chez Koffi');
    ownerMember = (
      await db.query<{ id: string }>('select id from public.shop_members where user_id = $1', [
        owner,
      ])
    ).rows[0].id;

    product = (
      await db.query<{ id: string }>(
        "insert into public.products (shop_id, name, base_unit) values ($1, 'Ciment', 'sac') returning id",
        [shop]
      )
    ).rows[0].id;
    lot = (
      await db.query<{ id: string }>(
        `insert into public.stock_lots (shop_id, product_id, cost_price, cost_quantity, initial_quantity)
         values ($1, $2, 5000, 1000, 10000) returning id`,
        [shop, product]
      )
    ).rows[0].id;
    sellerDevice = crypto.randomUUID();
    await db.query(
      "insert into public.devices (id, shop_id, device_number, name, platform) values ($1, $2, 2, 'Tel Awa', 'android')",
      [sellerDevice, shop]
    );
  });

  it('le propriétaire invite : le lien montre la boutique et les rôles, sans être connecté', async () => {
    const invited = await invite(['seller']);
    sellerMember = invited.member_id;
    sellerCode = invited.invite_code;
    expect(sellerCode).toMatch(/^[0-9a-f]{64}$/);
    expect(await readInvite(sellerCode)).toEqual({
      invite_status: 'valid',
      shop_name: 'Quincaillerie Awa',
      member_name: 'Nouveau membre',
      member_roles: ['seller'],
      suggested_email: null,
    });
    expect((await readInvite('faux-code')).invite_status).toBe('unknown');

    await expect(invite(['seller'], null, stranger)).rejects.toThrow(/propriétaire/);
    await expect(invite(['owner'])).rejects.toThrow(/Rôle non permis/);
    await expect(invite([])).rejects.toThrow(/au moins un rôle/);
  });

  it('le vendeur accepte avec son compte (nom, code PIN) : niveau « équipe », lien à usage unique', async () => {
    expect(await accept(seller, sellerCode, 'Awa')).toBe(shop);
    expect(await member(sellerMember)).toMatchObject({
      user_id: seller,
      display_name: 'Awa',
      access_level: 'team',
      pin_hash: PIN_HASH,
      active: true,
    });
    expect((await readInvite(sellerCode)).invite_status).toBe('used');
    await expect(accept(stranger, sellerCode, null)).rejects.toThrow(/déjà servi/);
    expect(await membershipStatus(seller)).toBe('active');
    expect(await membershipStatus(stranger)).toBe('none');
  });

  it('le niveau d’accès suit les rôles, et un appareil ne peut pas le choisir', async () => {
    expect((await member(ownerMember)).access_level).toBe('owner');
    const invitedManager = await invite(['manager'], 'Koffi');
    await accept(manager, invitedManager.invite_code, null, false);
    expect((await member(invitedManager.member_id)).access_level).toBe('costs');

    // Le propriétaire donne puis retire le rôle de responsable du stock au vendeur
    const grant = crypto.randomUUID();
    await send(owner, [
      {
        op: 'PUT',
        table: 'shop_member_roles',
        id: grant,
        data: { shop_id: shop, member_id: sellerMember, role: 'stock_manager' },
      },
    ]);
    expect((await member(sellerMember)).access_level).toBe('costs');
    await send(owner, [
      {
        op: 'PATCH',
        table: 'shop_member_roles',
        id: grant,
        data: { revoked_at: new Date().toISOString() },
      },
    ]);
    expect((await member(sellerMember)).access_level).toBe('team');

    // Une valeur envoyée par un appareil est ignorée
    await send(owner, [
      { op: 'PATCH', table: 'shop_members', id: sellerMember, data: { access_level: 'owner' } },
    ]);
    expect((await member(sellerMember)).access_level).toBe('team');
  });

  it('le vendeur ne touche ni à ses rôles ni à sa fiche, mais change son nom et son code PIN', async () => {
    await expect(
      send(seller, [
        {
          op: 'PUT',
          table: 'shop_member_roles',
          id: crypto.randomUUID(),
          data: { shop_id: shop, member_id: sellerMember, role: 'manager' },
        },
      ])
    ).rejects.toThrow();
    await expect(
      send(seller, [
        {
          op: 'PATCH',
          table: 'shop_members',
          id: sellerMember,
          data: { display_name: 'Patronne' },
        },
      ])
    ).rejects.toThrow(/refusée/);

    await asUser(db, seller, (tx) =>
      tx.query('select public.update_my_member_profile($1, $2, $3)', [
        'Awa K.',
        'ef'.repeat(32),
        '01'.repeat(16),
      ])
    );
    expect(await member(sellerMember)).toMatchObject({
      display_name: 'Awa K.',
      pin_hash: 'ef'.repeat(32),
      access_level: 'team',
    });
  });

  it('une vente du vendeur : le serveur calcule le coût (son téléphone ne l’a pas)', async () => {
    const sale = crypto.randomUUID();
    const withLot = crypto.randomUUID();
    const withoutLot = crypto.randomUUID();
    await send(seller, [
      {
        op: 'PUT',
        table: 'sales',
        id: sale,
        data: {
          shop_id: shop,
          device_id: sellerDevice,
          invoice_number: 'F2-000099',
          invoice_seq: 99,
          seller_id: sellerMember,
          subtotal: 16500,
          total: 16500,
          paid_amount: 16500,
          due_amount: 0,
        },
      },
      {
        op: 'PUT',
        table: 'stock_movements',
        id: withLot,
        data: {
          shop_id: shop,
          product_id: product,
          lot_id: lot,
          type: 'sale',
          quantity: -2000,
          sale_id: sale,
          cost_amount: 0,
        },
      },
      {
        op: 'PUT',
        table: 'stock_movements',
        id: withoutLot,
        data: { shop_id: shop, product_id: product, type: 'sale', quantity: -1001, sale_id: sale },
      },
    ]);
    const costs = await db.query<{ id: string; cost_amount: string }>(
      'select id, cost_amount from public.stock_movements where sale_id = $1',
      [sale]
    );
    const byId = Object.fromEntries(costs.rows.map((row) => [row.id, Number(row.cost_amount)]));
    // 2 sacs à 5 000 F ; 1,001 sac « sans lot » au dernier prix d'achat (5 005 F, arrondi)
    expect(byId[withLot]).toBe(-10000);
    expect(byId[withoutLot]).toBe(-5005);
  });

  it('le vendeur annule SA vente pour la corriger, dans le délai — et rien d’autre', async () => {
    const recent = await insertSale(sellerMember, 2, 1);
    const cancel = (saleId: string) =>
      send(seller, [
        {
          op: 'PATCH',
          table: 'sales',
          id: saleId,
          data: {
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancelled_by: sellerMember,
            cancel_reason: 'Erreur de saisie',
          },
        },
      ]);
    await cancel(recent);
    const after = await db.query<{ status: string }>(
      'select status from public.sales where id = $1',
      [recent]
    );
    expect(after.rows[0].status).toBe('cancelled');

    const another = await insertSale(sellerMember, 1, 2);
    await expect(
      send(seller, [
        {
          op: 'PATCH',
          table: 'sales',
          id: another,
          data: { total: 1, subtotal: 1, paid_amount: 1 },
        },
      ])
    ).rejects.toThrow(/annulation/);
    const old = await insertSale(sellerMember, 48, 3);
    await expect(cancel(old)).rejects.toThrow(/délai/);
    const ownerSale = await insertSale(ownerMember, 1, 4);
    await expect(cancel(ownerSale)).rejects.toThrow(/refusée/);
  });

  it('un lot : le vendeur corrige la date de péremption, pas le coût (le gérant, si)', async () => {
    await send(seller, [
      { op: 'PATCH', table: 'stock_lots', id: lot, data: { expiry_date: '2027-06-30' } },
    ]);
    await expect(
      send(seller, [{ op: 'PATCH', table: 'stock_lots', id: lot, data: { cost_price: 1 } }])
    ).rejects.toThrow(/date de péremption/);
    await send(manager, [
      { op: 'PATCH', table: 'stock_lots', id: lot, data: { cost_price: 5200 } },
    ]);
    const row = await db.query<{ cost_price: string; expiry_date: string }>(
      "select cost_price, to_char(expiry_date, 'YYYY-MM-DD') as expiry_date from public.stock_lots where id = $1",
      [lot]
    );
    expect(row.rows[0]).toEqual({ cost_price: 5200, expiry_date: '2027-06-30' });
  });

  it('nouveau lien, lien annulé, lien expiré, compte déjà dans une boutique', async () => {
    const pinMember = (
      await db.query<{ id: string }>(
        "insert into public.shop_members (shop_id, display_name, active) values ($1, 'Codjo', true) returning id",
        [shop]
      )
    ).rows[0].id;
    const issue = () =>
      asUser(db, owner, (tx) =>
        tx.query<{ invite_code: string }>('select * from public.create_team_invite($1, $2)', [
          pinMember,
          'Codjo@Exemple.bj',
        ])
      ).then((result) => result.rows[0].invite_code);

    const first = await issue();
    await asUser(db, owner, (tx) => tx.query('select public.revoke_team_invite($1)', [pinMember]));
    expect((await readInvite(first)).invite_status).toBe('revoked');
    await expect(accept(stranger, first, null)).rejects.toThrow(/pas valable/);

    const second = await issue();
    await db.query(
      "update public.team_invites set expires_at = now() - interval '1 minute' where member_id = $1 and used_at is null and revoked_at is null",
      [pinMember]
    );
    await expect(accept(stranger, second, null)).rejects.toThrow(/expiré/);

    const third = await issue();
    await expect(accept(otherOwner, third, null)).rejects.toThrow(/appartient déjà/);
    await expect(
      asUser(db, owner, (tx) =>
        tx.query('select * from public.create_team_invite($1, null)', [sellerMember])
      )
    ).rejects.toThrow(/déjà son compte/);
  });

  it('membre retiré par le propriétaire : statut « retiré », plus rien n’est accepté de lui', async () => {
    await send(owner, [
      { op: 'PATCH', table: 'shop_members', id: sellerMember, data: { active: false } },
    ]);
    expect(await membershipStatus(seller)).toBe('removed');
    await expect(
      send(seller, [
        {
          op: 'PUT',
          table: 'customers',
          id: crypto.randomUUID(),
          data: { shop_id: shop, name: 'Client fantôme' },
        },
      ])
    ).rejects.toThrow();
  });

  it('une clôture de caisse faite par la caissière : sans bénéfices ni coûts', async () => {
    const cashier = await createUser(db);
    const invited = await invite(['cashier'], 'Rachida');
    await accept(cashier, invited.invite_code, null, false);
    const report = crypto.randomUUID();
    await send(cashier, [
      {
        op: 'PUT',
        table: 'reports',
        id: report,
        data: {
          shop_id: shop,
          kind: 'day_close',
          period_start: new Date(Date.now() - 8 * 3_600_000).toISOString(),
          period_end: new Date().toISOString(),
          data: JSON.stringify({
            sales: { total: 16500 },
            costOfGoods: 0,
            grossProfit: 16500,
            netProfit: 16500,
            losses: 0,
            adjustments: 0,
            stock: { receivedValue: 0, valueAtEnd: 0 },
            cash: { stockPurchases: 0, withdrawals: 0, deposits: 0 },
            closing: { openingFloat: 5000, totalDifference: 0 },
          }),
        },
      },
    ]);
    const stored = await db.query<{ data: Record<string, unknown> }>(
      'select data from public.reports where id = $1',
      [report]
    );
    expect(stored.rows[0].data).toEqual({
      sales: { total: 16500 },
      cash: { withdrawals: 0, deposits: 0 },
      closing: { openingFloat: 5000, totalDifference: 0 },
    });
  });

  it('le rôle « livreur » existe, au niveau « équipe »', async () => {
    const invited = await invite(['delivery'], 'Sèdjro');
    expect((await member(invited.member_id)).access_level).toBe('team');
    const roles = await db.query<{ role: string }>(
      'select role from public.shop_member_roles where member_id = $1',
      [invited.member_id]
    );
    expect(roles.rows.map((row) => row.role)).toEqual(['delivery']);
  });
});
