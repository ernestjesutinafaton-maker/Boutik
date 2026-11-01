import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-provider';

import { AuthLayout } from './auth-layout';
import { BigButton } from './big-button';
import { Notice } from './notice';

/**
 * Le propriétaire a retiré cette personne de l'équipe : son compte ne voit plus rien de la
 * boutique (le serveur a coupé sa synchronisation). Se déconnecter efface aussi les données
 * gardées dans l'appareil.
 */
export function AccessRemovedScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  return (
    <AuthLayout title={t('accessRemoved.title')}>
      <Notice message={t('accessRemoved.text')} />
      <BigButton icon="logout" onPress={() => signOut()}>
        {t('account.signOut')}
      </BigButton>
    </AuthLayout>
  );
}
