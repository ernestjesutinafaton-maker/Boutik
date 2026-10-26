/**
 * Mises à jour de l'appli — version NAVIGATEUR : rien à faire ici, la version web
 * se met à jour par son service worker (voir src/pwa/web-app.ts).
 */
export function useAppUpdate(): { ready: boolean; apply: () => void } {
  return { ready: false, apply: () => {} };
}

export function useNewApk(): { version: string; url: string } | null {
  return null;
}
