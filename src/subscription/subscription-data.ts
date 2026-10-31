import { useQuery } from '@powersync/react';
import { useEffect, useState } from 'react';

import type { SubscriptionOperator } from '@/config/subscription';
import { type SubscriptionStatus, subscriptionStatus } from '@/domain/subscription';
import { supabase } from '@/lib/supabase';
import { useShop } from '@/shop/shop-provider';

import { uploadPaymentProof } from './payment-proof';

/** L'heure qui avance toutes les minutes : la fin d'un essai ou d'un abonnement est vue à temps. */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * L'état de l'abonnement de la boutique, lu dans la base locale (marche hors ligne).
 * isLoading : la ligne de la boutique n'est pas encore lue (ne rien bloquer trop tôt).
 */
export function useSubscriptionState(): { status: SubscriptionStatus | null; isLoading: boolean } {
  const { shop } = useShop();
  const now = useMinuteClock();
  const { data, isLoading } = useQuery<{
    created_at: string | null;
    paid_until: string | null;
    provisional_until: string | null;
  }>('SELECT created_at, paid_until, provisional_until FROM shops WHERE id = ?', [shop?.id ?? '']);
  const row = data[0];
  if (!row?.created_at) {
    return { status: null, isLoading };
  }
  return {
    status: subscriptionStatus({
      shopCreatedAt: new Date(row.created_at),
      paidUntil: row.paid_until ? new Date(row.paid_until) : null,
      provisionalUntil: row.provisional_until ? new Date(row.provisional_until) : null,
      now,
    }),
    isLoading,
  };
}

/** L'état de l'abonnement de la boutique (null tant qu'il n'est pas connu). */
export function useSubscription(): SubscriptionStatus | null {
  return useSubscriptionState().status;
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

export type PaymentDeclaration = {
  shopId: string;
  months: number;
  operator: SubscriptionOperator;
  senderPhone: string;
  reference: string;
  /** Heure du transfert Mobile Money indiquée par le client */
  paidAt: Date;
  /** Message pour la vérification (peut être vide) */
  message: string;
  /** La capture du paiement, en base64 (obligatoire) */
  proofBase64: string;
};

/** Pourquoi une déclaration n'est pas passée (traduit à l'écran, jamais l'erreur brute). */
export type DeclareFailure = 'duplicate' | 'proof' | 'time' | 'network';

export type DeclareResult =
  { ok: true; provisionalUntil: Date | null } | { ok: false; reason: DeclareFailure };

/**
 * Déclare un paiement : la capture part d'abord dans le stockage privé, puis le serveur
 * enregistre la déclaration (il recalcule le prix et décide de l'accès provisoire).
 */
export async function declarePayment(input: PaymentDeclaration): Promise<DeclareResult> {
  let proofPath: string;
  try {
    proofPath = await uploadPaymentProof(input.shopId, input.proofBase64);
  } catch {
    return { ok: false, reason: 'network' };
  }
  const { data, error } = await supabase.rpc('declare_subscription_payment', {
    p_shop_id: input.shopId,
    p_months: input.months,
    p_operator: input.operator,
    p_sender_phone: input.senderPhone,
    p_reference: input.reference,
    p_paid_at: input.paidAt.toISOString(),
    p_message: input.message.trim(),
    p_proof_path: proofPath,
  });
  if (error) {
    return { ok: false, reason: declareFailure(error) };
  }
  const provisional = data?.[0]?.provisional_until;
  return { ok: true, provisionalUntil: provisional ? new Date(provisional) : null };
}

/** Les refus du serveur (ses propres messages, voir la migration) → une raison affichable. */
function declareFailure(error: { code?: string; message?: string }): DeclareFailure {
  const message = error.message ?? '';
  if (error.code === '23505') {
    return /capture|proof/i.test(message) ? 'proof' : 'duplicate';
  }
  if (error.code === '22023') {
    return /heure/i.test(message) ? 'time' : 'proof';
  }
  return 'network';
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

/** Le nombre de paiements à vérifier (administrateur seulement ; null sinon ou hors ligne). */
export function usePendingPaymentsCount(isAdmin: boolean): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    supabase
      .rpc('admin_overview')
      .then(({ data }) => {
        if (!cancelled && data?.[0]) setCount(Number(data[0].payments_pending));
      })
      .then(undefined, () => {
        // Hors ligne : pas de compteur
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);
  return isAdmin ? count : null;
}
