// Charge les traductions avant tout le reste
import '@/i18n';

import { Nunito_500Medium } from '@expo-google-fonts/nunito/500Medium';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { AuthProvider, useAuth } from '@/auth/auth-provider';
import { ShopErrorScreen } from '@/components/shop-error-screen';
import { PowerSyncProvider } from '@/db/powersync-provider';
import { ShopProvider, useShop } from '@/shop/shop-provider';
import { ThemePreferenceProvider } from '@/theme/theme-preference';
import { fontFamily } from '@/theme/tokens';

// L'écran de démarrage (avec le logo) reste affiché
// tant qu'on ne sait pas encore qui est connecté.
SplashScreen.preventAutoHideAsync();

/**
 * La police Nunito, en 3 épaisseurs : moyen (texte), gras et extra-gras (titres).
 * Seulement celles qui servent : moins de fichiers à charger au démarrage.
 */
const BRAND_FONT = [
  {
    fontFamily: fontFamily.brand,
    fontDefinitions: [
      { path: Nunito_500Medium, weight: 500 },
      { path: Nunito_700Bold, weight: 700 },
      { path: Nunito_800ExtraBold, weight: 800 },
    ],
  },
];

/** Au-delà de ce délai (internet lent, sur le web), on démarre avec la police du téléphone. */
const FONT_WAIT_MS = 3000;

/**
 * Mise en page racine : elle entoure TOUS les écrans de l'application.
 * Elle charge la police, applique le thème, suit la connexion, ouvre la base locale
 * (PowerSync), charge la boutique, puis affiche le bon écran.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(BRAND_FONT);
  const [fontWaitOver, setFontWaitOver] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFontWaitOver(true), FONT_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (fontError) {
      // Pas grave : l'application garde la police du téléphone
      console.warn('Police Nunito indisponible :', fontError);
    }
  }, [fontError]);

  return (
    <ThemePreferenceProvider brandFont={fontsLoaded}>
      <AuthProvider>
        <PowerSyncProvider>
          <ShopProvider>
            <RootNavigator fontsSettled={fontsLoaded || fontError !== null || fontWaitOver} />
          </ShopProvider>
        </PowerSyncProvider>
      </AuthProvider>
    </ThemePreferenceProvider>
  );
}

/**
 * Choisit les écrans accessibles selon la situation :
 *   - pas connecté               → connexion / inscription
 *   - connecté, sans boutique    → création de la boutique
 *   - connecté, avec sa boutique → l'application (Caisse, Produits…)
 */
function RootNavigator({ fontsSettled }: { fontsSettled: boolean }) {
  const { session, isLoading } = useAuth();
  const { status } = useShop();
  const isSignedIn = session !== null;
  const isReady = fontsSettled && !isLoading && (!isSignedIn || status !== 'loading');

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null; // l'écran de démarrage est encore affiché
  }
  if (isSignedIn && status === 'error') {
    return <ShopErrorScreen />;
  }

  // L'écran où envoyer la personne selon sa situation. On le dit explicitement à chaque
  // groupe protégé (« redirectTo ») : sinon Expo Router enverrait vers l'adresse du groupe
  // « (auth) », qui n'a pas d'écran d'entrée (→ « Page could not be found »).
  const home = !isSignedIn ? '/sign-in' : status === 'ready' ? '/' : '/create-shop';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isSignedIn && status === 'ready'} redirectTo={home}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && status === 'none'} redirectTo={home}>
        <Stack.Screen name="create-shop" />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn} redirectTo={home}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      {/* Page publique, accessible connecté ou non */}
      <Stack.Screen name="telecharger" />
    </Stack>
  );
}
