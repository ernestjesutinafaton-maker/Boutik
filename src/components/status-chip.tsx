import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/theme/paper-theme';

import type { IconName } from './icon-name';

type StatusChipProps = {
  label: string;
  /** danger = rouge (périmé, dette ancienne), warning = orange (bientôt, stock bas), ok = vert (tout va bien) */
  tone: 'danger' | 'warning' | 'ok' | 'neutral';
  icon?: IconName;
};

/** Petite étiquette colorée : « Stock bas », « Périmé », « + de 30 jours »… */
export function StatusChip({ label, tone, icon }: StatusChipProps) {
  const theme = useAppTheme();
  const { colors, radius, spacing } = theme.app;
  const { backgroundColor, color } = {
    danger: { backgroundColor: colors.dangerContainer, color: colors.onDangerContainer },
    warning: { backgroundColor: colors.accentContainer, color: colors.onAccentContainer },
    ok: { backgroundColor: colors.successContainer, color: colors.onSuccessContainer },
    neutral: { backgroundColor: colors.surfaceVariant, color: colors.textSecondary },
  }[tone];

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.sm + 2,
          gap: spacing.xs,
        },
      ]}>
      {icon ? <Icon source={icon} size={16} color={color} /> : null}
      <Text variant="labelLarge" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
});
