import { z } from 'zod';

import { ROLES } from '@/domain/permissions';
import { isValidPin } from '@/domain/pin';
import type { TranslationKey } from '@/i18n/keys';

/** Vérifie au moment d'écrire le code que la clé existe bien dans fr.ts. */
const message = (key: TranslationKey) => key;

/** Fiche d'une personne de l'équipe. La remise maximale est tapée en texte (vide = aucune limite propre). */
export const memberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, message('errors.memberNameTooShort'))
    .max(60, message('errors.memberNameTooLong')),
  roles: z.array(z.enum(ROLES)).min(1, message('errors.rolesRequired')),
  maxDiscountPercent: z
    .string()
    .trim()
    .refine((value) => value === '' || (/^\d{1,3}$/.test(value) && Number(value) <= 100), {
      error: message('errors.discountPercentInvalid'),
    })
    .transform((value) => (value === '' ? null : Number(value))),
});

/** Nouveau code PIN, tapé deux fois. */
export const pinSchema = z
  .object({
    pin: z.string().refine(isValidPin, { error: message('errors.pinFormat') }),
    pinConfirmation: z.string(),
  })
  .refine((values) => values.pin === values.pinConfirmation, {
    error: message('errors.pinsDontMatch'),
    path: ['pinConfirmation'],
  });

export type MemberInput = z.input<typeof memberSchema>;
export type MemberValues = z.output<typeof memberSchema>;
export type PinInput = z.input<typeof pinSchema>;
