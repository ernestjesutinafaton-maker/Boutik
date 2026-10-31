import { describe, expect, it } from 'vitest';

import { parseSettingsInput, type SettingsInput } from './settings-values';

const input: SettingsInput = {
  name: ' Boutique Chez Maman ',
  phone: '01 97 00 00 00',
  address: 'Marché Dantokpa, Cotonou',
  invoiceFooter: 'Les marchandises vendues ne sont ni reprises ni échangées.',
  expiryFirst: '30',
  expirySecond: '7',
  sellerMaxDiscount: '5',
  allowSaleWithoutStock: true,
  returnWindowHours: 48,
};

describe('Paramètres de la boutique', () => {
  it('lit les valeurs tapées', () => {
    const result = parseSettingsInput(input, '+229');
    expect(result).toEqual({
      success: true,
      data: {
        name: 'Boutique Chez Maman',
        phone: '+2290197000000',
        address: 'Marché Dantokpa, Cotonou',
        invoiceFooter: 'Les marchandises vendues ne sont ni reprises ni échangées.',
        expiryFirst: 30,
        expirySecond: 7,
        sellerMaxDiscount: 5,
        allowSaleWithoutStock: true,
        returnWindowHours: 48,
      },
    });
  });

  it('la 2e alerte de péremption doit venir après la 1re (moins de jours)', () => {
    const result = parseSettingsInput({ ...input, expiryFirst: '7', expirySecond: '30' }, '+229');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.expirySecond).toBe('errors.secondAlertAfterFirst');
  });

  it('refuse les valeurs impossibles', () => {
    const result = parseSettingsInput(
      { ...input, name: 'A', phone: 'abc', sellerMaxDiscount: '150', expiryFirst: '-1' },
      '+229'
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual({
      name: 'errors.shopNameTooShort',
      phone: 'errors.phoneInvalid',
      sellerMaxDiscount: 'errors.discountPercentInvalid',
      expiryFirst: 'errors.daysInvalid',
    });
  });
});
