import { describe, expect, it } from 'vitest';

import { type DeliveryFormValues, parseDeliveryForm } from './delivery-form';

const base: DeliveryFormValues = {
  address: '  Cadjehoun, rue 12  ',
  landmark: 'Derrière la pharmacie',
  contactName: '',
  contactPhone: '01 97 00 00 01',
  when: 'asap',
  time: '',
  courierId: null,
  amount: '15 000',
  note: '',
};
const options = { currency: 'XOF' as const, dialCode: '+229', maxAmount: 15000 };

describe('Formulaire d’une livraison', () => {
  it('une livraison complète : adresse nettoyée, téléphone international, montant', () => {
    const result = parseDeliveryForm(base, options);
    expect(result).toEqual({
      success: true,
      data: {
        address: 'Cadjehoun, rue 12',
        landmark: 'Derrière la pharmacie',
        contactName: null,
        contactPhone: '+2290197000001',
        requestedAt: null,
        amountToCollect: 15000,
        assignedTo: null,
        note: null,
      },
    });
  });

  it('un jour choisi demande une heure valide', () => {
    expect(parseDeliveryForm({ ...base, when: '2026-11-02', time: 'midi' }, options)).toEqual({
      success: false,
      errors: { time: 'time' },
    });
    const ok = parseDeliveryForm({ ...base, when: '2026-11-02', time: '15h30' }, options);
    expect(ok.success && ok.data.requestedAt).toBe(new Date(2026, 10, 2, 15, 30).toISOString());
  });

  it('erreurs : adresse vide, téléphone faux, plus que ce qui reste à payer', () => {
    expect(
      parseDeliveryForm({ ...base, address: '  ', contactPhone: '12', amount: '20 000' }, options)
    ).toEqual({
      success: false,
      errors: { address: 'address', contactPhone: 'phone', amount: 'amountTooMuch' },
    });
    expect(parseDeliveryForm({ ...base, amount: '1000' }, { ...options, maxAmount: 0 })).toEqual({
      success: false,
      errors: { amount: 'amountTooMuch' },
    });
  });

  it('rien à encaisser : champ vide', () => {
    const result = parseDeliveryForm({ ...base, amount: '' }, { ...options, maxAmount: 0 });
    expect(result.success && result.data.amountToCollect).toBe(0);
  });
});
