import { daysBetween } from './dates';

/**
 * Alertes de péremption.
 *   expired = périmé (date dépassée) : vente bloquée, sauf forçage par le propriétaire
 *   urgent  = périme dans moins de 7 jours (2e alerte, réglable)
 *   soon    = périme dans moins de 30 jours (1re alerte, réglable)
 *   ok      = rien à signaler
 */
export type ExpiryLevel = 'expired' | 'urgent' | 'soon' | 'ok';

export type ExpiryAlertDays = { first: number; second: number };

export const DEFAULT_EXPIRY_ALERT_DAYS: ExpiryAlertDays = { first: 30, second: 7 };

/** Le niveau d'alerte d'une date de péremption, à la date d'aujourd'hui. */
export function expiryLevel(
  expiryDate: string | null,
  today: string,
  days: ExpiryAlertDays = DEFAULT_EXPIRY_ALERT_DAYS
): ExpiryLevel {
  if (!expiryDate) {
    return 'ok';
  }
  const remaining = daysBetween(today, expiryDate);
  if (remaining < 0) return 'expired';
  if (remaining <= days.second) return 'urgent';
  if (remaining <= days.first) return 'soon';
  return 'ok';
}

const SEVERITY: Record<ExpiryLevel, number> = { ok: 0, soon: 1, urgent: 2, expired: 3 };

/** Le niveau le plus grave parmi plusieurs (ex. tous les lots d'un produit). */
export function worstLevel(levels: readonly ExpiryLevel[]): ExpiryLevel {
  return levels.reduce<ExpiryLevel>(
    (worst, level) => (SEVERITY[level] > SEVERITY[worst] ? level : worst),
    'ok'
  );
}
