import type { CommonPowerSyncDatabase, Transaction } from '@powersync/common';

import { type ActionContext, logAction, type WhenOptions } from '@/data/audit';
import { newId, nowIso } from '@/data/ids';
import { today } from '@/domain/dates';
import { toBaseQuantity } from '@/domain/quantity';
import { carryPayments } from '@/domain/sale-edit';
import {
  type AppliedPayment,
  type CartLine,
  cartSubtotal,
  formatInvoiceNumber,
  lineTotal,
  returnValue,
} from '@/domain/sale';
import { allocate, isExpired, latestCost, reverseAllocations } from '@/domain/stock';
import { insertMovement } from '@/stock/movements';
import { loadLots, type Reader } from '@/stock/stock-data';

import { findOpenCashSession } from './cash-session-data';

/**
 * Les écritures de la caisse : vendre, modifier une vente, annuler, reprendre des articles.
 * Chaque opération est « tout ou rien » (une transaction) et notée dans le journal.
 */

/** Un souci de stock repéré avant la vente. */
export type StockProblem = {
  productId: string;
  productName: string;
  /** expired = le manque existe seulement dans des lots périmés ; shortage = stock insuffisant */
  kind: 'expired' | 'shortage';
  /** Quantité concernée, en millièmes d'unité de base */
  quantity: number;
};

/** Vente refusée à cause du stock (lots périmés sans forçage, ou stock insuffisant interdit). */
export class SaleStockError extends Error {
  constructor(readonly problems: StockProblem[]) {
    super('Stock insuffisant ou périmé.');
    this.name = 'SaleStockError';
  }
}

/** Erreur : cet appareil n'a pas encore reçu son numéro (indispensable pour les factures). */
export class DeviceNotRegisteredError extends Error {
  constructor() {
    super('Appareil pas encore enregistré.');
    this.name = 'DeviceNotRegisteredError';
  }
}

/**
 * Vérifie le stock du panier, produit par produit (un même produit peut être
 * dans deux lignes : 1 sac + 3 kg). Sert à prévenir AVANT de valider la vente.
 */
export async function checkCartStock(
  reader: Reader,
  lines: readonly CartLine[],
  options: {
    allowExpired: boolean;
    /** Vente en cours de modification : sa marchandise compte comme revenue en stock */
    returningSaleId?: string | null;
  }
): Promise<StockProblem[]> {
  const byProduct = new Map<string, { name: string; quantity: number }>();
  for (const line of lines) {
    const current = byProduct.get(line.productId) ?? { name: line.productName, quantity: 0 };
    current.quantity += toBaseQuantity(line.quantity, line.unitFactor);
    byProduct.set(line.productId, current);
  }
  // Ce que la vente modifiée a encore de sorti, lot par lot (il reviendra au stock)
  const givenBack = new Map<string, number>();
  if (options.returningSaleId) {
    const rows = await reader.getAll<{ lot_id: string | null; quantity: number }>(
      `SELECT lot_id, SUM(quantity) AS quantity FROM stock_movements
        WHERE sale_id = ? AND type IN ('sale', 'return')
        GROUP BY lot_id HAVING SUM(quantity) < 0`,
      [options.returningSaleId]
    );
    for (const row of rows) {
      if (row.lot_id) givenBack.set(row.lot_id, -row.quantity);
    }
  }
  const problems: StockProblem[] = [];
  for (const [productId, { name, quantity }] of byProduct) {
    const lots = (await loadLots(reader, productId)).map((lot) => ({
      ...lot,
      remaining: lot.remaining + (givenBack.get(lot.id) ?? 0),
    }));
    const result = allocate(lots, quantity, { today: today(), allowExpired: options.allowExpired });
    if (result.expiredAvailable > 0) {
      problems.push({
        productId,
        productName: name,
        kind: 'expired',
        quantity: result.expiredAvailable,
      });
    }
    if (result.shortfall - result.expiredAvailable > 0) {
      problems.push({
        productId,
        productName: name,
        kind: 'shortage',
        quantity: result.shortfall - result.expiredAvailable,
      });
    }
  }
  return problems;
}

export type NewSale = {
  /** Numéro de cet appareil dans la boutique (pour le numéro de facture) */
  deviceNumber: number;
  lines: CartLine[];
  discount: number;
  payments: AppliedPayment[];
  customer: { id: string; name: string } | null;
  note: string | null;
  /** Le propriétaire a choisi de vendre quand même des lots périmés (tracé) */
  forceExpired: boolean;
};

/** Enregistre une vente complète. Renvoie son identifiant et son numéro de facture. */
export async function createSale(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  sale: NewSale,
  options: WhenOptions = {}
): Promise<{ saleId: string; invoiceNumber: string }> {
  let created = { saleId: '', invoiceNumber: '' };
  await db.writeTransaction(async (tx) => {
    created = await insertSale(tx, context, sale, options);
  });
  return created;
}

/**
 * Enregistre une vente DANS une transaction déjà ouverte (vente normale, ou vente corrigée
 * qui en remplace une autre : replacesSaleId).
 */
async function insertSale(
  tx: Transaction,
  context: ActionContext,
  sale: NewSale,
  options: WhenOptions & { replacesSaleId?: string } = {}
): Promise<{ saleId: string; invoiceNumber: string }> {
  const deviceId = context.deviceId;
  if (!deviceId) {
    throw new DeviceNotRegisteredError();
  }
  const saleId = newId();
  const now = options.occurredAt ?? nowIso();
  const day = today();
  const subtotal = cartSubtotal(sale.lines);
  const total = subtotal - sale.discount;
  const paid = sale.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const due = total - paid;
  if (total < 0 || due < 0 || (due > 0 && !sale.customer)) {
    throw new Error('Vente incohérente : montants ou client manquant.');
  }
  let invoiceNumber = '';

  {
    const problems = await checkCartStock(tx, sale.lines, { allowExpired: sale.forceExpired });
    const blocking = problems.filter(
      (problem) =>
        (problem.kind === 'expired' && !sale.forceExpired) ||
        // Un stock ne peut jamais devenir négatif : un manque bloque toujours la vente
        problem.kind === 'shortage'
    );
    if (blocking.length > 0) {
      throw new SaleStockError(blocking);
    }

    // Numéro suivant de CET appareil : jamais de doublon, même hors ligne
    const last = await tx.get<{ seq: number }>(
      'SELECT COALESCE(MAX(invoice_seq), 0) AS seq FROM sales WHERE device_id = ?',
      [deviceId]
    );
    const sequence = last.seq + 1;
    invoiceNumber = formatInvoiceNumber(sale.deviceNumber, sequence);
    // Une vente datée dans le passé (démonstration) n'appartient à aucune caisse ouverte
    const session = options.occurredAt ? null : await findOpenCashSession(tx, deviceId);

    await tx.execute(
      `INSERT INTO sales
         (id, shop_id, device_id, invoice_number, invoice_seq, customer_id, seller_id,
          cash_session_id, status, subtotal, discount_amount, total, paid_amount, due_amount,
          note, replaces_sale_id, occurred_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saleId,
        context.shopId,
        deviceId,
        invoiceNumber,
        sequence,
        sale.customer?.id ?? null,
        context.memberId,
        session?.id ?? null,
        subtotal,
        sale.discount,
        total,
        paid,
        due,
        sale.note,
        options.replacesSaleId ?? null,
        now,
        now,
        now,
      ]
    );

    const expiredUsed: { product: string; quantity: number }[] = [];
    for (const line of sale.lines) {
      const itemId = newId();
      const baseQuantity = toBaseQuantity(line.quantity, line.unitFactor);
      await tx.execute(
        `INSERT INTO sale_items
           (id, shop_id, sale_id, product_id, product_unit_id, product_name, unit_name,
            unit_factor, quantity, base_quantity, unit_price, line_total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          context.shopId,
          saleId,
          line.productId,
          line.unitId,
          line.productName,
          line.unitName,
          line.unitFactor,
          line.quantity,
          baseQuantity,
          line.unitPrice,
          lineTotal(line),
          now,
        ]
      );
      // Les lots sont relus à chaque ligne : ils tiennent compte des lignes précédentes
      const lots = await loadLots(tx, line.productId);
      const { allocations } = allocate(lots, baseQuantity, {
        today: day,
        allowExpired: sale.forceExpired,
        fallbackCost: latestCost(lots),
      });
      for (const part of allocations) {
        const lot = lots.find((candidate) => candidate.id === part.lotId);
        if (lot && isExpired(lot, day)) {
          expiredUsed.push({ product: line.productName, quantity: part.quantity });
        }
        await insertMovement(tx, context, {
          productId: line.productId,
          lotId: part.lotId,
          type: 'sale',
          quantity: -part.quantity,
          costAmount: -part.costAmount,
          saleId,
          saleItemId: itemId,
          occurredAt: now,
        });
      }
    }

    for (const payment of sale.payments) {
      await tx.execute(
        `INSERT INTO payments
           (id, shop_id, kind, sale_id, customer_id, payment_method_id, amount, cash_received,
            change_given, cash_session_id, occurred_at, created_by, device_id, created_at)
         VALUES (?, ?, 'sale', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          context.shopId,
          saleId,
          sale.customer?.id ?? null,
          payment.methodId,
          payment.amount,
          payment.cashReceived,
          payment.changeGiven,
          session?.id ?? null,
          now,
          context.memberId,
          deviceId,
          now,
        ]
      );
    }

    if (due > 0 && sale.customer) {
      await tx.execute(
        `INSERT INTO customer_ledger
           (id, shop_id, customer_id, type, amount, sale_id, occurred_at, created_by, device_id,
            created_at)
         VALUES (?, ?, ?, 'debt', ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          context.shopId,
          sale.customer.id,
          due,
          saleId,
          now,
          context.memberId,
          deviceId,
          now,
        ]
      );
    }

    const entity = { type: 'sale', id: saleId };
    await logAction(
      tx,
      context,
      'sale.create',
      entity,
      {
        invoiceNumber,
        total,
        paid,
        due,
        customer: sale.customer?.name ?? null,
        items: sale.lines.length,
      },
      now
    );
    if (sale.discount > 0) {
      await logAction(
        tx,
        context,
        'sale.discount',
        entity,
        {
          invoiceNumber,
          subtotal,
          discount: sale.discount,
        },
        now
      );
    }
    if (expiredUsed.length > 0) {
      await logAction(
        tx,
        context,
        'sale.expired_forced',
        entity,
        {
          invoiceNumber,
          products: expiredUsed,
        },
        now
      );
    }
  }

  return { saleId, invoiceNumber };
}

type SaleRow = {
  id: string;
  invoice_number: string;
  status: string;
  customer_id: string | null;
  subtotal: number;
  total: number;
};

type NetMovementRow = {
  product_id: string;
  lot_id: string | null;
  sale_item_id: string;
  quantity: number;
  cost_amount: number;
};

/** Ce qui est encore sorti du stock pour une vente (ventes − retours déjà faits), lot par lot. */
async function netSaleMovements(tx: Transaction, saleId: string): Promise<NetMovementRow[]> {
  return tx.getAll<NetMovementRow>(
    // COALESCE : le téléphone d'un membre « équipe » n'a pas les coûts (le serveur les calcule)
    `SELECT product_id, lot_id, sale_item_id, SUM(quantity) AS quantity,
            COALESCE(SUM(cost_amount), 0) AS cost_amount
       FROM stock_movements
      WHERE sale_id = ? AND type IN ('sale', 'return')
      GROUP BY product_id, lot_id, sale_item_id
      HAVING SUM(quantity) < 0
      ORDER BY MIN(created_at)`,
    [saleId]
  );
}

async function insertRefund(
  tx: Transaction,
  context: ActionContext,
  input: { saleId: string; customerId: string | null; methodId: string; amount: number },
  now: string
) {
  const session = context.deviceId ? await findOpenCashSession(tx, context.deviceId) : null;
  await tx.execute(
    `INSERT INTO payments
       (id, shop_id, kind, sale_id, customer_id, payment_method_id, amount, cash_session_id,
        occurred_at, created_by, device_id, created_at)
     VALUES (?, ?, 'refund', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      context.shopId,
      input.saleId,
      input.customerId,
      input.methodId,
      -input.amount,
      session?.id ?? null,
      now,
      context.memberId,
      context.deviceId,
      now,
    ]
  );
}

async function reduceSaleDebt(
  tx: Transaction,
  context: ActionContext,
  input: { saleId: string; customerId: string; amount: number; note: string | null },
  now: string
) {
  await tx.execute(
    `INSERT INTO customer_ledger
       (id, shop_id, customer_id, type, amount, sale_id, note, occurred_at, created_by, device_id,
        created_at)
     VALUES (?, ?, ?, 'cancellation', ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      context.shopId,
      input.customerId,
      -input.amount,
      input.saleId,
      input.note,
      now,
      context.memberId,
      context.deviceId,
      now,
    ]
  );
}

/**
 * Annule une vente entière : la marchandise revient dans ses lots, l'argent encaissé
 * est rendu (mode par mode) et la dette de cette vente est effacée du carnet.
 * La vente n'est pas supprimée : elle passe « annulée », avec la raison.
 */
export async function cancelSale(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  saleId: string,
  reason: string
): Promise<void> {
  const now = nowIso();
  await db.writeTransaction(async (tx) => {
    const sale = await tx.get<SaleRow>(
      'SELECT id, invoice_number, status, customer_id, subtotal, total FROM sales WHERE id = ?',
      [saleId]
    );
    if (sale.status !== 'completed') {
      throw new Error('Cette vente est déjà annulée.');
    }

    for (const movement of await netSaleMovements(tx, saleId)) {
      await insertMovement(tx, context, {
        productId: movement.product_id,
        lotId: movement.lot_id,
        type: 'return',
        quantity: -movement.quantity,
        costAmount: -movement.cost_amount,
        saleId,
        saleItemId: movement.sale_item_id,
        note: reason,
        occurredAt: now,
      });
    }

    // Ce qui a été encaissé pour cette vente, moins ce qui a déjà été rendu (retours)
    const paidByMethod = await tx.getAll<{ payment_method_id: string; amount: number }>(
      `SELECT payment_method_id, SUM(amount) AS amount FROM payments
        WHERE sale_id = ? GROUP BY payment_method_id ORDER BY MIN(created_at)`,
      [saleId]
    );
    const netPaid = paidByMethod.reduce((sum, payment) => sum + payment.amount, 0);
    let toRefund = netPaid;
    for (const payment of paidByMethod) {
      const amount = Math.min(payment.amount, toRefund);
      if (amount <= 0) continue;
      toRefund -= amount;
      await insertRefund(
        tx,
        context,
        { saleId, customerId: sale.customer_id, methodId: payment.payment_method_id, amount },
        now
      );
    }

    const debt = await tx.get<{ amount: number }>(
      'SELECT COALESCE(SUM(amount), 0) AS amount FROM customer_ledger WHERE sale_id = ?',
      [saleId]
    );
    if (debt.amount > 0 && sale.customer_id) {
      await reduceSaleDebt(
        tx,
        context,
        { saleId, customerId: sale.customer_id, amount: debt.amount, note: reason },
        now
      );
    }

    await tx.execute(
      `UPDATE sales SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?,
              cancel_reason = ?, updated_at = ?
        WHERE id = ?`,
      [now, context.memberId, reason, now, saleId]
    );
    await logAction(
      tx,
      context,
      'sale.cancel',
      { type: 'sale', id: saleId },
      {
        invoiceNumber: sale.invoice_number,
        total: sale.total,
        reason,
        refunded: Math.max(netPaid, 0),
        debtCancelled: Math.max(debt.amount, 0),
      }
    );
  });
}

/** La vente corrigée : les nouvelles lignes, et l'argent donné maintenant (s'il manque). */
export type SaleModification = NewSale & {
  originalSaleId: string;
  /** Mode pour rendre l'argent en trop au client (si le nouveau total est plus petit) */
  refundMethodId: string | null;
  /** Pourquoi : échange, erreur de saisie… (noté sur l'ancienne vente et au journal) */
  reason: string;
};

/**
 * Modifie une vente déjà faite (le client échange ou rend des articles, ou erreur de saisie),
 * en une seule opération :
 *   1. l'ancienne vente est annulée : sa marchandise revient dans ses lots, sa dette est effacée ;
 *   2. l'argent déjà payé est reporté sur la nouvelle vente ; le surplus éventuel est rendu
 *      avec le mode choisi ;
 *   3. la vente corrigée est enregistrée (nouvelle facture), liée à l'ancienne.
 * `payments` = l'argent donné MAINTENANT en plus. Rien n'est effacé : tout reste au journal.
 */
export async function replaceSale(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  change: SaleModification
): Promise<{ saleId: string; invoiceNumber: string; refunded: number }> {
  const now = nowIso();
  let result = { saleId: '', invoiceNumber: '', refunded: 0 };

  await db.writeTransaction(async (tx) => {
    const original = await tx.get<SaleRow>(
      'SELECT id, invoice_number, status, customer_id, subtotal, total FROM sales WHERE id = ?',
      [change.originalSaleId]
    );
    if (original.status !== 'completed') {
      throw new Error('Cette vente est déjà annulée ou modifiée.');
    }

    // 1. La marchandise de l'ancienne vente revient dans ses lots ; sa dette est effacée
    for (const movement of await netSaleMovements(tx, original.id)) {
      await insertMovement(tx, context, {
        productId: movement.product_id,
        lotId: movement.lot_id,
        type: 'return',
        quantity: -movement.quantity,
        costAmount: -movement.cost_amount,
        saleId: original.id,
        saleItemId: movement.sale_item_id,
        note: change.reason,
        occurredAt: now,
      });
    }
    const debt = await tx.get<{ amount: number }>(
      'SELECT COALESCE(SUM(amount), 0) AS amount FROM customer_ledger WHERE sale_id = ?',
      [original.id]
    );
    if (debt.amount > 0 && original.customer_id) {
      await reduceSaleDebt(
        tx,
        context,
        {
          saleId: original.id,
          customerId: original.customer_id,
          amount: debt.amount,
          note: change.reason,
        },
        now
      );
    }

    // 2. L'argent déjà payé (moins ce qui a déjà été rendu) : sorti de l'ancienne vente…
    const paidRows = await tx.getAll<{ payment_method_id: string; amount: number }>(
      `SELECT payment_method_id, SUM(amount) AS amount FROM payments
        WHERE sale_id = ? GROUP BY payment_method_id ORDER BY MIN(created_at)`,
      [original.id]
    );
    const paid = paidRows
      .filter((row) => row.amount > 0)
      .map((row) => ({ methodId: row.payment_method_id, amount: row.amount }));
    for (const payment of paid) {
      await insertRefund(
        tx,
        context,
        {
          saleId: original.id,
          customerId: original.customer_id,
          methodId: payment.methodId,
          amount: payment.amount,
        },
        now
      );
    }
    await tx.execute(
      `UPDATE sales SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?,
              cancel_reason = ?, updated_at = ?
        WHERE id = ?`,
      [now, context.memberId, change.reason, now, original.id]
    );

    // …et reporté sur la vente corrigée, jusqu'à son total (le surplus reste rendu au client)
    const newTotal = cartSubtotal(change.lines) - change.discount;
    const { carried, refund } = carryPayments(paid, newTotal, change.refundMethodId);
    const created = await insertSale(
      tx,
      context,
      {
        ...change,
        payments: [
          ...carried.map((payment) => ({
            methodId: payment.methodId,
            amount: payment.amount,
            cashReceived: null,
            changeGiven: null,
          })),
          ...change.payments,
        ],
      },
      { replacesSaleId: original.id }
    );
    result = { ...created, refunded: refund };

    await logAction(
      tx,
      context,
      'sale.modify',
      { type: 'sale', id: created.saleId },
      {
        invoiceNumber: original.invoice_number,
        newInvoiceNumber: created.invoiceNumber,
        oldTotal: original.total,
        newTotal,
        refunded: refund,
        reason: change.reason,
      }
    );
  });
  return result;
}

/**
 * Retour d'articles (une partie de la vente) : la marchandise revient dans les lots
 * d'où elle était sortie ; la valeur rendue diminue d'abord la dette de cette vente,
 * le reste est remboursé au client. Renvoie le montant remboursé.
 */
export async function returnSaleItems(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  input: {
    saleId: string;
    items: { saleItemId: string; baseQuantity: number }[];
    refundMethodId: string;
    reason: string;
  }
): Promise<{ value: number; refunded: number }> {
  const now = nowIso();
  let value = 0;
  let refunded = 0;

  await db.writeTransaction(async (tx) => {
    const sale = await tx.get<SaleRow>(
      'SELECT id, invoice_number, status, customer_id, subtotal, total FROM sales WHERE id = ?',
      [input.saleId]
    );
    if (sale.status !== 'completed') {
      throw new Error('Cette vente est annulée.');
    }
    const net = await netSaleMovements(tx, input.saleId);
    const returned: { item: string; quantity: number }[] = [];

    for (const request of input.items) {
      if (request.baseQuantity <= 0) continue;
      const item = await tx.get<{ product_id: string; line_total: number; base_quantity: number }>(
        'SELECT product_id, line_total, base_quantity FROM sale_items WHERE id = ?',
        [request.saleItemId]
      );
      const taken = net
        .filter((movement) => movement.sale_item_id === request.saleItemId)
        .map((movement) => ({
          lotId: movement.lot_id,
          quantity: -movement.quantity,
          costAmount: -movement.cost_amount,
        }));
      const stillOut = taken.reduce((sum, part) => sum + part.quantity, 0);
      if (request.baseQuantity > stillOut) {
        throw new Error('On ne peut pas reprendre plus que ce qui a été vendu.');
      }
      for (const part of reverseAllocations(taken, request.baseQuantity)) {
        await insertMovement(tx, context, {
          productId: item.product_id,
          lotId: part.lotId,
          type: 'return',
          quantity: part.quantity,
          costAmount: part.costAmount,
          saleId: input.saleId,
          saleItemId: request.saleItemId,
          note: input.reason,
          occurredAt: now,
        });
      }
      value += returnValue({
        lineTotal: item.line_total,
        lineBaseQuantity: item.base_quantity,
        returnedBaseQuantity: request.baseQuantity,
        saleSubtotal: sale.subtotal,
        saleTotal: sale.total,
      });
      returned.push({ item: request.saleItemId, quantity: request.baseQuantity });
    }

    // D'abord la dette de cette vente, puis le remboursement en argent
    const debt = await tx.get<{ amount: number }>(
      'SELECT COALESCE(SUM(amount), 0) AS amount FROM customer_ledger WHERE sale_id = ?',
      [input.saleId]
    );
    const debtReduction = sale.customer_id ? Math.min(Math.max(debt.amount, 0), value) : 0;
    if (debtReduction > 0 && sale.customer_id) {
      await reduceSaleDebt(
        tx,
        context,
        {
          saleId: input.saleId,
          customerId: sale.customer_id,
          amount: debtReduction,
          note: input.reason,
        },
        now
      );
    }
    refunded = value - debtReduction;
    if (refunded > 0) {
      await insertRefund(
        tx,
        context,
        {
          saleId: input.saleId,
          customerId: sale.customer_id,
          methodId: input.refundMethodId,
          amount: refunded,
        },
        now
      );
    }

    await logAction(
      tx,
      context,
      'sale.return',
      { type: 'sale', id: input.saleId },
      {
        invoiceNumber: sale.invoice_number,
        items: returned,
        value,
        debtReduction,
        refunded,
        reason: input.reason,
      }
    );
  });
  return { value, refunded };
}
