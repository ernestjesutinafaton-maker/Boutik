import { describe, expect, it } from 'vitest';

import { errorMessageKey } from './error-messages';

describe('errorMessageKey : traduire les erreurs du serveur en français clair', () => {
  it('reconnaît les erreurs de connexion de Supabase', () => {
    expect(
      errorMessageKey({ code: 'invalid_credentials', message: 'Invalid login credentials' })
    ).toBe('errors.invalidCredentials');
    expect(errorMessageKey({ code: 'user_already_exists' })).toBe('errors.emailAlreadyUsed');
    expect(errorMessageKey({ code: 'weak_password' })).toBe('errors.weakPassword');
    expect(errorMessageKey({ code: 'email_address_invalid' })).toBe('errors.emailInvalid');
    expect(errorMessageKey({ code: 'over_request_rate_limit' })).toBe('errors.tooManyAttempts');
  });

  it('reconnaît un manque de connexion internet', () => {
    expect(errorMessageKey({ name: 'AuthRetryableFetchError', message: '' })).toBe(
      'errors.network'
    );
    expect(errorMessageKey(new TypeError('Network request failed'))).toBe('errors.network');
    expect(errorMessageKey({ message: 'TypeError: Failed to fetch' })).toBe('errors.network');
  });

  it('donne un message général pour tout le reste', () => {
    expect(errorMessageKey({ code: 'XX000', message: 'boom' })).toBe('errors.unknown');
    expect(errorMessageKey(null)).toBe('errors.unknown');
    expect(errorMessageKey('erreur bizarre')).toBe('errors.unknown');
  });
});
