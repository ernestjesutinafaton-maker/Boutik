import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';

import { asUser, createTestDatabase, createUser } from './fake-supabase';

/**
 * Effacer les données de test : seulement le propriétaire, seulement pendant l'essai
 * (sauf l'administrateur), et seulement SA boutique. L'équipe et l'abonnement restent.
 */

describe('Effacer les données de test', () => {
  let db: PGlite;
  let owner: string;
  let stranger: string;
  let admin: string;
  let shop: string;

  beforeEach(async () => {
    db = await createTestDatabase();
    owner = await createUser(db);
    stranger = await createUser(db);
    admin = await createUser(db);
    await db.query('insert into public.platform_admins (user_id) values ($1)', [admin]);
    const result = await asUser(db, owner, (tx) =>
      tx.query<{ id: string }>(
        'select public.create_shop(\'Chez Maman\', \'BJ\', \'XOF\', \'Awa\', \'[{"code":"cash","label":"Espèces","kind":"cash"}]\'::jsonb) as id'
      )
    );
    shop = result.rows[0].id;
    await db.query("insert into public.customers (shop_id, name) values ($1, 'Client test')", [
      shop,
    ]);
    await db.query(
      "insert into public.products (shop_id, name, base_unit) values ($1, 'Riz', 'kg')",
      [shop]
    );
  });

  const reset = (user: string, confirmation = 'EFFACER') =>
    asUser(db, user, (tx) =>
      tx.query('select public.reset_shop_data($1, $2)', [shop, confirmation])
    );
  const count = async (table: string) =>
    (
      await db.query<{ n: number }>(
        `select count(*)::int as n from public.${table} where shop_id = $1`,
        [shop]
      )
    ).rows[0].n;

  it('le propriétaire efface tout pendant l’essai ; l’équipe et les moyens de paiement restent', async () => {
    await reset(owner);
    expect(await count('customers')).toBe(0);
    expect(await count('products')).toBe(0);
    expect(await count('shop_members')).toBe(1);
    expect(await count('payment_methods')).toBe(1);
  });

  it('sans le mot EFFACER : refusé', async () => {
    await expect(reset(owner, 'oui')).rejects.toThrow();
    expect(await count('customers')).toBe(1);
  });

  it('une autre personne ne peut pas effacer la boutique', async () => {
    await expect(reset(stranger)).rejects.toThrow();
    expect(await count('products')).toBe(1);
  });

  it('après les 15 jours d’essai : refusé au propriétaire, permis à l’administrateur', async () => {
    await db.query(
      "update public.shops set created_at = now() - interval '16 days' where id = $1",
      [shop]
    );
    await expect(reset(owner)).rejects.toThrow(/essai/);
    expect(await count('customers')).toBe(1);
    await reset(admin);
    expect(await count('customers')).toBe(0);
  });
});

describe('Tableau de bord administrateur', () => {
  it('réservé à l’administrateur ; compte les boutiques en essai', async () => {
    const db = await createTestDatabase();
    const owner = await createUser(db);
    const admin = await createUser(db);
    await db.query('insert into public.platform_admins (user_id) values ($1)', [admin]);
    await asUser(db, owner, (tx) =>
      tx.query(
        'select public.create_shop(\'Chez Maman\', \'BJ\', \'XOF\', \'Awa\', \'[{"code":"cash","label":"Espèces","kind":"cash"}]\'::jsonb)'
      )
    );
    await expect(
      asUser(db, owner, (tx) => tx.query('select * from public.admin_overview()'))
    ).rejects.toThrow();
    const result = await asUser(db, admin, (tx) =>
      tx.query<{ shops_total: number; shops_trial: number; payments_pending: number }>(
        'select * from public.admin_overview()'
      )
    );
    expect(result.rows[0]).toMatchObject({ shops_total: 1, shops_trial: 1, payments_pending: 0 });
  });
});
