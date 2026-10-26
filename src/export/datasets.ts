import { debtAging, type LedgerType } from '@/domain/credit';
import { dayOfMoment, formatDay, formatTime } from '@/domain/dates';
import type { CurrencyCode } from '@/domain/money';
import { costForQuantity } from '@/domain/quantity';
import type { Reader } from '@/stock/stock-data';

import { type CsvCell, moneyCell, quantityCell } from './csv';

/** Les tableaux qu'on peut exporter vers Excel. */
export type ExportKind = 'products' | 'sales' | 'saleLines' | 'customers' | 'expenses';

export type ExportTable = { headers: string[]; rows: CsvCell[][] };

const EXPENSE_NAMES: Record<string, string> = {
  transport: 'Livraison et transport',
  fuel: 'Carburant',
  supplies: 'Fournitures',
  utilities: 'Électricité, eau, internet, crédit téléphone',
  rent: 'Loyer',
  salary: 'Salaire ou avance',
  repairs: 'Réparations',
  other: 'Autre',
};

const MOVEMENT_NAMES: Record<string, string> = {
  expense: 'Dépense',
  stock_purchase: 'Achat de marchandise',
  withdrawal: 'Retrait du propriétaire',
  deposit: 'Ajout d’argent',
};

/** Fabrique le tableau demandé, à partir de la base locale. La période sert aux ventes et dépenses. */
export async function buildExport(
  reader: Reader,
  input: {
    kind: ExportKind;
    shopId: string;
    currency: CurrencyCode;
    range: { start: string; end: string };
    today: string;
  }
): Promise<ExportTable> {
  const money = (amount: number) => moneyCell(amount, input.currency);
  const { shopId, range } = input;

  switch (input.kind) {
    case 'products': {
      const rows = await reader.getAll<{
        name: string;
        category: string | null;
        base_unit: string;
        barcode: string | null;
        stock: number;
        price: number | null;
        low_stock_threshold: number | null;
        lots: string | null;
      }>(
        `SELECT p.name, c.name AS category, p.base_unit, p.barcode, p.low_stock_threshold,
                COALESCE((SELECT SUM(m.quantity) FROM stock_movements m WHERE m.product_id = p.id), 0) AS stock,
                (SELECT u.sale_price FROM product_units u
                  WHERE u.product_id = p.id AND u.archived_at IS NULL AND u.factor = 1000
                  ORDER BY u.sort_order LIMIT 1) AS price,
                (SELECT json_group_array(json_array(l.cost_price, l.cost_quantity,
                          COALESCE((SELECT SUM(m.quantity) FROM stock_movements m WHERE m.lot_id = l.id), 0)))
                   FROM stock_lots l WHERE l.product_id = p.id) AS lots
           FROM products p LEFT JOIN categories c ON c.id = p.category_id
          WHERE p.shop_id = ? AND p.archived_at IS NULL
          ORDER BY p.name COLLATE NOCASE`,
        [shopId]
      );
      return {
        headers: [
          'Produit',
          'Rayon',
          'Unité de base',
          'Code-barres',
          'Stock',
          'Prix de vente (unité de base)',
          'Valeur du stock (prix d’achat)',
          'Seuil de stock bas',
        ],
        rows: rows.map((row) => {
          const lots = JSON.parse(row.lots ?? '[]') as [number, number, number][];
          const value = lots.reduce(
            (sum, [price, quantity, remaining]) =>
              remaining > 0 ? sum + costForQuantity(price, quantity, remaining) : sum,
            0
          );
          return [
            row.name,
            row.category,
            row.base_unit,
            row.barcode,
            quantityCell(row.stock),
            row.price === null ? null : money(row.price),
            money(value),
            row.low_stock_threshold === null ? null : quantityCell(row.low_stock_threshold),
          ];
        }),
      };
    }

    case 'sales': {
      const rows = await reader.getAll<{
        occurred_at: string;
        invoice_number: string;
        customer: string | null;
        seller: string | null;
        status: string;
        subtotal: number;
        discount_amount: number;
        total: number;
        paid_amount: number;
        due_amount: number;
      }>(
        `SELECT s.occurred_at, s.invoice_number, c.name AS customer, m.display_name AS seller,
                s.status, s.subtotal, s.discount_amount, s.total, s.paid_amount, s.due_amount
           FROM sales s
           LEFT JOIN customers c ON c.id = s.customer_id
           LEFT JOIN shop_members m ON m.id = s.seller_id
          WHERE s.shop_id = ? AND s.occurred_at >= ? AND s.occurred_at < ?
          ORDER BY s.occurred_at`,
        [shopId, range.start, range.end]
      );
      return {
        headers: [
          'Date',
          'Heure',
          'Facture',
          'Client',
          'Vendeur',
          'Statut',
          'Sous-total',
          'Remise',
          'Total',
          'Payé',
          'Reste dû',
        ],
        rows: rows.map((row) => [
          formatDay(dayOfMoment(row.occurred_at)),
          formatTime(row.occurred_at),
          row.invoice_number,
          row.customer,
          row.seller,
          row.status === 'cancelled' ? 'Annulée' : 'Payée',
          money(row.subtotal),
          money(row.discount_amount),
          money(row.total),
          money(row.paid_amount),
          money(row.due_amount),
        ]),
      };
    }

    case 'saleLines': {
      const rows = await reader.getAll<{
        occurred_at: string;
        invoice_number: string;
        status: string;
        product_name: string;
        unit_name: string;
        quantity: number;
        unit_price: number;
        line_total: number;
      }>(
        `SELECT s.occurred_at, s.invoice_number, s.status, i.product_name, i.unit_name, i.quantity,
                i.unit_price, i.line_total
           FROM sale_items i JOIN sales s ON s.id = i.sale_id
          WHERE s.shop_id = ? AND s.occurred_at >= ? AND s.occurred_at < ?
          ORDER BY s.occurred_at`,
        [shopId, range.start, range.end]
      );
      return {
        headers: [
          'Date',
          'Facture',
          'Statut',
          'Produit',
          'Unité',
          'Quantité',
          'Prix unitaire',
          'Total',
        ],
        rows: rows.map((row) => [
          formatDay(dayOfMoment(row.occurred_at)),
          row.invoice_number,
          row.status === 'cancelled' ? 'Annulée' : 'Payée',
          row.product_name,
          row.unit_name,
          quantityCell(row.quantity),
          money(row.unit_price),
          money(row.line_total),
        ]),
      };
    }

    case 'customers': {
      const customers = await reader.getAll<{
        id: string;
        name: string;
        phone: string | null;
        credit_limit: number | null;
      }>(
        `SELECT id, name, phone, credit_limit FROM customers
          WHERE shop_id = ? AND archived_at IS NULL ORDER BY name COLLATE NOCASE`,
        [shopId]
      );
      const ledger = await reader.getAll<{
        customer_id: string;
        type: LedgerType;
        amount: number;
        occurred_at: string;
      }>('SELECT customer_id, type, amount, occurred_at FROM customer_ledger WHERE shop_id = ?', [
        shopId,
      ]);
      return {
        headers: [
          'Client',
          'Téléphone',
          'Doit',
          'Plafond de crédit',
          'Plus ancienne dette',
          'Jours',
        ],
        rows: customers.map((customer) => {
          const aging = debtAging(
            ledger
              .filter((entry) => entry.customer_id === customer.id)
              .map((entry) => ({
                type: entry.type,
                amount: entry.amount,
                occurredAt: entry.occurred_at,
              })),
            input.today
          );
          return [
            customer.name,
            customer.phone,
            money(aging.balance),
            customer.credit_limit === null ? null : money(customer.credit_limit),
            aging.oldestUnpaidDay ? formatDay(aging.oldestUnpaidDay) : null,
            aging.oldestUnpaidDay ? aging.ageDays : null,
          ];
        }),
      };
    }

    case 'expenses': {
      const rows = await reader.getAll<{
        occurred_at: string;
        type: string;
        category: string | null;
        amount: number;
        method: string | null;
        note: string | null;
        member: string | null;
      }>(
        `SELECT c.occurred_at, c.type, c.category, c.amount, pm.label AS method, c.note,
                m.display_name AS member
           FROM cash_movements c
           LEFT JOIN payment_methods pm ON pm.id = c.payment_method_id
           LEFT JOIN shop_members m ON m.id = c.created_by
          WHERE c.shop_id = ? AND c.occurred_at >= ? AND c.occurred_at < ?
          ORDER BY c.occurred_at`,
        [shopId, range.start, range.end]
      );
      return {
        headers: ['Date', 'Heure', 'Type', 'Catégorie', 'Montant', 'Payé avec', 'Remarque', 'Par'],
        rows: rows.map((row) => [
          formatDay(dayOfMoment(row.occurred_at)),
          formatTime(row.occurred_at),
          MOVEMENT_NAMES[row.type] ?? row.type,
          row.category ? (EXPENSE_NAMES[row.category] ?? row.category) : null,
          money(row.amount),
          row.method,
          row.note,
          row.member,
        ]),
      };
    }
  }
}
