import 'i18next';

import type { fr } from './fr';

// Fait connaître à TypeScript la liste des clés de traduction :
// une faute de frappe dans t('...') sera signalée comme une erreur.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof fr };
  }
}
