import { describe, expect, it } from 'vitest';

import { firstErrorPerField } from '@/lib/validation';

import { memberSchema, pinSchema } from './schemas';

describe('Fiche d’une personne de l’équipe', () => {
  it('accepte une personne avec plusieurs rôles, sans limite de remise propre', () => {
    const result = memberSchema.safeParse({
      name: ' Dédé ',
      roles: ['manager', 'cashier', 'seller'],
      maxDiscountPercent: '',
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: 'Dédé',
      roles: ['manager', 'cashier', 'seller'],
      maxDiscountPercent: null,
    });
  });

  it('transforme la remise maximale tapée en nombre', () => {
    const result = memberSchema.safeParse({
      name: 'Awa',
      roles: ['seller'],
      maxDiscountPercent: '10',
    });
    expect(result.data?.maxDiscountPercent).toBe(10);
  });

  it('exige un nom, au moins un rôle et une remise entre 0 et 100', () => {
    const result = memberSchema.safeParse({ name: 'A', roles: [], maxDiscountPercent: '150' });
    expect(firstErrorPerField(result.error!)).toEqual({
      name: 'errors.memberNameTooShort',
      roles: 'errors.rolesRequired',
      maxDiscountPercent: 'errors.discountPercentInvalid',
    });
  });

  it('refuse un rôle inconnu', () => {
    const result = memberSchema.safeParse({
      name: 'Awa',
      roles: ['admin'],
      maxDiscountPercent: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('Nouveau code PIN', () => {
  it('accepte 4 chiffres tapés deux fois', () => {
    expect(pinSchema.safeParse({ pin: '2580', pinConfirmation: '2580' }).success).toBe(true);
  });

  it('refuse un PIN mal formé ou mal confirmé', () => {
    const badFormat = pinSchema.safeParse({ pin: '25', pinConfirmation: '25' });
    expect(firstErrorPerField(badFormat.error!)).toEqual({ pin: 'errors.pinFormat' });
    const mismatch = pinSchema.safeParse({ pin: '2580', pinConfirmation: '2581' });
    expect(firstErrorPerField(mismatch.error!)).toEqual({
      pinConfirmation: 'errors.pinsDontMatch',
    });
  });
});
