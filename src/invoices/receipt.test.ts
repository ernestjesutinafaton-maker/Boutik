import { describe, expect, it } from 'vitest';

import { type ReceiptData, receiptHtml, receiptNumber, receiptText, reminderText } from './receipt';

const NBSP = String.fromCharCode(0xa0);
const fcfa = (text: string) => text.replace(/ /g, NBSP);

const data: ReceiptData = {
  shop: { name: 'Chez Maman', phone: null, address: null },
  currency: 'XOF',
  receiptNumber: 'R-1A2B3C4D',
  occurredAt: '2026-10-25T10:00:00.000Z',
  customerName: 'Awa',
  amount: 5000,
  methodLabel: 'MTN MoMo',
  balanceAfter: 2500,
  receivedBy: 'Koffi',
};

describe('Reçu de remboursement', () => {
  it('a un numéro court et lisible', () => {
    expect(receiptNumber('1a2b3c4d-5e6f-7a8b-9c0d-112233445566')).toBe('R-1A2B3C4D');
  });

  it('indique le montant reçu et ce qu’il reste à payer', () => {
    const text = receiptText(data);
    expect(text).toContain(`*${fcfa('5 000 FCFA')}* (MTN MoMo)`);
    expect(text).toContain(`Reste à payer : *${fcfa('2 500 FCFA')}*`);
    expect(receiptHtml(data)).toContain('Reçu de paiement N° R-1A2B3C4D');
  });

  it('dit merci quand le compte est soldé', () => {
    expect(receiptText({ ...data, balanceAfter: 0 })).toContain('Votre compte est soldé');
  });

  it('protège le nom du client dans le HTML', () => {
    expect(receiptHtml({ ...data, customerName: '<Awa>' })).toContain('&lt;Awa&gt;');
  });
});

describe('Relance WhatsApp', () => {
  it('rappelle poliment le montant et la date de la dette', () => {
    const text = reminderText({
      shopName: 'Chez Maman',
      customerName: 'Awa',
      balance: 12_000,
      currency: 'XOF',
      since: '2026-09-10',
    });
    expect(text).toContain('Bonjour Awa,');
    expect(text).toContain(`il reste *${fcfa('12 000 FCFA')}* à régler (depuis le 10/09/2026)`);
  });
});
