import type { CommonPowerSyncDatabase } from '@powersync/common';
import { PowerSyncDatabase } from '@powersync/web';

import { AppSchema } from './schema';

/**
 * La base locale — version NAVIGATEUR : SQLite fonctionne dans le navigateur grâce à
 * WebAssembly, dans un « worker » (programme en arrière-plan) copié dans public/@powersync.
 * Une seule base pour toute l'application. (La version téléphone est dans database.native.ts.)
 */
export const powersync: CommonPowerSyncDatabase = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'boutik.db',
    worker: '/@powersync/worker.js',
  },
  sync: {
    worker: '/@powersync/worker.js',
  },
});
