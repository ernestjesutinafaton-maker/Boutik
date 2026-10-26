import { describe, expect, it } from 'vitest';

import { buildDemoPlan, DEMO_CUSTOMERS, DEMO_PRODUCTS, seededRandom } from './demo';

const TODAY = '2026-10-26';

describe('Boutique de démonstration', () => {
  it('30 produits, 8 clients, des noms uniques', () => {
    expect(DEMO_PRODUCTS).toHaveLength(30);
    expect(new Set(DEMO_PRODUCTS.map((product) => product.key)).size).toBe(30);
    expect(DEMO_CUSTOMERS).toHaveLength(8);
  });

  it('chaque produit a son unité de base en premier et un prix d’achat', () => {
    for (const product of DEMO_PRODUCTS) {
      expect(product.units[0].factor).toBe(1);
      expect(product.units[product.purchase.unitIndex]).toBeDefined();
      expect(product.purchase.cost).toBeGreaterThan(0);
    }
  });

  it('la même graine donne exactement la même boutique', () => {
    expect(buildDemoPlan(TODAY, 7)).toEqual(buildDemoPlan(TODAY, 7));
    expect(seededRandom(1)()).toBe(seededRandom(1)());
    expect(buildDemoPlan(TODAY, 7)).not.toEqual(buildDemoPlan(TODAY, 8));
  });

  it('30 jours de ventes, dans l’ordre, jusqu’à hier', () => {
    const plan = buildDemoPlan(TODAY);
    const sales = plan.filter((event) => event.kind === 'sale');
    expect(sales.length).toBeGreaterThan(150);
    const times = plan.map((event) => event.at);
    expect([...times].sort()).toEqual(times);
    expect(new Date(times[times.length - 1]).getTime()).toBeLessThan(
      new Date(`${TODAY}T23:59:59`).getTime()
    );
    const days = new Set(sales.map((event) => event.at.slice(0, 10)));
    expect(days.size).toBeGreaterThanOrEqual(29);
  });

  it('des ventes à crédit (avec client), des remboursements et des dépenses', () => {
    const plan = buildDemoPlan(TODAY);
    const credit = plan.filter((event) => event.kind === 'sale' && event.payment === 'credit');
    expect(credit.length).toBeGreaterThan(5);
    expect(credit.every((event) => event.kind === 'sale' && event.customerKey !== null)).toBe(true);
    expect(plan.some((event) => event.kind === 'repayment')).toBe(true);
    expect(plan.some((event) => event.kind === 'expense' && event.category === 'rent')).toBe(true);
  });

  it('des produits qui « dorment » ne sont jamais vendus', () => {
    const sold = new Set(
      buildDemoPlan(TODAY).flatMap((event) =>
        event.kind === 'sale' ? event.lines.map((line) => line.productKey) : []
      )
    );
    expect(sold.has('cafe')).toBe(false);
    expect(sold.has('piles')).toBe(false);
    expect(sold.has('riz')).toBe(true);
  });
});
