import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';

import { VERSION_INFO_URL } from '@/config/downloads';
import { compareVersions } from '@/domain/version';

/**
 * Mises à jour de l'appli — TÉLÉPHONE et TABLETTE.
 *
 * 1. Mise à jour « à distance » (EAS Update) : le nouveau code est téléchargé en
 *    arrière-plan au démarrage ; un bandeau propose ensuite de redémarrer l'appli.
 * 2. Nouvelle version de l'APK (quand il faut réinstaller l'appli, par exemple après
 *    l'ajout d'un module natif) : un petit fichier sur le site annonce la dernière version.
 */
export function useAppUpdate(): { ready: boolean; apply: () => void } {
  const { isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    // Pas de mise à jour à distance pendant le développement (le code vient du PC)
    if (!Updates.isEnabled || __DEV__) return;
    Updates.checkForUpdateAsync()
      .then((result) => (result.isAvailable ? Updates.fetchUpdateAsync() : null))
      .catch(() => {
        // Pas d'internet : on réessaiera au prochain démarrage
      });
  }, []);

  return {
    ready: isUpdatePending,
    apply: () => {
      void Updates.reloadAsync();
    },
  };
}

type VersionInfo = { android?: { version?: string; url?: string } };

/** Une version plus récente de l'APK à télécharger, ou null. */
export function useNewApk(): { version: string; url: string } | null {
  const [newer, setNewer] = useState<{ version: string; url: string } | null>(null);

  useEffect(() => {
    const current = Constants.expoConfig?.version;
    if (!VERSION_INFO_URL || !current) return;
    let cancelled = false;
    fetch(VERSION_INFO_URL)
      .then((response) => (response.ok ? (response.json() as Promise<VersionInfo>) : null))
      .then((info) => {
        const latest = info?.android;
        if (
          !cancelled &&
          latest?.version &&
          latest.url &&
          compareVersions(latest.version, current) > 0
        ) {
          setNewer({ version: latest.version, url: latest.url });
        }
      })
      .catch(() => {
        // Pas d'internet : rien à afficher
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return newer;
}
