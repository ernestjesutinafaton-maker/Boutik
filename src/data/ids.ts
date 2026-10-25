import { randomUUID } from 'expo-crypto';

/** Un nouvel identifiant unique (UUID), créé par l'appareil lui-même — même hors ligne. */
export function newId(): string {
  return randomUUID();
}

/** Le moment présent, au format utilisé dans la base (« 2026-10-25T14:30:00.000Z »). */
export function nowIso(): string {
  return new Date().toISOString();
}
