import type { CommonPowerSyncDatabase } from '@powersync/common';
import { PowerSyncDatabase } from '@powersync/web';

import Constants from 'expo-constants';

import { AppSchema } from './schema';

// L'appli web vit sous /app sur le site (voir app.config.js), à la racine dans la version ordinateur
const WEB_BASE = (Constants.expoConfig?.extra?.webBase as string | undefined) ?? '';
const WORKER = `${WEB_BASE}/@powersync/worker.js`;

/**
 * La base locale — version NAVIGATEUR : SQLite fonctionne dans le navigateur grâce à
 * WebAssembly, dans un « worker » (programme en arrière-plan) copié dans public/@powersync.
 * Une seule base pour toute l'application. (La version téléphone est dans database.native.ts.)
 */
export const powersync: CommonPowerSyncDatabase = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'boutik.db',
    worker: WORKER,
  },
  sync: {
    worker: WORKER,
  },
});
