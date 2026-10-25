import { formatDay, formatMoment } from '@/domain/dates';
import { type CurrencyCode, formatMoney } from '@/domain/money';

import { escapeHtml, type InvoiceFormat } from './invoice-html';

/**
 * Le reçu d'un remboursement de crédit, et le message de relance d'une dette.
 * Fonctions « pures » : faciles à tester.
 */

export type ReceiptData = {
  shop: { name: string; phone: string | null; address: string | null };
  currency: CurrencyCode;
  /** Numéro court du reçu (début de l'identifiant du paiement) */
  receiptNumber: string;
  occurredAt: string;
  customerName: string;
  amount: number;
  methodLabel: string;
  /** Ce que le client doit encore après ce remboursement */
  balanceAfter: number;
  receivedBy: string | null;
};

/** Numéro court et lisible d'un reçu : R-1A2B3C4D. */
export function receiptNumber(paymentId: string): string {
  return `R-${paymentId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export function receiptText(data: ReceiptData): string {
  const money = (amount: number) => formatMoney(amount, data.currency);
  return [
    `*${data.shop.name}*`,
    `Reçu ${data.receiptNumber} — ${formatMoment(data.occurredAt)}`,
    '',
    `${data.customerName}, nous avons bien reçu *${money(data.amount)}* (${data.methodLabel}).`,
    data.balanceAfter > 0
      ? `Reste à payer : *${money(data.balanceAfter)}*.`
      : 'Votre compte est soldé. Merci !',
    data.receivedBy ? `Reçu par : ${data.receivedBy}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function receiptHtml(data: ReceiptData, format: InvoiceFormat = 'a4'): string {
  const pageWidth = { a4: '160mm', ticket80: '72mm', ticket58: '48mm' }[format];
  const text = (value: string) => escapeHtml(value);
  const money = (amount: number) => escapeHtml(formatMoney(amount, data.currency));
  const contact = [data.shop.address, data.shop.phone].filter(Boolean) as string[];
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Reçu ${text(data.receiptNumber)}</title>
<style>
  @page { margin: ${format === 'a4' ? '12mm' : '2mm'}; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #111827; }
  .page { width: ${pageWidth}; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #4B5563; }
  .title { margin: 16px 0 8px; font-weight: bold; font-size: 16px; }
  .amount { font-size: 28px; font-weight: bold; color: #059669; margin: 12px 0; }
  .due { color: #DC2626; font-weight: bold; }
</style></head>
<body><div class="page">
  <h1>${text(data.shop.name)}</h1>
  ${contact.map((line) => `<div class="muted">${text(line)}</div>`).join('')}
  <div class="title">Reçu de paiement N° ${text(data.receiptNumber)}</div>
  <div>${text(formatMoment(data.occurredAt))}</div>
  <div>Client : ${text(data.customerName)}</div>
  <div class="amount">${money(data.amount)}</div>
  <div>Payé par : ${text(data.methodLabel)}</div>
  ${data.receivedBy ? `<div>Reçu par : ${text(data.receivedBy)}</div>` : ''}
  <p class="${data.balanceAfter > 0 ? 'due' : ''}">${
    data.balanceAfter > 0 ? `Reste à payer : ${money(data.balanceAfter)}` : 'Compte soldé. Merci !'
  }</p>
</div></body></html>`;
}

/** Message de relance (poli) pour une dette, à envoyer par WhatsApp. */
export function reminderText(input: {
  shopName: string;
  customerName: string;
  balance: number;
  currency: CurrencyCode;
  /** Jour de la plus ancienne dette pas encore remboursée */
  since: string | null;
}): string {
  const amount = formatMoney(input.balance, input.currency);
  const since = input.since ? ` (depuis le ${formatDay(input.since)})` : '';
  return [
    `Bonjour ${input.customerName},`,
    `ceci est un petit rappel de *${input.shopName}* : il reste *${amount}* à régler${since}.`,
    'Vous pouvez passer à la boutique ou payer par Mobile Money. Merci beaucoup !',
  ].join('\n');
}
