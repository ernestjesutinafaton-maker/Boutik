import { TabTrigger } from 'expo-router/ui';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/paper-theme';

import { NavButton } from './nav-button';
import { NAV_ITEMS } from './nav-items';

/** Barre de navigation en bas de l'écran (téléphone, petite tablette). */
export function BottomNav() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, spacing } = theme.app;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          gap: spacing.xs,
          paddingTop: spacing.xs,
          paddingHorizontal: spacing.xs,
          // Laisse la place à la barre de gestes du téléphone
          paddingBottom: insets.bottom + spacing.xs,
        },
      ]}>
      {NAV_ITEMS.map((item) => (
        <TabTrigger key={item.name} name={item.name} asChild>
          <NavButton icon={item.icon} label={t(item.shortLabelKey)} placement="bottom" />
        </TabTrigger>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
