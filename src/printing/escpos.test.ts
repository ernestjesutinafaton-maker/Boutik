import { describe, expect, it } from 'vitest';

import type { InvoiceData } from '@/invoices/invoice-html';

import { columnsFor, encodeText, encodeTicket, twoColumns, wrapText } from './escpos';
import { invoiceTicketBytes, invoiceTicketLines } from './ticket';

/** Retrouve le texte lisible (ASCII) dans des octets, pour vérifier un ticket. */
const ascii = (bytes: Uint8Array) =>
  String.fromCharCode(...bytes.filter((byte) => (byte >= 0x20 && byte < 0x7f) || byte === 0x0a));

describe('Accents et caractères spéciaux (page de code 850)', () => {
  it('les lettres simples restent telles quelles', () => {
    expect(encodeText('Riz 50 kg')).toEqual([...'Riz 50 kg'].map((c) => c.charCodeAt(0)));
  });

  it('les accents français ont leur code', () => {
    expect(encodeText('é')).toEqual([0x82]);
    expect(encodeText('à')).toEqual([0x85]);
    expect(encodeText('ç')).toEqual([0x87]);
    expect(encodeText('ê')).toEqual([0x88]);
    expect(encodeText('É')).toEqual([0x90]);
  });

  it('l’espace insécable, l’apostrophe courbe et le « œ » sont remplacés', () => {
    expect(encodeText('32 000')).toEqual(encodeText('32 000'));
    expect(encodeText('l’eau')).toEqual(encodeText("l'eau"));
    expect(encodeText('œuf')).toEqual(encodeText('oeuf'));
  });

  it('un caractère inconnu devient « ? »', () => {
    expect(encodeText('😀')).toEqual([0x3f]);
  });
});

describe('Mise en page du ticket', () => {
  it('32 caractères en 58 mm, 48 en 80 mm', () => {
    expect(columnsFor(58)).toBe(32);
    expect(columnsFor(80)).toBe(48);
  });

  it('coupe les longues lignes entre les mots', () => {
    expect(wrapText('Lait concentré sucré en boîte de 410 grammes', 20)).toEqual([
      'Lait concentré sucré',
      'en boîte de 410',
      'grammes',
    ]);
    expect(wrapText('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 10)).toEqual([
      'ABCDEFGHIJ',
      'KLMNOPQRST',
      'UVWXYZ',
    ]);
  });

  it('aligne le montant à droite', () => {
    expect(twoColumns('TOTAL', '64 000 FCFA', 32)).toEqual(['TOTAL                64 000 FCFA']);
    const [line] = twoColumns('TOTAL', '64 000 FCFA', 32);
    expect(line).toHaveLength(32);
  });

  it('un texte trop long passe à la ligne, le montant reste à droite', () => {
    const lines = twoColumns('2 Sac 50 kg x 32 000 FCFA (riz parfumé)', '64 000 FCFA', 32);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[lines.length - 1].endsWith('64 000 FCFA')).toBe(true);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });
});

describe('Commandes ESC/POS', () => {
  it('commence par réinitialiser l’imprimante et choisir les accents, finit par couper', () => {
    const bytes = encodeTicket([{ kind: 'text', text: 'Bonjour' }], 58);
    expect([...bytes.slice(0, 5)]).toEqual([0x1b, 0x40, 0x1b, 0x74, 0x02]);
    expect([...bytes.slice(-7)]).toEqual([0x1b, 0x64, 4, 0x1d, 0x56, 0x42, 0x00]);
  });

  it('centre, met en gras et en grand, puis revient à la normale', () => {
    const bytes = [
      ...encodeTicket([{ kind: 'text', text: 'A', align: 'center', bold: true, big: true }], 80),
    ];
    const body = bytes.slice(5, -7);
    expect(body).toEqual([
      0x1b,
      0x61,
      1, // centré
      0x1b,
      0x45,
      1, // gras
      0x1d,
      0x21,
      0x11, // grand
      0x41,
      0x0a, // « A » puis retour à la ligne
      0x1d,
      0x21,
      0x00,
      0x1b,
      0x45,
      0,
      0x1b,
      0x61,
      0,
    ]);
  });
});

describe('Ticket d’une vente', () => {
  const data: InvoiceData = {
    shop: { name: 'Chez Maman', phone: null, address: 'Cotonou', footer: null },
    currency: 'XOF',
    invoiceNumber: 'F2-000123',
    occurredAt: '2026-10-25T14:30:00.000Z',
    sellerName: 'Awa',
    customerName: null,
    customerPhone: null,
    items: [
      {
        name: 'Riz parfumé',
        quantity: 2000,
        unitName: 'Sac 50 kg',
        unitPrice: 32_000,
        lineTotal: 64_000,
      },
    ],
    subtotal: 64_000,
    discount: 0,
    total: 64_000,
    payments: [{ label: 'Espèces', amount: 50_000 }],
    due: 14_000,
    change: 0,
    cancelled: false,
    cancelReason: null,
  };

  it('contient le numéro, les lignes, le total et le reste dû', () => {
    const text = ascii(invoiceTicketBytes(data, 58));
    // En 58 mm, la ligne ne tient pas : le montant passe à la ligne, à droite
    expect(text).toContain(
      '2 Sacs 50 kg x 32 000 FCFA' + String.fromCharCode(10) + ' '.repeat(21) + '64 000 FCFA'
    );
    expect(text).toContain('Facture F2-000123');
    expect(text).toContain('2 Sacs 50 kg x 32 000 FCFA');
    expect(text).toContain('64 000 FCFA');
    expect(text).toContain('RESTE D');
    expect(text).toContain('14 000 FCFA');
  });

  it('une vente annulée est signalée', () => {
    const lines = invoiceTicketLines({ ...data, cancelled: true });
    expect(lines).toContainEqual(expect.objectContaining({ text: '*** VENTE ANNULÉE ***' }));
  });
});
