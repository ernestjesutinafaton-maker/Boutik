import { TabTrigger } from 'expo-router/ui';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/paper-theme';

import { NavButton } from './nav-button';
import { NAV_ITEMS } from './nav-items';

/** Menu sur le côté gauche (grande tablette, ordinateur). */
export function SideNav() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, effects, spacing, layout, fontSize } = theme.app;

  return (
    <View
      style={[
        styles.menu,
        {
          width: layout.sideNavWidth + insets.left,
          backgroundColor: colors.surface,
          boxShadow: effects.cardShadow,
          gap: spacing.xs,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.md,
          paddingLeft: insets.left + spacing.md,
          paddingRight: spacing.md,
        },
      ]}>
      <Text style={[styles.brand, { color: colors.primary, fontSize: fontSize.amount }]}>
        {t('app.name')}
      </Text>
      <Text style={{ color: colors.textSecondary, marginBottom: spacing.lg }}>
        {t('app.tagline')}
      </Text>

      {NAV_ITEMS.map((item) => (
        <TabTrigger key={item.name} name={item.name} asChild>
          <NavButton icon={item.icon} label={t(item.labelKey)} placement="side" />
        </TabTrigger>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    // Au-dessus du contenu, pour que son ombre se voie
    zIndex: 1,
  },
  brand: {
    fontWeight: '800',
  },
});
