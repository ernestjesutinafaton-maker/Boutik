import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * Codes PIN à 4 chiffres, pour changer d'utilisateur sur l'appareil de la boutique.
 *
 * Le PIN n'est JAMAIS enregistré en clair : on garde seulement une « empreinte »
 * calculée avec un sel (valeur au hasard propre à chaque personne). Retrouver le PIN
 * à partir de l'empreinte demande beaucoup de calculs (PBKDF2, 5 000 tours).
 * La vérification se fait dans l'appareil : elle marche sans internet.
 */

const ITERATIONS = 5000;
const KEY_LENGTH = 32;

/** Nombre d'essais ratés autorisés avant un blocage temporaire. */
export const MAX_PIN_ATTEMPTS = 5;
/** Durée du blocage après trop d'essais ratés. */
export const PIN_LOCK_DURATION_MS = 30_000;

/** Un PIN valide : exactement 4 chiffres. */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/** Calcule l'empreinte d'un PIN avec son sel (texte hexadécimal). */
export function hashPin(pin: string, saltHex: string): string {
  if (!isValidPin(pin)) {
    throw new Error('Le code PIN doit contenir exactement 4 chiffres.');
  }
  const key = pbkdf2(sha256, utf8ToBytes(pin), hexToBytes(saltHex), {
    c: ITERATIONS,
    dkLen: KEY_LENGTH,
  });
  return bytesToHex(key);
}

/** Vérifie un PIN tapé, en comparant les empreintes sans fuite de temps. */
export function verifyPin(pin: string, saltHex: string, expectedHashHex: string): boolean {
  if (!isValidPin(pin)) {
    return false;
  }
  const actual = hashPin(pin, saltHex);
  if (actual.length !== expectedHashHex.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < actual.length; index++) {
    difference |= actual.charCodeAt(index) ^ expectedHashHex.charCodeAt(index);
  }
  return difference === 0;
}

/** Transforme des octets tirés au hasard en sel (texte hexadécimal). */
export function saltFromBytes(bytes: Uint8Array): string {
  return bytesToHex(bytes);
}

/**
 * Après trop d'essais ratés, on bloque quelques secondes : impossible d'essayer
 * les 10 000 codes possibles. Renvoie l'heure de fin du blocage (ou null).
 */
export function lockedUntil(failedAttempts: number, lastFailureAt: number): number | null {
  if (failedAttempts < MAX_PIN_ATTEMPTS) {
    return null;
  }
  return lastFailureAt + PIN_LOCK_DURATION_MS;
}
