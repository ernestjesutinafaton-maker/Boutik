import { describe, expect, it } from 'vitest';

import { escapeHtml, type InvoiceData, invoiceHtml, invoiceText } from './invoice-html';

const NBSP = String.fromCharCode(0xa0);
const fcfa = (text: string) => text.replace(/ /g, NBSP);

const data: InvoiceData = {
  shop: {
    name: 'Chez Maman',
    phone: '+2290197000000',
    address: 'Cotonou',
    footer: 'Ni repris ni échangé',
  },
  currency: 'XOF',
  invoiceNumber: 'F2-000123',
  occurredAt: '2026-10-25T14:30:00.000Z',
  sellerName: 'Awa',
  customerName: 'Koffi <le grand>',
  customerPhone: null,
  items: [
    {
      name: 'Riz parfumé',
      quantity: 2000,
      unitName: 'Sac 50 kg',
      unitPrice: 32_000,
      lineTotal: 64_000,
    },
    { name: 'Riz parfumé', quantity: 1500, unitName: 'kg', unitPrice: 700, lineTotal: 1050 },
  ],
  subtotal: 65_050,
  discount: 1050,
  total: 64_000,
  payments: [{ label: 'Espèces', amount: 50_000 }],
  due: 14_000,
  change: 0,
  cancelled: false,
  cancelReason: null,
};

describe('Facture HTML', () => {
  it('protège les textes (un nom avec < > ne casse pas la page)', () => {
    expect(escapeHtml('<b>"A" & \'B\'</b>')).toBe(
      '&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;'
    );
    const html = invoiceHtml(data, 'a4');
    expect(html).toContain('Koffi &lt;le grand&gt;');
    expect(html).not.toContain('<le grand>');
  });

  it('contient le numéro, les lignes, les totaux et le reste dû', () => {
    const html = invoiceHtml(data, 'a4');
    expect(html).toContain('Facture N° F2-000123');
    expect(html).toContain('Sac 50 kg');
    expect(html).toContain('1,5 kg');
    expect(html).toContain(fcfa('64 000 FCFA'));
    expect(html).toContain('Reste dû (crédit)');
    expect(html).toContain(fcfa('14 000 FCFA'));
    expect(html).toContain('Ni repris ni échangé');
  });

  it('existe en ticket 58 et 80 mm', () => {
    expect(invoiceHtml(data, 'ticket58')).toContain('width: 48mm');
    expect(invoiceHtml(data, 'ticket80')).toContain('width: 72mm');
  });

  it('une vente annulée porte la mention « VENTE ANNULÉE »', () => {
    const html = invoiceHtml({ ...data, cancelled: true, cancelReason: 'Erreur' }, 'a4');
    expect(html).toContain('VENTE ANNULÉE — Erreur');
  });
});

describe('Facture en message WhatsApp', () => {
  it('résume la vente en texte', () => {
    const text = invoiceText(data);
    expect(text).toContain('*Chez Maman*');
    expect(text).toContain('Facture N° F2-000123');
    expect(text).toContain(`• Riz parfumé : 2 Sac 50 kg × ${fcfa('32 000 FCFA')}`);
    expect(text).toContain(`*Reste dû : ${fcfa('14 000 FCFA')}*`);
  });
});
