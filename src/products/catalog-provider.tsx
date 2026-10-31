import { createContext, type ReactNode, useContext, useMemo } from 'react';

import type { CatalogProduct } from '@/domain/catalog';

import { toCatalog, useCatalogRows } from './product-data';

type CatalogState = { products: CatalogProduct[]; isLoading: boolean };

const CatalogContext = createContext<CatalogState | null>(null);

/**
 * Le catalogue, lu UNE seule fois pour toute l'application.
 * Avant, chaque écran ouvert (Vendre, Produits, Tableau de bord…) relançait la même
 * requête après chaque vente, et relisait les unités de chaque produit à chaque affichage :
 * c'était lent sur les vieux téléphones, surtout avec des milliers d'articles.
 */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { rows, isLoading } = useCatalogRows();
  // Converti seulement quand la base a changé, pas à chaque affichage
  const products = useMemo(() => toCatalog(rows), [rows]);
  const value = useMemo(() => ({ products, isLoading }), [products, isLoading]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

/** Tous les produits actifs de la boutique, avec leur stock et leurs unités. */
export function useCatalog(): CatalogState {
  const value = useContext(CatalogContext);
  if (!value) {
    throw new Error('useCatalog doit être utilisé à l’intérieur de CatalogProvider.');
  }
  return value;
}
