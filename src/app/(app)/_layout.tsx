import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PinLockScreen } from '@/components/pin-lock-screen';
import { CatalogProvider } from '@/products/catalog-provider';
import { usePhotoUploader } from '@/products/photos';
import { CartProvider } from '@/sales/cart-provider';
import { ActiveMemberProvider, useActiveMember } from '@/team/active-member-provider';

/**
 * Tous les écrans de l'application, une fois connecté avec une boutique.
 * Sur un appareil partagé, l'écran « Qui êtes-vous ? » s'affiche à la place
 * tant que personne n'a tapé son code PIN.
 */
export default function AppLayout() {
  return (
    // Le catalogue est lu une seule fois, pour tous les écrans
    <CatalogProvider>
      <ActiveMemberProvider>
        <CartProvider>
          <AppStack />
        </CartProvider>
      </ActiveMemberProvider>
    </CatalogProvider>
  );
}

function AppStack() {
  const { t } = useTranslation();
  const { isReady, isLocked } = useActiveMember();
  // Les photos de produits prises hors ligne partent dès qu'internet revient
  usePhotoUploader();

  if (!isReady) {
    return null; // on ne sait pas encore qui est actif : rien ne doit s'afficher
  }
  if (isLocked) {
    return <PinLockScreen />;
  }

  return (
    <Stack screenOptions={{ headerBackTitle: t('common.back') }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
