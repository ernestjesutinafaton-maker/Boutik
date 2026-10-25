import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

import { powersync } from '@/db/database';
import { authStorage } from '@/lib/auth-storage';
import { AUTH_STORAGE_KEY, supabase } from '@/lib/supabase';
import { clearShopCache } from '@/shop/shop-cache';

type AuthContextValue = {
  /** La session de la personne connectée, ou null si personne n'est connecté */
  session: Session | null;
  /** Vrai au démarrage, le temps de relire la session gardée dans l'appareil */
  isLoading: boolean;
  /** Déconnecte ET efface les données de la boutique de cet appareil */
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Relit nous-mêmes la session gardée dans l'appareil (sans passer par le serveur). */
async function readStoredSession(): Promise<Session | null> {
  try {
    const raw = await authStorage.getItem(AUTH_STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Session) : null;
    return stored?.user && stored.refresh_token ? stored : null;
  } catch {
    return null;
  }
}

/**
 * La session au démarrage de l'application.
 *
 * Cas important : HORS LIGNE avec une session EXPIRÉE (plus d'une heure sans internet).
 * Supabase garde la session dans l'appareil, mais ne peut pas la renouveler et répond
 * « personne ». On reprend alors la session gardée : on continue à travailler hors ligne,
 * et elle sera renouvelée toute seule au retour d'internet.
 */
async function loadInitialSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (data.session) {
    return data.session;
  }
  if (error && isAuthRetryableFetchError(error)) {
    return readStoredSession();
  }
  return null;
}

/**
 * Suit en permanence qui est connecté, et le partage avec tous les écrans.
 * La session est gardée dans l'appareil : on reste connecté en rouvrant l'application,
 * même sans internet.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Au démarrage : retrouver la session (voir loadInitialSession).
    //    Si tout échoue, on continue comme « pas connecté » : sinon l'écran de
    //    démarrage resterait affiché pour toujours.
    loadInitialSession()
      .then(setSession)
      .catch((error: unknown) => {
        console.warn('Lecture de la session impossible :', error);
        setSession(null);
      })
      .finally(() => setIsLoading(false));

    // 2. Ensuite : être prévenu de chaque connexion, déconnexion ou renouvellement.
    //    Un événement « sans session » qui n'est pas une vraie déconnexion (par exemple
    //    au démarrage hors ligne) ne doit pas nous déconnecter.
    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession) {
        setSession(newSession);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await clearShopCache();
    // Efface la base locale : sur un appareil partagé, rien ne doit rester de la boutique.
    // (L'écran « Plus » vérifie d'abord qu'aucune opération n'attend encore d'être envoyée.)
    await powersync.disconnectAndClear();
    // « local » : la déconnexion marche même sans internet
    await supabase.auth.signOut({ scope: 'local' });
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, isLoading, signOut }}>{children}</AuthContext.Provider>
  );
}

/** Pour savoir, depuis n'importe quel écran, qui est connecté. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth doit être utilisé à l’intérieur de AuthProvider.');
  }
  return value;
}
