import { PowerSyncContext } from '@powersync/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ReactNode, useEffect } from 'react';

import { useAuth } from '@/auth/auth-provider';

import { connector } from './connector';
import { powersync } from './database';

/** Retient à qui appartiennent les données de la base locale. */
const OWNER_KEY = 'boutik.local-db-owner';

/**
 * Met la base locale à disposition de tous les écrans, et lance la synchronisation
 * dès qu'une personne est connectée. Sans internet, tout continue de fonctionner :
 * PowerSync réessaie tout seul et envoie les opérations en attente au retour du réseau.
 */
export function PowerSyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  // Ouvre la base locale dès le démarrage (sans encore synchroniser) : les écrans seront prêts plus vite
  useEffect(() => {
    powersync.init().catch((error: unknown) => {
      console.warn('Ouverture de la base locale impossible :', error);
    });
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;

    async function start(currentUserId: string) {
      // Si la base locale contient les données d'une AUTRE personne, on l'efface d'abord
      const owner = await AsyncStorage.getItem(OWNER_KEY).catch(() => null);
      if (owner && owner !== currentUserId) {
        await powersync.disconnectAndClear();
      }
      await AsyncStorage.setItem(OWNER_KEY, currentUserId).catch(() => {});
      if (!cancelled) {
        await powersync.connect(connector);
      }
    }

    start(userId).catch((error: unknown) => {
      console.warn('Démarrage de la synchronisation impossible :', error);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return <PowerSyncContext.Provider value={powersync}>{children}</PowerSyncContext.Provider>;
}
