import type { CommonPowerSyncDatabase } from '@powersync/common';
import { PowerSyncDatabase } from '@powersync/react-native';

import { AppSchema } from './schema';

/**
 * La base locale — version TÉLÉPHONE et TABLETTE : un fichier SQLite dans l'appareil.
 * Une seule base pour toute l'application. (La version navigateur est dans database.ts.)
 */
export const powersync: CommonPowerSyncDatabase = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'boutik.db' },
});
