import { describe, expect, it } from 'vitest';

import {
  allocate,
  fefoOrder,
  isExpired,
  type LotBalance,
  latestCost,
  lotBalances,
  type MovementLike,
  receiptLine,
  reverseAllocations,
  stockValue,
  sumQuantities,
} from './stock';

const TODAY = '2026-10-25';

function lot(partial: Partial<LotBalance> & Pick<LotBalance, 'id' | 'remaining'>): LotBalance {
  return {
    expiryDate: null,
    receivedAt: '2026-10-01T08:00:00.000Z',
    costPrice: 28_000,
    costQuantity: 50_000,
    ...partial,
  };
}

describe('Réception de marchandise', () => {
  it('10 sacs de 50 kg à 28 000 le sac = un lot de 500 kg valant 280 000', () => {
    expect(receiptLine({ quantityInUnit: 10_000, unitFactor: 50_000, unitCost: 28_000 })).toEqual({
      baseQuantity: 500_000,
      costPrice: 28_000,
      costQuantity: 50_000,
      costAmount: 280_000,
    });
  });

  it('un carton de 24 boîtes à 9 600 : 1 boîte coûte 400', () => {
    const line = receiptLine({ quantityInUnit: 1000, unitFactor: 24_000, unitCost: 9600 });
    expect(line.baseQuantity).toBe(24_000);
    const [boite] = allocate(
      [lot({ id: 'L', remaining: line.baseQuantity, costPrice: 9600, costQuantity: 24_000 })],
      1000,
      { today: TODAY }
    ).allocations;
    expect(boite.costAmount).toBe(400);
  });
});

describe('Le sac de riz entamé', () => {
  // Un sac de 50 kg reçu (28 000 F), puis vendu au détail : 3,5 kg, puis 1,25 kg
  const movements: MovementLike[] = [
    { lotId: 'sac', quantity: 50_000, costAmount: 28_000 },
    { lotId: 'sac', quantity: -3500, costAmount: -1960 },
    { lotId: 'sac', quantity: -1250, costAmount: -700 },
  ];

  it('le stock est la somme des mouvements : 45,25 kg', () => {
    expect(sumQuantities(movements)).toBe(45_250);
  });

  it('le lot sait ce qu’il lui reste', () => {
    const [balance] = lotBalances(
      [{ id: 'sac', expiryDate: null, receivedAt: TODAY, costPrice: 28_000, costQuantity: 50_000 }],
      movements
    );
    expect(balance.remaining).toBe(45_250);
    // Valeur du reste au prix d'achat : 45,25 kg × 560 F = 25 340
    expect(stockValue([balance])).toBe(25_340);
  });

  it('le coût de chaque vente se calcule par règle de trois', () => {
    const result = allocate([lot({ id: 'sac', remaining: 45_250 })], 2000, { today: TODAY });
    expect(result.allocations).toEqual([{ lotId: 'sac', quantity: 2000, costAmount: 1120 }]);
  });
});

describe('Deux appareils qui vendent hors ligne en même temps', () => {
  it('aucune vente n’est perdue : leurs mouvements s’additionnent', () => {
    const reception: MovementLike = { lotId: 'L1', quantity: 10_000, costAmount: 5000 };
    // Le téléphone vend 3 pièces, la tablette 4 pièces, chacun sans réseau
    const telephone: MovementLike = { lotId: 'L1', quantity: -3000, costAmount: -1500 };
    const tablette: MovementLike = { lotId: 'L1', quantity: -4000, costAmount: -2000 };

    // Quel que soit l'ordre d'arrivée sur le serveur, le résultat est le même
    expect(sumQuantities([reception, telephone, tablette])).toBe(3000);
    expect(sumQuantities([tablette, reception, telephone])).toBe(3000);
  });

  it('s’ils vendent plus que le stock, le stock devient négatif (visible, à corriger par inventaire)', () => {
    const movements: MovementLike[] = [
      { lotId: 'L1', quantity: 5000, costAmount: 2500 },
      { lotId: 'L1', quantity: -4000, costAmount: -2000 },
      { lotId: 'L1', quantity: -3000, costAmount: -1500 },
    ];
    expect(sumQuantities(movements)).toBe(-2000);
    const [balance] = lotBalances(
      [{ id: 'L1', expiryDate: null, receivedAt: TODAY, costPrice: 500, costQuantity: 1000 }],
      movements
    );
    // Un lot vidé (ou en négatif) n'est plus jamais choisi pour une sortie
    const next = allocate([balance], 1000, { today: TODAY, fallbackCost: latestCost([balance]) });
    expect(next.allocations).toEqual([{ lotId: null, quantity: 1000, costAmount: 500 }]);
  });
});

describe('FEFO : le lot qui périme le plus tôt sort en premier', () => {
  const lots = [
    lot({ id: 'sans-date', remaining: 10_000, receivedAt: '2026-09-01T08:00:00Z' }),
    lot({ id: 'mars', remaining: 10_000, expiryDate: '2027-03-31' }),
    lot({ id: 'decembre', remaining: 10_000, expiryDate: '2026-12-31' }),
    lot({
      id: 'janvier-ancien',
      remaining: 10_000,
      expiryDate: '2027-01-31',
      receivedAt: '2026-01-01T08:00:00Z',
    }),
    lot({
      id: 'janvier-recent',
      remaining: 10_000,
      expiryDate: '2027-01-31',
      receivedAt: '2026-10-01T08:00:00Z',
    }),
  ];

  it('ordre : péremption la plus proche, puis le plus ancien, les lots sans date à la fin', () => {
    expect(fefoOrder(lots).map((l) => l.id)).toEqual([
      'decembre',
      'janvier-ancien',
      'janvier-recent',
      'mars',
      'sans-date',
    ]);
  });

  it('une vente prise sur deux lots', () => {
    const result = allocate(
      [
        lot({
          id: 'A',
          remaining: 3000,
          expiryDate: '2026-11-15',
          costPrice: 400,
          costQuantity: 1000,
        }),
        lot({
          id: 'B',
          remaining: 20_000,
          expiryDate: '2027-02-01',
          costPrice: 450,
          costQuantity: 1000,
        }),
      ],
      5000,
      { today: TODAY }
    );
    expect(result.allocations).toEqual([
      { lotId: 'A', quantity: 3000, costAmount: 1200 },
      { lotId: 'B', quantity: 2000, costAmount: 900 },
    ]);
    expect(result.shortfall).toBe(0);
  });

  it('sans date de péremption, le plus ancien sort en premier (FIFO)', () => {
    const result = allocate(
      [
        lot({ id: 'recent', remaining: 5000, receivedAt: '2026-10-20T08:00:00Z' }),
        lot({ id: 'ancien', remaining: 5000, receivedAt: '2026-09-20T08:00:00Z' }),
      ],
      6000,
      { today: TODAY }
    );
    expect(result.allocations.map((a) => [a.lotId, a.quantity])).toEqual([
      ['ancien', 5000],
      ['recent', 1000],
    ]);
  });
});

describe('Produits périmés', () => {
  const lots = [
    lot({ id: 'perime', remaining: 4000, expiryDate: '2026-10-24' }),
    lot({ id: 'bon', remaining: 2000, expiryDate: '2026-12-01' }),
  ];

  it('un lot est périmé le lendemain de sa date', () => {
    expect(isExpired({ expiryDate: '2026-10-25' }, TODAY)).toBe(false);
    expect(isExpired({ expiryDate: '2026-10-24' }, TODAY)).toBe(true);
    expect(isExpired({ expiryDate: null }, TODAY)).toBe(false);
  });

  it('un lot périmé n’est jamais vendu sans forçage', () => {
    const result = allocate(lots, 3000, { today: TODAY });
    expect(result.allocations[0]).toMatchObject({ lotId: 'bon', quantity: 2000 });
    expect(result.shortfall).toBe(1000);
    // Le manque existe dans un lot périmé : l'écran bloque la vente
    expect(result.expiredAvailable).toBe(1000);
  });

  it('le propriétaire peut forcer : le lot périmé est alors utilisé', () => {
    const result = allocate(lots, 3000, { today: TODAY, allowExpired: true });
    expect(result.allocations.map((a) => [a.lotId, a.quantity])).toEqual([['perime', 3000]]);
    expect(result.shortfall).toBe(0);
  });
});

describe('Vendre alors que le stock affiché est à 0', () => {
  it('la vente passe « sans lot », au coût du dernier achat', () => {
    const result = allocate([], 2000, {
      today: TODAY,
      fallbackCost: { costPrice: 28_000, costQuantity: 50_000 },
    });
    expect(result.allocations).toEqual([{ lotId: null, quantity: 2000, costAmount: 1120 }]);
    expect(result.shortfall).toBe(2000);
    expect(result.expiredAvailable).toBe(0);
  });

  it('sans aucun achat connu, le coût est 0', () => {
    expect(allocate([], 1000, { today: TODAY }).allocations[0].costAmount).toBe(0);
  });
});

describe('Retours et annulations : la marchandise revient dans les bons lots', () => {
  const taken = [
    { lotId: 'A', quantity: 3000, costAmount: 1200 },
    { lotId: 'B', quantity: 2000, costAmount: 900 },
  ];

  it('annulation complète : chaque lot récupère exactement ce qu’il avait donné', () => {
    expect(reverseAllocations(taken, 5000)).toEqual([
      { lotId: 'B', quantity: 2000, costAmount: 900 },
      { lotId: 'A', quantity: 3000, costAmount: 1200 },
    ]);
  });

  it('retour partiel : on commence par le dernier lot utilisé', () => {
    expect(reverseAllocations(taken, 2500)).toEqual([
      { lotId: 'B', quantity: 2000, costAmount: 900 },
      { lotId: 'A', quantity: 500, costAmount: 200 },
    ]);
  });
});
