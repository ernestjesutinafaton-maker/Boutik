import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { isLimited } from '@/domain/subscription';

import { useSubscription } from './subscription-data';

/** Vrai si les fonctions avancées sont limitées (abonnement expiré depuis plus de 7 jours). */
export function useIsLimited(): boolean {
  const status = useSubscription();
  return status !== null && isLimited(status);
}

/** Message affiché à la place d'une fonction avancée quand l'abonnement est expiré. */
export function LimitedNotice() {
  const { t } = useTranslation();
  return (
    <>
      <Notice message={t('subscription.limited')} />
      <BigButton icon="crown" variant="accent" onPress={() => router.push('/subscription')}>
        {t('subscription.banner.action')}
      </BigButton>
    </>
  );
}
