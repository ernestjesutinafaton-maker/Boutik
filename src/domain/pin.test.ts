import { describe, expect, it } from 'vitest';

import {
  hashPin,
  isValidPin,
  lockedUntil,
  MAX_PIN_ATTEMPTS,
  PIN_LOCK_DURATION_MS,
  saltFromBytes,
  verifyPin,
} from './pin';

const SALT = saltFromBytes(new Uint8Array(16).fill(7));

describe('Codes PIN', () => {
  it('accepte seulement 4 chiffres', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
  });

  it('ne garde jamais le PIN en clair : l’empreinte ne le contient pas', () => {
    const hash = hashPin('2580', SALT);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain('2580');
  });

  it('reconnaît le bon PIN et refuse les mauvais', () => {
    const hash = hashPin('2580', SALT);
    expect(verifyPin('2580', SALT, hash)).toBe(true);
    expect(verifyPin('2581', SALT, hash)).toBe(false);
    expect(verifyPin('abcd', SALT, hash)).toBe(false);
  });

  it('le même PIN donne une empreinte différente avec un autre sel', () => {
    const otherSalt = saltFromBytes(new Uint8Array(16).fill(9));
    expect(hashPin('2580', SALT)).not.toBe(hashPin('2580', otherSalt));
  });

  it('refuse de calculer l’empreinte d’un PIN invalide', () => {
    expect(() => hashPin('12', SALT)).toThrow('4 chiffres');
  });

  it('bloque temporairement après trop d’essais ratés', () => {
    expect(lockedUntil(MAX_PIN_ATTEMPTS - 1, 1000)).toBeNull();
    expect(lockedUntil(MAX_PIN_ATTEMPTS, 1000)).toBe(1000 + PIN_LOCK_DURATION_MS);
  });
});
