import { describe, expect, it } from 'vitest';

import {
  type CatalogProduct,
  type CatalogUnit,
  defaultSaleUnit,
  isLowStock,
  matchBarcode,
  normalizeText,
  productCategories,
  searchProducts,
  sellableUnits,
} from './catalog';

function unit(partial: Partial<CatalogUnit> & Pick<CatalogUnit, 'id' | 'name' | 'factor'>) {
  return {
    salePrice: null,
    purchasePrice: null,
    barcode: null,
    isDefault: false,
    sortOrder: 0,
    ...partial,
  };
}

function product(partial: Partial<CatalogProduct> & Pick<CatalogProduct, 'id' | 'name'>) {
  return {
    barcode: null,
    categoryId: null,
    categoryName: null,
    baseUnit: 'pièce',
    allowDecimal: false,
    lowStockThreshold: null,
    trackExpiry: false,
    photoPath: null,
    stock: 0,
    units: [],
    ...partial,
  } satisfies CatalogProduct;
}

const riz = product({
  id: 'riz',
  name: 'Riz parfumé',
  categoryName: 'Alimentation',
  baseUnit: 'kg',
  barcode: '6001234567890',
  units: [
    unit({ id: 'kg', name: 'kg', factor: 1000, salePrice: 700, sortOrder: 0 }),
    unit({ id: 'sac', name: 'Sac 50 kg', factor: 50_000, salePrice: 32_000, sortOrder: 1 }),
  ],
});
const lait = product({
  id: 'lait',
  name: 'Lait concentré',
  categoryName: 'Épicerie',
  baseUnit: 'boîte',
  barcode: '3017620422003',
  units: [
    unit({ id: 'boite', name: 'boîte', factor: 1000, salePrice: 500, sortOrder: 0 }),
    unit({
      id: 'carton',
      name: 'Carton 24',
      factor: 24_000,
      salePrice: 11_000,
      barcode: '3017620422999',
      isDefault: true,
      sortOrder: 1,
    }),
  ],
});
const cafe = product({ id: 'cafe', name: 'Café moulu' });
const catalog = [riz, lait, cafe];

describe('Recherche de produits', () => {
  it('ignore les majuscules et les accents', () => {
    expect(normalizeText('  Café ÉPICÉ ')).toBe('cafe epice');
    expect(searchProducts(catalog, 'cafe').map((p) => p.id)).toEqual(['cafe']);
  });

  it('chaque mot doit se trouver dans le nom ou la catégorie', () => {
    expect(searchProducts(catalog, 'riz parf').map((p) => p.id)).toEqual(['riz']);
    expect(searchProducts(catalog, 'epicerie').map((p) => p.id)).toEqual(['lait']);
    expect(searchProducts(catalog, 'riz lait')).toEqual([]);
  });

  it('trouve aussi par le début du code-barres', () => {
    expect(searchProducts(catalog, '600123').map((p) => p.id)).toEqual(['riz']);
    expect(searchProducts(catalog, '3017620422999').map((p) => p.id)).toEqual(['lait']);
  });

  it('une recherche vide renvoie tout', () => {
    expect(searchProducts(catalog, '  ')).toHaveLength(3);
  });
});

describe('Code-barres scanné', () => {
  it('le code du produit donne l’unité proposée par défaut', () => {
    const found = matchBarcode(catalog, '6001234567890');
    expect(found?.product.id).toBe('riz');
    expect(found?.unit?.id).toBe('kg');
  });

  it('le code d’un carton donne directement le carton', () => {
    const found = matchBarcode(catalog, ' 3017620422999 ');
    expect(found?.product.id).toBe('lait');
    expect(found?.unit?.id).toBe('carton');
  });

  it('un code inconnu ne donne rien', () => {
    expect(matchBarcode(catalog, '0000')).toBeNull();
    expect(matchBarcode(catalog, '')).toBeNull();
  });
});

describe('Unités de vente', () => {
  it('l’unité par défaut est celle choisie, sinon la première qui a un prix', () => {
    expect(defaultSaleUnit(lait)?.id).toBe('carton');
    expect(defaultSaleUnit(riz)?.id).toBe('kg');
    expect(defaultSaleUnit(cafe)).toBeNull();
  });

  it('une unité sans prix ne se vend pas', () => {
    const sucre = product({
      id: 'sucre',
      name: 'Sucre',
      units: [
        unit({ id: 'kg', name: 'kg', factor: 1000, sortOrder: 0 }),
        unit({ id: 'sac', name: 'Sac', factor: 25_000, salePrice: 15_000, sortOrder: 1 }),
      ],
    });
    expect(sellableUnits(sucre).map((u) => u.id)).toEqual(['sac']);
    expect(defaultSaleUnit(sucre)?.id).toBe('sac');
  });
});

describe('Stock bas', () => {
  it('alerte quand le stock atteint le seuil', () => {
    expect(isLowStock({ stock: 5000, lowStockThreshold: 5000 })).toBe(true);
    expect(isLowStock({ stock: 4000, lowStockThreshold: 5000 })).toBe(true);
    expect(isLowStock({ stock: 6000, lowStockThreshold: 5000 })).toBe(false);
  });

  it('pas d’alerte sans seuil', () => {
    expect(isLowStock({ stock: 0, lowStockThreshold: null })).toBe(false);
  });
});

describe('Rayons de la caisse sur tablette', () => {
  it('seulement les rayons qui ont des produits, sans doublon, par ordre alphabétique', () => {
    expect(
      productCategories([
        { categoryId: 'plomberie', categoryName: 'Plomberie' },
        { categoryId: 'electricite', categoryName: 'Électricité' },
        { categoryId: 'plomberie', categoryName: 'Plomberie' },
        { categoryId: null, categoryName: null },
      ])
    ).toEqual([
      { id: 'electricite', name: 'Électricité' },
      { id: 'plomberie', name: 'Plomberie' },
    ]);
  });
});
