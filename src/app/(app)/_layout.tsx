import { Stack, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PinLockScreen } from '@/components/pin-lock-screen';
import { isBlocked } from '@/domain/subscription';
import { CatalogProvider } from '@/products/catalog-provider';
import { useProofUploader } from '@/deliveries/delivery-proofs';
import { usePhotoUploader } from '@/products/photos';
import { CartProvider } from '@/sales/cart-provider';
import { SubscriptionBlockedScreen } from '@/subscription/blocked-screen';
import { useSubscriptionState } from '@/subscription/subscription-data';
import { ActiveMemberProvider, useActiveMember } from '@/team/active-member-provider';

/**
 * Tous les écrans de l'application, une fois connecté avec une boutique.
 * Sur un appareil partagé, l'écran « Qui êtes-vous ? » s'affiche à la place
 * tant que personne n'a tapé son code PIN.
 * Boutique en pause (abonnement expiré) : seul « Mon abonnement » reste ouvert.
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
  const subscription = useSubscriptionState();
  const pathname = usePathname();
  // Les photos de produits prises hors ligne partent dès qu'internet revient
  usePhotoUploader();
  // Les photos des reçus des livreurs aussi (stockage privé)
  useProofUploader();

  if (!isReady || subscription.isLoading) {
    return null; // on ne sait pas encore qui est actif ni si la boutique est ouverte
  }
  if (isLocked) {
    return <PinLockScreen />;
  }
  if (subscription.status && isBlocked(subscription.status) && pathname !== '/subscription') {
    return <SubscriptionBlockedScreen since={subscription.status.since} />;
  }

  return (
    <Stack screenOptions={{ headerBackTitle: t('common.back') }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
