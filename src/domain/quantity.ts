/**
 * Quantités : saisir, convertir et afficher.
 *
 * RÈGLE D'OR : une quantité est TOUJOURS un nombre entier, compté en MILLIÈMES
 * de l'unité, comme si on comptait le riz en grammes :
 *   2,5 kg → 2500 ; 1 boîte → 1000 ; un « Sac 50 kg » contient 50000 millièmes de kg.
 * Le stock d'un produit est toujours compté dans son unité de base.
 */

/** Une unité entière = 1000 millièmes. */
export const MILLI = 1000;

// Espace insécable : « 2,5 kg » ne sera jamais coupé en fin de ligne
const NBSP = String.fromCharCode(0xa0);

/**
 * Multiplie puis divise des entiers sans jamais perdre de précision, en arrondissant
 * au plus proche (les demis vers le haut). Sert aux règles de trois.
 */
export function mulDiv(value: number, multiplier: number, divisor: number): number {
  if (divisor === 0) {
    throw new Error('Division par zéro impossible.');
  }
  const product = BigInt(value) * BigInt(multiplier);
  const divisorBig = BigInt(divisor);
  const negative = product < 0n !== divisorBig < 0n;
  const absProduct = product < 0n ? -product : product;
  const absDivisor = divisorBig < 0n ? -divisorBig : divisorBig;
  const rounded = (absProduct * 2n + absDivisor) / (2n * absDivisor);
  return Number(negative ? -rounded : rounded);
}

/**
 * Lit une quantité tapée par l'utilisateur et la renvoie en millièmes.
 * Renvoie null si la saisie n'est pas valide.
 *   « 2,5 » → 2500 ; « 3 » → 3000 ; « 0.125 » → 125
 *   Avec decimals = false (produit vendu à la pièce) : « 2,5 » → null
 */
export function parseQuantity(input: string, allowDecimals = true): number | null {
  const text = input.replace(/\s/g, '');
  const match = /^(\d+)(?:[.,](\d{1,3}))?$/.exec(text);
  if (!match) {
    return null;
  }
  const decimalPart = match[2] ?? '';
  if (!allowDecimals && decimalPart.replace(/0/g, '') !== '') {
    return null;
  }
  const value = Number(match[1]) * MILLI + Number(decimalPart.padEnd(3, '0'));
  return Number.isSafeInteger(value) ? value : null;
}

/** Affiche une quantité en millièmes : 2500 → « 2,5 » ; 1500000 → « 1 500 ». */
export function formatQuantity(milli: number): string {
  const sign = milli < 0 ? '-' : '';
  const absolute = Math.abs(milli);
  const whole = Math.floor(absolute / MILLI);
  const decimals = String(absolute % MILLI)
    .padStart(3, '0')
    .replace(/0+$/, '');
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${sign}${grouped}${decimals ? `,${decimals}` : ''}`;
}

/** Quantité suivie de son unité : 2500 et « kg » → « 2,5 kg ». */
export function formatQuantityWithUnit(milli: number, unitName: string): string {
  return `${formatQuantity(milli)}${NBSP}${unitName}`;
}

/**
 * Convertit une quantité exprimée dans une unité de vente (en millièmes de cette unité)
 * vers l'unité de base du produit (en millièmes).
 *   2 « Sac 50 kg » : quantité 2000, facteur 50000 → 100000 (= 100 kg)
 *   1,5 « Kilo » : quantité 1500, facteur 1000 → 1500 (= 1,5 kg)
 */
export function toBaseQuantity(quantityInUnit: number, unitFactor: number): number {
  return mulDiv(quantityInUnit, unitFactor, MILLI);
}

/** Montant d'une ligne : prix d'UNE unité × quantité (en millièmes), arrondi une seule fois. */
export function lineAmount(unitPrice: number, quantityInUnit: number): number {
  return mulDiv(unitPrice, quantityInUnit, MILLI);
}

/**
 * Coût d'achat d'une quantité, par règle de trois :
 * « coût » pour « quantité de référence » → coût de « quantité ».
 *   Sac de 50 kg acheté 28 000 : coût 28000 pour 50000 → 3,5 kg (3500) coûtent 1960.
 */
export function costForQuantity(costPrice: number, costQuantity: number, quantity: number): number {
  return mulDiv(costPrice, quantity, costQuantity);
}

export type DisplayUnit = { name: string; factor: number };

/**
 * Affiche un stock de façon lisible, avec le plus grand conditionnement du produit :
 *   497000 millièmes de kg, avec « Sac 50 kg » → « 9 × Sac 50 kg + 47 kg »
 * Si le stock est plus petit qu'un conditionnement (ou négatif), on l'affiche
 * simplement dans l'unité de base.
 */
export function formatMixedStock(
  stockMilli: number,
  baseUnitName: string,
  units: readonly DisplayUnit[]
): string {
  const packaging = units
    .filter((unit) => unit.factor > MILLI)
    .reduce<DisplayUnit | null>(
      (largest, unit) => (!largest || unit.factor > largest.factor ? unit : largest),
      null
    );

  if (!packaging || stockMilli < packaging.factor) {
    return formatQuantityWithUnit(stockMilli, baseUnitName);
  }
  const packs = Math.floor(stockMilli / packaging.factor);
  const rest = stockMilli - packs * packaging.factor;
  const packsText = `${formatQuantity(packs * MILLI)}${NBSP}×${NBSP}${packaging.name}`;
  return rest > 0 ? `${packsText} + ${formatQuantityWithUnit(rest, baseUnitName)}` : packsText;
}
