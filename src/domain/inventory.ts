import { costForQuantity } from './quantity';
import { type Allocation, allocate, latestCost, type LotBalance } from './stock';

/**
 * L'inventaire : on compte le stock réel, puis on corrige le stock calculé.
 *
 * Écart = compté − calculé (au moment du comptage).
 *   - Écart négatif (il manque de la marchandise) : on la retire des lots, dans
 *     l'ordre FEFO (les lots périmés d'abord, puisqu'ils périment le plus tôt).
 *   - Écart positif (on en trouve plus que prévu) : on crée un nouveau lot,
 *     au prix du dernier achat connu.
 * Chaque correction est un mouvement « ajustement » : l'historique reste complet.
 */

export type AdjustmentPlan =
  | { kind: 'none' }
  | { kind: 'remove'; allocations: Allocation[]; costAmount: number }
  | {
      kind: 'add';
      quantity: number;
      costPrice: number;
      costQuantity: number;
      costAmount: number;
    };

export function inventoryDifference(expected: number, counted: number): number {
  return counted - expected;
}

/** Comment corriger le stock d'un produit après comptage. */
export function planAdjustment(
  lots: readonly LotBalance[],
  difference: number,
  today: string
): AdjustmentPlan {
  if (difference === 0) {
    return { kind: 'none' };
  }
  const fallbackCost = latestCost(lots);
  if (difference < 0) {
    const { allocations } = allocate(lots, -difference, {
      today,
      allowExpired: true,
      fallbackCost,
    });
    return {
      kind: 'remove',
      allocations,
      costAmount: allocations.reduce((total, part) => total + part.costAmount, 0),
    };
  }
  const cost = fallbackCost ?? { costPrice: 0, costQuantity: 1000 };
  return {
    kind: 'add',
    quantity: difference,
    costPrice: cost.costPrice,
    costQuantity: cost.costQuantity,
    costAmount: costForQuantity(cost.costPrice, cost.costQuantity, difference),
  };
}

/** Valeur (au prix d'achat) d'une correction : négative quand il manque de la marchandise. */
export function adjustmentValue(plan: AdjustmentPlan): number {
  if (plan.kind === 'none') return 0;
  return plan.kind === 'remove' ? -plan.costAmount : plan.costAmount;
}
