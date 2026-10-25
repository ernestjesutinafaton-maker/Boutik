import type { z } from 'zod';

import type { TranslationKey } from '@/i18n/keys';

/** Pour chaque champ du formulaire : la clé du message d'erreur à afficher (s'il y en a une). */
export type FieldErrors<T> = Partial<Record<keyof T, TranslationKey>>;

/**
 * Transforme les erreurs de Zod en « une erreur par champ » (la première trouvée),
 * prête à être affichée sous chaque champ du formulaire.
 */
export function firstErrorPerField<T>(error: z.ZodError<T>): FieldErrors<T> {
  const result: FieldErrors<T> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as keyof T | undefined;
    if (field !== undefined && result[field] === undefined) {
      result[field] = issue.message as TranslationKey;
    }
  }
  return result;
}
