import Constants from 'expo-constants';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { Button, Dialog, List, Portal, SegmentedButtons, Text } from 'react-native-paper';

import { usePowerSync } from '@powersync/react';
import { router } from 'expo-router';

import { Card } from '@/components/card';
import { useAuth } from '@/auth/auth-provider';
import { BigButton } from '@/components/big-button';
import { Icon3D } from '@/components/icon-3d';
import { Screen } from '@/components/screen';
import { deviceName } from '@/device/device';
import { useOutbox } from '@/invoices/outbox';
import { useIsPlatformAdmin } from '@/subscription/subscription-data';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';
import { useThemePreference } from '@/theme/theme-preference';

/** Rubrique « Plus » : mon compte, réglages et accès aux autres fonctions. */
export default function MoreScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const { session, signOut } = useAuth();
  const { shop, device } = useShop();
  const { can } = useActiveMember();
  const { preference, setPreference } = useThemePreference();
  const outbox = useOutbox();
  const isPlatformAdmin = useIsPlatformAdmin();
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
        <Card.Title
          title={t('account.title')}
          titleVariant="titleLarge"
          left={() => <Icon3D name="locked" size={36} />}
        />
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

      {can('cash.session') || can('cash.expense') || can('reports.account') ? (
        <Card mode="outlined">
          {can('cash.session') || can('cash.expense') ? (
            <List.Item
              title={t('cash.title')}
              titleStyle={{ fontWeight: '700' }}
              description={t('more.cashHelp')}
              left={(props) => <Icon3D name="coin" style={props.style} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/cash')}
            />
          ) : null}
          {can('reports.account') || can('cash.session') ? (
            <List.Item
              title={t('report.archivesTitle')}
              titleStyle={{ fontWeight: '700' }}
              description={t('more.reportsHelp')}
              left={(props) => <Icon3D name="bar-chart" style={props.style} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/report')}
            />
          ) : null}
        </Card>
      ) : null}

      <Card mode="outlined">
        <List.Item
          title={t('history.title')}
          titleStyle={{ fontWeight: '700' }}
          description={t('more.salesHelp')}
          left={(props) => <Icon3D name="receipt" style={props.style} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/sale')}
        />
        <List.Item
          title={t('printer.title')}
          titleStyle={{ fontWeight: '700' }}
          description={t('more.printerHelp')}
          left={(props) => <Icon3D name="printer" style={props.style} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/printer')}
        />
        {outbox.length > 0 ? (
          <List.Item
            title={t('history.outbox', { count: outbox.length })}
            titleStyle={{ fontWeight: '700', color: theme.app.colors.accent }}
            left={(props) => <Icon3D name="outbox" style={props.style} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/sale/outbox')}
          />
        ) : null}
      </Card>

      {can('settings.manage') || can('reports.account') ? (
        <Card mode="outlined">
          {can('settings.manage') ? (
            <List.Item
              title={t('subscription.title')}
              titleStyle={{ fontWeight: '700' }}
              description={t('subscription.menuHelp')}
              left={(props) => <Icon3D name="crown" style={props.style} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/subscription')}
            />
          ) : null}
          {isPlatformAdmin ? (
            <List.Item
              title={t('subscription.adminMenu')}
              titleStyle={{ fontWeight: '700' }}
              description={t('subscription.adminTitle')}
              left={(props) => <Icon3D name="shield" style={props.style} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/admin-payments')}
            />
          ) : null}
          {can('settings.manage') ? (
            <List.Item
              title={t('settings.title')}
              titleStyle={{ fontWeight: '700' }}
              description={t('settings.menuHelp')}
              left={(props) => <Icon3D name="gear" style={props.style} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/settings')}
            />
          ) : null}
          {can('reports.account') ? (
            <List.Item
              title={t('audit.title')}
              titleStyle={{ fontWeight: '700' }}
              description={t('audit.menuHelp')}
              left={(props) => <Icon3D name="scroll" style={props.style} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/history')}
            />
          ) : null}
          {can('reports.account') ? (
            <List.Item
              title={t('export.title')}
              titleStyle={{ fontWeight: '700' }}
              description={t('export.menuHelp')}
              left={(props) => <Icon3D name="bookmark-tabs" style={props.style} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/export')}
            />
          ) : null}
        </Card>
      ) : null}

      <Card mode="outlined">
        <List.Item
          title={t('guide.menu')}
          titleStyle={{ fontWeight: '700' }}
          description={t('guide.menuHelp')}
          left={(props) => <Icon3D name="light-bulb" style={props.style} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/guide')}
        />
      </Card>

      {can('settings.manage') ? (
        <Card mode="outlined">
          <List.Item
            title={t('demo.menu')}
            titleStyle={{ fontWeight: '700' }}
            description={t('demo.menuHelp')}
            left={(props) => <Icon3D name="store" style={props.style} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/demo')}
          />
        </Card>
      ) : null}

      {can('team.manage') ? (
        <Card mode="outlined">
          <List.Item
            title={t('more.users')}
            titleStyle={{ fontWeight: '700' }}
            description={t('more.usersHelp')}
            left={(props) => <Icon3D name="team" style={props.style} />}
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
