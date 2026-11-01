import { formatMoment } from '@/domain/dates';
import { type CurrencyCode, formatMoney } from '@/domain/money';
import { formatQuantity, pluralUnit } from '@/domain/quantity';
import { palette } from '@/theme/tokens';

/**
 * Les factures, fabriquées DANS l'appareil (même hors ligne) :
 *   - en HTML, transformé en PDF (A4) ou imprimé (A4 ou ticket 58 / 80 mm) ;
 *   - en texte simple, pour un message WhatsApp.
 * Fonctions « pures » : faciles à tester.
 */

export type InvoiceFormat = 'a4' | 'ticket80' | 'ticket58';

export type InvoiceData = {
  shop: { name: string; phone: string | null; address: string | null; footer: string | null };
  currency: CurrencyCode;
  invoiceNumber: string;
  occurredAt: string;
  sellerName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  items: {
    name: string;
    /** En millièmes de l'unité de vente */
    quantity: number;
    unitName: string;
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discount: number;
  total: number;
  payments: { label: string; amount: number }[];
  due: number;
  change: number;
  cancelled: boolean;
  cancelReason: string | null;
};

/** Protège un texte avant de le mettre dans du HTML (un nom avec « < » ne casse rien). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PAGE_WIDTH: Record<InvoiceFormat, string> = {
  a4: '190mm',
  ticket80: '72mm',
  ticket58: '48mm',
};

/** La facture en HTML, prête à imprimer ou à transformer en PDF. */
export function invoiceHtml(data: InvoiceData, format: InvoiceFormat): string {
  const money = (amount: number) => escapeHtml(formatMoney(amount, data.currency));
  const text = (value: string) => escapeHtml(value);
  const isTicket = format !== 'a4';
  const baseSize = format === 'ticket58' ? 10 : format === 'ticket80' ? 11 : 12;

  const contact = [data.shop.address, data.shop.phone]
    .filter(Boolean)
    .map((line) => text(line ?? ''));
  const people = [
    data.sellerName ? `Vendeur : ${text(data.sellerName)}` : null,
    data.customerName
      ? `Client : ${text(data.customerName)}${data.customerPhone ? ` (${text(data.customerPhone)})` : ''}`
      : null,
  ].filter(Boolean);

  const rows = data.items
    .map((item) =>
      isTicket
        ? `<tr><td colspan="2" class="name">${text(item.name)}</td></tr>
           <tr><td>${text(formatQuantity(item.quantity))} ${text(pluralUnit(item.unitName, item.quantity))} × ${money(item.unitPrice)}</td>
               <td class="num">${money(item.lineTotal)}</td></tr>`
        : `<tr><td>${text(item.name)}</td>
               <td class="num">${text(formatQuantity(item.quantity))} ${text(pluralUnit(item.unitName, item.quantity))}</td>
               <td class="num">${money(item.unitPrice)}</td>
               <td class="num">${money(item.lineTotal)}</td></tr>`
    )
    .join('');

  const head = isTicket
    ? ''
    : '<tr><th>Désignation</th><th class="num">Quantité</th><th class="num">Prix unitaire</th><th class="num">Total</th></tr>';
  const span = isTicket ? 1 : 3;
  const totalRow = (label: string, value: string, cls = '') =>
    `<tr class="${cls}"><td colspan="${span}">${label}</td><td class="num">${value}</td></tr>`;

  const totals = [
    data.discount > 0 ? totalRow('Sous-total', money(data.subtotal)) : '',
    data.discount > 0 ? totalRow('Remise', `− ${money(data.discount)}`) : '',
    totalRow('TOTAL', money(data.total), 'grand'),
    ...data.payments.map((payment) => totalRow(text(payment.label), money(payment.amount))),
    data.change > 0 ? totalRow('Monnaie rendue', money(data.change)) : '',
    data.due > 0 ? totalRow('Reste dû (crédit)', money(data.due), 'due') : '',
  ].join('');

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Facture ${text(data.invoiceNumber)}</title>
<style>
  @page { margin: ${isTicket ? '2mm' : '12mm'}; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: ${baseSize}px; color: #111827; margin: 0; }
  .page { width: ${PAGE_WIDTH[format]}; margin: 0 auto; }
  h1 { font-size: ${baseSize + (isTicket ? 4 : 10)}px; margin: 0 0 4px; text-align: ${isTicket ? 'center' : 'left'}; }
  .muted { color: #4B5563; ${isTicket ? 'text-align: center;' : ''} }
  .title { margin: ${isTicket ? '6px' : '16px'} 0 4px; font-weight: bold; font-size: ${baseSize + 2}px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; border-bottom: 2px solid ${palette.light.primary}; padding: 4px 2px; }
  td { padding: ${isTicket ? '1px' : '4px'} 2px; vertical-align: top; }
  ${isTicket ? '' : 'tbody tr td { border-bottom: 1px solid #E5E7EB; }'}
  .name { font-weight: bold; padding-top: 4px; }
  .num { text-align: right; white-space: nowrap; }
  .grand td { font-weight: bold; font-size: ${baseSize + 4}px; border-top: 2px solid #111827; padding-top: 6px; }
  .due td { color: #DC2626; font-weight: bold; }
  .cancelled { color: #DC2626; border: 3px solid #DC2626; text-align: center; font-weight: bold;
               font-size: ${baseSize + 6}px; padding: 4px; margin: 8px 0; }
  .footer { margin-top: 12px; text-align: center; color: #4B5563; white-space: pre-line; }
</style></head>
<body><div class="page">
  <h1>${text(data.shop.name)}</h1>
  ${contact.map((line) => `<div class="muted">${line}</div>`).join('')}
  <div class="title">Facture N° ${text(data.invoiceNumber)}</div>
  <div>${text(formatMoment(data.occurredAt))}</div>
  ${people.map((line) => `<div>${line}</div>`).join('')}
  ${data.cancelled ? `<div class="cancelled">VENTE ANNULÉE${data.cancelReason ? ` — ${text(data.cancelReason)}` : ''}</div>` : ''}
  <table>
    <thead>${head}</thead>
    <tbody>${rows}</tbody>
    <tfoot>${totals}</tfoot>
  </table>
  <div class="footer">${data.shop.footer ? `${text(data.shop.footer)}\n` : ''}Merci de votre visite !</div>
</div></body></html>`;
}

/** La facture en texte simple, pour un message WhatsApp. */
export function invoiceText(data: InvoiceData): string {
  const money = (amount: number) => formatMoney(amount, data.currency);
  const lines = [
    `*${data.shop.name}*`,
    `Facture N° ${data.invoiceNumber} — ${formatMoment(data.occurredAt)}`,
    data.cancelled ? '*VENTE ANNULÉE*' : null,
    '',
    ...data.items.map(
      (item) =>
        `• ${item.name} : ${formatQuantity(item.quantity)} ${pluralUnit(item.unitName, item.quantity)} × ${money(item.unitPrice)} = ${money(item.lineTotal)}`
    ),
    '',
    data.discount > 0 ? `Remise : − ${money(data.discount)}` : null,
    `*Total : ${money(data.total)}*`,
    ...data.payments.map((payment) => `${payment.label} : ${money(payment.amount)}`),
    data.due > 0 ? `*Reste dû : ${money(data.due)}*` : null,
    '',
    data.shop.footer,
    'Merci de votre visite !',
  ];
  return lines.filter((line) => line !== null).join('\n');
}
