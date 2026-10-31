import { describe, expect, it, vi } from 'vitest';

import { createLocalDb } from './local-db';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('@/shop/shop-provider', () => ({ useShop: () => ({ shop: null, device: null }) }));

const { loadDemoData, ShopNotEmptyError } = await import('@/demo/load-demo');
const { today } = await import('@/domain/dates');

/** Les données de démonstration, chargées avec les vraies fonctions de l'appli. */

const SHOP = 'shop-1';
const context = { shopId: SHOP, memberId: 'owner', deviceId: 'device-1' };

describe('Données de démonstration', () => {
  it('remplit une boutique vide, sans stock négatif ni vente bloquée', async () => {
    const db = createLocalDb();
    await db.execute(
      "INSERT INTO payment_methods (id, shop_id, label, kind, sort_order, active) VALUES ('cash', ?, 'Espèces', 'cash', 1, 1), ('momo', ?, 'MTN MoMo', 'mobile_money', 2, 1)",
      [SHOP, SHOP]
    );
    let lastProgress = 0;
    const { sales } = await loadDemoData(db, context, {
      deviceNumber: 1,
      today: today(),
      onProgress: (done) => {
        lastProgress = done;
      },
    });

    expect(sales).toBeGreaterThan(150);
    expect(lastProgress).toBeGreaterThan(sales);
    expect(db.query<{ count: number }>('SELECT COUNT(*) AS count FROM products')[0].count).toBe(30);
    expect(db.query<{ count: number }>('SELECT COUNT(*) AS count FROM sales')[0].count).toBe(sales);

    // Aucun produit en stock négatif
    const negative = db.query(
      `SELECT product_id, SUM(quantity) AS stock FROM stock_movements
        GROUP BY product_id HAVING SUM(quantity) < 0`
    );
    expect(negative).toEqual([]);

    // Des clients doivent de l'argent ; les factures se suivent F1-000001, F1-000002…
    const debt = db.query<{ total: number }>('SELECT SUM(amount) AS total FROM customer_ledger')[0];
    expect(debt.total).toBeGreaterThan(0);
    const last = db.query<{ invoice_number: string }>(
      'SELECT invoice_number FROM sales ORDER BY invoice_seq DESC LIMIT 1'
    )[0];
    expect(last.invoice_number).toBe(`F1-${String(sales).padStart(6, '0')}`);

    // Un lot périmé reste en stock (il n'est jamais vendu) : il apparaît dans les alertes
    const expired = db.query<{ remaining: number }>(
      `SELECT SUM(m.quantity) AS remaining FROM stock_lots l JOIN stock_movements m ON m.lot_id = l.id
        WHERE l.expiry_date < ? GROUP BY l.id`,
      [today()]
    );
    expect(expired).toEqual([{ remaining: 3000 }]);

    // Une seule fois : la boutique n'est plus vide
    await expect(
      loadDemoData(db, context, { deviceNumber: 1, today: today() })
    ).rejects.toBeInstanceOf(ShopNotEmptyError);
  }, 120_000);
});

describe('Tableau de bord sur la boutique de démonstration', () => {
  it('calcule les chiffres des 3 périodes, la courbe et les produits qui dorment', async () => {
    const { loadDashboard } = await import('@/dashboard/dashboard-data');
    const db = createLocalDb();
    await db.execute(
      "INSERT INTO payment_methods (id, shop_id, label, kind, sort_order, active) VALUES ('cash', ?, 'Espèces', 'cash', 1, 1), ('momo', ?, 'MTN MoMo', 'mobile_money', 2, 1)",
      [SHOP, SHOP]
    );
    await loadDemoData(db, context, { deviceNumber: 1, today: today() });
    const data = await loadDashboard(db, SHOP, today(), new Date().toISOString());

    // Rien aujourd'hui (la démonstration s'arrête hier), beaucoup sur 30 jours
    expect(data.reports.today.sales.count).toBe(0);
    expect(data.reports.week.sales.count).toBeGreaterThan(20);
    expect(data.reports.month.sales.count).toBeGreaterThan(data.reports.week.sales.count);
    expect(data.reports.month.netProfit).toBeLessThan(data.reports.month.grossProfit);
    expect(data.reports.month.expenses.byCategory.rent).toBe(40_000);
    expect(data.reports.month.topProducts[0].revenue).toBeGreaterThan(0);
    expect(data.reports.month.totalDebt).toBeGreaterThan(0);
    expect(data.series).toHaveLength(14);
    expect(data.series.filter((entry) => entry.total > 0).length).toBeGreaterThanOrEqual(12);
    expect(data.sleeping.map((product) => product.name)).toEqual(
      expect.arrayContaining(['Niveau à bulle 60 cm'])
    );
  }, 120_000);
});
