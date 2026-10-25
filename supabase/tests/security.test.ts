import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

import { asAnonymous, asUser, createTestDatabase, createUser } from './fake-supabase';

/**
 * Tests de sécurité : une boutique ne doit JAMAIS voir ni modifier les données d'une autre.
 *
 * Le décor : Alice possède la boutique A, Bruno possède la boutique B.
 * Carla est vendeuse dans la boutique A, avec son propre compte (cas prévu pour la V2).
 */

const PAYMENT_METHODS = JSON.stringify([
  { code: 'cash', label: 'Espèces', kind: 'cash' },
  { code: 'mtn_momo', label: 'MTN MoMo', kind: 'mobile_money' },
]);

/** Crée une boutique avec la fonction create_shop, comme le fera l'application. */
async function createShop(db: PGlite, ownerId: string, name: string): Promise<string> {
  const result = await asUser(db, ownerId, (tx) =>
    tx.query<{ id: string }>(
      "select public.create_shop($1, 'BJ', 'XOF', 'Propriétaire', $2::jsonb) as id",
      [name, PAYMENT_METHODS]
    )
  );
  return result.rows[0].id;
}

describe("Sécurité : une boutique ne voit jamais les données d'une autre", () => {
  let db: PGlite;
  let alice: string;
  let bruno: string;
  let carla: string;
  let shopA: string;
  let shopB: string;
  let riceId: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    alice = await createUser(db);
    bruno = await createUser(db);
    carla = await createUser(db);
    shopA = await createShop(db, alice, 'Boutique A');
    shopB = await createShop(db, bruno, 'Boutique B');

    // Alice ajoute un produit dans sa boutique, et Carla comme vendeuse
    const rice = await asUser(db, alice, (tx) =>
      tx.query<{ id: string }>(
        "insert into public.products (shop_id, name, base_unit) values ($1, 'Riz', 'kg') returning id",
        [shopA]
      )
    );
    riceId = rice.rows[0].id;
    await asUser(db, alice, (tx) =>
      tx.query(
        "insert into public.shop_members (shop_id, user_id, display_name, role) values ($1, $2, 'Carla', 'seller')",
        [shopA, carla]
      )
    );
  }, 30_000);

  it('create_shop crée la boutique, son propriétaire et ses modes de paiement', async () => {
    const members = await asUser(db, alice, (tx) =>
      tx.query<{ role: string }>('select role from public.shop_members where user_id = $1', [alice])
    );
    expect(members.rows).toEqual([{ role: 'owner' }]);

    const methods = await asUser(db, alice, (tx) =>
      tx.query<{ label: string }>('select label from public.payment_methods order by sort_order')
    );
    expect(methods.rows.map((row) => row.label)).toEqual(['Espèces', 'MTN MoMo']);
  });

  it('chacun voit sa propre boutique, et seulement elle', async () => {
    const seenByBruno = await asUser(db, bruno, (tx) =>
      tx.query<{ id: string }>('select id from public.shops')
    );
    expect(seenByBruno.rows.map((row) => row.id)).toEqual([shopB]);
  });

  it("Bruno ne voit pas les produits d'Alice", async () => {
    const seenByBruno = await asUser(db, bruno, (tx) => tx.query('select id from public.products'));
    expect(seenByBruno.rows).toHaveLength(0);

    const seenByAlice = await asUser(db, alice, (tx) => tx.query('select id from public.products'));
    expect(seenByAlice.rows).toHaveLength(1);
  });

  it("Bruno ne peut pas ajouter de produit dans la boutique d'Alice", async () => {
    await expect(
      asUser(db, bruno, (tx) =>
        tx.query(
          "insert into public.products (shop_id, name, base_unit) values ($1, 'Piège', 'kg')",
          [shopA]
        )
      )
    ).rejects.toThrow(/row-level security/);
  });

  it("Bruno ne peut pas modifier la boutique d'Alice", async () => {
    const result = await asUser(db, bruno, (tx) =>
      tx.query("update public.shops set name = 'Piratée' where id = $1", [shopA])
    );
    expect(result.affectedRows).toBe(0);

    const shop = await asUser(db, alice, (tx) =>
      tx.query<{ name: string }>('select name from public.shops where id = $1', [shopA])
    );
    expect(shop.rows[0].name).toBe('Boutique A');
  });

  it("Bruno ne peut pas enregistrer d'appareil dans la boutique d'Alice", async () => {
    await expect(
      asUser(db, bruno, (tx) =>
        tx.query("select public.register_device($1, $2, 'Intrus', 'android')", [
          crypto.randomUUID(),
          shopA,
        ])
      )
    ).rejects.toThrow(/pas membre/);
  });

  it('les appareils reçoivent des numéros 1, 2, 3… sans doublon', async () => {
    const register = (deviceId: string) =>
      asUser(db, alice, (tx) =>
        tx.query<{ n: number }>(
          "select public.register_device($1, $2, 'Téléphone', 'android') as n",
          [deviceId, shopA]
        )
      ).then((result) => result.rows[0].n);

    const first = crypto.randomUUID();
    expect(await register(first)).toBe(1);
    expect(await register(crypto.randomUUID())).toBe(2);
    // Le même appareil qui se réenregistre garde son numéro
    expect(await register(first)).toBe(1);
  });

  it('un visiteur non connecté ne voit rien', async () => {
    await expect(
      asAnonymous(db, (tx) => tx.query('select id from public.products'))
    ).rejects.toThrow(/permission denied/);
  });

  it('personne ne peut supprimer une ligne (on archive ou on annule)', async () => {
    await expect(
      asUser(db, alice, (tx) => tx.query('delete from public.products where id = $1', [riceId]))
    ).rejects.toThrow(/permission denied/);
  });

  it('une ligne du journal ne se modifie jamais', async () => {
    await asUser(db, alice, (tx) =>
      tx.query("insert into public.audit_log (shop_id, action) values ($1, 'test.action')", [shopA])
    );
    const result = await asUser(db, alice, (tx) =>
      tx.query("update public.audit_log set action = 'modifiée' where shop_id = $1", [shopA])
    );
    expect(result.affectedRows).toBe(0);
  });

  it('une vendeuse ne peut pas modifier les prix ni le catalogue', async () => {
    const result = await asUser(db, carla, (tx) =>
      tx.query("update public.products set name = 'Riz modifié' where id = $1", [riceId])
    );
    expect(result.affectedRows).toBe(0);

    await expect(
      asUser(db, carla, (tx) =>
        tx.query(
          "insert into public.products (shop_id, name, base_unit) values ($1, 'Sucre', 'kg')",
          [shopA]
        )
      )
    ).rejects.toThrow(/row-level security/);
  });

  it("une vendeuse ne peut pas faire d'ajustement de stock, mais peut déclarer une perte", async () => {
    await expect(
      asUser(db, carla, (tx) =>
        tx.query(
          "insert into public.stock_movements (shop_id, product_id, type, quantity) values ($1, $2, 'adjustment', 5000)",
          [shopA, riceId]
        )
      )
    ).rejects.toThrow(/row-level security/);

    const loss = await asUser(db, carla, (tx) =>
      tx.query(
        "insert into public.stock_movements (shop_id, product_id, type, quantity, loss_reason) values ($1, $2, 'loss', -1000, 'broken')",
        [shopA, riceId]
      )
    );
    expect(loss.affectedRows).toBe(1);
  });
});
