import { describe, expect, it } from 'vitest';

import { firstErrorPerField } from '@/lib/validation';

import { createShopSchema, newPasswordSchema, signInSchema, signUpSchema } from './schemas';

describe('Formulaire de connexion', () => {
  it('accepte un e-mail et un mot de passe, en enlevant les espaces autour de l’e-mail', () => {
    const result = signInSchema.safeParse({ email: '  awa@exemple.com ', password: 'secret' });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe('awa@exemple.com');
  });

  it('signale un e-mail vide, un e-mail invalide et un mot de passe vide', () => {
    const empty = signInSchema.safeParse({ email: '', password: '' });
    expect(empty.success).toBe(false);
    expect(firstErrorPerField(empty.error!)).toEqual({
      email: 'errors.emailRequired',
      password: 'errors.passwordRequired',
    });

    const invalid = signInSchema.safeParse({ email: 'awa-exemple.com', password: 'x' });
    expect(firstErrorPerField(invalid.error!)).toEqual({ email: 'errors.emailInvalid' });
  });
});

describe('Formulaire d’inscription', () => {
  it('demande au moins 8 caractères pour le mot de passe', () => {
    const result = signUpSchema.safeParse({
      email: 'awa@exemple.com',
      password: '1234567',
      passwordConfirmation: '1234567',
    });
    expect(firstErrorPerField(result.error!)).toEqual({ password: 'errors.passwordTooShort' });
  });

  it('vérifie que les deux mots de passe sont identiques', () => {
    const result = signUpSchema.safeParse({
      email: 'awa@exemple.com',
      password: 'motdepasse1',
      passwordConfirmation: 'motdepasse2',
    });
    expect(firstErrorPerField(result.error!)).toEqual({
      passwordConfirmation: 'errors.passwordsDontMatch',
    });
  });

  it('accepte une inscription correcte', () => {
    const result = signUpSchema.safeParse({
      email: 'awa@exemple.com',
      password: 'motdepasse1',
      passwordConfirmation: 'motdepasse1',
    });
    expect(result.success).toBe(true);
  });
});

describe('Formulaire de création de boutique', () => {
  it('accepte une boutique au Bénin', () => {
    const result = createShopSchema.safeParse({
      shopName: ' Boutique Chez Maman ',
      ownerName: 'Awa',
      countryCode: 'BJ',
    });
    expect(result.success).toBe(true);
    expect(result.data?.shopName).toBe('Boutique Chez Maman');
  });

  it('signale un nom trop court et un pays inconnu', () => {
    const result = createShopSchema.safeParse({ shopName: 'A', ownerName: 'B', countryCode: 'ZZ' });
    expect(firstErrorPerField(result.error!)).toEqual({
      shopName: 'errors.shopNameTooShort',
      ownerName: 'errors.ownerNameTooShort',
      countryCode: 'errors.countryRequired',
    });
  });

  it('nouveau mot de passe (« Mon profil ») : 8 caractères au moins, deux fois le même', () => {
    expect(
      newPasswordSchema.safeParse({
        password: 'nouveau-2026',
        passwordConfirmation: 'nouveau-2026',
      }).success
    ).toBe(true);
    const short = newPasswordSchema.safeParse({ password: 'court', passwordConfirmation: 'court' });
    expect(short.success ? null : firstErrorPerField(short.error)).toEqual({
      password: 'errors.passwordTooShort',
    });
    const different = newPasswordSchema.safeParse({
      password: 'nouveau-2026',
      passwordConfirmation: 'nouveau-2025',
    });
    expect(different.success ? null : firstErrorPerField(different.error)).toEqual({
      passwordConfirmation: 'errors.passwordsDontMatch',
    });
  });
});
