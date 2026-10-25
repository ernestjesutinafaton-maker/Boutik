import Constants from 'expo-constants';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { Button, Card, Dialog, List, Portal, SegmentedButtons, Text } from 'react-native-paper';

import { usePowerSync } from '@powersync/react';
import { router } from 'expo-router';

import { useAuth } from '@/auth/auth-provider';
import { BigButton } from '@/components/big-button';
import type { IconName } from '@/components/icon-name';
import { Screen } from '@/components/screen';
import { deviceName } from '@/device/device';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';
import { useThemePreference } from '@/theme/theme-preference';

/** Les rubriques qui viendront s'ajouter ici, avec l'étape du plan où elles seront faites. */
const UPCOMING = [
  { labelKey: 'more.cashSession', icon: 'cash-multiple', step: 15 },
  { labelKey: 'more.history', icon: 'history', step: 17 },
  { labelKey: 'more.shopSettings', icon: 'store-cog', step: 17 },
  { labelKey: 'more.export', icon: 'file-excel', step: 17 },
] as const satisfies readonly { labelKey: `more.${string}`; icon: IconName; step: number }[];

/** Rubrique « Plus » : mon compte, réglages et accès aux autres fonctions. */
export default function MoreScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const { session, signOut } = useAuth();
  const { shop, device } = useShop();
  const { can } = useActiveMember();
  const { preference, setPreference } = useThemePreference();
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  // Nombre d'opérations pas encore envoyées qui empêchent la déconnexion (0 = rien de bloqué)
  const [blockingCount, setBlockingCount] = useState(0);
  const version = Constants.expoConfig?.version ?? '';

  /** Se déconnecter efface la base locale : on refuse s'il reste des opérations à envoyer. */
  async function requestSignOut() {
    const stats = await db.getUploadQueueStats();
    if (stats.count > 0) {
      setBlockingCount(stats.count);
    } else {
      setIsSignOutDialogOpen(true);
    }
  }

  async function handleSignOut() {
    setIsSignOutDialogOpen(false);
    await signOut();
  }

  return (
    <Screen title={t('nav.more')}>
      <Card mode="outlined">
        <Card.Title title={t('account.title')} titleVariant="titleLarge" />
        <Card.Content style={{ gap: theme.app.spacing.sm }}>
          <Text variant="bodyLarge">{session?.user.email}</Text>
          {shop ? (
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('account.shop', { name: shop.name })}
            </Text>
          ) : null}
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {device?.number
              ? t('account.device', { name: deviceName, number: device.number })
              : t('account.deviceNotRegistered', { name: deviceName })}
          </Text>
          <BigButton variant="outline" icon="logout" onPress={requestSignOut}>
            {t('account.signOut')}
          </BigButton>
        </Card.Content>
      </Card>

      {can('team.manage') ? (
        <Card mode="outlined">
          <List.Item
            title={t('more.users')}
            titleStyle={{ fontWeight: '700' }}
            description={t('more.usersHelp')}
            left={(props) => <List.Icon {...props} icon="account-key" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/team')}
          />
        </Card>
      ) : null}

      <Card mode="outlined">
        <Card.Title title={t('more.appearance')} titleVariant="titleLarge" />
        <Card.Content style={{ gap: theme.app.spacing.md }}>
          <SegmentedButtons
            value={preference}
            onValueChange={setPreference}
            buttons={[
              { value: 'light', label: t('more.themeLight'), icon: 'weather-sunny' },
              { value: 'dark', label: t('more.themeDark'), icon: 'weather-night' },
              { value: 'system', label: t('more.themeSystem'), icon: 'theme-light-dark' },
            ]}
          />
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('more.themeHelp')}
          </Text>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Title title={t('more.upcoming')} titleVariant="titleLarge" />
        {UPCOMING.map((item) => (
          <List.Item
            key={item.labelKey}
            title={t(item.labelKey)}
            description={t('comingSoon.plannedStep', { step: item.step })}
            left={(props) => <List.Icon {...props} icon={item.icon} />}
          />
        ))}
      </Card>

      <Text variant="bodyMedium" style={[styles.version, { color: theme.colors.onSurfaceVariant }]}>
        {t('more.version', { version })}
      </Text>

      <Portal>
        <Dialog visible={isSignOutDialogOpen} onDismiss={() => setIsSignOutDialogOpen(false)}>
          <Dialog.Title>{t('account.signOutConfirmTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyLarge">{t('account.signOutConfirmText')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsSignOutDialogOpen(false)}>{t('account.cancel')}</Button>
            <Button textColor={theme.app.colors.danger} onPress={handleSignOut}>
              {t('account.signOut')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={blockingCount > 0} onDismiss={() => setBlockingCount(0)}>
          <Dialog.Title>{t('account.signOutBlockedTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyLarge">
              {t('account.signOutBlockedText', { count: blockingCount })}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setBlockingCount(0)}>{t('account.ok')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  version: {
    textAlign: 'center',
  },
});
