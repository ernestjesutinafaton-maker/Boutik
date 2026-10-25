import { describe, expect, it } from 'vitest';

import { emptyCustomerInput, parseCustomerInput } from './customer-form-values';

describe('Fiche client', () => {
  it('met le téléphone au format international et lit le plafond', () => {
    const result = parseCustomerInput(
      { name: ' Awa ', phone: '01 97 00 00 00', creditLimit: '50 000', notes: '' },
      'XOF',
      '+229'
    );
    expect(result).toEqual({
      success: true,
      data: { name: 'Awa', phone: '+2290197000000', creditLimit: 50_000, notes: null },
    });
  });

  it('le téléphone et le plafond sont facultatifs', () => {
    const result = parseCustomerInput({ ...emptyCustomerInput(), name: 'Koffi' }, 'XOF', '+229');
    expect(result.success && result.data).toEqual({
      name: 'Koffi',
      phone: null,
      creditLimit: null,
      notes: null,
    });
  });

  it('signale les erreurs', () => {
    const result = parseCustomerInput(
      { name: 'A', phone: 'abc', creditLimit: '12,5', notes: '' },
      'XOF',
      '+229'
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual({
      name: 'errors.customerNameTooShort',
      phone: 'errors.phoneInvalid',
      creditLimit: 'errors.priceInvalid',
    });
  });
});
