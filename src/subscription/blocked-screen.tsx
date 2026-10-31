import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { useAuth } from '@/auth/auth-provider';
import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { Icon3D } from '@/components/icon-3d';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { formatDay, toDay } from '@/domain/dates';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/**
 * Boutique en pause : l'essai ou l'abonnement est terminé depuis plus de 7 jours, sans paiement.
 * Tout est bloqué sauf « Mon abonnement » (réservé au propriétaire). Les données restent
 * gardées, dans l'appareil comme sur le serveur : tout revient dès que le paiement est validé.
 */
export function SubscriptionBlockedScreen({ since }: { since: Date }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { can, usesPin, lock } = useActiveMember();
  const { spacing } = theme.app;
  const isOwner = can('settings.manage');

  return (
    <Screen title={t('subscription.blocked.title')}>
      <Card mode="outlined">
        <Card.Content style={[styles.center, { gap: spacing.md, paddingVertical: spacing.lg }]}>
          <Icon3D name="locked" size={72} />
          <Text variant="headlineSmall" style={[styles.bold, styles.centered]}>
            {t('subscription.blocked.heading')}
          </Text>
          <Text variant="bodyLarge" style={styles.centered}>
            {t('subscription.blocked.text', { date: formatDay(toDay(since)) })}
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.centered, { color: theme.colors.onSurfaceVariant }]}>
            {t('subscription.blocked.dataKept')}
          </Text>
        </Card.Content>
      </Card>
      {isOwner ? (
        <BigButton icon="crown" variant="accent" onPress={() => router.push('/subscription')}>
          {t('subscription.blocked.pay')}
        </BigButton>
      ) : (
        <Notice tone="info" message={t('subscription.blocked.askOwner')} />
      )}
      {usesPin ? (
        <BigButton icon="account-switch" variant="outline" onPress={lock}>
          {t('subscription.blocked.switchUser')}
        </BigButton>
      ) : null}
      {/* Les vendeurs (code PIN) utilisent le compte du propriétaire : se déconnecter fermerait
          l'appareil entier. Réservé au propriétaire. */}
      {isOwner ? (
        <Button icon="logout" onPress={signOut}>
          {t('subscription.blocked.signOut')}
        </Button>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  bold: {
    fontWeight: '700',
  },
});
