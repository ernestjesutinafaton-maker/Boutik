import { describe, expect, it } from 'vitest';

import {
  can,
  canSeeCustomers,
  isRole,
  maxDiscountPercent,
  PERMISSIONS,
  permissionsFor,
} from './permissions';

describe('Droits des rôles', () => {
  it('le propriétaire a tous les droits', () => {
    for (const permission of PERMISSIONS) {
      expect(can(['owner'], permission)).toBe(true);
    }
  });

  it('le vendeur vend, encaisse et enregistre un remboursement, mais ne voit pas les prix d’achat', () => {
    expect(can(['seller'], 'sale.create')).toBe(true);
    expect(can(['seller'], 'credit.repayment')).toBe(true);
    expect(can(['seller'], 'stock.view_costs')).toBe(false);
    expect(can(['seller'], 'prices.edit')).toBe(false);
    expect(can(['seller'], 'sale.cancel')).toBe(false);
    expect(can(['seller'], 'stock.adjust')).toBe(false);
    expect(can(['seller'], 'reports.profit')).toBe(false);
  });

  it('seul le caissier (parmi vendeur et caissier) ouvre et ferme la caisse du jour', () => {
    expect(can(['cashier'], 'cash.session')).toBe(true);
    expect(can(['seller'], 'cash.session')).toBe(false);
  });

  it('plusieurs rôles : les droits s’additionnent (vendeur + caissier)', () => {
    const roles = ['seller', 'cashier'] as const;
    expect(can(roles, 'sale.create')).toBe(true);
    expect(can(roles, 'cash.session')).toBe(true);
    expect(can(roles, 'stock.adjust')).toBe(false);
  });

  it('le gérant remplace le propriétaire, sauf bénéfices, équipe, paramètres, dettes effacées et catalogue', () => {
    expect(can(['manager'], 'sale.cancel')).toBe(true);
    // Seul le propriétaire ajoute les produits et fixe les prix
    expect(can(['manager'], 'prices.edit')).toBe(false);
    expect(can(['manager'], 'catalog.edit')).toBe(false);
    expect(can(['owner'], 'catalog.edit')).toBe(true);
    expect(can(['manager'], 'reports.account')).toBe(true);
    expect(can(['manager'], 'reports.profit')).toBe(false);
    expect(can(['manager'], 'team.manage')).toBe(false);
    expect(can(['manager'], 'settings.manage')).toBe(false);
    expect(can(['manager'], 'credit.write_off')).toBe(false);
    expect(can(['owner'], 'credit.write_off')).toBe(true);
  });

  it('le compteur ne fait que compter ; le gestionnaire de stock gère le stock sans changer les prix', () => {
    expect([...permissionsFor(['stock_counter'])]).toEqual(['stock.count']);
    expect(can(['stock_manager'], 'stock.adjust')).toBe(true);
    expect(can(['stock_manager'], 'stock.view_costs')).toBe(true);
    expect(can(['stock_manager'], 'prices.edit')).toBe(false);
    expect(can(['stock_manager'], 'catalog.edit')).toBe(false);
    expect(can(['stock_manager'], 'sale.create')).toBe(false);
  });

  it('sans rôle, aucun droit', () => {
    expect(permissionsFor([]).size).toBe(0);
  });

  it('reconnaît les rôles valides', () => {
    expect(isRole('cashier')).toBe(true);
    expect(isRole('admin')).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});

describe('Limite de remise', () => {
  it('le vendeur est limité par sa limite personnelle, sinon par celle de la boutique', () => {
    expect(maxDiscountPercent(['seller'], 5, 10)).toBe(5);
    expect(maxDiscountPercent(['seller'], null, 10)).toBe(10);
  });

  it('le propriétaire et le gérant n’ont pas de limite', () => {
    expect(maxDiscountPercent(['owner'], 0, 0)).toBe(100);
    expect(maxDiscountPercent(['manager', 'seller'], 0, 0)).toBe(100);
  });
});

describe('Vérification complète : le tableau des droits', () => {
  // Une ligne par rôle : exactement ce que chaque rôle a le droit de faire.
  // Changer un droit oblige à changer ce tableau : rien ne change par accident.
  const EXPECTED: Record<string, string[]> = {
    manager: PERMISSIONS.filter(
      (p) =>
        ![
          'reports.profit',
          'team.manage',
          'settings.manage',
          'credit.write_off',
          'data.delete',
          'catalog.edit',
          'prices.edit',
          'sale.edit_late',
        ].includes(p)
    ),
    cashier: ['sale.create', 'credit.repayment', 'customers.edit', 'cash.session', 'cash.expense'],
    seller: ['sale.create', 'credit.repayment', 'customers.edit'],
    stock_manager: ['stock.receive', 'stock.count', 'stock.adjust', 'stock.view_costs'],
    stock_counter: ['stock.count'],
    delivery: ['credit.repayment'],
  };

  it('chaque rôle a exactement ses droits, ni plus ni moins', () => {
    for (const [role, permissions] of Object.entries(EXPECTED)) {
      expect(
        [...permissionsFor([role as Parameters<typeof permissionsFor>[0][number]])].sort()
      ).toEqual([...permissions].sort());
    }
  });

  it('seul le propriétaire voit les bénéfices, gère l’équipe et les paramètres', () => {
    for (const permission of [
      'reports.profit',
      'team.manage',
      'settings.manage',
      'credit.write_off',
      'data.delete',
      'catalog.edit',
      'prices.edit',
      'sale.edit_late',
    ] as const) {
      expect(can(['owner'], permission)).toBe(true);
      expect(
        can(
          ['manager', 'cashier', 'seller', 'stock_manager', 'stock_counter', 'delivery'],
          permission
        )
      ).toBe(false);
    }
  });

  it('les clients et leurs dettes ne sont pas visibles des rôles du stock', () => {
    expect(canSeeCustomers(['seller'])).toBe(true);
    expect(canSeeCustomers(['cashier'])).toBe(true);
    expect(canSeeCustomers(['manager'])).toBe(true);
    expect(canSeeCustomers(['stock_manager'])).toBe(false);
    expect(canSeeCustomers(['stock_counter'])).toBe(false);
    expect(canSeeCustomers(['stock_counter', 'seller'])).toBe(true);
  });
});
