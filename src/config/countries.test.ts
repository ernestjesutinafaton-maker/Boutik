import { describe, expect, it } from 'vitest';

import { CURRENCIES } from '@/domain/money';

import { COUNTRIES, DEFAULT_COUNTRY_CODE, getCountry } from './countries';

describe('Les pays pris en charge', () => {
  it('le Bénin est le pays par défaut, en FCFA, avec l’indicatif +229', () => {
    const benin = getCountry(DEFAULT_COUNTRY_CODE);
    expect(benin.name).toBe('Bénin');
    expect(benin.currency).toBe('XOF');
    expect(benin.dialCode).toBe('+229');
  });

  it('le Bénin propose les modes de paiement demandés dans le cahier des charges', () => {
    expect(getCountry('BJ').paymentMethods.map((method) => method.label)).toEqual([
      'Espèces',
      'MTN MoMo',
      'Moov Money',
      'Celtiis Cash',
      'Autre',
    ]);
  });

  it('chaque pays a un code unique, un indicatif valide et une monnaie connue', () => {
    const codes = COUNTRIES.map((country) => country.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const country of COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      expect(country.dialCode).toMatch(/^\+\d{3}$/);
      expect(CURRENCIES[country.currency]).toBeDefined();
    }
  });

  it('chaque pays propose les espèces en premier', () => {
    for (const country of COUNTRIES) {
      expect(country.paymentMethods[0]).toMatchObject({ code: 'cash', kind: 'cash' });
    }
  });

  it('refuse un pays inconnu avec un message clair', () => {
    expect(() => getCountry('ZZ')).toThrow('Pays inconnu');
  });
});
