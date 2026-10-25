import { daysBetween } from './dates';

/**
 * Le crédit des clients (le « carnet de dettes »).
 *
 * RÈGLE D'OR : on n'enregistre jamais « Awa doit 15 000 ». On note chaque ligne
 * (+ dette d'une vente à crédit, − remboursement, − annulation…) et la dette est
 * leur SOMME. Comme pour le stock, deux appareils hors ligne ne s'écrasent jamais.
 */

export type LedgerType = 'debt' | 'repayment' | 'cancellation' | 'write_off' | 'adjustment';

export type LedgerEntry = {
  type: LedgerType;
  /** + augmente la dette ; − la diminue */
  amount: number;
  /** Moment de l'opération (« 2026-10-25T14:30:00Z ») */
  occurredAt: string;
};

/** Ce que le client doit (négatif = la boutique lui doit de l'argent). */
export function balanceOf(entries: readonly Pick<LedgerEntry, 'amount'>[]): number {
  return entries.reduce((total, entry) => total + entry.amount, 0);
}

/** Ancienneté de la dette : récente, plus de 30 jours, plus de 60 jours. */
export type AgingBucket = 'none' | 'recent' | 'over30' | 'over60';

export type DebtAging = {
  balance: number;
  /** Jour de la plus ancienne dette pas encore remboursée */
  oldestUnpaidDay: string | null;
  /** Âge de cette dette, en jours */
  ageDays: number;
  bucket: AgingBucket;
};

/**
 * Calcule l'ancienneté de la dette d'un client.
 * Les remboursements effacent d'abord les dettes les plus anciennes
 * (comme on le ferait à la main dans un cahier).
 */
export function debtAging(entries: readonly LedgerEntry[], today: string): DebtAging {
  const sorted = [...entries].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));
  // Les dettes encore ouvertes, de la plus ancienne à la plus récente
  const open: { day: string; amount: number }[] = [];
  let credit = 0; // remboursements « en avance » (avant une dette)

  for (const entry of sorted) {
    if (entry.amount > 0) {
      let amount = entry.amount;
      const used = Math.min(credit, amount);
      credit -= used;
      amount -= used;
      if (amount > 0) {
        open.push({ day: entry.occurredAt.slice(0, 10), amount });
      }
    } else {
      let toPay = -entry.amount;
      while (toPay > 0 && open.length > 0) {
        const first = open[0];
        const used = Math.min(first.amount, toPay);
        first.amount -= used;
        toPay -= used;
        if (first.amount === 0) {
          open.shift();
        }
      }
      credit += toPay;
    }
  }

  const balance = balanceOf(entries);
  const oldest = balance > 0 ? (open[0]?.day ?? null) : null;
  const ageDays = oldest ? Math.max(daysBetween(oldest, today), 0) : 0;
  const bucket: AgingBucket = !oldest
    ? 'none'
    : ageDays > 60
      ? 'over60'
      : ageDays > 30
        ? 'over30'
        : 'recent';
  return { balance, oldestUnpaidDay: oldest, ageDays, bucket };
}
