import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { Card, List, SegmentedButtons, Text } from 'react-native-paper';

import type { IconName } from '@/components/icon-name';
import { Screen } from '@/components/screen';
import { useAppTheme } from '@/theme/paper-theme';
import { useThemePreference } from '@/theme/theme-preference';

/** Les rubriques qui viendront s'ajouter ici, avec l'étape du plan où elles seront faites. */
const UPCOMING = [
  { labelKey: 'more.users', icon: 'account-key', step: 7 },
  { labelKey: 'more.cashSession', icon: 'cash-multiple', step: 15 },
  { labelKey: 'more.history', icon: 'history', step: 17 },
  { labelKey: 'more.shopSettings', icon: 'store-cog', step: 17 },
  { labelKey: 'more.export', icon: 'file-excel', step: 17 },
] as const satisfies readonly { labelKey: `more.${string}`; icon: IconName; step: number }[];

/** Rubrique « Plus » : réglages et accès aux autres fonctions. */
export default function MoreScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { preference, setPreference } = useThemePreference();
  const version = Constants.expoConfig?.version ?? '';

  return (
    <Screen title={t('nav.more')}>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  version: {
    textAlign: 'center',
  },
});
