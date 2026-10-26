import { describe, expect, it } from 'vitest';

import { AUDIT_ACTIONS } from '@/data/audit';
import { fr } from '@/i18n/fr';

import { auditGroup, auditSummary } from './audit-summary';

const NBSP = String.fromCharCode(0xa0);
const fcfa = (value: string) => value.replace(/ /g, NBSP);

describe('Journal des actions', () => {
  it('chaque action a un nom en français', () => {
    for (const action of AUDIT_ACTIONS) {
      expect(
        fr.audit.actions[action.replace('.', '_') as keyof typeof fr.audit.actions]
      ).toBeTruthy();
    }
  });

  it('range les actions par groupe', () => {
    expect(auditGroup('sale.cancel')).toBe('sales');
    expect(auditGroup('credit.repayment')).toBe('credit');
    expect(auditGroup('customer.update')).toBe('credit');
    expect(auditGroup('product.price_change')).toBe('stock');
    expect(auditGroup('inventory.validate')).toBe('stock');
    expect(auditGroup('cash.close')).toBe('cash');
    expect(auditGroup('member.pin_change')).toBe('team');
  });

  it('résume les détails de façon lisible', () => {
    expect(
      auditSummary(
        'sale.create',
        { invoiceNumber: 'F1-000012', total: 34_450, customer: 'Awa' },
        'XOF'
      )
    ).toBe(fcfa('F1-000012 · 34 450 FCFA · Awa'));
    expect(
      auditSummary(
        'product.price_change',
        { name: 'Riz', changes: [{ unit: 'kg', before: 700, after: 750 }] },
        'XOF'
      )
    ).toBe(fcfa('Riz · kg : 700 FCFA → 750 FCFA'));
    expect(auditSummary('cash.close', { difference: -500 }, 'XOF')).toBe(fcfa('-500 FCFA'));
    expect(auditSummary('member.pin_change', {}, 'XOF')).toBeNull();
  });
});
