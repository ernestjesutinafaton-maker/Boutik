import type { TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
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
 * (isFocused) : il est alors mis en avant par une pilule violette en relief
 * (toute la ligne sur grand écran, l'icône seulement sur téléphone).
 */
export function NavButton({
  icon,
  label,
  placement,
  isFocused,
  ...pressableProps
}: NavButtonProps) {
  const theme = useAppTheme();
  const { colors, effects, spacing, radius, touch, fontSize } = theme.app;
  const isSide = placement === 'side';
  const active = { backgroundImage: effects.navActiveGradient, boxShadow: effects.navActiveShadow };
  const labelColor = !isFocused ? colors.textSecondary : isSide ? colors.onPrimary : colors.primary;
  const iconColor = isFocused ? colors.onPrimary : colors.textSecondary;

  return (
    <Pressable
      {...pressableProps}
      style={({ pressed }) => [
        isSide ? styles.side : styles.bottom,
        {
          minHeight: touch.minHeight,
          borderRadius: radius.md,
          gap: isSide ? spacing.md : 2,
          paddingHorizontal: isSide ? spacing.md : spacing.xs,
        },
        isFocused && isSide && active,
        pressed && styles.pressed,
      ]}>
      <View
        style={[
          !isSide && [styles.iconPill, { borderRadius: radius.pill }],
          isFocused && !isSide && active,
        ]}>
        <Icon source={icon} size={26} color={iconColor} />
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: labelColor,
          fontSize: isSide ? fontSize.body : fontSize.small,
          fontWeight: isFocused ? '800' : '600',
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
  iconPill: {
    width: 60,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
