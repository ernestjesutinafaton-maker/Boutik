import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/theme/paper-theme';
import type { ButtonLook } from '@/theme/tokens';

import type { IconName } from './icon-name';

type BigButtonVariant = 'primary' | 'accent' | 'danger' | 'outline';

type BigButtonProps = {
  children: ReactNode;
  onPress?: () => void;
  icon?: IconName;
  /**
   * primary = violet (action normale), accent = orange (action importante),
   * danger = rouge (action risquée), outline = discret (action secondaire)
   */
  variant?: BigButtonVariant;
  /** Action en cours : roue qui tourne, et le bouton ne réagit plus (pas de double envoi) */
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Hauteur de la « tranche » du bouton : il s'enfonce d'autant quand on appuie. */
const EDGE = 4;

/**
 * Gros bouton en relief (3D douce), facile à toucher, utilisé dans toute l'application :
 * un dégradé, une tranche plus foncée en dessous et un reflet en haut. Il s'enfonce
 * quand on appuie, comme une vraie touche.
 */
export function BigButton({
  children,
  onPress,
  icon,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: BigButtonProps) {
  const theme = useAppTheme();
  const { colors, effects, radius, spacing, touch, fontSize } = theme.app;
  const look: ButtonLook = effects.button[variant];
  const isGreyed = disabled && !loading;
  const textColor = isGreyed ? colors.textSecondary : look.text;
  const highlight = variant === 'outline' ? '' : `, ${effects.buttonHighlight}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: touch.minHeight,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.lg,
          gap: spacing.sm,
        },
        isGreyed
          ? { backgroundColor: colors.surfaceVariant }
          : {
              backgroundImage: look.gradient,
              borderWidth: look.border ? 2 : 0,
              borderColor: look.border,
              boxShadow: pressed
                ? `0px 1px 0px ${look.edge}${highlight}`
                : `0px ${EDGE}px 0px ${look.edge}, 0px 10px 18px -6px ${look.glow}${highlight}`,
              transform: [{ translateY: pressed ? EDGE - 1 : 0 }],
            },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : icon ? (
        <Icon source={icon} size={24} color={textColor} />
      ) : null}
      <Text
        numberOfLines={2}
        style={[
          styles.label,
          { color: textColor, fontSize: fontSize.large, lineHeight: fontSize.large + 6 },
        ]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  label: {
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
});
