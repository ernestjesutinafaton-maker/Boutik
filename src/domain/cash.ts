/**
 * La caisse du jour : l'argent qui devrait s'y trouver, mode de paiement par mode.
 *
 * Attendu = fond de caisse (espèces)
 *         + ventes et remboursements de crédit encaissés
 *         − argent rendu aux clients (retours, annulations)
 *         − dépenses, achats payés par la caisse, retraits du propriétaire
 *         + argent ajouté dans la caisse, et argent remis par les livreurs
 * À la clôture, on compte ce qu'il y a vraiment : la différence est l'écart de caisse.
 */

export type CashMovementType = 'expense' | 'stock_purchase' | 'withdrawal' | 'deposit' | 'handover';

/** Les catégories de dépenses proposées. */
export const EXPENSE_CATEGORIES = [
  'transport', // livraison et transport
  'fuel', // carburant
  'supplies', // fournitures (sachets, papier…)
  'utilities', // électricité, eau, internet, crédit téléphone
  'rent', // loyer
  'salary', // salaire ou avance
  'repairs', // réparations
  'other', // autre
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** + si l'argent entre dans la caisse, − s'il en sort. */
export function cashMovementSign(type: CashMovementType): 1 | -1 {
  // Ajout d'argent, et remise de l'argent encaissé par un livreur : l'argent entre
  return type === 'deposit' || type === 'handover' ? 1 : -1;
}

/** Ce qui devrait se trouver dans la caisse, pour chaque mode de paiement. */
export function expectedByMethod(input: {
  openingFloat: number;
  /** Le mode « Espèces » (le fond de caisse est en espèces) */
  cashMethodId: string | null;
  payments: readonly { methodId: string; amount: number }[];
  movements: readonly { methodId: string; type: CashMovementType; amount: number }[];
}): Record<string, number> {
  const expected: Record<string, number> = {};
  const add = (methodId: string, amount: number) => {
    expected[methodId] = (expected[methodId] ?? 0) + amount;
  };
  if (input.cashMethodId) {
    add(input.cashMethodId, input.openingFloat);
  }
  for (const payment of input.payments) {
    add(payment.methodId, payment.amount);
  }
  for (const movement of input.movements) {
    add(movement.methodId, cashMovementSign(movement.type) * movement.amount);
  }
  return expected;
}

/** Écarts de caisse : compté − attendu, mode par mode et au total. */
export function closingDifferences(
  expected: Readonly<Record<string, number>>,
  counted: Readonly<Record<string, number>>
): { byMethod: Record<string, number>; total: number } {
  const byMethod: Record<string, number> = {};
  for (const methodId of new Set([...Object.keys(expected), ...Object.keys(counted)])) {
    byMethod[methodId] = (counted[methodId] ?? 0) - (expected[methodId] ?? 0);
  }
  return { byMethod, total: Object.values(byMethod).reduce((sum, value) => sum + value, 0) };
}
