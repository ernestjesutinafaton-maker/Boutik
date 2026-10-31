import type { Permission } from './permissions';

/**
 * Modifier une vente déjà faite : le client revient changer ou rendre des articles, ou le
 * vendeur s'est trompé. Fonctions pures (sans base de données).
 *
 * Le propriétaire choisit un délai (24 h par défaut). Pendant ce délai, la vente peut être
 * modifiée ; ensuite elle est « archivée » : on la consulte, mais seul le propriétaire peut
 * encore la modifier (avec un avertissement).
 */

/** Le délai par défaut, en heures. */
export const DEFAULT_RETURN_WINDOW_HOURS = 24;

/** Les délais proposés au propriétaire, en heures (0 = aucune modification possible). */
export const RETURN_WINDOW_CHOICES = [0, 24, 48, 72, 168, 720] as const;

const HOUR_MS = 60 * 60 * 1000;

/** Jusqu'à quand la vente peut être modifiée (moment universel). */
export function editDeadline(occurredAt: string, windowHours: number): string {
  return new Date(Date.parse(occurredAt) + windowHours * HOUR_MS).toISOString();
}

export type SaleEditRight = {
  /** La personne peut modifier la vente (et reprendre des articles) */
  allowed: boolean;
  /** Le délai est dépassé (seul le propriétaire peut encore modifier) */
  late: boolean;
  /** Fin du délai de modification */
  deadline: string;
  /** Pourquoi c'est refusé : annulée, délai dépassé, pas sa vente, pas le droit */
  reason: 'ok' | 'cancelled' | 'late' | 'notOwnSale' | 'forbidden';
};

/**
 * Qui peut modifier une vente, et jusqu'à quand :
 *   - pendant le délai : ceux qui peuvent annuler (propriétaire, gérant) toutes les ventes ;
 *     un vendeur ou un caissier seulement SES ventes (corriger une erreur de saisie) ;
 *   - après le délai : le propriétaire seulement (droit « sale.edit_late »).
 */
export function saleEditRight(input: {
  status: 'completed' | 'cancelled';
  occurredAt: string;
  sellerId: string | null;
  windowHours: number;
  now: string;
  memberId: string | null;
  can: (permission: Permission) => boolean;
}): SaleEditRight {
  const deadline = editDeadline(input.occurredAt, input.windowHours);
  if (input.status !== 'completed') {
    return { allowed: false, late: false, deadline, reason: 'cancelled' };
  }
  const late = Date.parse(input.now) >= Date.parse(deadline);
  if (late) {
    const allowed = input.can('sale.edit_late');
    return { allowed, late, deadline, reason: allowed ? 'ok' : 'late' };
  }
  if (input.can('sale.cancel')) {
    return { allowed: true, late, deadline, reason: 'ok' };
  }
  if (input.can('sale.create')) {
    const own = input.sellerId !== null && input.sellerId === input.memberId;
    return { allowed: own, late, deadline, reason: own ? 'ok' : 'notOwnSale' };
  }
  return { allowed: false, late, deadline, reason: 'forbidden' };
}

/** Ce qui reste à payer (nouveau total plus grand) ou à rendre (plus petit). */
export function modificationBalance(
  newTotal: number,
  alreadyPaid: number
): { toPay: number; toRefund: number } {
  return {
    toPay: Math.max(newTotal - alreadyPaid, 0),
    toRefund: Math.max(alreadyPaid - newTotal, 0),
  };
}

/**
 * L'argent déjà payé pour l'ancienne vente est reporté sur la nouvelle, mode par mode,
 * jusqu'au nouveau total. S'il y en a trop, le surplus est rendu au client : on reporte
 * d'abord les AUTRES modes, pour que le rendu se fasse avec le mode choisi (espèces…).
 *   Payé 6 000 en espèces + 4 000 par MoMo, nouveau total 7 000, rendu en espèces
 *   → reporté : MoMo 4 000 + espèces 3 000 ; rendu : 3 000 en espèces.
 */
export function carryPayments(
  paidByMethod: readonly { methodId: string; amount: number }[],
  newTotal: number,
  refundMethodId: string | null
): { carried: { methodId: string; amount: number }[]; refund: number } {
  const ordered = [
    ...paidByMethod.filter((payment) => payment.methodId !== refundMethodId),
    ...paidByMethod.filter((payment) => payment.methodId === refundMethodId),
  ];
  let left = Math.max(newTotal, 0);
  const carried: { methodId: string; amount: number }[] = [];
  for (const payment of ordered) {
    const amount = Math.min(Math.max(payment.amount, 0), left);
    if (amount > 0) {
      carried.push({ methodId: payment.methodId, amount });
      left -= amount;
    }
  }
  const paid = paidByMethod.reduce((sum, payment) => sum + Math.max(payment.amount, 0), 0);
  const kept = carried.reduce((sum, payment) => sum + payment.amount, 0);
  return { carried, refund: paid - kept };
}
