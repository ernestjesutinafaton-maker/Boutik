/**
 * Les livraisons : leurs états, ce qu'un livreur peut faire, l'argent qu'il garde.
 *
 * Les règles sont les MÊMES que celles du serveur (supabase/migrations/…_livraisons.sql),
 * qui les vérifie de son côté : ici, elles servent à n'afficher que les bons boutons.
 */

export const DELIVERY_STATUSES = [
  'pending', // à faire (pas encore prise, ou prise mais pas commencée)
  'in_progress', // en cours : un livreur s'en occupe
  'delivered', // livrée
  'failed', // pas livrée (client absent…), avec une raison : à replanifier
  'cancelled', // annulée par la boutique
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Les dépenses qu'un livreur peut déclarer (mêmes valeurs que les dépenses de la caisse). */
export const COURIER_EXPENSE_CATEGORIES = ['fuel', 'transport', 'repairs', 'other'] as const;

export type CourierExpenseCategory = (typeof COURIER_EXPENSE_CATEGORIES)[number];

export type DeliveryExpenseStatus = 'pending' | 'reimbursed' | 'rejected';

export function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return typeof value === 'string' && (DELIVERY_STATUSES as readonly string[]).includes(value);
}

/** Livrée ou annulée : la livraison ne change plus. */
export function isFinalStatus(status: DeliveryStatus): boolean {
  return status === 'delivered' || status === 'cancelled';
}

/** Les trois onglets de la liste des livraisons. */
export type DeliveryGroup = 'todo' | 'active' | 'done';

export function deliveryGroup(status: DeliveryStatus): DeliveryGroup {
  switch (status) {
    case 'pending':
    case 'failed': // à replanifier
      return 'todo';
    case 'in_progress':
      return 'active';
    case 'delivered':
    case 'cancelled':
      return 'done';
  }
}

/** Ce qu'un livreur peut faire sur une livraison. */
export type CourierAction = 'take' | 'complete' | 'fail' | 'release';

/**
 * Les boutons du livreur : il prend une livraison ouverte (ou la sienne), puis il la livre,
 * la marque « pas livrée » ou la rend. Jamais celle d'un autre livreur.
 */
export function courierActions(
  delivery: { status: DeliveryStatus; assignedTo: string | null },
  memberId: string
): CourierAction[] {
  if (isFinalStatus(delivery.status)) {
    return [];
  }
  if (delivery.assignedTo !== null && delivery.assignedTo !== memberId) {
    return [];
  }
  if (delivery.status === 'in_progress') {
    return ['complete', 'fail', 'release'];
  }
  return ['take'];
}

/** Ce que l'appli propose d'encaisser : le montant prévu, sans dépasser ce que doit le client. */
export function suggestedCollection(planned: number, customerBalance: number): number {
  return Math.max(0, Math.min(planned, customerBalance));
}

/** Un montant encaissé à la livraison : ni négatif, ni plus que la dette du client. */
export function collectionError(
  amount: number,
  customerBalance: number
): 'negative' | 'tooMuch' | null {
  if (!Number.isInteger(amount) || amount < 0) {
    return 'negative';
  }
  if (amount > Math.max(0, customerBalance)) {
    return 'tooMuch';
  }
  return null;
}

/**
 * L'argent liquide que garde chaque livreur : ce qu'il a encaissé à ses livraisons (hors caisse
 * ouverte), moins ce qu'il a déjà remis à la caisse. Seuls les livreurs qui doivent quelque
 * chose (ou à qui on doit, en cas d'erreur de saisie) apparaissent.
 */
export function courierBalances(
  collected: readonly { courierId: string; amount: number }[],
  handedOver: readonly { courierId: string; amount: number }[]
): Map<string, number> {
  const balances = new Map<string, number>();
  for (const line of collected) {
    balances.set(line.courierId, (balances.get(line.courierId) ?? 0) + line.amount);
  }
  for (const line of handedOver) {
    balances.set(line.courierId, (balances.get(line.courierId) ?? 0) - line.amount);
  }
  for (const [courierId, amount] of balances) {
    if (amount === 0) {
      balances.delete(courierId);
    }
  }
  return balances;
}

/** Le chemin de la photo d'un reçu : <boutique>/<livreur>/<dépense>.jpg (dossier du livreur). */
export function receiptPath(shopId: string, courierId: string, expenseId: string): string {
  return `${shopId}/${courierId}/${expenseId}.jpg`;
}

/** Lit une heure tapée : « 15:30 », « 15h30 », « 15h », « 9 ». Renvoie null si elle est invalide. */
export function parseTime(input: string): { hours: number; minutes: number } | null {
  const match = /^\s*(\d{1,2})\s*(?:[:hH.]\s*(\d{2})?)?\s*$/.exec(input);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return { hours, minutes };
}

/** Le moment souhaité (ISO) : un jour (AAAA-MM-JJ) à une heure, à l'heure du téléphone. */
export function requestedMoment(day: string, time: { hours: number; minutes: number }): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, time.hours, time.minutes).toISOString();
}
