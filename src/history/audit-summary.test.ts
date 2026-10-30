import { describe, expect, it, vi } from 'vitest';

import { AUDIT_ACTIONS } from '@/data/audit';
import { formatMoney } from '@/domain/money';
import { fr } from '@/i18n/fr';

import { auditGroup, auditSummary } from './audit-summary';

// expo-crypto ne marche que dans l'appli : on le remplace pour le test
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

// Les montants s'écrivent comme dans l'appli (espaces insécables compris)
const money = (amount: number) => formatMoney(amount, 'XOF');

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
    ).toBe(`F1-000012 · ${money(34_450)} · Awa`);
    expect(
      auditSummary(
        'product.price_change',
        { name: 'Riz', changes: [{ unit: 'kg', before: 700, after: 750 }] },
        'XOF'
      )
    ).toBe(`Riz · kg : ${money(700)} → ${money(750)}`);
    expect(auditSummary('cash.close', { difference: -500 }, 'XOF')).toBe(money(-500));
    expect(auditSummary('member.pin_change', {}, 'XOF')).toBeNull();
  });
});
