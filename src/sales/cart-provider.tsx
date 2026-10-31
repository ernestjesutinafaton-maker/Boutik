import { createContext, type ReactNode, useContext, useState } from 'react';

import { newId } from '@/data/ids';
import { type CatalogProduct, type CatalogUnit, defaultSaleUnit } from '@/domain/catalog';
import { MILLI } from '@/domain/quantity';
import type { CartLine, DiscountInput } from '@/domain/sale';

import type { SaleDetail } from './sale-data';
import { cartFromSale, type SaleEditing } from './sale-editing';

/**
 * Le panier de la caisse. Il reste en mémoire pendant qu'on navigue
 * (ex. aller créer un client puis revenir), jusqu'à la fin de la vente.
 * Il sert aussi à MODIFIER une vente déjà faite : il est alors rempli avec ses articles.
 */
type CartContextValue = {
  lines: CartLine[];
  customerId: string | null;
  discount: DiscountInput | null;
  note: string;
  /** Ajoute un produit (ou augmente sa quantité s'il est déjà là dans la même unité) */
  addProduct: (product: CatalogProduct, unit?: CatalogUnit | null) => boolean;
  updateLine: (key: string, changes: Partial<CartLine>) => void;
  removeLine: (key: string) => void;
  setCustomerId: (customerId: string | null) => void;
  setDiscount: (discount: DiscountInput | null) => void;
  setNote: (note: string) => void;
  /** Vide le panier (et quitte la modification d'une vente) */
  clear: () => void;
  /** La vente en cours de modification, ou null pour une vente normale */
  editing: SaleEditing | null;
  /** Remplit le panier avec une vente déjà faite, pour la modifier */
  startEditing: (sale: SaleDetail) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [discount, setDiscount] = useState<DiscountInput | null>(null);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<SaleEditing | null>(null);

  function addProduct(product: CatalogProduct, unit?: CatalogUnit | null): boolean {
    const chosen = unit && unit.salePrice !== null ? unit : defaultSaleUnit(product);
    if (!chosen || chosen.salePrice === null) {
      return false; // produit sans prix : il ne se vend pas
    }
    const salePrice = chosen.salePrice;
    setLines((current) => {
      const existing = current.find(
        (line) => line.productId === product.id && line.unitId === chosen.id
      );
      if (existing) {
        return current.map((line) =>
          line === existing ? { ...line, quantity: line.quantity + MILLI } : line
        );
      }
      return [
        ...current,
        {
          key: newId(),
          productId: product.id,
          productName: product.name,
          unitId: chosen.id,
          unitName: chosen.name,
          unitFactor: chosen.factor,
          quantity: MILLI,
          unitPrice: salePrice,
        },
      ];
    });
    return true;
  }

  function updateLine(key: string, changes: Partial<CartLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...changes } : line))
    );
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  function clear() {
    setLines([]);
    setCustomerId(null);
    setDiscount(null);
    setNote('');
    setEditing(null);
  }

  function startEditing(sale: SaleDetail) {
    const filled = cartFromSale(sale);
    setLines(filled.lines);
    setCustomerId(filled.customerId);
    setDiscount(filled.discount);
    setNote(filled.note);
    setEditing(filled.editing);
  }

  return (
    <CartContext.Provider
      value={{
        lines,
        customerId,
        discount,
        note,
        addProduct,
        updateLine,
        removeLine,
        setCustomerId,
        setDiscount,
        setNote,
        clear,
        editing,
        startEditing,
      }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) {
    throw new Error('useCart doit être utilisé à l’intérieur de CartProvider.');
  }
  return value;
}
