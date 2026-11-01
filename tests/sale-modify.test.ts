import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLocalDb, type LocalTestDb } from './local-db';

vi.mock('expo-crypto', () => ({
  randomUUID: () => crypto.randomUUID(),
  getRandomBytes: (size: number) => crypto.getRandomValues(new Uint8Array(size)),
}));
vi.mock('@/shop/shop-provider', () => ({ useShop: () => ({ shop: null, device: null }) }));

const { checkCartStock, createSale, replaceSale } = await import('@/sales/sale-actions');
const { receiveStock } = await import('@/stock/stock-actions');
const { settle } = await import('@/domain/sale');

/**
 * Modifier une vente déjà faite : le client revient échanger ou rendre des articles,
 * ou le vendeur s'est trompé. On vérifie le stock, l'argent, la dette et les liens.
 */

const SHOP = 'shop-1';
const context = { shopId: SHOP, memberId: 'owner', deviceId: 'device-1' };
let db: LocalTestDb;

async function seed() {
  const rows: [string, Record<string, unknown>][] = [
    ['payment_methods', { id: 'cash', shop_id: SHOP, label: 'Espèces', kind: 'cash', active: 1 }],
    [
      'payment_methods',
      { id: 'momo', shop_id: SHOP, label: 'MTN MoMo', kind: 'mobile_money', active: 1 },
    ],
    [
      'products',
      { id: 'ciment', shop_id: SHOP, name: 'Ciment', base_unit: 'sac', allow_decimal: 0 },
    ],
    [
      'product_units',
      {
        id: 'sac',
        shop_id: SHOP,
        product_id: 'ciment',
        name: 'sac',
        factor: 1000,
        sale_price: 5500,
        sort_order: 0,
      },
    ],
    [
      'products',
      { id: 'cable', shop_id: SHOP, name: 'Câble', base_unit: 'mètre', allow_decimal: 1 },
    ],
    [
      'product_units',
      {
        id: 'metre',
        shop_id: SHOP,
        product_id: 'cable',
        name: 'mètre',
        factor: 1000,
        sale_price: 350,
        sort_order: 0,
      },
    ],
    ['customers', { id: 'awa', shop_id: SHOP, name: 'Awa', credit_limit: null }],
    ['devices', { id: 'device-1', shop_id: SHOP, device_number: 1 }],
  ];
  for (const [table, row] of rows) {
    const columns = Object.keys(row);
    await db.execute(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      Object.values(row)
    );
  }
  await receiveStock(db, context, {
    supplierName: 'Grossiste',
    reference: null,
    lines: [
      {
        productId: 'ciment',
        productName: 'Ciment',
        unitName: 'sac',
        unitFactor: 1000,
        quantityInUnit: 20_000,
        unitCost: 4900,
        expiryDate: null,
      },
      {
        productId: 'cable',
        productName: 'Câble',
        unitName: 'mètre',
        unitFactor: 1000,
        quantityInUnit: 100_000,
        unitCost: 260,
        expiryDate: null,
      },
    ],
  });
}

const ciment = (sacs: number) => ({
  key: crypto.randomUUID(),
  productId: 'ciment',
  productName: 'Ciment',
  unitId: 'sac',
  unitName: 'sac',
  unitFactor: 1000,
  quantity: sacs * 1000,
  unitPrice: 5500,
});
const cable = (metres: number) => ({
  key: crypto.randomUUID(),
  productId: 'cable',
  productName: 'Câble',
  unitId: 'metre',
  unitName: 'mètre',
  unitFactor: 1000,
  quantity: metres * 1000,
  unitPrice: 350,
});
const stockOf = (productId: string) =>
  db.query<{ stock: number }>(
    'SELECT COALESCE(SUM(quantity), 0) AS stock FROM stock_movements WHERE product_id = ?',
    [productId]
  )[0].stock;
const moneyIn = (methodId: string) =>
  db.query<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE payment_method_id = ?',
    [methodId]
  )[0].total;
const debtOf = (customerId: string) =>
  db.query<{ balance: number }>(
    'SELECT COALESCE(SUM(amount), 0) AS balance FROM customer_ledger WHERE customer_id = ?',
    [customerId]
  )[0].balance;
const saleRow = (id: string) =>
  db.query<{
    status: string;
    total: number;
    replaces_sale_id: string | null;
    cancel_reason: string | null;
  }>('SELECT status, total, replaces_sale_id, cancel_reason FROM sales WHERE id = ?', [id])[0];

/** 2 sacs + 10 m de câble = 14 500, payés 10 000 en espèces et 4 500 par MoMo. */
async function firstSale() {
  const total = 2 * 5500 + 10 * 350;
  const settlement = settle(total, [
    { methodId: 'cash', isCash: true, amount: 10_000 },
    { methodId: 'momo', isCash: false, amount: 4500 },
  ]);
  return createSale(db, context, {
    deviceNumber: 1,
    lines: [ciment(2), cable(10)],
    discount: 0,
    payments: settlement.payments,
    customer: null,
    note: null,
    forceExpired: false,
  });
}

beforeEach(async () => {
  db = createLocalDb();
  await seed();
});

describe('Modifier une vente', () => {
  it('le client rend un sac : le stock revient, on lui rend 5 500 en espèces', async () => {
    const { saleId } = await firstSale();
    expect(stockOf('ciment')).toBe(18_000);

    const result = await replaceSale(db, context, {
      originalSaleId: saleId,
      deviceNumber: 1,
      lines: [ciment(1), cable(10)],
      discount: 0,
      payments: [],
      customer: null,
      note: null,
      forceExpired: false,
      refundMethodId: 'cash',
      reason: 'Échange : un sac rendu',
    });

    expect(result.refunded).toBe(5500);
    expect(stockOf('ciment')).toBe(19_000);
    expect(stockOf('cable')).toBe(90_000);
    // L'argent : 10 000 − 5 500 rendus en espèces ; le MoMo ne bouge pas
    expect(moneyIn('cash')).toBe(4500);
    expect(moneyIn('momo')).toBe(4500);
    // L'ancienne vente est annulée, la nouvelle la remplace (nouvelle facture)
    expect(saleRow(saleId)).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'Échange : un sac rendu',
    });
    expect(saleRow(result.saleId)).toMatchObject({
      status: 'completed',
      total: 9000,
      replaces_sale_id: saleId,
    });
    expect(result.invoiceNumber).toBe('F1-000002');
    const actions = db
      .query<{ action: string }>('SELECT action FROM audit_log')
      .map((row) => row.action);
    expect(actions).toContain('sale.modify');
  });

  it('le client prend plus : il paie seulement la différence', async () => {
    const { saleId } = await firstSale();
    const extra = settle(5500, [{ methodId: 'cash', isCash: true, amount: 6000 }]);

    const result = await replaceSale(db, context, {
      originalSaleId: saleId,
      deviceNumber: 1,
      lines: [ciment(3), cable(10)],
      discount: 0,
      payments: extra.payments,
      customer: null,
      note: null,
      forceExpired: false,
      refundMethodId: null,
      reason: 'Un sac de plus',
    });

    expect(result.refunded).toBe(0);
    expect(stockOf('ciment')).toBe(17_000);
    expect(moneyIn('cash')).toBe(15_500);
    expect(moneyIn('momo')).toBe(4500);
    expect(saleRow(result.saleId)).toMatchObject({ total: 20_000 });
  });

  it('vente à crédit modifiée : la dette est recalculée', async () => {
    const credit = settle(14_500, [{ methodId: 'cash', isCash: true, amount: 4500 }]);
    const { saleId } = await createSale(db, context, {
      deviceNumber: 1,
      lines: [ciment(2), cable(10)],
      discount: 0,
      payments: credit.payments,
      customer: { id: 'awa', name: 'Awa' },
      note: null,
      forceExpired: false,
    });
    expect(debtOf('awa')).toBe(10_000);

    // Elle ne garde qu'un sac : 9 000 au total, 4 500 déjà payés → elle doit 4 500
    await replaceSale(db, context, {
      originalSaleId: saleId,
      deviceNumber: 1,
      lines: [ciment(1), cable(10)],
      discount: 0,
      payments: [],
      customer: { id: 'awa', name: 'Awa' },
      note: null,
      forceExpired: false,
      refundMethodId: 'cash',
      reason: 'Erreur de saisie',
    });
    expect(debtOf('awa')).toBe(4500);
    expect(moneyIn('cash')).toBe(4500);
  });

  it('une livraison pas encore faite suit la vente corrigée', async () => {
    const { saleId } = await firstSale();
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO deliveries (id, shop_id, sale_id, address, status, amount_to_collect, created_at, updated_at)
       VALUES ('livraison', ?, ?, 'Cadjehoun', 'pending', 0, ?, ?)`,
      [SHOP, saleId, now, now]
    );
    const result = await replaceSale(db, context, {
      originalSaleId: saleId,
      deviceNumber: 1,
      lines: [ciment(1), cable(10)],
      discount: 0,
      payments: [],
      customer: null,
      note: null,
      forceExpired: false,
      refundMethodId: 'cash',
      reason: 'Un sac en moins',
    });
    const [delivery] = db.query<{ sale_id: string }>(
      "SELECT sale_id FROM deliveries WHERE id = 'livraison'"
    );
    expect(delivery.sale_id).toBe(result.saleId);
  });

  it('une vente déjà modifiée ne peut pas l’être une seconde fois', async () => {
    const { saleId } = await firstSale();
    const change = {
      originalSaleId: saleId,
      deviceNumber: 1,
      lines: [ciment(2), cable(10)],
      discount: 0,
      payments: [],
      customer: null,
      note: null,
      forceExpired: false,
      refundMethodId: 'cash',
      reason: 'Correction',
    };
    await replaceSale(db, context, change);
    await expect(replaceSale(db, context, change)).rejects.toThrow('déjà annulée ou modifiée');
    // Rien n'a bougé lors du second essai
    expect(stockOf('ciment')).toBe(18_000);
  });

  it('vérification du stock : la marchandise de la vente modifiée compte comme revenue', async () => {
    const { saleId } = await firstSale();
    // 20 sacs reçus, 2 vendus : il en reste 18. Le client veut finalement les 20.
    const shortage = await checkCartStock(db, [ciment(20)], { allowExpired: false });
    expect(shortage.map((problem) => problem.kind)).toEqual(['shortage']);
    const whileModifying = await checkCartStock(db, [ciment(20)], {
      allowExpired: false,
      returningSaleId: saleId,
    });
    expect(whileModifying).toEqual([]);
  });
});

describe('Téléphone d’un membre « équipe » (il ne reçoit pas les coûts)', () => {
  it('vendre puis corriger la vente marche, avec un coût 0 en attendant le serveur', async () => {
    // Ce que reçoit le téléphone d'un vendeur : les lots et les mouvements, sans leurs coûts
    await db.execute('UPDATE stock_lots SET cost_price = NULL, cost_quantity = NULL');
    await db.execute('UPDATE stock_movements SET cost_amount = NULL');

    const { saleId } = await firstSale();
    const result = await replaceSale(db, context, {
      originalSaleId: saleId,
      deviceNumber: 1,
      lines: [ciment(1), cable(10)],
      discount: 0,
      payments: [],
      customer: null,
      note: null,
      forceExpired: false,
      refundMethodId: 'cash',
      reason: 'Erreur de saisie',
    });

    expect(stockOf('ciment')).toBe(19_000);
    const costs = db.query<{ cost_amount: number | null }>(
      'SELECT cost_amount FROM stock_movements WHERE sale_id IN (?, ?)',
      [saleId, result.saleId]
    );
    expect(costs.length).toBeGreaterThan(0);
    // Aucun coût inventé : 0 partout (le serveur calculera le vrai coût à l'envoi)
    expect(costs.every((row) => row.cost_amount === 0)).toBe(true);
  });
});
