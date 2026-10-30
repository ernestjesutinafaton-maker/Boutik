/**
 * Prix d'achat et marge de chaque unité d'un produit.
 *
 * Le propriétaire tape le prix d'achat chez le fournisseur d'une ou plusieurs unités
 * (ex. le sac de 50 kg à 30 000 F). Pour une unité sans prix d'achat, on le déduit de
 * l'unité de référence en proportion de son contenu (le kg : 30 000 × 1/50 = 600 F).
 * Ainsi on voit tout de suite qu'un kg vendu 550 F fait perdre 50 F.
 *
 * Tous les montants sont des entiers (francs) ; les contenus en millièmes d'unité de base.
 * Fonctions pures, sans base de données.
 */

export type PricedUnit = {
  id: string;
  name: string;
  /** Contenu en millièmes d'unité de base (Sac 50 kg → 50000) */
  factor: number;
  salePrice: number | null;
  purchasePrice: number | null;
};

export type UnitMargin = {
  unitId: string;
  unitName: string;
  salePrice: number | null;
  /** Prix d'achat (tapé, ou déduit d'une autre unité), null si aucun n'est connu */
  cost: number | null;
  /** Vrai si le prix d'achat est déduit d'une autre unité */
  derived: boolean;
  /** Bénéfice par unité vendue (prix de vente − prix d'achat), null si l'un manque */
  margin: number | null;
  /** Marge en % du prix de vente, arrondie à l'unité ; null si pas calculable */
  marginPercent: number | null;
};

/**
 * L'unité qui sert de référence pour déduire les autres : celle qui a un prix d'achat et
 * le plus gros contenu (on achète en général en gros : le sac, le carton).
 */
export function referenceUnit<T extends PricedUnit>(units: readonly T[]): T | null {
  let best: T | null = null;
  for (const unit of units) {
    if (unit.purchasePrice === null || unit.factor <= 0) continue;
    if (best === null || unit.factor > best.factor) best = unit;
  }
  return best;
}

/** Le prix d'achat d'une unité : le sien, sinon déduit de l'unité de référence. */
export function unitCost(
  unit: PricedUnit,
  units: readonly PricedUnit[]
): { cost: number | null; derived: boolean } {
  if (unit.purchasePrice !== null) {
    return { cost: unit.purchasePrice, derived: false };
  }
  const reference = referenceUnit(units);
  if (!reference || reference.purchasePrice === null) {
    return { cost: null, derived: false };
  }
  return {
    cost: Math.round((reference.purchasePrice * unit.factor) / reference.factor),
    derived: true,
  };
}

/** Prix d'achat, bénéfice et marge de chaque unité, dans l'ordre reçu. */
export function unitMargins(units: readonly PricedUnit[]): UnitMargin[] {
  return units.map((unit) => {
    const { cost, derived } = unitCost(unit, units);
    const margin = unit.salePrice !== null && cost !== null ? unit.salePrice - cost : null;
    const marginPercent =
      margin !== null && unit.salePrice !== null && unit.salePrice > 0
        ? Math.round((margin * 100) / unit.salePrice)
        : null;
    return {
      unitId: unit.id,
      unitName: unit.name,
      salePrice: unit.salePrice,
      cost,
      derived,
      margin,
      marginPercent,
    };
  });
}
