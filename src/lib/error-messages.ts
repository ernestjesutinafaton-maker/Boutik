import type { TranslationKey } from '@/i18n/keys';

/**
 * Traduit une erreur venue du serveur (Supabase) en message clair, en français,
 * pour l'utilisateur. Renvoie une clé de traduction (voir fr.ts).
 */
export function errorMessageKey(error: unknown): TranslationKey {
  const { code, message, name } = readError(error);

  switch (code) {
    case 'invalid_credentials':
      return 'errors.invalidCredentials';
    case 'user_already_exists':
    case 'email_exists':
      return 'errors.emailAlreadyUsed';
    case 'weak_password':
      return 'errors.weakPassword';
    case 'email_address_invalid':
      return 'errors.emailInvalid';
    case 'email_not_confirmed':
      return 'errors.emailNotConfirmed';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'errors.tooManyAttempts';
    case 'signup_disabled':
      return 'errors.signupDisabled';
  }

  if (isNetworkError(name, message)) {
    return 'errors.network';
  }
  return 'errors.unknown';
}

/** Vrai si l'erreur vient d'un manque de connexion internet. */
function isNetworkError(name: string, message: string): boolean {
  return (
    name === 'AuthRetryableFetchError' ||
    /network request failed|failed to fetch|fetch failed|network ?error|timeout/i.test(message)
  );
}

function readError(error: unknown): { code: string; message: string; name: string } {
  if (typeof error !== 'object' || error === null) {
    return { code: '', message: String(error ?? ''), name: '' };
  }
  const { code, message, name } = error as { code?: unknown; message?: unknown; name?: unknown };
  return {
    code: typeof code === 'string' ? code : '',
    message: typeof message === 'string' ? message : '',
    name: typeof name === 'string' ? name : '',
  };
}
