import { getRandomBytes } from 'expo-crypto';

import { hashPin, saltFromBytes } from '@/domain/pin';
import { errorMessageKey } from '@/lib/error-messages';
import { supabase } from '@/lib/supabase';
import type { TranslationKey } from '@/i18n/keys';

export type ProfileResult = 'ok' | 'offline' | 'failed';

/**
 * Le membre change SON nom et/ou SON code PIN (jamais ses rôles). Internet nécessaire :
 * c'est le serveur qui enregistre, puis la synchronisation le transmet à l'appareil de la
 * boutique (où sert le code PIN).
 * name : null ou vide = garder le nom ; pin : null = garder le code PIN.
 */
export async function updateMyProfile(
  name: string | null,
  pin: string | null
): Promise<ProfileResult> {
  const salt = pin ? saltFromBytes(getRandomBytes(16)) : null;
  const { error } = await supabase.rpc('update_my_member_profile', {
    p_display_name: name?.trim() ?? '',
    // Sans nouveau code PIN : null, et le serveur garde l'ancien (les types générés ne savent
    // pas que la fonction accepte null)
    p_pin_hash: (pin && salt ? hashPin(pin, salt) : null) as string,
    p_pin_salt: salt as string,
  });
  if (!error) {
    return 'ok';
  }
  // Pas de code d'erreur PostgreSQL : la demande n'est pas arrivée au serveur (réseau)
  return error.code ? 'failed' : 'offline';
}

/**
 * Change le mot de passe du compte connecté (internet nécessaire ; pas d'e-mail à attendre).
 * Renvoie null si c'est fait, sinon le message d'erreur à montrer.
 */
export async function changeMyPassword(password: string): Promise<TranslationKey | null> {
  const { error } = await supabase.auth.updateUser({ password });
  return error ? errorMessageKey(error) : null;
}
