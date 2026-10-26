import { useEffect, useState } from 'react';

/**
 * La version web installable (PWA) — dans le NAVIGATEUR :
 *   - « nouvelle version disponible » : le service worker a reçu une nouvelle version ;
 *   - « installer Boutik » : le navigateur propose d'installer l'appli (Chrome, Edge…).
 * Sur téléphone et tablette (appli Android / iOS), voir web-app.native.ts.
 */

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

/** Une nouvelle version de l'appli web attend : la personne choisit quand recharger. */
export function useWebUpdate(): { available: boolean; apply: () => void } {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;
    const watch = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        setWaiting(registration.waiting);
      }
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => {
          if (
            !cancelled &&
            installing.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            setWaiting(installing);
          }
        });
      });
    };
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration && !cancelled) watch(registration);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function apply() {
    if (!waiting) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  return { available: waiting !== null, apply };
}

/** Le navigateur propose d'installer Boutik comme une appli (icône sur le bureau / l'écran). */
export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void> } {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (prompt: Event) => {
      prompt.preventDefault();
      setEvent(prompt as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  async function install() {
    if (!event) return;
    await event.prompt();
    setEvent(null);
  }

  return { canInstall: event !== null, install };
}
