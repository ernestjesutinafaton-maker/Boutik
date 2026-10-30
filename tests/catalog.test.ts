import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLocalDb, type LocalTestDb } from './local-db';

vi.mock('expo-crypto', () => ({
  randomUUID: () => crypto.randomUUID(),
  getRandomBytes: (size: number) => crypto.getRandomValues(new Uint8Array(size)),
}));

const { createProduct, updateProduct, archiveProduct } = await import('@/products/product-actions');

/** Le catalogue sur une vraie base SQLite : création, modification des unités et des prix. */

const context = { shopId: 'shop-1', memberId: 'owner', deviceId: 'device-1' };
let db: LocalTestDb;

beforeEach(() => {
  db = createLocalDb();
});

const riz = {
  name: 'Riz parfumé',
  categoryId: null,
  barcode: '6001',
  baseUnit: 'kg',
  allowDecimal: true,
  trackExpiry: false,
  lowStockThreshold: 100_000,
  units: [
    {
      id: null,
      name: 'kg',
      factor: 1000,
      salePrice: 700,
      purchasePrice: null,
      barcode: null,
      isDefault: false,
      sortOrder: 0,
    },
    {
      id: null,
      name: 'Sac 50 kg',
      factor: 50_000,
      salePrice: 32_000,
      purchasePrice: null,
      barcode: null,
      isDefault: true,
      sortOrder: 1,
    },
    {
      id: null,
      name: 'Tine',
      factor: 2500,
      salePrice: 1750,
      purchasePrice: null,
      barcode: null,
      isDefault: false,
      sortOrder: 2,
    },
  ],
};

type UnitRow = { id: string; name: string; sale_price: number | null; archived_at: string | null };

function catalogProduct(productId: string) {
  const units = db
    .query<UnitRow & { factor: number; is_default: number; sort_order: number; barcode: null }>(
      'SELECT * FROM product_units WHERE product_id = ? AND archived_at IS NULL',
      [productId]
    )
    .map((unit) => ({
      id: unit.id,
      name: unit.name,
      factor: unit.factor,
      salePrice: unit.sale_price,
      purchasePrice: null,
      barcode: unit.barcode,
      isDefault: unit.is_default === 1,
      sortOrder: unit.sort_order,
    }));
  return {
    id: productId,
    name: riz.name,
    barcode: riz.barcode,
    categoryId: null,
    categoryName: null,
    baseUnit: 'kg',
    allowDecimal: true,
    lowStockThreshold: 100_000,
    trackExpiry: false,
    photoPath: null,
    stock: 0,
    units,
  };
}

describe('Catalogue', () => {
  it('crée un produit avec ses unités et une photo en attente d’envoi', async () => {
    const productId = await createProduct(db, context, riz, 'BASE64');
    const units = db.query<UnitRow>('SELECT * FROM product_units WHERE product_id = ?', [
      productId,
    ]);
    expect(units.map((unit) => unit.name).sort()).toEqual(['Sac 50 kg', 'Tine', 'kg']);
    expect(db.query('SELECT product_id FROM local_photo_uploads')).toEqual([
      { product_id: productId },
    ]);
  });

  it('modifie les prix (noté au journal) et archive une unité retirée', async () => {
    const productId = await createProduct(db, context, riz, null);
    const product = catalogProduct(productId);
    const kg = product.units.find((unit) => unit.name === 'kg');
    const sac = product.units.find((unit) => unit.name === 'Sac 50 kg');

    await updateProduct(
      db,
      context,
      product,
      {
        ...riz,
        units: [
          { ...riz.units[0], id: kg?.id ?? null, salePrice: 750 },
          { ...riz.units[1], id: sac?.id ?? null },
          // La tine est retirée du formulaire
        ],
      },
      null
    );

    const units = db.query<UnitRow>(
      'SELECT name, sale_price, archived_at FROM product_units WHERE product_id = ? ORDER BY name',
      [productId]
    );
    expect(units.map((unit) => [unit.name, unit.sale_price, Boolean(unit.archived_at)])).toEqual([
      ['Sac 50 kg', 32_000, false],
      ['Tine', 1750, true],
      ['kg', 750, false],
    ]);
    const priceChange = db.query<{ details: string }>(
      "SELECT details FROM audit_log WHERE action = 'product.price_change'"
    )[0];
    expect(JSON.parse(priceChange.details).changes).toEqual([
      { unit: 'kg', before: 700, after: 750 },
    ]);
  });

  it('archiver garde le produit (rien n’est supprimé)', async () => {
    const productId = await createProduct(db, context, riz, null);
    await archiveProduct(db, context, catalogProduct(productId));
    const rows = db.query<{ archived_at: string | null }>(
      'SELECT archived_at FROM products WHERE id = ?',
      [productId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].archived_at).not.toBeNull();
  });
});
