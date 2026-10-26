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
 *   - La fin d'un abonnement ne bloque JAMAIS les ventes ni le carnet de crédit.
 */

export const TRIAL_DAYS = 15;
export const WELCOME_MONTHS = 3;
export const WELCOME_PRICE = 10_000;
/** Délai après la fin de l'abonnement avant de limiter les fonctions avancées */
export const GRACE_DAYS = 7;

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
  | { state: 'grace'; since: Date; daysLeft: number }
  | { state: 'expired'; since: Date };

const DAY = 86_400_000;

/** Où en est la boutique : essai, abonnée, délai de grâce, ou expirée (fonctions avancées limitées). */
export function subscriptionStatus(input: {
  shopCreatedAt: Date;
  paidUntil: Date | null;
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
  const end = input.paidUntil && input.paidUntil > trialEnd ? input.paidUntil : trialEnd;
  const graceEnd = new Date(end.getTime() + GRACE_DAYS * DAY);
  if (graceEnd > input.now) {
    return { state: 'grace', since: end, daysLeft: daysTo(graceEnd) };
  }
  return { state: 'expired', since: end };
}

/** Vrai si les fonctions avancées (tableau de bord, comptes, export) sont limitées. */
export function isLimited(status: SubscriptionStatus): boolean {
  return status.state === 'expired';
}
