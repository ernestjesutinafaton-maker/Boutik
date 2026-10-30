import { describe, expect, it } from 'vitest';

import { referenceUnit, unitCost, unitMargins } from './margin';

/** L'exemple d'Ernest : riz acheté au sac, revendu au sac et au kilo. */
const riz = [
  { id: 'kg', name: 'kg', factor: 1000, salePrice: 550, purchasePrice: null },
  { id: 'sac', name: 'Sac 50 kg', factor: 50_000, salePrice: 32_000, purchasePrice: 30_000 },
];

describe('Prix d’achat et marge par unité', () => {
  it('le sac sert de référence (plus gros contenu avec un prix d’achat)', () => {
    expect(referenceUnit(riz)?.id).toBe('sac');
  });

  it('le prix d’achat du kg est déduit du sac : 30 000 / 50 = 600 F', () => {
    expect(unitCost(riz[0], riz)).toEqual({ cost: 600, derived: true });
  });

  it('le kg vendu 550 F fait perdre 50 F ; le sac gagne 2 000 F', () => {
    const [kg, sac] = unitMargins(riz);
    expect(kg).toMatchObject({ cost: 600, margin: -50, marginPercent: -9 });
    expect(sac).toMatchObject({ cost: 30_000, margin: 2000, marginPercent: 6, derived: false });
  });

  it('un prix d’achat tapé pour une unité est gardé tel quel', () => {
    const units = [
      { id: 'piece', name: 'Pièce', factor: 1000, salePrice: 300, purchasePrice: 200 },
      { id: 'carton', name: 'Carton de 24', factor: 24_000, salePrice: 6500, purchasePrice: 4500 },
    ];
    expect(unitMargins(units).map((unit) => unit.margin)).toEqual([100, 2000]);
  });

  it('sans aucun prix d’achat : marge inconnue (pas inventée)', () => {
    const units = [{ id: 'kg', name: 'kg', factor: 1000, salePrice: 700, purchasePrice: null }];
    expect(unitMargins(units)[0]).toMatchObject({ cost: null, margin: null });
  });
});
