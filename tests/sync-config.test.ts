import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { AppSchema } from '@/db/schema';

/**
 * Garde-fou des règles de synchronisation (powersync/sync-config.yaml, collées à la main dans
 * PowerSync) : chaque niveau d'accès reçoit exactement ce qu'il doit, et rien de secret ne part
 * vers le téléphone d'un membre « équipe ».
 */

type Query = { table: string; columns: string[] | '*'; where: string };
type Stream = { name: string; level: string | null; profiles: string | null; queries: Query[] };

/** Les colonnes secrètes, par niveau : elles ne doivent jamais partir vers ce niveau. */
const SECRET: Record<'costs' | 'team', Record<string, string[]>> = {
  costs: { shop_members: ['pin_hash', 'pin_salt'] },
  team: {
    shop_members: ['pin_hash', 'pin_salt'],
    product_units: ['purchase_price'],
    stock_lots: ['cost_price', 'cost_quantity'],
    stock_movements: ['cost_amount'],
  },
};
/** Les tables entières que le niveau « équipe » ne reçoit pas. */
const TEAM_EXCLUDED_TABLES = ['reports', 'audit_log'];

function readStreams(): Stream[] {
  const text = readFileSync(join(__dirname, '..', 'powersync', 'sync-config.yaml'), 'utf8');
  const streams: Stream[] = [];
  let inStreams = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^streams:\s*$/.test(line)) {
      inStreams = true;
      continue;
    }
    if (!inStreams || /^\s*#/.test(line)) continue;
    const stream = /^ {2}([a-z_]+):\s*$/.exec(line);
    if (stream) {
      streams.push({ name: stream[1], level: null, profiles: null, queries: [] });
      continue;
    }
    const current = streams[streams.length - 1];
    const parameters = /^\s+my_shops: (.+)$/.exec(line);
    if (current && parameters) {
      expect(parameters[1]).toMatch(/user_id = auth\.user_id\(\) AND active = true/);
      current.level = /access_level = '([a-z]+)'/.exec(parameters[1])?.[1] ?? null;
      continue;
    }
    const profiles = /^\s+my_profiles: (.+)$/.exec(line);
    if (current && profiles) {
      current.profiles = profiles[1].trim();
      continue;
    }
    const query = /^\s+- SELECT (.+?) FROM ([a-z_]+) WHERE (.+)$/.exec(line);
    if (current && query) {
      current.queries.push({
        table: query[2],
        columns: query[1] === '*' ? '*' : query[1].split(',').map((column) => column.trim()),
        where: query[3].trim(),
      });
    }
  }
  return streams;
}

const syncedTables = AppSchema.tables.filter((table) => !table.localOnly);
const columnsOf = (name: string) => {
  const table = syncedTables.find((candidate) => candidate.name === name);
  return table ? ['id', ...table.columns.map((column) => column.name)] : [];
};

describe('Règles de synchronisation par niveau d’accès', () => {
  const streams = readStreams();
  const byLevel = (level: string) => streams.find((stream) => stream.level === level);

  it('trois flux : propriétaire, responsables (coûts), équipe', () => {
    expect(streams.map((stream) => [stream.name, stream.level])).toEqual([
      ['shop_owner', 'owner'],
      ['shop_costs', 'costs'],
      ['shop_team', 'team'],
    ]);
  });

  it('chaque requête est limitée aux boutiques de la personne', () => {
    for (const stream of streams) {
      for (const query of stream.queries) {
        const key = query.table === 'shops' ? 'id' : 'shop_id';
        expect(query.where, `${stream.name} / ${query.table}`).toMatch(
          new RegExp(`^${key} IN my_shops( AND [a-z_]+ IN my_profiles)?$`)
        );
      }
    }
  });

  it('un livreur (niveau « équipe ») ne reçoit que SES dépenses de livraison', () => {
    const team = byLevel('team');
    expect(team?.profiles).toBe(
      "SELECT id FROM shop_members WHERE user_id = auth.user_id() AND active = true AND access_level = 'team'"
    );
    expect(team?.queries.find((query) => query.table === 'delivery_expenses')?.where).toBe(
      'shop_id IN my_shops AND courier_id IN my_profiles'
    );
    // Les autres niveaux les reçoivent toutes, et seules les dépenses sont filtrées par personne
    for (const stream of streams) {
      for (const query of stream.queries) {
        if (stream.level === 'team' && query.table === 'delivery_expenses') continue;
        expect(query.where, `${stream.name} / ${query.table}`).not.toContain('my_profiles');
      }
    }
  });

  it('le propriétaire reçoit toutes les tables, entières', () => {
    const owner = byLevel('owner');
    expect(owner?.queries.map((query) => query.table).sort()).toEqual(
      syncedTables.map((table) => table.name).sort()
    );
    expect(owner?.queries.every((query) => query.columns === '*')).toBe(true);
  });

  for (const level of ['costs', 'team'] as const) {
    it(`niveau « ${level} » : rien de secret, et toutes les autres colonnes`, () => {
      const stream = byLevel(level);
      const expectedTables = syncedTables
        .map((table) => table.name)
        .filter((name) => level !== 'team' || !TEAM_EXCLUDED_TABLES.includes(name));
      expect(stream?.queries.map((query) => query.table).sort()).toEqual(expectedTables.sort());

      for (const query of stream?.queries ?? []) {
        const secret = SECRET[level][query.table] ?? [];
        const all = columnsOf(query.table);
        if (query.columns === '*') {
          // Une table entière : seulement si elle n'a rien de secret pour ce niveau
          expect(secret, query.table).toEqual([]);
          continue;
        }
        // Les colonnes citées existent, et ce sont toutes les colonnes sauf les secrètes
        for (const column of query.columns) {
          expect(all, `${query.table}.${column}`).toContain(column);
        }
        expect([...query.columns].sort(), query.table).toEqual(
          all.filter((column) => !secret.includes(column)).sort()
        );
      }
    });
  }
});
