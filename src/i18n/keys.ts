import type { fr } from './fr';

/**
 * Toutes les clés de traduction possibles, par exemple « auth.signIn » ou « errors.network ».
 * Sert quand une clé est rangée dans une variable (message d'erreur…) : TypeScript
 * vérifie qu'elle existe vraiment dans fr.ts.
 */
type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = Leaves<typeof fr>;
