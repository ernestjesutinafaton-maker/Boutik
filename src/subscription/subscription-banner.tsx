import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { formatDay, toDay } from '@/domain/dates';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

import { useSubscription } from './subscription-data';

/**
 * Rappel d'abonnement (propriétaire seulement) : fin de l'essai, paiement en vérification,
 * délai de grâce avant la pause. Une boutique en pause a son propre écran (blocked-screen).
 */
export function SubscriptionBanner() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { can } = useActiveMember();
  const status = useSubscription();

  if (!status || !can('settings.manage')) return null;
  const text =
    status.state === 'trial' && status.daysLeft <= 5
      ? t('subscription.banner.trial', { count: status.daysLeft })
      : status.state === 'provisional'
        ? t('subscription.banner.provisional', { date: formatDay(toDay(status.until)) })
        : status.state === 'grace'
          ? t('subscription.banner.grace', { count: status.daysLeft })
          : null;
  if (!text) return null;
  // Moins de 3 jours avant la pause : en rouge
  const danger = status.state === 'grace' && status.daysLeft <= 3;
  const color = danger ? theme.app.colors.onDangerContainer : theme.app.colors.onAccentContainer;
  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: danger
            ? theme.app.colors.dangerContainer
            : theme.app.colors.accentContainer,
          borderRadius: theme.app.radius.md,
          padding: theme.app.spacing.sm,
          gap: theme.app.spacing.sm,
        },
      ]}>
      <Icon source="crown" size={22} color={color} />
      <Text variant="bodyMedium" style={[styles.text, { color }]}>
        {text}
      </Text>
      <Button mode="contained" compact onPress={() => router.push('/subscription')}>
        {t('subscription.banner.action')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  text: { flex: 1, minWidth: 160 },
});
