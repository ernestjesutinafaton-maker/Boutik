import { costForQuantity, lineAmount, toBaseQuantity } from './quantity';

/**
 * Le stock, calculé à partir des mouvements.
 *
 * RÈGLE D'OR : on n'enregistre JAMAIS « le stock vaut 50 ». On enregistre chaque
 * mouvement (+500 kg reçus, −3,5 kg vendus…) et le stock est leur SOMME.
 * Ainsi deux appareils qui vendent hors ligne en même temps ne s'écrasent pas :
 * leurs mouvements s'additionnent quand ils se synchronisent.
 *
 * Chaque entrée de stock crée un LOT (avec son prix d'achat et sa date de péremption).
 * Les sorties sont prises dans les lots : d'abord celui qui périme le plus tôt
 * (FEFO), puis le plus ancien (FIFO) pour les produits sans date.
 */

export type MovementLike = { lotId: string | null; quantity: number; costAmount: number };

/** Stock = somme des mouvements (en millièmes d'unité de base). */
export function sumQuantities(movements: readonly Pick<MovementLike, 'quantity'>[]): number {
  return movements.reduce((total, movement) => total + movement.quantity, 0);
}

/** Un lot, avec ce qu'il en reste. */
export type LotBalance = {
  id: string;
  /** Date de péremption « 2026-12-31 » (null = pas de date) */
  expiryDate: string | null;
  /** Moment de la réception (sert à l'ordre FIFO) */
  receivedAt: string;
  /** Prix d'achat « costPrice » pour « costQuantity » millièmes (règle de trois) */
  costPrice: number;
  costQuantity: number;
  /** Ce qu'il reste dans le lot = somme de SES mouvements */
  remaining: number;
};

/** Ce qu'il reste dans chaque lot, d'après les mouvements. */
export function lotBalances(
  lots: readonly Omit<LotBalance, 'remaining'>[],
  movements: readonly MovementLike[]
): LotBalance[] {
  const remaining = new Map<string, number>();
  for (const movement of movements) {
    if (movement.lotId) {
      remaining.set(movement.lotId, (remaining.get(movement.lotId) ?? 0) + movement.quantity);
    }
  }
  return lots.map((lot) => ({ ...lot, remaining: remaining.get(lot.id) ?? 0 }));
}

/** Vrai si le lot est périmé (date passée). Le jour même de la date, il est encore vendable. */
export function isExpired(lot: Pick<LotBalance, 'expiryDate'>, today: string): boolean {
  return lot.expiryDate !== null && lot.expiryDate < today;
}

/** L'ordre de sortie des lots : péremption la plus proche d'abord, puis le plus ancien. */
export function fefoOrder<T extends Pick<LotBalance, 'expiryDate' | 'receivedAt' | 'id'>>(
  lots: readonly T[]
): T[] {
  return [...lots].sort((a, b) => {
    if (a.expiryDate !== b.expiryDate) {
      if (a.expiryDate === null) return 1;
      if (b.expiryDate === null) return -1;
      return a.expiryDate < b.expiryDate ? -1 : 1;
    }
    if (a.receivedAt !== b.receivedAt) {
      return a.receivedAt < b.receivedAt ? -1 : 1;
    }
    return a.id < b.id ? -1 : 1;
  });
}

/** Une part de sortie : tant de millièmes pris dans tel lot, à tel coût. */
export type Allocation = {
  /** null = rien dans les lots (vente alors que le stock affiché est à 0) */
  lotId: string | null;
  quantity: number;
  costAmount: number;
};

export type AllocationResult = {
  allocations: Allocation[];
  /** Quantité qui n'a été trouvée dans aucun lot vendable */
  shortfall: number;
  /** Partie du manque qui existe pourtant… dans des lots périmés (vente bloquée sauf forçage) */
  expiredAvailable: number;
};

/**
 * Choisit dans quels lots prendre une quantité qui sort (vente, perte, ajustement).
 *   - Lots périmés ignorés, sauf si « allowExpired » (forçage par le propriétaire, tracé).
 *   - S'il manque de la marchandise dans les lots, le reste sort « sans lot »,
 *     au coût du dernier achat connu (fallbackCost), pour garder un bénéfice juste.
 */
export function allocate(
  lots: readonly LotBalance[],
  quantity: number,
  options: {
    today: string;
    allowExpired?: boolean;
    fallbackCost?: { costPrice: number; costQuantity: number } | null;
  }
): AllocationResult {
  const allocations: Allocation[] = [];
  let needed = quantity;
  let expiredAvailable = 0;

  for (const lot of fefoOrder(lots)) {
    if (needed <= 0) break;
    if (lot.remaining <= 0) continue;
    if (isExpired(lot, options.today) && !options.allowExpired) {
      expiredAvailable += lot.remaining;
      continue;
    }
    const take = Math.min(lot.remaining, needed);
    allocations.push({
      lotId: lot.id,
      quantity: take,
      costAmount: costForQuantity(lot.costPrice, lot.costQuantity, take),
    });
    needed -= take;
  }

  if (needed > 0) {
    const cost = options.fallbackCost;
    allocations.push({
      lotId: null,
      quantity: needed,
      costAmount: cost ? costForQuantity(cost.costPrice, cost.costQuantity, needed) : 0,
    });
  }

  return {
    allocations,
    shortfall: needed > 0 ? needed : 0,
    expiredAvailable: Math.min(expiredAvailable, Math.max(needed, 0)),
  };
}

/** Le coût du dernier achat (lot reçu le plus récemment), pour les sorties « sans lot ». */
export function latestCost(
  lots: readonly Pick<LotBalance, 'receivedAt' | 'costPrice' | 'costQuantity'>[]
): { costPrice: number; costQuantity: number } | null {
  const latest = [...lots].sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))[0];
  return latest ? { costPrice: latest.costPrice, costQuantity: latest.costQuantity } : null;
}

/**
 * Remet en stock une partie de ce qui était sorti (retour d'un client, annulation).
 * On rend la marchandise aux mêmes lots, en commençant par le dernier lot utilisé,
 * et au même coût que lors de la sortie.
 */
export function reverseAllocations(taken: readonly Allocation[], quantity: number): Allocation[] {
  const result: Allocation[] = [];
  let toReturn = quantity;
  for (const part of [...taken].reverse()) {
    if (toReturn <= 0) break;
    const back = Math.min(part.quantity, toReturn);
    result.push({
      lotId: part.lotId,
      quantity: back,
      costAmount:
        back === part.quantity
          ? part.costAmount
          : costForQuantity(part.costAmount, part.quantity, back),
    });
    toReturn -= back;
  }
  return result;
}

/** Valeur du stock au prix d'achat (somme, lot par lot, de ce qui reste). */
export function stockValue(lots: readonly LotBalance[]): number {
  return lots.reduce(
    (total, lot) =>
      lot.remaining > 0
        ? total + costForQuantity(lot.costPrice, lot.costQuantity, lot.remaining)
        : total,
    0
  );
}

/**
 * Une ligne de réception de marchandise, tapée dans l'unité d'achat :
 *   10 « Sac 50 kg » à 28 000 le sac → lot de 500 kg, coût 28 000 pour 50 kg, valeur 280 000.
 */
export function receiptLine(input: {
  /** Quantité dans l'unité d'achat, en millièmes (10 sacs → 10000) */
  quantityInUnit: number;
  /** Contenu de l'unité d'achat en millièmes d'unité de base (Sac 50 kg → 50000) */
  unitFactor: number;
  /** Prix d'achat d'UNE unité d'achat */
  unitCost: number;
}): { baseQuantity: number; costPrice: number; costQuantity: number; costAmount: number } {
  return {
    baseQuantity: toBaseQuantity(input.quantityInUnit, input.unitFactor),
    costPrice: input.unitCost,
    costQuantity: input.unitFactor,
    costAmount: lineAmount(input.unitCost, input.quantityInUnit),
  };
}
