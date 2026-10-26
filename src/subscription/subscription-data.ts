import { useQuery } from '@powersync/react';
import { useEffect, useState } from 'react';

import { type SubscriptionStatus, subscriptionStatus } from '@/domain/subscription';
import { supabase } from '@/lib/supabase';
import { useShop } from '@/shop/shop-provider';

/** L'état de l'abonnement de la boutique (lu dans la base locale : marche hors ligne). */
export function useSubscription(): SubscriptionStatus | null {
  const { shop } = useShop();
  const { data } = useQuery<{ created_at: string | null; paid_until: string | null }>(
    'SELECT created_at, paid_until FROM shops WHERE id = ?',
    [shop?.id ?? '']
  );
  const row = data[0];
  if (!row?.created_at) {
    return null;
  }
  return subscriptionStatus({
    shopCreatedAt: new Date(row.created_at),
    paidUntil: row.paid_until ? new Date(row.paid_until) : null,
    now: new Date(),
  });
}

export type Quote = { monthlyPrice: number; reason: 'welcome' | 'tier'; averageRevenue: number };

/** Le prix mensuel calculé par le serveur (internet nécessaire). */
export async function fetchQuote(shopId: string): Promise<Quote> {
  const { data, error } = await supabase.rpc('subscription_quote', { p_shop_id: shopId });
  if (error || !data?.[0]) {
    throw error ?? new Error('Prix indisponible');
  }
  const row = data[0];
  return {
    monthlyPrice: Number(row.monthly_price),
    reason: row.reason === 'welcome' ? 'welcome' : 'tier',
    averageRevenue: Number(row.average_revenue),
  };
}

/** Vrai si la personne connectée est administrateur de la plateforme Boutik. */
export function useIsPlatformAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc('am_i_platform_admin')
      .then(({ data }) => {
        if (!cancelled) setIsAdmin(data === true);
      })
      .then(undefined, () => {
        // Hors ligne : on ne montre pas l'écran d'administration
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return isAdmin;
}
