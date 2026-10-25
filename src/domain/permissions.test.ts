import { describe, expect, it } from 'vitest';

import { can, isRole, maxDiscountPercent, PERMISSIONS, permissionsFor } from './permissions';

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

  it('le gérant remplace le propriétaire, sauf bénéfices, équipe et paramètres', () => {
    expect(can(['manager'], 'sale.cancel')).toBe(true);
    expect(can(['manager'], 'prices.edit')).toBe(true);
    expect(can(['manager'], 'reports.account')).toBe(true);
    expect(can(['manager'], 'reports.profit')).toBe(false);
    expect(can(['manager'], 'team.manage')).toBe(false);
    expect(can(['manager'], 'settings.manage')).toBe(false);
  });

  it('le compteur ne fait que compter ; le gestionnaire de stock gère le stock sans changer les prix', () => {
    expect([...permissionsFor(['stock_counter'])]).toEqual(['stock.count']);
    expect(can(['stock_manager'], 'stock.adjust')).toBe(true);
    expect(can(['stock_manager'], 'stock.view_costs')).toBe(true);
    expect(can(['stock_manager'], 'prices.edit')).toBe(false);
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
