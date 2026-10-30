import type { CommonPowerSyncDatabase } from '@powersync/common';

import { recordCashMovement } from '@/cash/cash-actions';
import { createCustomer, recordRepayment } from '@/customers/customer-actions';
import type { ActionContext } from '@/data/audit';
import { buildDemoPlan, DEMO_CUSTOMERS, DEMO_PRODUCTS } from '@/domain/demo';
import { mulDiv } from '@/domain/quantity';
import { type CartLine, cartSubtotal, settle } from '@/domain/sale';
import { createCategory, createProduct } from '@/products/product-actions';
import { createSale } from '@/sales/sale-actions';
import { receiveStock } from '@/stock/stock-actions';

/**
 * Remplit la boutique avec les données de démonstration, en passant par les VRAIES
 * fonctions de l'appli (ventes, réceptions, remboursements…) : les chiffres sont donc
 * cohérents partout (stock, caisse, crédit, rapports, journal).
 * Réservé à une boutique vide, pour ne jamais mélanger avec de vraies données.
 */

export class ShopNotEmptyError extends Error {
  constructor() {
    super('La boutique a déjà des produits.');
    this.name = 'ShopNotEmptyError';
  }
}

export async function loadDemoData(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  input: {
    deviceNumber: number;
    today: string;
    onProgress?: (done: number, total: number) => void;
  }
): Promise<{ sales: number }> {
  const existing = await db.get<{ count: number }>(
    'SELECT COUNT(*) AS count FROM products WHERE shop_id = ?',
    [context.shopId]
  );
  if (existing.count > 0) {
    throw new ShopNotEmptyError();
  }
  const methods = await db.getAll<{ id: string; kind: string }>(
    'SELECT id, kind FROM payment_methods WHERE shop_id = ? AND active = 1 ORDER BY sort_order',
    [context.shopId]
  );
  const cash = methods.find((method) => method.kind === 'cash') ?? methods[0];
  const momo = methods.find((method) => method.kind === 'mobile_money') ?? cash;
  if (!cash) {
    throw new Error('Aucun mode de paiement.');
  }

  const plan = buildDemoPlan(input.today);
  const total = DEMO_PRODUCTS.length + DEMO_CUSTOMERS.length + plan.length;
  let done = 0;
  const progress = () => input.onProgress?.(++done, total);

  // 1. Rayons et produits
  const categories = new Map<string, string>();
  for (const name of [...new Set(DEMO_PRODUCTS.map((product) => product.category))]) {
    categories.set(name, await createCategory(db, context, name));
  }
  const products = new Map<string, { id: string; unitIds: string[] }>();
  for (const product of DEMO_PRODUCTS) {
    const id = await createProduct(
      db,
      context,
      {
        name: product.name,
        categoryId: categories.get(product.category) ?? null,
        barcode: null,
        baseUnit: product.baseUnit,
        allowDecimal: product.allowDecimal,
        trackExpiry: product.trackExpiry,
        lowStockThreshold: product.lowStock === null ? null : product.lowStock * 1000,
        units: product.units.map((unit, index) => ({
          id: null,
          name: unit.name,
          factor: unit.factor * 1000,
          salePrice: unit.price,
          // Le prix d'achat de l'unité achetée au fournisseur (les autres en sont déduites)
          purchasePrice: index === product.purchase.unitIndex ? product.purchase.cost : null,
          barcode: null,
          isDefault: index === 0,
          sortOrder: index,
        })),
      },
      null
    );
    const units = await db.getAll<{ id: string }>(
      'SELECT id FROM product_units WHERE product_id = ? ORDER BY sort_order',
      [id]
    );
    products.set(product.key, { id, unitIds: units.map((unit) => unit.id) });
    progress();
  }

  // 2. Clients
  const customers = new Map<string, { id: string; name: string }>();
  for (const customer of DEMO_CUSTOMERS) {
    const id = await createCustomer(db, context, {
      name: customer.name,
      phone: customer.phone,
      creditLimit: customer.creditLimit,
      notes: 'Client de démonstration',
    });
    customers.set(customer.key, { id, name: customer.name });
    progress();
  }

  // 3. Trente jours d'activité, dans l'ordre
  let sales = 0;
  for (const event of plan) {
    const when = { occurredAt: event.at };
    if (event.kind === 'receipt') {
      const definition = DEMO_PRODUCTS.find((product) => product.key === event.productKey);
      const product = products.get(event.productKey);
      if (definition && product) {
        const unit = definition.units[event.unitIndex];
        await receiveStock(
          db,
          context,
          {
            supplierName: 'Grossiste (démonstration)',
            reference: null,
            lines: [
              {
                productId: product.id,
                productName: definition.name,
                unitName: unit.name,
                unitFactor: unit.factor * 1000,
                quantityInUnit: event.quantity * 1000,
                unitCost: event.unitCost,
                expiryDate: event.expiryDate,
              },
            ],
          },
          when
        );
      }
    } else if (event.kind === 'sale') {
      const lines: CartLine[] = event.lines.flatMap((line, index) => {
        const definition = DEMO_PRODUCTS.find((product) => product.key === line.productKey);
        const product = products.get(line.productKey);
        const unit = definition?.units[line.unitIndex];
        if (!definition || !product || !unit || unit.price === null) return [];
        return [
          {
            key: String(index),
            productId: product.id,
            productName: definition.name,
            unitId: product.unitIds[line.unitIndex],
            unitName: unit.name,
            unitFactor: unit.factor * 1000,
            quantity: line.quantity,
            unitPrice: unit.price,
          },
        ];
      });
      const saleTotal = cartSubtotal(lines);
      const customer = event.customerKey ? (customers.get(event.customerKey) ?? null) : null;
      let paid = saleTotal;
      if (event.payment === 'credit') {
        // Payé en partie, arrondi aux 100 FCFA
        paid = Math.floor(mulDiv(saleTotal, event.paidPercent, 100) / 100) * 100;
      }
      // En espèces, le client donne souvent un billet rond : on rend la monnaie
      const given = event.payment === 'cash' ? Math.ceil(saleTotal / 1000) * 1000 : paid;
      const settlement = settle(
        saleTotal,
        paid > 0
          ? [
              {
                methodId: event.payment === 'momo' ? momo.id : cash.id,
                isCash: event.payment !== 'momo',
                amount: event.payment === 'cash' ? given : paid,
              },
            ]
          : []
      );
      await createSale(
        db,
        context,
        {
          deviceNumber: input.deviceNumber,
          lines,
          discount: 0,
          payments: settlement.payments,
          customer,
          note: null,
          forceExpired: false,
        },
        when
      );
      sales++;
    } else if (event.kind === 'repayment') {
      const customer = customers.get(event.customerKey);
      if (customer) {
        const { balance } = await db.get<{ balance: number }>(
          'SELECT COALESCE(SUM(amount), 0) AS balance FROM customer_ledger WHERE customer_id = ?',
          [customer.id]
        );
        const amount = Math.floor(mulDiv(balance, event.percent, 100) / 100) * 100;
        if (amount > 0) {
          await recordRepayment(
            db,
            context,
            {
              customer: {
                id: customer.id,
                name: customer.name,
                phone: null,
                creditLimit: null,
                notes: null,
                archived: false,
                balance,
              },
              amount,
              methodId: cash.id,
              cashReceived: amount,
              changeGiven: 0,
            },
            when
          );
        }
      }
    } else {
      await recordCashMovement(
        db,
        context,
        {
          type: 'expense',
          category: event.category,
          methodId: cash.id,
          amount: event.amount,
          note: event.note,
        },
        when
      );
    }
    progress();
  }
  return { sales };
}
