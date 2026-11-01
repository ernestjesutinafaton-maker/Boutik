import { describe, expect, it } from 'vitest';

import { buildReport } from '@/domain/report';

import { reportHtml } from './report-html';

const report = buildReport({
  periodStart: '2026-10-25T00:00:00.000Z',
  periodEnd: '2026-10-25T20:00:00.000Z',
  sales: [{ status: 'completed', total: 10_000, discount: 0 }],
  saleMovements: [{ type: 'sale', costAmount: -6000, saleStatus: 'completed' }],
  refunds: [],
  debtReductions: [],
  payments: [{ methodId: 'cash', methodLabel: 'Espèces', amount: 10_000 }],
  ledger: [],
  cashMovements: [{ type: 'expense', category: 'fuel', amount: 1000 }],
  stockMovements: [],
  closedSessions: [],
  soldItems: [],
  debtors: [{ name: 'Awa <B>', balance: 5000, ageDays: 40 }],
  stockValue: 0,
});

describe('Fiche de rapport en HTML', () => {
  it('le bénéfice n’apparaît que pour la personne qui a le droit de le voir', () => {
    const base = { report, title: 'Compte', shopName: 'Chez Maman', currency: 'XOF' as const };
    expect(reportHtml({ ...base, showProfit: true, showCosts: true })).toContain('Bénéfice net');
    expect(reportHtml({ ...base, showProfit: false, showCosts: true })).not.toContain(
      'Bénéfice net'
    );
  });

  it('sans les coûts (clôture faite par l’équipe) : ni bénéfice, ni achats, ni valeur du stock', () => {
    const html = reportHtml({
      report,
      title: 'Clôture',
      shopName: 'Chez Maman',
      currency: 'XOF',
      showProfit: true,
      showCosts: false,
    });
    expect(html).not.toContain('Bénéfice net');
    expect(html).not.toContain('Achats de marchandise');
    expect(html).not.toContain('Valeur du stock');
    expect(html).toContain('Carburant');
  });

  it('montre les dépenses par catégorie et protège les noms', () => {
    const html = reportHtml({
      report,
      title: 'Compte',
      shopName: 'Chez Maman',
      currency: 'XOF',
      showProfit: false,
      showCosts: true,
    });
    expect(html).toContain('Carburant');
    expect(html).toContain('Awa &lt;B&gt;');
  });
});
