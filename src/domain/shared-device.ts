import type { Role } from './permissions';

/**
 * « Qui êtes-vous ? » (choix de la personne avec son code PIN) ne sert que sur l'appareil de la
 * boutique, connecté avec le compte du PROPRIÉTAIRE, et seulement quand une autre personne peut
 * s'y identifier avec son code PIN.
 *
 * Sur le téléphone personnel d'un membre (son propre compte), jamais : il entre directement dans
 * son interface, avec ses rôles. Un membre invité qui n'a pas de code PIN ne compte pas : il
 * travaille sur son propre téléphone.
 */
export function asksWhoIsThere(input: {
  /** Les rôles du compte connecté sur cet appareil */
  accountRoles: readonly Role[];
  /** Le profil de ce compte dans la boutique */
  accountMemberId: string | null;
  /** Les profils actifs qui ont un code PIN */
  membersWithPin: readonly string[];
}): boolean {
  return (
    input.accountRoles.includes('owner') &&
    input.membersWithPin.some((memberId) => memberId !== input.accountMemberId)
  );
}
