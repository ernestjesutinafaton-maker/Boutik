import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

import { asUser, createTestDatabase, createUser } from './fake-supabase';

/**
 * Tests de la fonction apply_changes : c'est elle qui reçoit les modifications
 * faites hors ligne dans les appareils, et les applique « tout ou rien ».
 */

type Change = { op: string; table: string; id: string; data?: Record<string, unknown> };

const PAYMENT_METHODS = JSON.stringify([{ code: 'cash', label: 'Espèces', kind: 'cash' }]);

describe('apply_changes : recevoir les modifications des appareils', () => {
  let db: PGlite;
  let alice: string;
  let bruno: string;
  let shopA: string;
  let shopB: string;

  /** Envoie une liste de modifications, comme le fera l'appareil d'une personne. */
  const send = (userId: string, changes: Change[]) =>
    asUser(db, userId, (tx) =>
      tx.query('select public.apply_changes($1::jsonb)', [JSON.stringify(changes)])
    );

  const countProducts = async (userId: string, id: string) => {
    const result = await asUser(db, userId, (tx) =>
      tx.query('select id from public.products where id = $1', [id])
    );
    return result.rows.length;
  };

  beforeAll(async () => {
    db = await createTestDatabase();
    alice = await createUser(db);
    bruno = await createUser(db);
    const create = async (userId: string, name: string) => {
      const result = await asUser(db, userId, (tx) =>
        tx.query<{ id: string }>(
          "select public.create_shop($1, 'BJ', 'XOF', 'Propriétaire', $2::jsonb) as id",
          [name, PAYMENT_METHODS]
        )
      );
      return result.rows[0].id;
    };
    shopA = await create(alice, 'Boutique A');
    shopB = await create(bruno, 'Boutique B');
  }, 30_000);

  it('crée une ligne envoyée par un appareil, avec les valeurs par défaut du serveur', async () => {
    const id = crypto.randomUUID();
    await send(alice, [
      { op: 'PUT', table: 'products', id, data: { shop_id: shopA, name: 'Riz', base_unit: 'kg' } },
    ]);
    const row = await asUser(db, alice, (tx) =>
      tx.query<{ name: string; created_at: string | null }>(
        'select name, created_at from public.products where id = $1',
        [id]
      )
    );
    expect(row.rows[0].name).toBe('Riz');
    expect(row.rows[0].created_at).not.toBeNull();
  });

  it('ignore un envoi répété (après une coupure de réseau) sans erreur ni doublon', async () => {
    const id = crypto.randomUUID();
    const change: Change = {
      op: 'PUT',
      table: 'products',
      id,
      data: { shop_id: shopA, name: 'Sucre', base_unit: 'kg' },
    };
    await send(alice, [change]);
    await send(alice, [change]);
    expect(await countProducts(alice, id)).toBe(1);
  });

  it('modifie seulement les colonnes envoyées', async () => {
    const id = crypto.randomUUID();
    await send(alice, [
      {
        op: 'PUT',
        table: 'products',
        id,
        data: { shop_id: shopA, name: 'Huile', base_unit: 'litre' },
      },
      { op: 'PATCH', table: 'products', id, data: { name: 'Huile de palme' } },
    ]);
    const row = await asUser(db, alice, (tx) =>
      tx.query<{ name: string; base_unit: string }>(
        'select name, base_unit from public.products where id = $1',
        [id]
      )
    );
    expect(row.rows[0]).toEqual({ name: 'Huile de palme', base_unit: 'litre' });
  });

  it('comprend les oui/non (1/0) et les données JSON envoyées comme texte par l’appareil', async () => {
    const productId = crypto.randomUUID();
    const logId = crypto.randomUUID();
    await send(alice, [
      {
        op: 'PUT',
        table: 'products',
        id: productId,
        data: { shop_id: shopA, name: 'Tomate', base_unit: 'boîte', track_expiry: 1 },
      },
      {
        op: 'PUT',
        table: 'audit_log',
        id: logId,
        data: { shop_id: shopA, action: 'product.create', details: '{"prix":700}' },
      },
    ]);
    const product = await asUser(db, alice, (tx) =>
      tx.query<{ track_expiry: boolean }>(
        'select track_expiry from public.products where id = $1',
        [productId]
      )
    );
    expect(product.rows[0].track_expiry).toBe(true);
    const log = await asUser(db, alice, (tx) =>
      tx.query<{ details: unknown }>('select details from public.audit_log where id = $1', [logId])
    );
    expect(log.rows[0].details).toEqual({ prix: 700 });
  });

  it('tout ou rien : si une modification est refusée, aucune de l’envoi n’est gardée', async () => {
    const goodId = crypto.randomUUID();
    await expect(
      send(alice, [
        {
          op: 'PUT',
          table: 'products',
          id: goodId,
          data: { shop_id: shopA, name: 'Savon', base_unit: 'pièce' },
        },
        // Interdit : un produit dans la boutique de Bruno
        {
          op: 'PUT',
          table: 'products',
          id: crypto.randomUUID(),
          data: { shop_id: shopB, name: 'Piège', base_unit: 'kg' },
        },
      ])
    ).rejects.toThrow(/row-level security/);
    expect(await countProducts(alice, goodId)).toBe(0);
  });

  it('les règles de sécurité restent appliquées : Bruno ne peut rien écrire chez Alice', async () => {
    await expect(
      send(bruno, [
        {
          op: 'PUT',
          table: 'products',
          id: crypto.randomUUID(),
          data: { shop_id: shopA, name: 'Piège', base_unit: 'kg' },
        },
      ])
    ).rejects.toThrow(/row-level security/);
  });

  it('refuse une modification qui ne touche aucune ligne autorisée', async () => {
    await expect(
      send(bruno, [{ op: 'PATCH', table: 'shops', id: shopA, data: { name: 'Piratée' } }])
    ).rejects.toThrow(/Modification refusée/);
  });

  it('refuse toute suppression et toute table inconnue', async () => {
    await expect(
      send(alice, [{ op: 'DELETE', table: 'products', id: crypto.randomUUID() }])
    ).rejects.toThrow(/rien ne se supprime/);
    await expect(
      send(alice, [{ op: 'PUT', table: 'pg_authid', id: crypto.randomUUID(), data: {} }])
    ).rejects.toThrow(/non autorisée/);
  });
});
