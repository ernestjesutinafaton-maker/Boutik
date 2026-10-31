import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

import { useOpenCashSession } from './cash-session-data';

/**
 * Rappel « la caisse du jour n'est pas ouverte », en haut de la caisse.
 * On peut quand même vendre ; mais sans caisse ouverte, l'argent ne sera pas
 * compté à la clôture de la journée.
 */
export function CashSessionNotice() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { device } = useShop();
  const { can } = useActiveMember();
  const deviceId = device?.number ? device.id : null;
  const { session, isLoading } = useOpenCashSession(deviceId);

  if (!deviceId || isLoading || session) {
    return null;
  }
  return (
    <Card mode="outlined">
      <Card.Content style={{ gap: theme.app.spacing.sm }}>
        <Notice
          tone="info"
          message={can('cash.session') ? t('cash.notOpen') : t('cash.notOpenAskCashier')}
        />
        {can('cash.session') ? (
          <BigButton icon="lock-open-variant" onPress={() => router.push('/cash')}>
            {t('cash.open')}
          </BigButton>
        ) : null}
      </Card.Content>
    </Card>
  );
}
