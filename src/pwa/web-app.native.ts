/**
 * Sur téléphone et tablette, l'appli n'est pas une page web : pas de service worker
 * ni d'installation par le navigateur. (Les mises à jour de l'appli : voir src/updates/.)
 */
export function useWebUpdate(): { available: boolean; apply: () => void } {
  return { available: false, apply: () => {} };
}

export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void> } {
  return { canInstall: false, install: async () => {} };
}
