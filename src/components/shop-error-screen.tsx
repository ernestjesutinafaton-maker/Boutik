import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'react-native-paper';

import { useAuth } from '@/auth/auth-provider';
import { useShop } from '@/shop/shop-provider';

import { AuthLayout } from './auth-layout';
import { BigButton } from './big-button';
import { Notice } from './notice';

/** Affiché quand la boutique n'a pas pu être chargée (pas de réseau lors de la première ouverture). */
export function ShopErrorScreen() {
  const { t } = useTranslation();
  const { reload } = useShop();
  const { signOut } = useAuth();
  const [isRetrying, setIsRetrying] = useState(false);

  function handleRetry() {
    setIsRetrying(true);
    reload();
    // Le bouton redevient cliquable après un court instant, si le réseau manque toujours
    setTimeout(() => setIsRetrying(false), 1500);
  }

  async function handleSignOut() {
    await signOut();
  }

  return (
    <AuthLayout title={t('shopError.title')}>
      <Notice message={t('shopError.description')} />
      <BigButton icon="refresh" onPress={handleRetry} loading={isRetrying} disabled={isRetrying}>
        {t('shopError.retry')}
      </BigButton>
      <Button mode="text" onPress={handleSignOut}>
        {t('account.signOut')}
      </Button>
    </AuthLayout>
  );
}
