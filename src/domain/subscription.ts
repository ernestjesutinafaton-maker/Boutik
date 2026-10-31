/**
 * L'abonnement Boutik (Bénin, FCFA).
 * 👉 Pour changer les prix ou les plages, modifie UNIQUEMENT ce fichier
 *    (et la même table dans la migration …_abonnement.sql, qui recalcule le prix côté serveur).
 *
 * Règles :
 *   - 15 jours d'essai gratuit à la création de la boutique ;
 *   - mois 1 à 3 de la boutique : 10 000 F / mois (prix de bienvenue) ;
 *   - ensuite, le prix de chaque trimestre dépend de la MOYENNE MENSUELLE du chiffre
 *     d'affaires (ventes non annulées) du trimestre précédent.
 *   - 7 jours après la fin de l'essai ou de l'abonnement sans paiement, la boutique est EN PAUSE :
 *     tout est bloqué sauf le paiement (décision d'Ernest, 01/11/2026). Les données sont gardées.
 *   - Un paiement déclaré ouvre un accès provisoire de 3 jours pendant sa vérification
 *     (accordé par le serveur : une fois par 30 jours, jamais juste après un refus).
 *   Les mêmes règles sont appliquées par le serveur (migration …_abonnement_securise.sql).
 */

import { parseDayInput } from './dates';

export const TRIAL_DAYS = 15;
export const WELCOME_MONTHS = 3;
export const WELCOME_PRICE = 10_000;
/** Délai après la fin de l'essai ou de l'abonnement avant la mise en pause de la boutique */
export const GRACE_DAYS = 7;
/** Accès provisoire pendant la vérification d'un paiement (fixé par le serveur) */
export const PROVISIONAL_DAYS = 3;

export const TIERS = [
  { upTo: 1_500_000, monthlyPrice: 10_000, label: 'Moins de 1 500 000 F de ventes par mois' },
  { upTo: 5_000_000, monthlyPrice: 15_000, label: 'De 1 500 000 à 5 000 000 F par mois' },
  { upTo: Number.POSITIVE_INFINITY, monthlyPrice: 25_000, label: 'Plus de 5 000 000 F par mois' },
] as const;

export const DURATIONS = [1, 3, 6] as const;
export type Duration = (typeof DURATIONS)[number];

/** Le palier correspondant à une moyenne mensuelle de chiffre d'affaires. */
export function tierFor(averageMonthlyRevenue: number) {
  return TIERS.find((tier) => averageMonthlyRevenue < tier.upTo) ?? TIERS[TIERS.length - 1];
}

/** Ajoute des mois à une date (le 31 janvier + 1 mois = fin février). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/** Combien de mois complets depuis la création de la boutique. */
export function monthsSince(start: Date, now: Date): number {
  let months = 0;
  while (addMonths(start, months + 1) <= now) months++;
  return months;
}

/**
 * Le prix mensuel aujourd'hui.
 *   revenueOfPreviousQuarter : total des ventes du trimestre précédent (3 mois complets).
 */
export function monthlyPrice(input: {
  shopCreatedAt: Date;
  now: Date;
  revenueOfPreviousQuarter: number;
}): { price: number; reason: 'welcome' | 'tier'; tierLabel: string | null } {
  if (monthsSince(input.shopCreatedAt, input.now) < WELCOME_MONTHS) {
    return { price: WELCOME_PRICE, reason: 'welcome', tierLabel: null };
  }
  const tier = tierFor(Math.floor(input.revenueOfPreviousQuarter / 3));
  return { price: tier.monthlyPrice, reason: 'tier', tierLabel: tier.label };
}

/** Le trimestre en cours de la boutique (0 = mois 1 à 3) et ses dates. */
export function currentQuarter(shopCreatedAt: Date, now: Date) {
  const index = Math.floor(monthsSince(shopCreatedAt, now) / 3);
  return {
    index,
    start: addMonths(shopCreatedAt, index * 3),
    end: addMonths(shopCreatedAt, index * 3 + 3),
    previousStart: index > 0 ? addMonths(shopCreatedAt, (index - 1) * 3) : null,
  };
}

export type SubscriptionStatus =
  | { state: 'trial'; until: Date; daysLeft: number }
  | { state: 'active'; until: Date; daysLeft: number }
  /** Paiement déclaré, en cours de vérification : la boutique travaille jusqu'à « until » */
  | { state: 'provisional'; until: Date; daysLeft: number }
  | { state: 'grace'; since: Date; daysLeft: number }
  | { state: 'expired'; since: Date };

const DAY = 86_400_000;

/**
 * Où en est la boutique : essai, abonnée, en vérification, délai de grâce, ou expirée
 * (en pause : tout est bloqué sauf le paiement).
 */
export function subscriptionStatus(input: {
  shopCreatedAt: Date;
  paidUntil: Date | null;
  provisionalUntil: Date | null;
  now: Date;
}): SubscriptionStatus {
  const trialEnd = new Date(input.shopCreatedAt.getTime() + TRIAL_DAYS * DAY);
  const daysTo = (date: Date) => Math.ceil((date.getTime() - input.now.getTime()) / DAY);
  if (input.paidUntil && input.paidUntil > input.now) {
    return { state: 'active', until: input.paidUntil, daysLeft: daysTo(input.paidUntil) };
  }
  if (trialEnd > input.now) {
    return { state: 'trial', until: trialEnd, daysLeft: daysTo(trialEnd) };
  }
  if (input.provisionalUntil && input.provisionalUntil > input.now) {
    return {
      state: 'provisional',
      until: input.provisionalUntil,
      daysLeft: daysTo(input.provisionalUntil),
    };
  }
  const end = input.paidUntil && input.paidUntil > trialEnd ? input.paidUntil : trialEnd;
  const graceEnd = new Date(end.getTime() + GRACE_DAYS * DAY);
  if (graceEnd > input.now) {
    return { state: 'grace', since: end, daysLeft: daysTo(graceEnd) };
  }
  return { state: 'expired', since: end };
}

/** Vrai si la boutique est en pause : tout est bloqué sauf le paiement de l'abonnement. */
export function isBlocked(
  status: SubscriptionStatus
): status is Extract<SubscriptionStatus, { state: 'expired' }> {
  return status.state === 'expired';
}

/** Une heure de paiement plus vieille ou plus lointaine est refusée (comme par le serveur). */
const PAYMENT_MAX_AGE_DAYS = 30;
const PAYMENT_FUTURE_TOLERANCE_MS = 10 * 60_000;

/**
 * L'heure du paiement tapée par le client (« 31/10/2026 » et « 14:05 » ou « 14h05 ») →
 * le moment exact (heure du téléphone). Null si invalide, dans le futur, ou plus vieux que
 * 30 jours : les mêmes limites que le serveur.
 */
export function parsePaymentMoment(dayText: string, timeText: string, now: Date): Date | null {
  const day = parseDayInput(dayText);
  const time = /^(\d{1,2})\s*[h:.]\s*(\d{2})$/i.exec(timeText.trim());
  if (!day || !time) {
    return null;
  }
  const hours = Number(time[1]);
  const minutes = Number(time[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  const [year, month, date] = day.split('-').map(Number);
  const moment = new Date(year, month - 1, date, hours, minutes);
  if (moment.getTime() > now.getTime() + PAYMENT_FUTURE_TOLERANCE_MS) {
    return null;
  }
  if (moment.getTime() < now.getTime() - PAYMENT_MAX_AGE_DAYS * DAY) {
    return null;
  }
  return moment;
}
