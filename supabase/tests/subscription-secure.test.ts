import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

import { asUser, createTestDatabase, createUser } from './fake-supabase';

/**
 * L'abonnement sécurisé : capture du paiement obligatoire (stockage privé), accès provisoire
 * pendant la vérification, refus motivé, et boutique bloquée côté serveur (code BK001)
 * quand l'essai et le délai de grâce sont passés sans paiement.
 */

const PAYMENT_METHODS = '[{"code":"cash","label":"Espèces","kind":"cash"}]';

describe('Abonnement sécurisé', () => {
  let db: PGlite;
  let owner: string;
  let stranger: string;
  let admin: string;
  let shop: string;
  let strangerShop: string;

  const createShop = (userId: string, name: string) =>
    asUser(db, userId, (tx) =>
      tx.query<{ id: string }>(
        "select public.create_shop($1, 'BJ', 'XOF', 'Awa', $2::jsonb) as id",
        [name, PAYMENT_METHODS]
      )
    ).then((result) => result.rows[0].id);

  /** Le propriétaire envoie une capture dans le dossier d'une boutique (comme l'appli). */
  const uploadProof = (userId: string, shopId: string) =>
    asUser(db, userId, async (tx) => {
      const name = `${shopId}/${crypto.randomUUID()}.jpg`;
      await tx.query(
        "insert into storage.objects (bucket_id, name) values ('payment-proofs', $1)",
        [name]
      );
      return name;
    });

  const declare = (userId: string, shopId: string, proof: string | null, reference: string) =>
    asUser(db, userId, (tx) =>
      tx.query<{ payment_id: string; provisional_until: string | null }>(
        `select * from public.declare_subscription_payment(
           $1, 1, 'mtn', '+2290197000000', $2, now() - interval '1 hour', 'Payé depuis le 97 00 00 00', $3)`,
        [shopId, reference, proof]
      )
    ).then((result) => result.rows[0]);

  const review = (paymentId: string, accept: boolean, note: string | null) =>
    asUser(db, admin, (tx) =>
      tx.query('select public.review_subscription_payment($1, $2, $3)', [paymentId, accept, note])
    );

  const isBlocked = (shopId: string) =>
    db
      .query<{ blocked: boolean }>('select private.shop_is_blocked($1) as blocked', [shopId])
      .then((result) => result.rows[0].blocked);

  const shopRow = (shopId: string) =>
    db
      .query<{ paid_until: Date | null; provisional_until: Date | null; created_at: Date }>(
        'select paid_until, provisional_until, created_at from public.shops where id = $1',
        [shopId]
      )
      .then((result) => result.rows[0]);

  /** Une modification envoyée par un appareil (une nouvelle catégorie). */
  const sendCategory = (userId: string, shopId: string) =>
    asUser(db, userId, (tx) =>
      tx.query('select public.apply_changes($1::jsonb)', [
        JSON.stringify([
          {
            op: 'PUT',
            table: 'categories',
            id: crypto.randomUUID(),
            data: { shop_id: shopId, name: 'Plomberie' },
          },
        ]),
      ])
    );

  beforeAll(async () => {
    db = await createTestDatabase();
    owner = await createUser(db);
    stranger = await createUser(db);
    admin = await createUser(db);
    await db.query('insert into public.platform_admins (user_id) values ($1)', [admin]);
    await db.query("update auth.users set email = 'awa@exemple.bj' where id = $1", [owner]);
    shop = await createShop(owner, 'Quincaillerie Awa');
    strangerShop = await createShop(stranger, 'Chez Koffi');
  });

  it('la capture est obligatoire et doit être dans le dossier de la boutique', async () => {
    await expect(declare(owner, shop, null, 'TX-0')).rejects.toThrow(/capture/);
    await expect(declare(owner, shop, `${shop}/inexistante.jpg`, 'TX-0')).rejects.toThrow(
      /capture/
    );
    // Une capture d'une autre boutique ne peut pas servir
    const otherProof = await uploadProof(stranger, strangerShop);
    await expect(declare(owner, shop, otherProof, 'TX-0')).rejects.toThrow(/capture/);
  });

  it('les captures sont privées : un inconnu ne peut ni en déposer, ni les voir', async () => {
    await expect(uploadProof(stranger, shop)).rejects.toThrow();
    const proof = await uploadProof(owner, shop);
    const seenBy = (userId: string) =>
      asUser(db, userId, (tx) =>
        tx.query('select name from storage.objects where name = $1', [proof])
      ).then((result) => result.rows.length);
    expect(await seenBy(owner)).toBe(1);
    expect(await seenBy(admin)).toBe(1);
    expect(await seenBy(stranger)).toBe(0);
  });

  it('boutique bloquée après l’essai et la grâce ; la déclaration ouvre 3 jours, une fois par mois', async () => {
    await db.query(
      "update public.shops set created_at = now() - interval '60 days' where id = $1",
      [shop]
    );
    expect(await isBlocked(shop)).toBe(true);

    const first = await declare(owner, shop, await uploadProof(owner, shop), 'TX-1');
    const hours = (new Date(first.provisional_until ?? 0).getTime() - Date.now()) / 3_600_000;
    expect(Math.round(hours)).toBe(72);
    expect(await isBlocked(shop)).toBe(false);

    // Deuxième déclaration dans le mois : pas de nouvel accès provisoire
    const second = await declare(owner, shop, await uploadProof(owner, shop), 'TX-2');
    expect(second.provisional_until).toBeNull();
  });

  it('un numéro de transaction ne sert qu’une fois (majuscules ou non)', async () => {
    await expect(declare(owner, shop, await uploadProof(owner, shop), 'TX-1')).rejects.toThrow(
      /déjà été déclaré/
    );
    await expect(declare(owner, shop, await uploadProof(owner, shop), 'tx-1')).rejects.toThrow(
      /déjà été déclaré/
    );
  });

  it('le serveur refuse les données d’une boutique bloquée (BK001), puis les accepte après paiement', async () => {
    const pending = await db.query<{ id: string; reference: string }>(
      "select id, reference from public.subscription_payments where shop_id = $1 and status = 'pending' order by reference",
      [shop]
    );
    const [tx1, tx2] = pending.rows;

    // Refus : une raison est obligatoire, et l'accès provisoire s'arrête
    await expect(review(tx1.id, false, '  ')).rejects.toThrow(/raison/);
    await review(tx1.id, false, 'Argent pas reçu sur le numéro de Boutik');
    expect((await shopRow(shop)).provisional_until).toBeNull();
    expect(await isBlocked(shop)).toBe(true);
    await expect(sendCategory(owner, shop)).rejects.toMatchObject({ code: 'BK001' });

    // Après un refus, le numéro peut être redéclaré, mais sans nouvel accès provisoire
    const again = await declare(owner, shop, await uploadProof(owner, shop), 'TX-1');
    expect(again.provisional_until).toBeNull();

    // Validation : la boutique travaille de nouveau, l'appareil peut envoyer ses données
    await review(tx2.id, true, null);
    expect(await isBlocked(shop)).toBe(false);
    await expect(sendCategory(owner, shop)).resolves.toBeDefined();
  });

  it('pendant l’essai, la validation ne fait pas perdre les jours d’essai restants', async () => {
    const newShop = await createShop(owner, 'Dépôt Awa 2');
    const declared = await declare(owner, newShop, await uploadProof(owner, newShop), 'TX-9');
    await review(declared.payment_id, true, null);
    const row = await shopRow(newShop);
    const trialEnd = row.created_at.getTime() + 15 * 86_400_000;
    const days = ((row.paid_until?.getTime() ?? 0) - trialEnd) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(28);
    expect(days).toBeLessThanOrEqual(31);
    expect(row.provisional_until).toBeNull();
  });

  it('le propriétaire ne peut pas s’accorder lui-même un accès provisoire', async () => {
    await expect(
      asUser(db, owner, (tx) =>
        tx.query(
          "update public.shops set provisional_until = now() + interval '10 years' where id = $1",
          [shop]
        )
      )
    ).rejects.toThrow(/abonnement/);
  });

  it('la liste de l’administrateur montre la capture, le message, l’heure et le contact', async () => {
    const list = await asUser(db, admin, (tx) =>
      tx.query<{
        reference: string;
        proof_path: string | null;
        message: string | null;
        paid_at: Date | null;
        owner_email: string | null;
        review_note: string | null;
      }>('select * from public.admin_subscription_payments()')
    );
    const rejected = list.rows.find((row) => row.review_note !== null);
    expect(rejected?.review_note).toMatch(/pas reçu/);
    const one = list.rows.find((row) => row.reference === 'TX-2');
    expect(one?.proof_path).toMatch(new RegExp(`^${shop}/`));
    expect(one?.message).toMatch(/97 00 00 00/);
    expect(one?.paid_at).toBeInstanceOf(Date);
    expect(one?.owner_email).toBe('awa@exemple.bj');

    await expect(
      asUser(db, owner, (tx) => tx.query('select * from public.admin_subscription_payments()'))
    ).rejects.toThrow(/administrateur/);
  });
});
