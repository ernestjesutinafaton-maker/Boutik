import { type CatalogProduct, sortUnits } from '@/domain/catalog';
import { type CurrencyCode, formatMoneyInput, parseMoney } from '@/domain/money';
import { formatQuantity, MILLI, parseQuantity } from '@/domain/quantity';
import type { TranslationKey } from '@/i18n/keys';

/**
 * Le formulaire d'un produit : ce que l'utilisateur tape (des textes),
 * la vérification, et la conversion en nombres entiers prêts pour la base.
 */

/** Un conditionnement tapé dans le formulaire : « Sac 50 kg » contient « 50 » kg, prix « 32000 ». */
export type PackagingInput = {
  /** Repère du formulaire (reste le même pendant la saisie) */
  key: string;
  /** Identifiant en base (null = nouveau conditionnement) */
  id: string | null;
  name: string;
  /** Combien d'unités de base il contient, tapé en texte (« 50 », « 2,5 ») */
  contains: string;
  price: string;
  barcode: string;
};

export type ProductInput = {
  name: string;
  categoryId: string | null;
  /** Code-barres du produit à l'unité */
  barcode: string;
  /** Unité de comptage du stock : kg, pièce, boîte… */
  baseUnit: string;
  baseUnitId: string | null;
  basePrice: string;
  allowDecimal: boolean;
  trackExpiry: boolean;
  /** Seuil d'alerte de stock bas, en unités de base (texte, vide = pas d'alerte) */
  lowStock: string;
  packagings: PackagingInput[];
  /** Unité proposée en premier à la caisse : « base » ou le repère d'un conditionnement */
  defaultKey: string;
};

export const BASE_KEY = 'base';

/** Une unité prête à enregistrer (la première est toujours l'unité de base). */
export type UnitValues = {
  id: string | null;
  name: string;
  factor: number;
  salePrice: number | null;
  barcode: string | null;
  isDefault: boolean;
  sortOrder: number;
};

export type ProductValues = {
  name: string;
  categoryId: string | null;
  barcode: string | null;
  baseUnit: string;
  allowDecimal: boolean;
  trackExpiry: boolean;
  lowStockThreshold: number | null;
  units: UnitValues[];
};

type ProductField = 'name' | 'baseUnit' | 'basePrice' | 'lowStock' | 'barcode';
type PackagingField = 'name' | 'contains' | 'price' | 'barcode';

export type ProductErrors = {
  fields: Partial<Record<ProductField, TranslationKey>>;
  packagings: Record<string, Partial<Record<PackagingField, TranslationKey>>>;
};

export type ProductParseResult =
  { success: true; data: ProductValues } | { success: false; errors: ProductErrors };

/** Un formulaire vide, pour un nouveau produit. */
export function emptyProductInput(): ProductInput {
  return {
    name: '',
    categoryId: null,
    barcode: '',
    baseUnit: '',
    baseUnitId: null,
    basePrice: '',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: '',
    packagings: [],
    defaultKey: BASE_KEY,
  };
}

/** Le formulaire pré-rempli avec un produit existant (pour le modifier). */
export function productToInput(product: CatalogProduct, currency: CurrencyCode): ProductInput {
  const units = sortUnits(product.units);
  const base = units.find((unit) => unit.factor === MILLI && unit.sortOrder === 0) ?? null;
  const packagings = units.filter((unit) => unit !== base);
  const money = (amount: number | null) =>
    amount === null ? '' : formatMoneyInput(amount, currency);
  const defaultUnit = units.find((unit) => unit.isDefault);

  return {
    name: product.name,
    categoryId: product.categoryId,
    barcode: product.barcode ?? '',
    baseUnit: product.baseUnit,
    baseUnitId: base?.id ?? null,
    basePrice: money(base?.salePrice ?? null),
    allowDecimal: product.allowDecimal,
    trackExpiry: product.trackExpiry,
    lowStock: product.lowStockThreshold === null ? '' : formatQuantity(product.lowStockThreshold),
    packagings: packagings.map((unit) => ({
      key: unit.id,
      id: unit.id,
      name: unit.name,
      contains: formatQuantity(unit.factor),
      price: money(unit.salePrice),
      barcode: unit.barcode ?? '',
    })),
    defaultKey: defaultUnit && defaultUnit !== base ? defaultUnit.id : BASE_KEY,
  };
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Vérifie le formulaire et le transforme en valeurs prêtes à enregistrer.
 * requirePrice = false pour une personne qui n'a pas le droit de fixer les prix
 * (gestionnaire de stock) : le propriétaire ou le gérant les ajoutera.
 */
export function parseProductInput(
  input: ProductInput,
  currency: CurrencyCode,
  { requirePrice = true }: { requirePrice?: boolean } = {}
): ProductParseResult {
  const errors: ProductErrors = { fields: {}, packagings: {} };
  const name = input.name.trim();
  const baseUnit = input.baseUnit.trim();
  const barcode = input.barcode.trim();

  if (name.length === 0) {
    errors.fields.name = 'errors.productNameRequired';
  } else if (name.length > 120) {
    errors.fields.name = 'errors.productNameTooLong';
  }
  if (baseUnit.length === 0) {
    errors.fields.baseUnit = 'errors.baseUnitRequired';
  } else if (baseUnit.length > 20) {
    errors.fields.baseUnit = 'errors.baseUnitTooLong';
  }

  const readPrice = (text: string): number | null | 'invalid' =>
    text.trim() === '' ? null : (parseMoney(text, currency) ?? 'invalid');

  const basePrice = readPrice(input.basePrice);
  if (basePrice === 'invalid') {
    errors.fields.basePrice = 'errors.priceInvalid';
  }

  let lowStockThreshold: number | null = null;
  if (input.lowStock.trim() !== '') {
    lowStockThreshold = parseQuantity(input.lowStock, input.allowDecimal);
    if (lowStockThreshold === null) {
      errors.fields.lowStock = input.allowDecimal
        ? 'errors.quantityInvalid'
        : 'errors.quantityWholeOnly';
    }
  }

  const barcodes = barcode ? [barcode] : [];
  const packagings: UnitValues[] = [];
  input.packagings.forEach((packaging, index) => {
    const packagingErrors: Partial<Record<PackagingField, TranslationKey>> = {};
    const packagingName = packaging.name.trim();
    const packagingBarcode = packaging.barcode.trim();

    if (packagingName.length === 0 || packagingName.length > 40) {
      packagingErrors.name = 'errors.unitNameRequired';
    } else if (
      sameName(packagingName, baseUnit) ||
      input.packagings.some((other, j) => j < index && sameName(other.name, packagingName))
    ) {
      packagingErrors.name = 'errors.unitNameDuplicate';
    }

    const factor = parseQuantity(packaging.contains);
    if (factor === null || factor === 0) {
      packagingErrors.contains = 'errors.unitContainsInvalid';
    }

    const price = readPrice(packaging.price);
    if (price === 'invalid') {
      packagingErrors.price = 'errors.priceInvalid';
    }

    if (packagingBarcode) {
      if (barcodes.includes(packagingBarcode)) {
        packagingErrors.barcode = 'errors.barcodeDuplicate';
      }
      barcodes.push(packagingBarcode);
    }

    if (Object.keys(packagingErrors).length > 0) {
      errors.packagings[packaging.key] = packagingErrors;
    } else {
      packagings.push({
        id: packaging.id,
        name: packagingName,
        factor: factor ?? MILLI,
        salePrice: price === 'invalid' ? null : price,
        barcode: packagingBarcode || null,
        isDefault: false,
        sortOrder: index + 1,
      });
    }
  });

  const base: UnitValues = {
    id: input.baseUnitId,
    name: baseUnit,
    factor: MILLI,
    salePrice: basePrice === 'invalid' ? null : basePrice,
    barcode: null,
    isDefault: false,
    sortOrder: 0,
  };
  const units = [base, ...packagings];

  // Il faut au moins un prix de vente, sinon le produit ne peut pas se vendre
  if (requirePrice && !errors.fields.basePrice && units.every((unit) => unit.salePrice === null)) {
    errors.fields.basePrice = 'errors.pricesRequired';
  }

  if (Object.keys(errors.fields).length > 0 || Object.keys(errors.packagings).length > 0) {
    return { success: false, errors };
  }

  // L'unité par défaut doit avoir un prix ; sinon on prend la première qui en a un
  const defaultIndex =
    input.defaultKey === BASE_KEY
      ? 0
      : input.packagings.findIndex((packaging) => packaging.key === input.defaultKey) + 1;
  const chosen = units[defaultIndex];
  const defaultUnit =
    chosen && chosen.salePrice !== null ? chosen : units.find((unit) => unit.salePrice !== null);
  for (const unit of units) {
    unit.isDefault = unit === defaultUnit;
  }

  return {
    success: true,
    data: {
      name,
      categoryId: input.categoryId,
      barcode: barcode || null,
      baseUnit,
      allowDecimal: input.allowDecimal,
      trackExpiry: input.trackExpiry,
      lowStockThreshold,
      units,
    },
  };
}
