import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { fr } from './fr';

/**
 * Système de traduction (i18n).
 *
 * Tous les textes affichés viennent des fichiers de langue (pour l'instant « fr.ts »).
 * Pour ajouter l'anglais : créer « en.ts » avec les mêmes clés, puis l'ajouter
 * dans « resources » ci-dessous.
 */
export const resources = {
  fr: { translation: fr },
} as const;

const i18n = createInstance();

// « initReactI18next » rend les traductions disponibles dans tous les écrans (useTranslation)
i18n.use(initReactI18next).init({
  resources,
  lng: 'fr', // l'interface est en français
  fallbackLng: 'fr',
  initAsync: false, // les textes sont déjà dans l'application : inutile d'attendre
  interpolation: {
    escapeValue: false, // React protège déjà l'affichage
  },
});

export default i18n;
