import { TabTrigger } from 'expo-router/ui';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isCourierOnly } from '@/domain/permissions';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

import { NavButton } from './nav-button';
import { visibleNavItems } from './nav-items';

/** Barre de navigation en bas de l'écran (téléphone, petite tablette). */
export function BottomNav() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { member } = useActiveMember();
  const { colors, radius, spacing } = theme.app;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          borderColor: colors.border,
          gap: spacing.xs,
          paddingTop: spacing.sm,
          paddingHorizontal: spacing.xs,
          // Laisse la place à la barre de gestes du téléphone
          paddingBottom: insets.bottom + spacing.xs,
        },
      ]}>
      {visibleNavItems(isCourierOnly(member?.roles ?? [])).map((item) => (
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
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
});
