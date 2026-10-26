import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

import { asUser, createTestDatabase, createUser } from './fake-supabase';

/**
 * L'abonnement : prix calculé par le serveur, paiement déclaré par le propriétaire,
 * validé par l'administrateur. Personne d'autre ne peut changer la date de fin.
 */

describe('Abonnement', () => {
  let db: PGlite;
  let owner: string;
  let stranger: string;
  let admin: string;
  let shop: string;

  beforeAll(async () => {
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
  });

  const quote = () =>
    asUser(db, owner, (tx) =>
      tx.query<{ monthly_price: string; reason: string }>(
        'select * from public.subscription_quote($1)',
        [shop]
      )
    ).then((r) => r.rows[0]);

  it('les 3 premiers mois : 10 000 F', async () => {
    expect(await quote()).toMatchObject({ monthly_price: 10000, reason: 'welcome' });
  });

  it('ensuite, la moyenne des ventes du trimestre précédent fixe le prix', async () => {
    // La boutique a 4 mois ; son 1er trimestre a fait 9 000 000 F de ventes (3 000 000 / mois)
    await db.query(
      "update public.shops set created_at = now() - interval '4 months' where id = $1",
      [shop]
    );
    const member = await db.query<{ id: string }>(
      'select id from public.shop_members where shop_id = $1',
      [shop]
    );
    const device = crypto.randomUUID();
    await db.query(
      "insert into public.devices (id, shop_id, device_number, name, platform) values ($1, $2, 1, 'Tel', 'android')",
      [device, shop]
    );
    await db.query(
      `insert into public.sales (shop_id, device_id, invoice_number, invoice_seq, seller_id, subtotal, total,
         paid_amount, due_amount, occurred_at)
       values ($1, $2, 'F1-000001', 1, $3, 9000000, 9000000, 9000000, 0, now() - interval '3 months' - interval '10 days')`,
      [shop, device, member.rows[0].id]
    );
    expect(await quote()).toMatchObject({ monthly_price: 15000, reason: 'tier' });
  });

  it('le propriétaire déclare, l’administrateur valide : la fin d’abonnement avance', async () => {
    const declared = await asUser(db, owner, (tx) =>
      tx.query<{ id: string }>(
        "select public.declare_subscription_payment($1, 3, 'mtn', '+2290197000000', 'MP123456') as id",
        [shop]
      )
    );
    const paymentId = declared.rows[0].id;
    const payment = await db.query<{ amount: string; status: string }>(
      'select amount, status from public.subscription_payments where id = $1',
      [paymentId]
    );
    expect(payment.rows[0]).toEqual({ amount: 45000, status: 'pending' });

    // Un inconnu ne peut ni valider ni déclarer pour cette boutique
    await expect(
      asUser(db, stranger, (tx) =>
        tx.query('select public.review_subscription_payment($1, true, null)', [paymentId])
      )
    ).rejects.toThrow(/administrateur/);
    await expect(
      asUser(db, stranger, (tx) =>
        tx.query("select public.declare_subscription_payment($1, 1, 'mtn', '0197000000', 'X123')", [
          shop,
        ])
      )
    ).rejects.toThrow(/propriétaire/);

    await asUser(db, admin, (tx) =>
      tx.query('select public.review_subscription_payment($1, true, null)', [paymentId])
    );
    const after = await db.query<{ months: number }>(
      'select (extract(epoch from paid_until - now()) / 86400 / 30)::int as months from public.shops where id = $1',
      [shop]
    );
    expect(after.rows[0].months).toBe(3);
  });

  it('le propriétaire ne peut pas changer lui-même sa date de fin', async () => {
    await expect(
      asUser(db, owner, (tx) =>
        tx.query("update public.shops set paid_until = now() + interval '10 years' where id = $1", [
          shop,
        ])
      )
    ).rejects.toThrow(/abonnement/);
    // Les autres réglages restent modifiables
    const ok = await asUser(db, owner, (tx) =>
      tx.query("update public.shops set phone = '+2290197000000' where id = $1", [shop])
    );
    expect(ok.affectedRows).toBe(1);
  });
});
