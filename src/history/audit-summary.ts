import { type CurrencyCode, formatMoney } from '@/domain/money';

/**
 * Le journal des actions : un résumé court et lisible de chaque action
 * (« F1-000012 · 34 450 FCFA », « kg : 700 → 750 FCFA »…), à partir de ses détails.
 */

export type AuditGroup = 'sales' | 'credit' | 'stock' | 'cash' | 'team';

/** Le groupe d'une action, pour filtrer le journal. */
export function auditGroup(action: string): AuditGroup {
  // L'argent des livreurs va avec la caisse ; le reste des livraisons, avec les ventes
  if (action === 'delivery.handover' || action.startsWith('delivery.expense')) return 'cash';
  if (action.startsWith('sale.') || action.startsWith('delivery.')) return 'sales';
  if (action.startsWith('credit.') || action.startsWith('customer.')) return 'credit';
  if (
    action.startsWith('stock.') ||
    action.startsWith('inventory.') ||
    action.startsWith('product.')
  ) {
    return 'stock';
  }
  if (action.startsWith('cash.') || action.startsWith('report.')) return 'cash';
  return 'team';
}

type Details = Record<string, unknown>;

const text = (value: unknown) => (typeof value === 'string' ? value : null);
const number = (value: unknown) => (typeof value === 'number' ? value : null);

/** Le résumé d'une action ; null s'il n'y a rien d'utile à dire. */
export function auditSummary(
  action: string,
  details: Details,
  currency: CurrencyCode
): string | null {
  const money = (value: unknown) => {
    const amount = number(value);
    return amount === null ? null : formatMoney(amount, currency);
  };
  const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(' · ') || null;

  switch (action) {
    case 'sale.create':
      return join(text(details.invoiceNumber), money(details.total), text(details.customer));
    case 'sale.cancel':
      return join(text(details.invoiceNumber), money(details.total), text(details.reason));
    case 'sale.return':
      return join(text(details.invoiceNumber), money(details.value), text(details.reason));
    case 'sale.modify':
      return join(
        `${text(details.invoiceNumber) ?? ''} → ${text(details.newInvoiceNumber) ?? ''}`,
        money(details.newTotal),
        text(details.reason)
      );
    case 'sale.discount':
      return join(text(details.invoiceNumber), money(details.discount));
    case 'sale.expired_forced':
      return text(details.invoiceNumber);
    case 'product.price_change': {
      const changes = Array.isArray(details.changes) ? (details.changes as Details[]) : [];
      return join(
        text(details.name),
        ...changes.map(
          (change) =>
            `${text(change.unit) ?? ''} : ${money(change.before) ?? '—'} → ${money(change.after) ?? '—'}`
        )
      );
    }
    case 'product.create':
    case 'product.archive':
    case 'customer.create':
      return text(details.name);
    case 'product.update':
      return text((details.after as Details | undefined)?.name);
    case 'customer.update':
      return text((details.after as Details | undefined)?.name);
    case 'stock.receive':
      return join(text(details.supplier), money(details.totalCost));
    case 'stock.loss':
      return join(text(details.product), money(details.costAmount), text(details.note));
    case 'inventory.validate':
      return money(details.totalValue);
    case 'credit.repayment':
    case 'credit.manual_debt':
    case 'credit.write_off':
      return join(text(details.customer), money(details.amount));
    case 'cash.open':
      return money(details.openingFloat);
    case 'cash.close':
      return money(details.difference);
    case 'cash.movement':
      return join(money(details.amount), text(details.note));
    case 'report.account':
      return money(details.revenue);
    case 'member.create':
      return text(details.name);
    case 'delivery.create':
    case 'delivery.update':
      return join(text(details.address), money(details.amountToCollect));
    case 'delivery.complete':
      return money(details.collected);
    case 'delivery.fail':
    case 'delivery.cancel':
      return text(details.reason);
    case 'delivery.handover':
      return join(text(details.courier), money(details.amount));
    case 'delivery.expense':
      return money(details.amount);
    case 'delivery.expense_review':
      return join(text(details.courier), money(details.amount), text(details.reason));
    default:
      return null;
  }
}
