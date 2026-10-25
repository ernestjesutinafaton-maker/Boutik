import type { TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import type { IconName } from '@/components/icon-name';
import { useAppTheme } from '@/theme/paper-theme';

// « ref » est retiré du type : Expo Router le transmet quand même, et il arrive
// tel quel sur le Pressable grâce à « ...pressableProps ».
type NavButtonProps = Omit<TabTriggerSlotProps, 'ref'> & {
  icon: IconName;
  label: string;
  /** bottom = barre du bas (téléphone), side = menu sur le côté (grand écran) */
  placement: 'bottom' | 'side';
};

/**
 * Un bouton du menu. Expo Router lui indique s'il correspond à l'écran affiché
 * (isFocused) : il est alors surligné en vert.
 */
export function NavButton({
  icon,
  label,
  placement,
  isFocused,
  ...pressableProps
}: NavButtonProps) {
  const theme = useAppTheme();
  const { colors, spacing, radius, touch, fontSize } = theme.app;
  const isSide = placement === 'side';
  const color = isFocused ? colors.onPrimaryContainer : colors.textSecondary;

  return (
    <Pressable
      {...pressableProps}
      style={({ pressed }) => [
        isSide ? styles.side : styles.bottom,
        {
          minHeight: touch.minHeight,
          borderRadius: radius.md,
          gap: isSide ? spacing.md : spacing.xs,
          paddingHorizontal: isSide ? spacing.md : spacing.xs,
        },
        isFocused && { backgroundColor: colors.primaryContainer },
        pressed && styles.pressed,
      ]}>
      <Icon source={icon} size={isSide ? 26 : 28} color={color} />
      <Text
        numberOfLines={1}
        style={{
          color,
          fontSize: isSide ? fontSize.body : fontSize.small,
          fontWeight: isFocused ? '700' : '500',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bottom: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  side: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
