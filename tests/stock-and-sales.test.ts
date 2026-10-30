import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLocalDb, type LocalTestDb } from './local-db';

// Modules du téléphone remplacés par leurs équivalents Node.js
vi.mock('expo-crypto', () => ({
  randomUUID: () => crypto.randomUUID(),
  getRandomBytes: (size: number) => crypto.getRandomValues(new Uint8Array(size)),
}));
vi.mock('@/shop/shop-provider', () => ({ useShop: () => ({ shop: null, device: null }) }));

const { recordRepayment } = await import('@/customers/customer-actions');
const { createSale, cancelSale, returnSaleItems, SaleStockError } =
  await import('@/sales/sale-actions');
const { receiveStock, declareLoss, LossExceedsStockError } = await import('@/stock/stock-actions');
const { saveCount, startInventory, validateInventory } = await import('@/stock/inventory');
const { settle } = await import('@/domain/sale');

/**
 * Scénarios complets, sur une vraie base SQLite : réception, ventes, crédit,
 * retours, annulations, pertes, inventaire. On vérifie le stock, l'argent,
 * les dettes et le journal après chaque opération.
 */

const SHOP = 'shop-1';
const OWNER = 'member-owner';
const context = { shopId: SHOP, memberId: OWNER, deviceId: 'device-1' };

let db: LocalTestDb;

function seed() {
  const now = '2026-10-01T08:00:00.000Z';
  const rows: [string, Record<string, unknown>][] = [
    ['payment_methods', { id: 'cash', shop_id: SHOP, label: 'Espèces', kind: 'cash', active: 1 }],
    [
      'payment_methods',
      { id: 'momo', shop_id: SHOP, label: 'MTN MoMo', kind: 'mobile_money', active: 1 },
    ],
    [
      'products',
      { id: 'riz', shop_id: SHOP, name: 'Riz parfumé', base_unit: 'kg', allow_decimal: 1 },
    ],
    [
      'product_units',
      {
        id: 'kg',
        shop_id: SHOP,
        product_id: 'riz',
        name: 'kg',
        factor: 1000,
        sale_price: 700,
        sort_order: 0,
      },
    ],
    [
      'product_units',
      {
        id: 'sac',
        shop_id: SHOP,
        product_id: 'riz',
        name: 'Sac 50 kg',
        factor: 50_000,
        sale_price: 32_000,
        sort_order: 1,
      },
    ],
    [
      'products',
      {
        id: 'lait',
        shop_id: SHOP,
        name: 'Lait',
        base_unit: 'boîte',
        allow_decimal: 0,
        track_expiry: 1,
      },
    ],
    [
      'product_units',
      {
        id: 'boite',
        shop_id: SHOP,
        product_id: 'lait',
        name: 'boîte',
        factor: 1000,
        sale_price: 500,
        sort_order: 0,
      },
    ],
    ['customers', { id: 'awa', shop_id: SHOP, name: 'Awa', credit_limit: 50_000, created_at: now }],
    ['devices', { id: 'device-1', shop_id: SHOP, device_number: 1 }],
    ['devices', { id: 'device-2', shop_id: SHOP, device_number: 2 }],
  ];
  return Promise.all(
    rows.map(([table, row]) => {
      const columns = Object.keys(row);
      return db.execute(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        Object.values(row)
      );
    })
  );
}

const stockOf = (productId: string) =>
  db.query<{ stock: number }>(
    'SELECT COALESCE(SUM(quantity), 0) AS stock FROM stock_movements WHERE product_id = ?',
    [productId]
  )[0].stock;

const balanceOf = (customerId: string) =>
  db.query<{ balance: number }>(
    'SELECT COALESCE(SUM(amount), 0) AS balance FROM customer_ledger WHERE customer_id = ?',
    [customerId]
  )[0].balance;

const cashIn = () =>
  db.query<{ total: number }>('SELECT COALESCE(SUM(amount), 0) AS total FROM payments')[0].total;

const auditActions = () =>
  db
    .query<{ action: string }>('SELECT action FROM audit_log ORDER BY occurred_at')
    .map((row) => row.action);

const line = (unit: 'kg' | 'sac', quantity: number) => ({
  key: crypto.randomUUID(),
  productId: 'riz',
  productName: 'Riz parfumé',
  unitId: unit,
  unitName: unit === 'kg' ? 'kg' : 'Sac 50 kg',
  unitFactor: unit === 'kg' ? 1000 : 50_000,
  quantity,
  unitPrice: unit === 'kg' ? 700 : 32_000,
});

async function receiveRice(sacs: number) {
  await receiveStock(db, context, {
    supplierName: 'Grossiste',
    reference: null,
    lines: [
      {
        productId: 'riz',
        productName: 'Riz parfumé',
        unitName: 'Sac 50 kg',
        unitFactor: 50_000,
        quantityInUnit: sacs * 1000,
        unitCost: 28_000,
        expiryDate: null,
      },
    ],
  });
}

beforeEach(async () => {
  db = createLocalDb();
  await seed();
});

describe('Réception puis vente', () => {
  it('2 sacs reçus, 1 sac + 3,5 kg vendus : il reste 46,5 kg', async () => {
    await receiveRice(2);
    expect(stockOf('riz')).toBe(100_000);

    const lines = [line('sac', 1000), line('kg', 3500)];
    const total = 32_000 + 2450;
    const settlement = settle(total, [{ methodId: 'cash', isCash: true, amount: 40_000 }]);
    const { invoiceNumber } = await createSale(db, context, {
      deviceNumber: 1,
      lines,
      discount: 0,
      payments: settlement.payments,
      customer: null,
      note: null,
      forceExpired: false,
    });

    expect(invoiceNumber).toBe('F1-000001');
    expect(stockOf('riz')).toBe(46_500);
    // Coût des marchandises vendues : 28 000 (sac) + 1 960 (3,5 kg à 560 F le kg)
    const cost = db.query<{ cost: number }>(
      "SELECT SUM(cost_amount) AS cost FROM stock_movements WHERE type = 'sale'"
    )[0].cost;
    expect(cost).toBe(-29_960);
    // On garde 34 450 : 40 000 donnés, 5 550 rendus
    expect(cashIn()).toBe(total);
    const payment = db.query<{ cash_received: number; change_given: number }>(
      'SELECT cash_received, change_given FROM payments'
    )[0];
    expect(payment).toEqual({ cash_received: 40_000, change_given: 5550 });
    expect(auditActions()).toEqual(['stock.receive', 'sale.create']);
  });

  it('chaque appareil a ses propres numéros de facture, sans doublon', async () => {
    await receiveRice(1);
    const sell = (deviceId: string, deviceNumber: number) =>
      createSale(
        db,
        { ...context, deviceId },
        {
          deviceNumber,
          lines: [line('kg', 1000)],
          discount: 0,
          payments: settle(700, [{ methodId: 'cash', isCash: true, amount: 700 }]).payments,
          customer: null,
          note: null,
          forceExpired: false,
        }
      );
    expect((await sell('device-1', 1)).invoiceNumber).toBe('F1-000001');
    expect((await sell('device-2', 2)).invoiceNumber).toBe('F2-000001');
    expect((await sell('device-1', 1)).invoiceNumber).toBe('F1-000002');
    expect(stockOf('riz')).toBe(47_000);
  });
});

describe('Crédit', () => {
  it('vente à moitié payée : le reste devient une dette, puis remboursée en partie', async () => {
    await receiveRice(1);
    const settlement = settle(7000, [{ methodId: 'momo', isCash: false, amount: 3000 }]);
    await createSale(db, context, {
      deviceNumber: 1,
      lines: [line('kg', 10_000)],
      discount: 0,
      payments: settlement.payments,
      customer: { id: 'awa', name: 'Awa' },
      note: null,
      forceExpired: false,
    });
    expect(balanceOf('awa')).toBe(4000);

    await recordRepayment(db, context, {
      customer: {
        id: 'awa',
        name: 'Awa',
        phone: null,
        creditLimit: 50_000,
        notes: null,
        archived: false,
        balance: 4000,
      },
      amount: 1500,
      methodId: 'cash',
      cashReceived: 1500,
      changeGiven: 0,
    });
    expect(balanceOf('awa')).toBe(2500);
    expect(cashIn()).toBe(4500);
  });

  it('une vente à crédit sans client est refusée', async () => {
    await expect(
      createSale(db, context, {
        deviceNumber: 1,
        lines: [line('kg', 1000)],
        discount: 0,
        payments: [],
        customer: null,
        note: null,
        forceExpired: false,
      })
    ).rejects.toThrow();
    expect(db.query('SELECT id FROM sales')).toHaveLength(0);
  });
});

describe('Retours et annulations', () => {
  it('retour partiel, puis annulation : tout revient comme avant', async () => {
    await receiveRice(2);
    const total = 32_000 + 2450;
    const { saleId } = await createSale(db, context, {
      deviceNumber: 1,
      lines: [line('sac', 1000), line('kg', 3500)],
      discount: 0,
      payments: settle(total, [{ methodId: 'cash', isCash: true, amount: total }]).payments,
      customer: null,
      note: null,
      forceExpired: false,
    });
    const kgItem = db.query<{ id: string }>("SELECT id FROM sale_items WHERE unit_name = 'kg'")[0];

    // Le client rapporte 1,5 kg : remboursé 1 050
    const result = await returnSaleItems(db, context, {
      saleId,
      items: [{ saleItemId: kgItem.id, baseQuantity: 1500 }],
      refundMethodId: 'cash',
      reason: 'Trop acheté',
    });
    expect(result).toEqual({ value: 1050, refunded: 1050 });
    expect(stockOf('riz')).toBe(100_000 - 50_000 - 2000);
    expect(cashIn()).toBe(total - 1050);

    // On ne peut pas reprendre plus que ce qui reste vendu
    await expect(
      returnSaleItems(db, context, {
        saleId,
        items: [{ saleItemId: kgItem.id, baseQuantity: 2500 }],
        refundMethodId: 'cash',
        reason: 'Erreur',
      })
    ).rejects.toThrow();

    // Puis annulation : le reste revient, tout l'argent est rendu
    await cancelSale(db, context, saleId, 'Client parti');
    expect(stockOf('riz')).toBe(100_000);
    expect(cashIn()).toBe(0);
    expect(db.query<{ status: string }>('SELECT status FROM sales')[0].status).toBe('cancelled');
    await expect(cancelSale(db, context, saleId, 'Encore')).rejects.toThrow();
    expect(auditActions()).toEqual(['stock.receive', 'sale.create', 'sale.return', 'sale.cancel']);
  });

  it('annuler une vente à crédit efface sa dette', async () => {
    await receiveRice(1);
    const { saleId } = await createSale(db, context, {
      deviceNumber: 1,
      lines: [line('kg', 2000)],
      discount: 0,
      payments: [],
      customer: { id: 'awa', name: 'Awa' },
      note: null,
      forceExpired: false,
    });
    expect(balanceOf('awa')).toBe(1400);
    await cancelSale(db, context, saleId, 'Erreur de saisie');
    expect(balanceOf('awa')).toBe(0);
    expect(stockOf('riz')).toBe(50_000);
  });
});

describe('Stock insuffisant et produits périmés', () => {
  async function receiveMilk(boxes: number, expiryDate: string) {
    await receiveStock(db, context, {
      supplierName: null,
      reference: null,
      lines: [
        {
          productId: 'lait',
          productName: 'Lait',
          unitName: 'boîte',
          unitFactor: 1000,
          quantityInUnit: boxes * 1000,
          unitCost: 400,
          expiryDate,
        },
      ],
    });
  }

  const milk = (boxes: number) => ({
    key: crypto.randomUUID(),
    productId: 'lait',
    productName: 'Lait',
    unitId: 'boite',
    unitName: 'boîte',
    unitFactor: 1000,
    quantity: boxes * 1000,
    unitPrice: 500,
  });

  const sellMilk = (boxes: number, options: { forceExpired?: boolean }) =>
    createSale(db, context, {
      deviceNumber: 1,
      lines: [milk(boxes)],
      discount: 0,
      payments: settle(boxes * 500, [{ methodId: 'cash', isCash: true, amount: boxes * 500 }])
        .payments,
      customer: null,
      note: null,
      forceExpired: options.forceExpired ?? false,
    });

  it('une vente prise sur deux lots : celui qui périme le plus tôt d’abord', async () => {
    await receiveMilk(3, '2099-01-31');
    await receiveMilk(3, '2099-01-10');
    await sellMilk(4, {});
    const byLot = db.query<{ expiry_date: string; remaining: number }>(
      `SELECT l.expiry_date, SUM(m.quantity) AS remaining
         FROM stock_lots l JOIN stock_movements m ON m.lot_id = l.id
        GROUP BY l.id ORDER BY l.expiry_date`
    );
    expect(byLot).toEqual([
      { expiry_date: '2099-01-10', remaining: 0 },
      { expiry_date: '2099-01-31', remaining: 2000 },
    ]);
  });

  it('un lot périmé bloque la vente, sauf forçage par le propriétaire (noté au journal)', async () => {
    await receiveMilk(2, '2020-01-01');
    await expect(sellMilk(1, {})).rejects.toBeInstanceOf(SaleStockError);
    expect(stockOf('lait')).toBe(2000);

    await sellMilk(1, { forceExpired: true });
    expect(stockOf('lait')).toBe(1000);
    expect(auditActions()).toContain('sale.expired_forced');
  });

  it('stock insuffisant : la vente est toujours refusée, le stock ne devient jamais négatif', async () => {
    await expect(sellMilk(1, {})).rejects.toBeInstanceOf(SaleStockError);
    await receiveMilk(1, '2099-01-31');
    await expect(sellMilk(2, {})).rejects.toBeInstanceOf(SaleStockError);
    expect(stockOf('lait')).toBe(1000);
    expect(db.query("SELECT id FROM stock_movements WHERE type = 'sale'")).toEqual([]);
  });
});

describe('Pertes et inventaire', () => {
  it('une perte plus grande que le stock est refusée (jamais de stock négatif)', async () => {
    await receiveRice(1); // 1 sac = 50 kg
    const loss = (quantity: number) =>
      declareLoss(db, context, {
        productId: 'riz',
        productName: 'Riz parfumé',
        lotId: null,
        quantity,
        reason: 'broken',
        note: null,
      });
    await expect(loss(60_000)).rejects.toBeInstanceOf(LossExceedsStockError);
    expect(stockOf('riz')).toBe(50_000);
    await loss(50_000);
    expect(stockOf('riz')).toBe(0);
  });

  it('une perte sort du stock à son prix d’achat', async () => {
    await receiveRice(1);
    await declareLoss(db, context, {
      productId: 'riz',
      productName: 'Riz parfumé',
      lotId: null,
      quantity: 2000,
      reason: 'broken',
      note: 'Sac percé',
    });
    expect(stockOf('riz')).toBe(48_000);
    const loss = db.query<{ cost_amount: number; loss_reason: string }>(
      "SELECT cost_amount, loss_reason FROM stock_movements WHERE type = 'loss'"
    )[0];
    expect(loss).toEqual({ cost_amount: -1120, loss_reason: 'broken' });
  });

  it('l’inventaire corrige le stock : manque et surplus', async () => {
    await receiveRice(2);
    const countId = await startInventory(db, context, 'Fin du mois');
    // Compté : 97,5 kg de riz (calculé : 100 kg) ; 3 boîtes de lait (calculé : 0)
    await saveCount(db, context, { countId, productId: 'riz', countedQuantity: 97_500 });
    await saveCount(db, context, { countId, productId: 'lait', countedQuantity: 3000 });
    // Une deuxième saisie du même produit remplace la première
    await saveCount(db, context, { countId, productId: 'riz', countedQuantity: 98_000 });

    const value = await validateInventory(db, context, countId);
    expect(stockOf('riz')).toBe(98_000);
    expect(stockOf('lait')).toBe(3000);
    // Manque de 2 kg de riz à 560 F = −1 120 ; lait jamais acheté : surplus à 0 F
    expect(value).toBe(-1120);
    expect(db.query<{ status: string }>('SELECT status FROM inventory_counts')[0].status).toBe(
      'validated'
    );
    expect(auditActions()).toContain('inventory.validate');
  });
});
