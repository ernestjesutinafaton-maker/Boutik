import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  /** La session de la personne connectée, ou null si personne n'est connecté */
  session: Session | null;
  /** Vrai au démarrage, le temps de relire la session gardée dans l'appareil */
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Suit en permanence qui est connecté, et le partage avec tous les écrans.
 * La session est gardée dans l'appareil : on reste connecté en rouvrant l'application.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Au démarrage : relire la session gardée dans l'appareil
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    // 2. Ensuite : être prévenu de chaque connexion, déconnexion ou renouvellement
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signOut() {
    // « local » : la déconnexion marche même sans internet
    await supabase.auth.signOut({ scope: 'local' });
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
