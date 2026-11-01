import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { fetchPendingInvites } from './invitations';

/**
 * Les liens d'invitation encore valables de la boutique (profil → fin de validité), relus chaque
 * fois que l'écran revient au premier plan. Vide hors ligne (rien n'est inventé).
 */
export function usePendingInvites(shopId: string | null): {
  pending: Record<string, Date>;
  refresh: () => void;
} {
  const [pending, setPending] = useState<Record<string, Date>>({});

  const load = useCallback(() => {
    if (!shopId) return undefined;
    let cancelled = false;
    fetchPendingInvites(shopId).then((found) => {
      if (!cancelled) setPending(found);
    });
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  useFocusEffect(load);

  return { pending, refresh: () => void load() };
}
