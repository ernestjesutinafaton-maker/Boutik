import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createLocalDb, type LocalTestDb } from './local-db';

/**
 * Les lectures des écrans (les « hooks » useCatalog, useSale, useReports…) exécutées
 * pour de vrai sur la base SQLite de test : chaque requête SQL des écrans est vérifiée
 * (noms de colonnes, jointures, JSON) et ses résultats aussi.
 */

const SHOP = 'shop-1';
const context = { shopId: SHOP, memberId: 'owner', deviceId: 'device-1' };
let db: LocalTestDb;

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: {} }));
vi.mock('expo-image-picker', () => ({}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x/${path}` } }),
      }),
    },
  },
}));
vi.mock('@/shop/shop-provider', () => ({
  useShop: () => ({
    shop: {
      id: SHOP,
      name: 'Chez Maman',
      countryCode: 'BJ',
      currencyCode: 'XOF',
      memberId: 'owner',
    },
    device: { id: 'device-1', number: 1 },
  }),
}));
vi.mock('@powersync/react', () => ({
  // La vraie requête est exécutée sur la base de test, à chaque appel
  useQuery: (sql: string, params: unknown[] = []) => ({
    data: db.query(sql, params),
    isLoading: false,
  }),
  usePowerSync: () => db,
  useStatus: () => ({ connected: true }),
}));

const { createProduct } = await import('@/products/product-actions');
const { useCatalog, useProduct, useCategories } = await import('@/products/product-data');
const { useProductPhoto } = await import('@/products/photos');
const { receiveStock } = await import('@/stock/stock-actions');
const { useProductLots, useProductMovements, useExpiringLots, expiryLevelsByProduct } =
  await import('@/stock/stock-data');
const { saveCount, startInventory, useInventoryCount, useInventoryCounts, useInventoryLines } =
  await import('@/stock/inventory');
const { createSale } = await import('@/sales/sale-actions');
const { useSale, useSales, useCustomerSales } = await import('@/sales/sale-data');
const { useAllPaymentMethods, usePaymentMethods } = await import('@/sales/payment-methods');
const { useAuditLog } = await import('@/history/audit-data');
const { useOpenCashSession } = await import('@/sales/cash-session-data');
const { createCustomer, recordRepayment } = await import('@/customers/customer-actions');
const { useCustomer, useCustomerLedger, useCustomers, useLedgerByCustomer, useRepaymentReceipt } =
  await import('@/customers/customer-data');
const { openCashSession, recordCashMovement } = await import('@/cash/cash-actions');
const { useSessionMovements, useSessionTotals } = await import('@/cash/cash-data');
const { makeAccount } = await import('@/reports/report-actions');
const { useLastAccountEnd, useReport, useReports } = await import('@/reports/report-data');
const { addToOutbox, useOutbox } = await import('@/invoices/outbox');
const { useShopSettings } = await import('@/shop/shop-settings');
const { useTeamMembers } = await import('@/team/team-data');
const { settle } = await import('@/domain/sale');
const { dayRange, today } = await import('@/domain/dates');

let productId = '';
let saleId = '';
let customerId = '';
let paymentId = '';
let sessionId = '';
let reportId = '';
let countId = '';

beforeAll(async () => {
  db = createLocalDb();
  await db.execute(
    "INSERT INTO shops (id, name, currency_code, expiry_alert_days_first, expiry_alert_days_second, seller_max_discount_percent, allow_sale_without_stock) VALUES (?, 'Chez Maman', 'XOF', 30, 7, 5, 1)",
    [SHOP]
  );
  await db.execute(
    "INSERT INTO shop_members (id, shop_id, display_name, active) VALUES ('owner', ?, 'Koffi', 1)",
    [SHOP]
  );
  await db.execute(
    "INSERT INTO shop_member_roles (id, shop_id, member_id, role) VALUES ('r1', ?, 'owner', 'owner')",
    [SHOP]
  );
  await db.execute(
    "INSERT INTO payment_methods (id, shop_id, label, kind, sort_order, active) VALUES ('cash', ?, 'Espèces', 'cash', 1, 1), ('momo', ?, 'MTN MoMo', 'mobile_money', 2, 1)",
    [SHOP, SHOP]
  );
  await db.execute(
    "INSERT INTO categories (id, shop_id, name, sort_order) VALUES ('cat', ?, 'Alimentation', 0)",
    [SHOP]
  );
  await db.execute("INSERT INTO devices (id, shop_id, device_number) VALUES ('device-1', ?, 1)", [
    SHOP,
  ]);

  productId = await createProduct(
    db,
    context,
    {
      name: 'Lait concentré',
      categoryId: 'cat',
      barcode: '3017620422003',
      baseUnit: 'boîte',
      allowDecimal: false,
      trackExpiry: true,
      lowStockThreshold: 30_000,
      units: [
        {
          id: null,
          name: 'boîte',
          factor: 1000,
          salePrice: 500,
          purchasePrice: null,
          barcode: null,
          isDefault: true,
          sortOrder: 0,
        },
        {
          id: null,
          name: 'Carton 24',
          factor: 24_000,
          salePrice: 11_000,
          purchasePrice: null,
          barcode: '999',
          isDefault: false,
          sortOrder: 1,
        },
      ],
    },
    'PHOTO'
  );
  // Un lot qui périme dans 5 jours
  const soon = new Date(Date.now() + 5 * 86_400_000);
  const soonDay = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
  await receiveStock(db, context, {
    supplierName: 'Grossiste',
    reference: 'BL-1',
    lines: [
      {
        productId,
        productName: 'Lait concentré',
        unitName: 'Carton 24',
        unitFactor: 24_000,
        quantityInUnit: 1000,
        unitCost: 9600,
        expiryDate: soonDay,
      },
    ],
  });

  customerId = await createCustomer(db, context, {
    name: 'Awa',
    phone: '+2290197000000',
    creditLimit: 50_000,
    notes: null,
  });
  sessionId = await openCashSession(db, context, 5000);
  ({ saleId } = await createSale(db, context, {
    deviceNumber: 1,
    lines: [
      {
        key: 'k',
        productId,
        productName: 'Lait concentré',
        unitId: 'u',
        unitName: 'boîte',
        unitFactor: 1000,
        quantity: 4000,
        unitPrice: 500,
      },
    ],
    discount: 0,
    payments: settle(2000, [{ methodId: 'cash', isCash: true, amount: 1000 }]).payments,
    customer: { id: customerId, name: 'Awa' },
    note: null,
    forceExpired: false,
  }));
  const customer = {
    id: customerId,
    name: 'Awa',
    phone: null,
    creditLimit: null,
    notes: null,
    archived: false,
    balance: 1000,
  };
  paymentId = await recordRepayment(db, context, {
    customer,
    amount: 400,
    methodId: 'momo',
    cashReceived: null,
    changeGiven: null,
  });
  await recordCashMovement(db, context, {
    type: 'expense',
    category: 'fuel',
    methodId: 'cash',
    amount: 300,
    note: 'Essence',
  });
  countId = await startInventory(db, context, 'Essai');
  await saveCount(db, context, { countId, productId, countedQuantity: 19_000 });
  reportId = await makeAccount(db, context, null);
  await addToOutbox(db, { shopId: SHOP, kind: 'invoice', saleId, label: 'F1-000001' });
});

describe('Lectures des écrans sur une vraie base', () => {
  it('catalogue : produit, unités (JSON), stock, rayon, photo en attente', () => {
    const { products } = useCatalog();
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      name: 'Lait concentré',
      categoryName: 'Alimentation',
      stock: 20_000,
      trackExpiry: true,
    });
    expect(products[0].units.map((unit) => unit.name).sort()).toEqual(['Carton 24', 'boîte']);
    expect(useProduct(productId).product?.id).toBe(productId);
    expect(useCategories()).toEqual([{ id: 'cat', name: 'Alimentation' }]);
    expect(useProductPhoto(productId, null)).toBe('data:image/jpeg;base64,PHOTO');
  });

  it('stock : lots, mouvements, péremption bientôt', () => {
    const lots = useProductLots(productId);
    expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({ remaining: 20_000, supplierName: 'Grossiste' });
    const movements = useProductMovements(productId);
    expect(movements.map((movement) => movement.type).sort()).toEqual(['receipt', 'sale']);
    expect(movements.find((movement) => movement.type === 'sale')?.invoiceNumber).toBe('F1-000001');
    const expiring = useExpiringLots(SHOP, today(), { first: 30, second: 7 });
    expect(expiring).toHaveLength(1);
    expect(expiring[0].level).toBe('urgent');
    expect(expiryLevelsByProduct(expiring).get(productId)).toBe('urgent');
  });

  it('inventaire : liste, détail, comptages', () => {
    expect(useInventoryCounts()[0]).toMatchObject({ id: countId, status: 'draft', lineCount: 1 });
    expect(useInventoryCount(countId)?.createdByName).toBe('Koffi');
    expect(useInventoryLines(countId).get(productId)).toMatchObject({
      expectedQuantity: 20_000,
      countedQuantity: 19_000,
    });
  });

  it('ventes : historique du jour, détail complet, ventes d’un client', () => {
    const sales = useSales(dayRange(today()));
    expect(sales).toHaveLength(1);
    expect(sales[0]).toMatchObject({
      invoiceNumber: 'F1-000001',
      customerName: 'Awa',
      sellerName: 'Koffi',
      due: 1000,
    });
    const { sale } = useSale(saleId);
    expect(sale?.items).toHaveLength(1);
    expect(sale?.items[0]).toMatchObject({ productName: 'Lait concentré', returnedQuantity: 0 });
    expect(sale?.payments[0]).toMatchObject({ methodLabel: 'Espèces', amount: 1000 });
    expect(sale?.deviceNumber).toBe(1);
    expect(useCustomerSales(customerId)).toHaveLength(1);
  });

  it('clients : solde, carnet, ancienneté, reçu', () => {
    const { customers } = useCustomers();
    expect(customers[0]).toMatchObject({ name: 'Awa', balance: 600 });
    expect(useCustomer(customerId).customer?.balance).toBe(600);
    const ledger = useCustomerLedger(customerId);
    expect(ledger.map((entry) => entry.type).sort()).toEqual(['debt', 'repayment']);
    expect(ledger.find((entry) => entry.type === 'repayment')?.methodLabel).toBe('MTN MoMo');
    expect(useLedgerByCustomer().get(customerId)).toHaveLength(2);
    expect(useRepaymentReceipt(paymentId)).toMatchObject({
      amount: 400,
      methodLabel: 'MTN MoMo',
      customerName: 'Awa',
      balanceAfter: 600,
      receivedBy: 'Koffi',
    });
  });

  it('caisse du jour : session ouverte, encaissements, dépenses', () => {
    const { session } = useOpenCashSession('device-1');
    expect(session).toMatchObject({ id: sessionId, openingFloat: 5000, openedByName: 'Koffi' });
    const totals = useSessionTotals(sessionId);
    expect(totals.payments.sort((a, b) => a.methodId.localeCompare(b.methodId))).toEqual([
      { methodId: 'cash', amount: 1000 },
      { methodId: 'momo', amount: 400 },
    ]);
    expect(totals.movements).toEqual([{ methodId: 'cash', type: 'expense', amount: 300 }]);
    expect(useSessionMovements(sessionId)[0]).toMatchObject({
      category: 'fuel',
      methodLabel: 'Espèces',
    });
  });

  it('rapports, file « À envoyer », réglages, équipe, modes de paiement', () => {
    const reports = useReports(['day_close', 'account']);
    expect(reports).toHaveLength(1);
    expect(useReport(reportId)?.data.sales.count).toBe(1);
    expect(useLastAccountEnd()).toBe(reports[0].periodEnd);
    expect(useOutbox()[0]).toMatchObject({ kind: 'invoice', saleId });
    expect(useShopSettings()).toMatchObject({
      sellerMaxDiscountPercent: 5,
      allowSaleWithoutStock: true,
      expiryAlertDays: { first: 30, second: 7 },
    });
    expect(useTeamMembers().members[0]).toMatchObject({ name: 'Koffi', roles: ['owner'] });
    expect(usePaymentMethods().map((method) => method.label)).toEqual(['Espèces', 'MTN MoMo']);
    expect(useAllPaymentMethods().every((method) => method.active)).toBe(true);
    const log = useAuditLog(dayRange(today()));
    expect(log.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['product.create', 'stock.receive', 'sale.create', 'credit.repayment'])
    );
    expect(log.find((entry) => entry.action === 'sale.create')).toMatchObject({
      memberName: 'Koffi',
      deviceNumber: 1,
      entityType: 'sale',
    });
  });
});
