import { PGlite, type Transaction } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Une imitation minimale de Supabase, dans un PostgreSQL qui tourne en mémoire (PGlite) :
 * les rôles « anon » (visiteur) et « authenticated » (personne connectée), la table des
 * comptes et la fonction auth.uid() qui dit « qui est connecté ».
 *
 * On y applique nos VRAIES migrations (supabase/migrations) : les tests vérifient donc
 * exactement les règles de sécurité qui seront envoyées sur Supabase, sans réseau.
 */

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));

const SUPABASE_IMITATION_SQL = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`;

/** Crée une base neuve, avec toutes nos migrations appliquées dans l'ordre. */
export async function createTestDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_IMITATION_SQL);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return db;
}

/** Crée un compte (comme une inscription) et renvoie son identifiant. */
export async function createUser(db: PGlite): Promise<string> {
  const id = crypto.randomUUID();
  await db.query('insert into auth.users (id) values ($1)', [id]);
  return id;
}

/**
 * Exécute des requêtes « en tant que » personne connectée, exactement comme le ferait
 * l'application : rôle « authenticated », et auth.uid() renvoie cet utilisateur.
 * Tout se passe dans une transaction : en cas d'erreur, rien n'est enregistré.
 */
export function asUser<T>(
  db: PGlite,
  userId: string,
  run: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await tx.exec('set local role authenticated');
    return run(tx);
  });
}

/** Exécute des requêtes en tant que visiteur NON connecté (rôle « anon »). */
export function asAnonymous<T>(db: PGlite, run: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec('set local role anon');
    return run(tx);
  });
}
