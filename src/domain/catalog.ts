/**
 * Le catalogue : rechercher un produit, le retrouver par son code-barres,
 * repérer le stock bas, choisir l'unité proposée à la caisse.
 * Fonctions « pures » (sans base de données) : faciles à tester.
 */

/** Une façon de vendre ou d'acheter un produit : « Sac 50 kg », « Kilo », « Carton »… */
export type CatalogUnit = {
  id: string;
  name: string;
  /** Contenu en millièmes d'unité de base (Sac 50 kg → 50000) */
  factor: number;
  /** Prix de vente de CETTE unité (null = pas vendue dans cette unité) */
  salePrice: number | null;
  barcode: string | null;
  isDefault: boolean;
  sortOrder: number;
};

export type CatalogProduct = {
  id: string;
  name: string;
  barcode: string | null;
  categoryId: string | null;
  categoryName: string | null;
  /** Unité de comptage du stock : kg, pièce, boîte… */
  baseUnit: string;
  allowDecimal: boolean;
  /** Seuil d'alerte, en millièmes d'unité de base (null = pas d'alerte) */
  lowStockThreshold: number | null;
  trackExpiry: boolean;
  photoPath: string | null;
  /** Stock actuel, en millièmes d'unité de base (la somme des mouvements) */
  stock: number;
  /** Le calcul donne un stock négatif (affiché 0) : un inventaire doit corriger l'écart */
  needsCheck?: boolean;
  units: CatalogUnit[];
};

/** Minuscules et sans accents : « Café » et « cafe » se retrouvent. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Les unités dans l'ordre d'affichage (unité de base en premier). */
export function sortUnits(units: readonly CatalogUnit[]): CatalogUnit[] {
  return [...units].sort((a, b) => a.sortOrder - b.sortOrder || a.factor - b.factor);
}

/** Les unités dans lesquelles le produit se vend (celles qui ont un prix). */
export function sellableUnits(product: CatalogProduct): CatalogUnit[] {
  return sortUnits(product.units).filter((unit) => unit.salePrice !== null);
}

/** L'unité proposée en premier à la caisse : celle choisie par défaut, sinon la première vendable. */
export function defaultSaleUnit(product: CatalogProduct): CatalogUnit | null {
  const sellable = sellableUnits(product);
  return sellable.find((unit) => unit.isDefault) ?? sellable[0] ?? null;
}

/** Les unités au format attendu par formatMixedStock (affichage « 9 × Sac 50 kg + 47 kg »). */
export function displayUnits(product: CatalogProduct): { name: string; factor: number }[] {
  return product.units.map((unit) => ({ name: unit.name, factor: unit.factor }));
}

/**
 * Recherche : chaque mot tapé doit se trouver dans le nom (ou la catégorie),
 * ou bien la saisie est le début d'un code-barres.
 *   « riz 50 » trouve « Riz parfumé sac 50 kg »
 */
export function searchProducts<T extends CatalogProduct>(
  products: readonly T[],
  query: string
): T[] {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [...products];
  }
  const code = query.trim();
  return products.filter((product) => {
    const haystack = normalizeText(`${product.name} ${product.categoryName ?? ''}`);
    if (words.every((word) => haystack.includes(word))) {
      return true;
    }
    const barcodes = [product.barcode, ...product.units.map((unit) => unit.barcode)];
    return code.length >= 3 && barcodes.some((barcode) => barcode?.startsWith(code));
  });
}

/**
 * Retrouve un produit par son code-barres (caméra ou lecteur USB).
 * Le code peut être celui du produit (→ unité proposée par défaut)
 * ou celui d'un conditionnement (un carton a souvent son propre code → cette unité).
 */
export function matchBarcode<T extends CatalogProduct>(
  products: readonly T[],
  code: string
): { product: T; unit: CatalogUnit | null } | null {
  const wanted = code.trim();
  if (!wanted) {
    return null;
  }
  for (const product of products) {
    const unit = product.units.find((candidate) => candidate.barcode === wanted);
    if (unit) {
      return { product, unit };
    }
  }
  const product = products.find((candidate) => candidate.barcode === wanted);
  return product ? { product, unit: defaultSaleUnit(product) } : null;
}

/** Stock bas : le stock est passé sous le seuil d'alerte (ou y est égal). */
export function isLowStock(product: Pick<CatalogProduct, 'stock' | 'lowStockThreshold'>): boolean {
  return product.lowStockThreshold !== null && product.stock <= product.lowStockThreshold;
}
