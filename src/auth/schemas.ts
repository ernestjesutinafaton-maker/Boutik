import { z } from 'zod';

import { COUNTRIES } from '@/config/countries';
import type { TranslationKey } from '@/i18n/keys';

/**
 * Règles de vérification des formulaires (avec la bibliothèque Zod).
 *
 * Les messages d'erreur sont des CLÉS de traduction (voir fr.ts) : l'écran les traduit
 * avec t(). Ainsi, ils pourront aussi s'afficher en anglais plus tard.
 */

/** Vérifie au moment d'écrire le code que la clé existe bien dans fr.ts. */
const message = (key: TranslationKey) => key;

const email = z
  .string()
  .trim()
  .min(1, message('errors.emailRequired'))
  .pipe(z.email(message('errors.emailInvalid')));

export const signInSchema = z.object({
  email,
  password: z.string().min(1, message('errors.passwordRequired')),
});

export const signUpSchema = z
  .object({
    email,
    password: z.string().min(8, message('errors.passwordTooShort')),
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    error: message('errors.passwordsDontMatch'),
    path: ['passwordConfirmation'],
  });

export const createShopSchema = z.object({
  shopName: z
    .string()
    .trim()
    .min(2, message('errors.shopNameTooShort'))
    .max(100, message('errors.shopNameTooLong')),
  ownerName: z
    .string()
    .trim()
    .min(2, message('errors.ownerNameTooShort'))
    .max(60, message('errors.ownerNameTooLong')),
  countryCode: z.string().refine((code) => COUNTRIES.some((country) => country.code === code), {
    error: message('errors.countryRequired'),
  }),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type CreateShopInput = z.infer<typeof createShopSchema>;
