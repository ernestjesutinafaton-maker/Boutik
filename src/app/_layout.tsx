// Charge les traductions avant tout le reste
import '@/i18n';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/auth/auth-provider';
import { ShopErrorScreen } from '@/components/shop-error-screen';
import { ShopProvider, useShop } from '@/shop/shop-provider';
import { ThemePreferenceProvider } from '@/theme/theme-preference';

// L'écran de démarrage (le vert, avec le logo) reste affiché
// tant qu'on ne sait pas encore qui est connecté.
SplashScreen.preventAutoHideAsync();

/**
 * Mise en page racine : elle entoure TOUS les écrans de l'application.
 * Elle applique le thème, suit la connexion et la boutique, puis affiche le bon écran.
 */
export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <AuthProvider>
        <ShopProvider>
          <RootNavigator />
        </ShopProvider>
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
function RootNavigator() {
  const { session, isLoading } = useAuth();
  const { status } = useShop();
  const isSignedIn = session !== null;
  const isReady = !isLoading && (!isSignedIn || status !== 'loading');

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

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isSignedIn && status === 'ready'}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && status === 'none'}>
        <Stack.Screen name="create-shop" />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
