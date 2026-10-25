import type { CommonPowerSyncDatabase } from '@powersync/common';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import { AppSchema } from '@/db/schema';

/**
 * Une imitation de la base LOCALE de l'application, dans un vrai SQLite en mémoire
 * (celui de Node.js) : mêmes tables et mêmes colonnes que le schéma PowerSync.
 *
 * Les fonctions de l'application (vendre, recevoir, annuler…) y tournent telles quelles :
 * les tests vérifient donc les VRAIES requêtes SQL, sans téléphone ni réseau.
 */

type Params = readonly unknown[] | undefined;

function toSqlParams(params: Params): SQLInputValue[] {
  return (params ?? []).map((value) => {
    if (value === undefined) {
      throw new Error('Paramètre SQL « undefined » : utiliser null.');
    }
    return value as SQLInputValue;
  });
}

function createExecutor(sqlite: DatabaseSync) {
  return {
    async execute(sql: string, params?: Params) {
      const result = sqlite.prepare(sql).run(...toSqlParams(params));
      return { rowsAffected: Number(result.changes), insertId: Number(result.lastInsertRowid) };
    },
    async getAll<T>(sql: string, params?: Params): Promise<T[]> {
      return sqlite.prepare(sql).all(...toSqlParams(params)) as T[];
    },
    async getOptional<T>(sql: string, params?: Params): Promise<T | null> {
      return (sqlite.prepare(sql).get(...toSqlParams(params)) as T | undefined) ?? null;
    },
    async get<T>(sql: string, params?: Params): Promise<T> {
      const row = sqlite.prepare(sql).get(...toSqlParams(params)) as T | undefined;
      if (row === undefined) {
        throw new Error(`Aucun résultat : ${sql}`);
      }
      return row;
    },
  };
}

export type LocalTestDb = CommonPowerSyncDatabase & {
  /** Lecture directe, pour les vérifications des tests */
  query: <T>(sql: string, params?: unknown[]) => T[];
};

/** Crée une base locale neuve et vide. */
export function createLocalDb(): LocalTestDb {
  const sqlite = new DatabaseSync(':memory:');
  for (const table of AppSchema.tables) {
    const columns = table.columns.map((column) => `${column.name} ${column.type ?? 'TEXT'}`);
    sqlite.exec(`CREATE TABLE ${table.name} (id TEXT PRIMARY KEY, ${columns.join(', ')})`);
  }
  const executor = createExecutor(sqlite);
  let queue = Promise.resolve();

  const db = {
    ...executor,
    /** Comme PowerSync : tout ou rien, une écriture à la fois. */
    writeTransaction<T>(callback: (tx: typeof executor) => Promise<T>): Promise<T> {
      const run = queue.then(async () => {
        sqlite.exec('BEGIN');
        try {
          const result = await callback(executor);
          sqlite.exec('COMMIT');
          return result;
        } catch (error) {
          sqlite.exec('ROLLBACK');
          throw error;
        }
      });
      queue = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    },
    query<T>(sql: string, params: unknown[] = []): T[] {
      return sqlite.prepare(sql).all(...toSqlParams(params)) as T[];
    },
  };
  return db as unknown as LocalTestDb;
}
