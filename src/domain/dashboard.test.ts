import { describe, expect, it } from 'vitest';

import { dailyTotals, sleepingProducts } from './dashboard';

const TODAY = '2026-10-26';
const noon = (day: string) => new Date(`${day}T12:00:00`).toISOString();

describe('Tableau de bord', () => {
  it('les ventes jour par jour, annulées exclues, jours sans vente à 0', () => {
    const series = dailyTotals(
      [
        { occurredAt: noon('2026-10-26'), total: 5000, status: 'completed' },
        { occurredAt: noon('2026-10-26'), total: 2000, status: 'completed' },
        { occurredAt: noon('2026-10-24'), total: 1000, status: 'completed' },
        { occurredAt: noon('2026-10-24'), total: 9000, status: 'cancelled' },
        { occurredAt: noon('2026-10-01'), total: 7000, status: 'completed' }, // hors période
      ],
      TODAY,
      3
    );
    expect(series).toEqual([
      { day: '2026-10-24', total: 1000, count: 1 },
      { day: '2026-10-25', total: 0, count: 0 },
      { day: '2026-10-26', total: 7000, count: 2 },
    ]);
  });

  it('les produits qui dorment : en stock, mais pas vendus depuis 30 jours', () => {
    const products = [
      {
        id: 'riz',
        name: 'Riz',
        stock: 5000,
        baseUnit: 'kg',
        lastSaleAt: noon('2026-10-25'),
        inStockSince: noon('2026-01-01'),
      },
      {
        id: 'cafe',
        name: 'Café',
        stock: 12_000,
        baseUnit: 'boîte',
        lastSaleAt: null,
        inStockSince: noon('2026-08-01'),
      },
      {
        id: 'piles',
        name: 'Piles',
        stock: 40_000,
        baseUnit: 'pièce',
        lastSaleAt: noon('2026-09-10'),
        inStockSince: noon('2026-01-01'),
      },
      {
        id: 'vide',
        name: 'Vide',
        stock: 0,
        baseUnit: 'pièce',
        lastSaleAt: null,
        inStockSince: noon('2026-01-01'),
      },
      {
        id: 'nouveau',
        name: 'Nouveau',
        stock: 1000,
        baseUnit: 'pièce',
        lastSaleAt: null,
        inStockSince: noon('2026-10-20'),
      },
    ];
    expect(sleepingProducts(products, TODAY)).toEqual([
      { id: 'cafe', name: 'Café', stock: 12_000, baseUnit: 'boîte', daysWithoutSale: null },
      { id: 'piles', name: 'Piles', stock: 40_000, baseUnit: 'pièce', daysWithoutSale: 46 },
    ]);
  });
});
