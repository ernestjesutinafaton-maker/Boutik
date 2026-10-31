import { useQuery } from '@powersync/react';

import type { CatalogProduct, CatalogUnit } from '@/domain/catalog';
import { useShop } from '@/shop/shop-provider';

/**
 * Lecture du catalogue dans la base LOCALE (marche hors ligne).
 * Les listes se mettent à jour toutes seules dès que la base change
 * (vente sur cet appareil, ou données reçues d'un autre appareil).
 */

export type ProductRow = {
  id: string;
  name: string;
  barcode: string | null;
  category_id: string | null;
  category_name: string | null;
  base_unit: string;
  allow_decimal: number;
  low_stock_threshold: number | null;
  track_expiry: number;
  photo_path: string | null;
  archived_at: string | null;
  stock: number;
  units: string | null;
};

type UnitJson = {
  id: string;
  name: string;
  factor: number;
  sale_price: number | null;
  purchase_price: number | null;
  barcode: string | null;
  is_default: number;
  sort_order: number;
};

/**
 * Le stock d'un produit = la somme de tous ses mouvements (entrées +, sorties −).
 * Les unités sont regroupées en JSON pour tout lire en une seule requête.
 */
const PRODUCT_SELECT = `
  SELECT p.id, p.name, p.barcode, p.category_id, c.name AS category_name, p.base_unit,
         p.allow_decimal, p.low_stock_threshold, p.track_expiry, p.photo_path, p.archived_at,
         COALESCE((SELECT SUM(m.quantity) FROM stock_movements m WHERE m.product_id = p.id), 0) AS stock,
         (SELECT json_group_array(json_object(
                   'id', u.id, 'name', u.name, 'factor', u.factor, 'sale_price', u.sale_price, 'purchase_price', u.purchase_price,
                   'barcode', u.barcode, 'is_default', u.is_default, 'sort_order', u.sort_order))
            FROM product_units u
           WHERE u.product_id = p.id AND u.archived_at IS NULL) AS units
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id`;

function toUnit(json: UnitJson): CatalogUnit {
  return {
    id: json.id,
    name: json.name,
    factor: json.factor,
    salePrice: json.sale_price,
    purchasePrice: json.purchase_price ?? null,
    barcode: json.barcode,
    isDefault: json.is_default === 1,
    sortOrder: json.sort_order ?? 0,
  };
}

function toProduct(row: ProductRow): CatalogProduct {
  const units = (JSON.parse(row.units ?? '[]') as UnitJson[]).map(toUnit);
  return {
    id: row.id,
    name: row.name,
    barcode: row.barcode,
    categoryId: row.category_id,
    categoryName: row.category_name,
    baseUnit: row.base_unit,
    allowDecimal: row.allow_decimal === 1,
    lowStockThreshold: row.low_stock_threshold,
    trackExpiry: row.track_expiry === 1,
    photoPath: row.photo_path,
    // Affichage : jamais sous 0. Un ancien stock négatif (avant cette règle, ou deux appareils
    // hors ligne qui vendent le même dernier article) se corrige par un inventaire, qui part du vrai calcul.
    stock: Math.max(0, row.stock),
    needsCheck: row.stock < 0,
    units,
  };
}

/**
 * La requête du catalogue : tous les produits actifs de la boutique (lignes brutes).
 * Elle n'est lancée qu'UNE fois pour toute l'application, par le CatalogProvider :
 * les écrans, eux, utilisent useCatalog() (voir catalog-provider.tsx).
 */
export function useCatalogRows(): { rows: ProductRow[]; isLoading: boolean } {
  const { shop } = useShop();
  const { data, isLoading } = useQuery<ProductRow>(
    `${PRODUCT_SELECT}
      WHERE p.shop_id = ? AND p.archived_at IS NULL
      ORDER BY p.name COLLATE NOCASE`,
    [shop?.id ?? '']
  );
  return { rows: data, isLoading };
}

/** Les lignes de la base deviennent les produits du catalogue (unités lues depuis le JSON). */
export function toCatalog(rows: readonly ProductRow[]): CatalogProduct[] {
  return rows.map(toProduct);
}

/** Un produit (même archivé), avec son stock et ses unités. */
export function useProduct(productId: string): {
  product: CatalogProduct | null;
  archived: boolean;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery<ProductRow>(`${PRODUCT_SELECT} WHERE p.id = ?`, [productId]);
  const row = data[0];
  return {
    product: row ? toProduct(row) : null,
    archived: Boolean(row?.archived_at),
    isLoading,
  };
}

export type Category = { id: string; name: string };

/** Les rayons de la boutique (Alimentation, Boissons…). */
export function useCategories(): Category[] {
  const { shop } = useShop();
  const { data } = useQuery<Category>(
    `SELECT id, name FROM categories
      WHERE shop_id = ? AND archived_at IS NULL
      ORDER BY sort_order, name COLLATE NOCASE`,
    [shop?.id ?? '']
  );
  return data;
}
