import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLocalDb, type LocalTestDb } from './local-db';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('@/shop/shop-provider', () => ({ useShop: () => ({ shop: null, device: null }) }));

const { closeCashSession, openCashSession, recordCashMovement, CashSessionAlreadyOpenError } =
  await import('@/cash/cash-actions');
const { makeAccount } = await import('@/reports/report-actions');
const { createSale } = await import('@/sales/sale-actions');
const { receiveStock } = await import('@/stock/stock-actions');
const { settle } = await import('@/domain/sale');

/** La caisse du jour, la clôture et les comptes, sur une vraie base SQLite. */

const SHOP = 'shop-1';
const context = { shopId: SHOP, memberId: 'owner', deviceId: 'device-1' };
const methods = [
  { id: 'cash', label: 'Espèces', isCash: true },
  { id: 'momo', label: 'MTN MoMo', isCash: false },
];
let db: LocalTestDb;

beforeEach(async () => {
  db = createLocalDb();
  for (const [sql, params] of [
    [
      "INSERT INTO payment_methods (id, shop_id, label, kind, active) VALUES ('cash', ?, 'Espèces', 'cash', 1)",
      [SHOP],
    ],
    [
      "INSERT INTO payment_methods (id, shop_id, label, kind, active) VALUES ('momo', ?, 'MTN MoMo', 'mobile_money', 1)",
      [SHOP],
    ],
    [
      "INSERT INTO products (id, shop_id, name, base_unit, allow_decimal) VALUES ('riz', ?, 'Riz', 'kg', 1)",
      [SHOP],
    ],
  ] as const) {
    await db.execute(sql, [...params]);
  }
  await receiveStock(db, context, {
    supplierName: null,
    reference: null,
    lines: [
      {
        productId: 'riz',
        productName: 'Riz',
        unitName: 'Sac 50 kg',
        unitFactor: 50_000,
        quantityInUnit: 1000,
        unitCost: 28_000,
        expiryDate: null,
      },
    ],
  });
});

const sellRice = (
  kilos: number,
  payments: { methodId: string; isCash: boolean; amount: number }[]
) =>
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
    payments: settle(kilos * 700, payments).payments,
    customer: null,
    note: null,
    forceExpired: false,
  });

describe('Caisse du jour et clôture', () => {
  it('ouvrir, vendre, dépenser, clôturer : la fiche du jour est archivée avec les écarts', async () => {
    const sessionId = await openCashSession(db, context, 5000);
    await expect(openCashSession(db, context, 0)).rejects.toBeInstanceOf(
      CashSessionAlreadyOpenError
    );

    await sellRice(10, [{ methodId: 'cash', isCash: true, amount: 10_000 }]); // 7 000, 3 000 rendus
    await sellRice(5, [{ methodId: 'momo', isCash: false, amount: 3500 }]);
    await recordCashMovement(db, context, {
      type: 'expense',
      category: 'fuel',
      methodId: 'cash',
      amount: 1500,
      note: 'Essence du livreur',
    });

    // Attendu en espèces : 5 000 + 7 000 − 1 500 = 10 500 ; compté : 10 000 (il manque 500)
    const reportId = await closeCashSession(db, context, {
      sessionId,
      counted: { cash: 10_000, momo: 3500 },
      methods,
      notes: null,
    });

    const session = db.query<{ status: string; difference_amount: number }>(
      'SELECT status, difference_amount FROM cash_sessions'
    )[0];
    expect(session).toEqual({ status: 'closed', difference_amount: -500 });

    const report = db.query<{ kind: string; data: string }>(
      'SELECT kind, data FROM reports WHERE id = ?',
      [reportId]
    )[0];
    expect(report.kind).toBe('day_close');
    const data = JSON.parse(report.data);
    expect(data.sales).toMatchObject({ count: 2, revenue: 10_500 });
    expect(data.expenses).toEqual({ total: 1500, byCategory: { fuel: 1500 } });
    // Bénéfice : 10 500 − coût (15 kg à 560 F = 8 400) − 1 500 de dépenses
    expect(data.netProfit).toBe(10_500 - 8400 - 1500);
    expect(data.closing).toEqual({
      openingFloat: 5000,
      methods: [
        { label: 'Espèces', expected: 10_500, counted: 10_000, difference: -500 },
        { label: 'MTN MoMo', expected: 3500, counted: 3500, difference: 0 },
      ],
      totalDifference: -500,
    });
    // Une caisse clôturée ne se clôture pas deux fois
    await expect(
      closeCashSession(db, context, { sessionId, counted: {}, methods, notes: null })
    ).rejects.toThrow();
  });
});

describe('Faire un compte', () => {
  it('le compte va du compte précédent (N-1) jusqu’à maintenant (N)', async () => {
    await sellRice(2, [{ methodId: 'cash', isCash: true, amount: 1400 }]);
    const first = await makeAccount(db, context, null);
    const firstData = JSON.parse(
      db.query<{ data: string }>('SELECT data FROM reports WHERE id = ?', [first])[0].data
    );
    expect(firstData.sales.count).toBe(1);
    expect(firstData.stock.valueAtEnd).toBe(28_000 - 1120);

    // (dans la vraie vie, des secondes séparent deux opérations ; ici on attend 2 millisecondes)
    await new Promise((resolve) => setTimeout(resolve, 2));
    await sellRice(1, [{ methodId: 'cash', isCash: true, amount: 700 }]);
    const second = await makeAccount(db, context, null);
    const rows = db.query<{ id: string; period_start: string; period_end: string; data: string }>(
      'SELECT id, period_start, period_end, data FROM reports ORDER BY period_end'
    );
    expect(rows.map((row) => row.id)).toEqual([first, second]);
    // Le deuxième compte commence juste après la fin du premier : rien n'est compté deux fois
    expect(Date.parse(rows[1].period_start) - Date.parse(rows[0].period_end)).toBe(1);
    expect(JSON.parse(rows[1].data).sales).toMatchObject({ count: 1, revenue: 700 });
  });
});
