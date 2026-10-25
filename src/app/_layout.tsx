// Charge les traductions avant tout le reste
import '@/i18n';

import { Stack } from 'expo-router';

import { ThemePreferenceProvider } from '@/theme/theme-preference';

/**
 * Mise en page racine : elle entoure TOUS les écrans de l'application.
 * Elle applique le thème (clair ou sombre) puis affiche les écrans en « pile ».
 * Plus tard s'ajouteront ici : la connexion, la base locale, la synchronisation…
 */
export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemePreferenceProvider>
  );
}
