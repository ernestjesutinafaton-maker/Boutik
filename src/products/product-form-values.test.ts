import { describe, expect, it } from 'vitest';

import type { CatalogProduct } from '@/domain/catalog';

import {
  BASE_KEY,
  emptyProductInput,
  type ProductInput,
  parseProductInput,
  productToInput,
} from './product-form-values';

/** Le riz de l'exemple : vendu au kilo, en tine et au sac de 50 kg. */
function rizInput(): ProductInput {
  return {
    ...emptyProductInput(),
    name: ' Riz parfumé ',
    baseUnit: 'kg',
    basePrice: '700',
    allowDecimal: true,
    lowStock: '100',
    packagings: [
      { key: 'a', id: null, name: 'Sac 50 kg', contains: '50', price: '32 000', barcode: '' },
      { key: 'b', id: null, name: 'Tine', contains: '2,5', price: '1750', barcode: '' },
    ],
    defaultKey: 'a',
  };
}

describe('Formulaire produit', () => {
  it('transforme les textes tapés en nombres entiers', () => {
    const result = parseProductInput(rizInput(), 'XOF');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.name).toBe('Riz parfumé');
    expect(result.data.lowStockThreshold).toBe(100_000);
    expect(result.data.units).toEqual([
      expect.objectContaining({ name: 'kg', factor: 1000, salePrice: 700, isDefault: false }),
      expect.objectContaining({
        name: 'Sac 50 kg',
        factor: 50_000,
        salePrice: 32_000,
        isDefault: true,
      }),
      expect.objectContaining({ name: 'Tine', factor: 2500, salePrice: 1750, sortOrder: 2 }),
    ]);
  });

  it('exige un nom, une unité de base et au moins un prix', () => {
    const result = parseProductInput(emptyProductInput(), 'XOF');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.fields).toEqual({
      name: 'errors.productNameRequired',
      baseUnit: 'errors.baseUnitRequired',
      basePrice: 'errors.pricesRequired',
    });
  });

  it('le gestionnaire de stock peut créer un produit sans prix', () => {
    const input = { ...rizInput(), basePrice: '', packagings: [] };
    expect(parseProductInput(input, 'XOF').success).toBe(false);
    expect(parseProductInput(input, 'XOF', { requirePrice: false }).success).toBe(true);
  });

  it('un produit peut se vendre seulement au sac (pas de prix au kilo)', () => {
    const input = { ...rizInput(), basePrice: '' };
    const result = parseProductInput(input, 'XOF');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.units[0].salePrice).toBeNull();
  });

  it('refuse les virgules pour un produit compté à la pièce', () => {
    const input = { ...rizInput(), allowDecimal: false, lowStock: '2,5' };
    const result = parseProductInput(input, 'XOF');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.fields.lowStock).toBe('errors.quantityWholeOnly');
  });

  it('signale les erreurs de chaque conditionnement', () => {
    const input = rizInput();
    input.packagings.push(
      { key: 'c', id: null, name: 'sac 50 KG', contains: '0', price: 'abc', barcode: '' },
      { key: 'd', id: null, name: 'KG', contains: '1', price: '', barcode: '' }
    );
    const result = parseProductInput(input, 'XOF');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.packagings.c).toEqual({
      name: 'errors.unitNameDuplicate',
      contains: 'errors.unitContainsInvalid',
      price: 'errors.priceInvalid',
    });
    expect(result.errors.packagings.d).toEqual({ name: 'errors.unitNameDuplicate' });
  });

  it('refuse deux fois le même code-barres', () => {
    const input = { ...rizInput(), barcode: '123456' };
    input.packagings[0].barcode = '123456';
    const result = parseProductInput(input, 'XOF');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.packagings.a?.barcode).toBe('errors.barcodeDuplicate');
  });

  it('l’unité par défaut sans prix est remplacée par la première qui en a un', () => {
    const input = { ...rizInput(), basePrice: '', defaultKey: BASE_KEY };
    const result = parseProductInput(input, 'XOF');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.units.find((unit) => unit.isDefault)?.name).toBe('Sac 50 kg');
  });

  it('pré-remplit le formulaire avec un produit existant, et le relit à l’identique', () => {
    const product: CatalogProduct = {
      id: 'p1',
      name: 'Riz parfumé',
      barcode: '6001',
      categoryId: 'cat',
      categoryName: 'Alimentation',
      baseUnit: 'kg',
      allowDecimal: true,
      lowStockThreshold: 100_000,
      trackExpiry: false,
      photoPath: null,
      stock: 0,
      units: [
        {
          id: 'u2',
          name: 'Sac 50 kg',
          factor: 50_000,
          salePrice: 32_000,
          barcode: null,
          isDefault: true,
          sortOrder: 1,
        },
        {
          id: 'u1',
          name: 'kg',
          factor: 1000,
          salePrice: 700,
          barcode: null,
          isDefault: false,
          sortOrder: 0,
        },
      ],
    };
    const input = productToInput(product, 'XOF');
    expect(input.baseUnitId).toBe('u1');
    expect(input.basePrice).toBe('700');
    expect(input.defaultKey).toBe('u2');
    expect(input.packagings).toEqual([
      { key: 'u2', id: 'u2', name: 'Sac 50 kg', contains: '50', price: '32000', barcode: '' },
    ]);
    const result = parseProductInput(input, 'XOF');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(
      result.data.units.map((unit) => [unit.id, unit.factor, unit.salePrice, unit.isDefault])
    ).toEqual([
      ['u1', 1000, 700, false],
      ['u2', 50_000, 32_000, true],
    ]);
  });
});
