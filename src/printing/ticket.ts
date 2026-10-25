import { formatMoment } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { formatQuantity } from '@/domain/quantity';
import type { InvoiceData } from '@/invoices/invoice-html';

import { encodeTicket, type PaperWidth, type TicketLine } from './escpos';

/** Le ticket de caisse d'une vente, ligne par ligne. */
export function invoiceTicketLines(data: InvoiceData): TicketLine[] {
  const money = (amount: number) => formatMoney(amount, data.currency);
  const lines: TicketLine[] = [
    { kind: 'text', text: data.shop.name, align: 'center', bold: true, big: true },
  ];
  for (const contact of [data.shop.address, data.shop.phone]) {
    if (contact) lines.push({ kind: 'text', text: contact, align: 'center' });
  }
  lines.push(
    { kind: 'rule' },
    { kind: 'text', text: `Facture ${data.invoiceNumber}`, bold: true },
    { kind: 'text', text: formatMoment(data.occurredAt) }
  );
  if (data.sellerName) lines.push({ kind: 'text', text: `Vendeur : ${data.sellerName}` });
  if (data.customerName) lines.push({ kind: 'text', text: `Client : ${data.customerName}` });
  if (data.cancelled) {
    lines.push({ kind: 'text', text: '*** VENTE ANNULÉE ***', align: 'center', bold: true });
  }
  lines.push({ kind: 'rule' });

  for (const item of data.items) {
    lines.push(
      { kind: 'text', text: item.name, bold: true },
      {
        kind: 'columns',
        left: `${formatQuantity(item.quantity)} ${item.unitName} x ${money(item.unitPrice)}`,
        right: money(item.lineTotal),
      }
    );
  }
  lines.push({ kind: 'rule' });

  if (data.discount > 0) {
    lines.push(
      { kind: 'columns', left: 'Sous-total', right: money(data.subtotal) },
      { kind: 'columns', left: 'Remise', right: `-${money(data.discount)}` }
    );
  }
  lines.push({ kind: 'columns', left: 'TOTAL', right: money(data.total), bold: true });
  for (const payment of data.payments) {
    lines.push({ kind: 'columns', left: payment.label, right: money(payment.amount) });
  }
  if (data.change > 0) {
    lines.push({ kind: 'columns', left: 'Monnaie rendue', right: money(data.change) });
  }
  if (data.due > 0) {
    lines.push({ kind: 'columns', left: 'RESTE DÛ', right: money(data.due), bold: true });
  }
  lines.push({ kind: 'feed', lines: 1 });
  if (data.shop.footer) {
    lines.push({ kind: 'text', text: data.shop.footer, align: 'center' });
  }
  lines.push({ kind: 'text', text: 'Merci de votre visite !', align: 'center' });
  return lines;
}

/** Les octets du ticket, prêts pour l'imprimante Bluetooth. */
export function invoiceTicketBytes(data: InvoiceData, width: PaperWidth): Uint8Array {
  return encodeTicket(invoiceTicketLines(data), width);
}

/** Petit ticket d'essai, pour vérifier l'imprimante et les accents. */
export function testTicketBytes(shopName: string, width: PaperWidth): Uint8Array {
  return encodeTicket(
    [
      { kind: 'text', text: shopName, align: 'center', bold: true, big: true },
      { kind: 'text', text: 'Essai d’impression', align: 'center' },
      { kind: 'rule' },
      { kind: 'text', text: 'Accents : é è ê à ç ô û ï' },
      { kind: 'columns', left: 'Total', right: '32 000 FCFA', bold: true },
      { kind: 'text', text: `Papier : ${width} mm`, align: 'center' },
    ],
    width
  );
}
