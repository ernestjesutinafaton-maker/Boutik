import { describe, expect, it, vi } from 'vitest';

import { createLocalDb } from './local-db';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('@/shop/shop-provider', () => ({ useShop: () => ({ shop: null, device: null }) }));

const { MY_SALES_TOTALS_SQL, MY_RECENT_SALES_SQL } =
  await import('@/dashboard/role-dashboard-data');
const { createSale } = await import('@/sales/sale-actions');
const { receiveStock } = await import('@/stock/stock-actions');
const { dayRange, today } = await import('@/domain/dates');

/** Le tableau de bord du vendeur ne montre que SES ventes. */

const SHOP = 'shop-1';
const awa = { shopId: SHOP, memberId: 'awa', deviceId: 'device-1' };
const koffi = { shopId: SHOP, memberId: 'koffi', deviceId: 'device-1' };

describe('Mes ventes (vendeur)', () => {
  it('compte seulement les ventes de la personne, pas celles des autres', async () => {
    const db = createLocalDb();
    await db.execute(
      "INSERT INTO products (id, shop_id, name, base_unit, allow_decimal) VALUES ('riz', ?, 'Riz', 'kg', 1)",
      [SHOP]
    );
    await receiveStock(db, awa, {
      supplierName: null,
      reference: null,
      lines: [
        {
          productId: 'riz',
          productName: 'Riz',
          unitName: 'kg',
          unitFactor: 1000,
          quantityInUnit: 100_000,
          unitCost: 500,
          expiryDate: null,
        },
      ],
    });
    const sell = (context: typeof awa, kilos: number) =>
      createSale(db, context, {
        deviceNumber: 1,
        lines: [
          {
            key: crypto.randomUUID(),
            productId: 'riz',
            productName: 'Riz',
            unitId: 'kg',
            unitName: 'kg',
            unitFactor: 1000,
            quantity: kilos * 1000,
            unitPrice: 700,
          },
        ],
        discount: 0,
        payments: [
          {
            methodId: 'cash',
            amount: kilos * 700,
            cashReceived: null,
            changeGiven: null,
          },
        ],
        customer: null,
        note: null,
        forceExpired: false,
      });
    await sell(awa, 2);
    await sell(awa, 3);
    await sell(koffi, 10);

    const range = dayRange(today());
    const mine = db.query<{ count: number; total: number }>(MY_SALES_TOTALS_SQL, [
      SHOP,
      'awa',
      range.start,
      range.end,
    ])[0];
    expect(mine).toMatchObject({ count: 2, total: 3500 });
    expect(db.query(MY_RECENT_SALES_SQL, [SHOP, 'awa'])).toHaveLength(2);
  });
});
