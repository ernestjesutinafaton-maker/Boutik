import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createLocalDb, type LocalTestDb } from './local-db';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('@/shop/shop-provider', () => ({ useShop: () => ({ shop: null, device: null }) }));

const { loadDemoData } = await import('@/demo/load-demo');
const { buildExport } = await import('@/export/datasets');
const { toCsv } = await import('@/export/csv');
const { tableHtml } = await import('@/reports/table-html');
const { startInventory, saveCount, validateInventory } = await import('@/stock/inventory');
const { addPaymentMethod, updatePaymentMethod, updateShopSettings } =
  await import('@/shop/settings-actions');
const { today, dayRange, addDays } = await import('@/domain/dates');

/** Paramètres de la boutique et export Excel, sur la boutique de démonstration. */

const SHOP = 'shop-1';
const context = { shopId: SHOP, memberId: 'owner', deviceId: 'device-1' };
let db: LocalTestDb;

beforeAll(async () => {
  db = createLocalDb();
  await db.execute(
    "INSERT INTO shops (id, name, currency_code, seller_max_discount_percent, allow_sale_without_stock) VALUES (?, 'Chez Maman', 'XOF', 0, 1)",
    [SHOP]
  );
  await db.execute(
    "INSERT INTO payment_methods (id, shop_id, label, kind, sort_order, active) VALUES ('cash', ?, 'Espèces', 'cash', 1, 1), ('momo', ?, 'MTN MoMo', 'mobile_money', 2, 1)",
    [SHOP, SHOP]
  );
  await loadDemoData(db, context, { deviceNumber: 1, today: today() });
}, 120_000);

describe('Paramètres de la boutique', () => {
  it('enregistre les réglages et garde l’avant / après au journal', async () => {
    await updateShopSettings(
      db,
      context,
      {
        id: SHOP,
        name: 'Chez Maman',
        countryCode: 'BJ',
        currencyCode: 'XOF',
        phone: null,
        address: null,
        invoiceFooter: null,
        expiryAlertDays: { first: 30, second: 7 },
        sellerMaxDiscountPercent: 0,
        allowSaleWithoutStock: true,
      },
      {
        name: 'Boutique Chez Maman',
        phone: '+2290197000000',
        address: 'Cotonou',
        invoiceFooter: 'Merci !',
        expiryFirst: 45,
        expirySecond: 10,
        sellerMaxDiscount: 5,
        allowSaleWithoutStock: false,
      }
    );
    expect(
      db.query('SELECT name, seller_max_discount_percent, allow_sale_without_stock FROM shops')
    ).toEqual([
      { name: 'Boutique Chez Maman', seller_max_discount_percent: 5, allow_sale_without_stock: 0 },
    ]);
    const log = db.query<{ details: string }>(
      "SELECT details FROM audit_log WHERE action = 'settings.update'"
    )[0];
    expect(JSON.parse(log.details).before.name).toBe('Chez Maman');
  });

  it('ajoute un mode de paiement, puis le désactive (sans le supprimer)', async () => {
    const id = await addPaymentMethod(db, context, { label: 'Wave', kind: 'mobile_money' });
    await updatePaymentMethod(
      db,
      context,
      { id, label: 'Wave', active: true },
      { label: 'Wave', active: false }
    );
    expect(
      db.query('SELECT label, active, sort_order FROM payment_methods WHERE id = ?', [id])
    ).toEqual([{ label: 'Wave', active: 0, sort_order: 3 }]);
  });
});

describe('Export Excel / CSV', () => {
  const range = { start: dayRange(addDays(today(), -40)).start, end: dayRange(today()).end };

  it.each(['products', 'sales', 'saleLines', 'customers', 'expenses'] as const)(
    'le tableau « %s » est complet et bien formé',
    async (kind) => {
      const table = await buildExport(db, {
        kind,
        shopId: SHOP,
        currency: 'XOF',
        range,
        today: today(),
      });
      expect(table.rows.length).toBeGreaterThan(0);
      for (const row of table.rows) {
        expect(row).toHaveLength(table.headers.length);
      }
      const csv = toCsv(table.headers, table.rows);
      expect(csv.split('\r\n').length).toBe(table.rows.length + 2);
    }
  );

  it('produits : stock et valeur au prix d’achat', async () => {
    const table = await buildExport(db, {
      kind: 'products',
      shopId: SHOP,
      currency: 'XOF',
      range,
      today: today(),
    });
    const cable = table.rows.find((row) => row[0] === 'Câble électrique 2,5 mm²');
    expect(cable?.[2]).toBe('mètre');
    expect(Number(String(cable?.[6]))).toBeGreaterThan(0);
  });

  it('inventaire : attendu, compté, écart et sa valeur ; aussi en page PDF', async () => {
    const cable = await db.get<{ id: string; stock: number }>(
      `SELECT p.id, COALESCE(SUM(m.quantity), 0) AS stock FROM products p
         LEFT JOIN stock_movements m ON m.product_id = p.id
        WHERE p.name = 'Câble électrique 2,5 mm²' GROUP BY p.id`
    );
    const countId = await startInventory(db, context, 'Comptage de fin de mois');
    // Il manque 2 mètres dans le rayon
    await saveCount(db, context, {
      countId,
      productId: cable.id,
      countedQuantity: cable.stock - 2000,
    });
    await validateInventory(db, context, countId);

    const forCount = await buildExport(db, {
      kind: 'inventory',
      shopId: SHOP,
      currency: 'XOF',
      range,
      today: today(),
      countId,
    });
    expect(forCount.rows).toHaveLength(1);
    const [row] = forCount.rows;
    expect(row).toHaveLength(forCount.headers.length);
    expect(row.slice(1, 3)).toEqual(['Comptage de fin de mois', 'Câble électrique 2,5 mm²']);
    expect(row[6]).toBe('-2');
    expect(Number(String(row[7]))).toBeLessThan(0);

    // Sans comptage précis : les inventaires validés de la période
    const forPeriod = await buildExport(db, {
      kind: 'inventory',
      shopId: SHOP,
      currency: 'XOF',
      range,
      today: today(),
    });
    expect(forPeriod.rows.some((line) => line[2] === 'Câble électrique 2,5 mm²')).toBe(true);

    const html = tableHtml({
      table: forCount,
      title: 'Inventaire',
      shopName: 'Chez <Maman>',
      subtitle: 'Validé',
    });
    expect(html).toContain('Chez &lt;Maman&gt;');
    expect(html).toContain('<td class="num">-2</td>');
    expect(html).toContain('1 ligne');
  });
});
