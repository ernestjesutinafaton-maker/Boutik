import { describe, expect, it } from 'vitest';

import { expiryLevel, worstLevel } from './expiry';
import { adjustmentValue, inventoryDifference, planAdjustment } from './inventory';
import type { LotBalance } from './stock';

const TODAY = '2026-10-25';

describe('Alertes de péremption (30 jours, puis 7 jours avant)', () => {
  it('donne le bon niveau selon les jours restants', () => {
    expect(expiryLevel('2026-10-24', TODAY)).toBe('expired');
    expect(expiryLevel('2026-10-25', TODAY)).toBe('urgent'); // périme ce soir
    expect(expiryLevel('2026-11-01', TODAY)).toBe('urgent'); // 7 jours
    expect(expiryLevel('2026-11-02', TODAY)).toBe('soon'); // 8 jours
    expect(expiryLevel('2026-11-24', TODAY)).toBe('soon'); // 30 jours
    expect(expiryLevel('2026-11-25', TODAY)).toBe('ok'); // 31 jours
    expect(expiryLevel(null, TODAY)).toBe('ok');
  });

  it('les délais sont réglables par boutique', () => {
    expect(expiryLevel('2026-11-08', TODAY, { first: 60, second: 15 })).toBe('urgent'); // 14 jours
    expect(expiryLevel('2026-12-20', TODAY, { first: 60, second: 15 })).toBe('soon');
  });

  it('un produit prend le niveau de son lot le plus grave', () => {
    expect(worstLevel(['ok', 'soon', 'urgent'])).toBe('urgent');
    expect(worstLevel(['soon', 'expired', 'ok'])).toBe('expired');
    expect(worstLevel([])).toBe('ok');
  });
});

describe('Inventaire : corriger le stock après comptage', () => {
  const lots: LotBalance[] = [
    {
      id: 'perime',
      expiryDate: '2026-10-01',
      receivedAt: '2026-06-01T08:00:00Z',
      costPrice: 400,
      costQuantity: 1000,
      remaining: 2000,
    },
    {
      id: 'recent',
      expiryDate: '2027-03-01',
      receivedAt: '2026-10-10T08:00:00Z',
      costPrice: 450,
      costQuantity: 1000,
      remaining: 10_000,
    },
  ];

  it('l’écart est compté − calculé', () => {
    expect(inventoryDifference(12_000, 9000)).toBe(-3000);
    expect(inventoryDifference(12_000, 12_500)).toBe(500);
  });

  it('pas d’écart, pas de correction', () => {
    expect(planAdjustment(lots, 0, TODAY)).toEqual({ kind: 'none' });
  });

  it('il manque 3 pièces : retirées du lot périmé d’abord, puis du suivant', () => {
    const plan = planAdjustment(lots, -3000, TODAY);
    expect(plan).toEqual({
      kind: 'remove',
      allocations: [
        { lotId: 'perime', quantity: 2000, costAmount: 800 },
        { lotId: 'recent', quantity: 1000, costAmount: 450 },
      ],
      costAmount: 1250,
    });
    expect(adjustmentValue(plan)).toBe(-1250);
  });

  it('on trouve 0,5 de plus : un nouveau lot au prix du dernier achat', () => {
    const plan = planAdjustment(lots, 500, TODAY);
    expect(plan).toEqual({
      kind: 'add',
      quantity: 500,
      costPrice: 450,
      costQuantity: 1000,
      costAmount: 225,
    });
    expect(adjustmentValue(plan)).toBe(225);
  });

  it('un produit jamais acheté : le surplus est ajouté au coût 0', () => {
    const plan = planAdjustment([], 4000, TODAY);
    expect(plan).toMatchObject({ kind: 'add', quantity: 4000, costAmount: 0 });
  });
});
