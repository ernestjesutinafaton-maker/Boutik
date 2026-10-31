import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
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
   * primary = vert (action normale), accent = orange (action importante),
   * danger = rouge (action risquée), outline = discret (action secondaire)
   */
  variant?: BigButtonVariant;
  /** Action en cours : roue qui tourne, et le bouton ne réagit plus (pas de double envoi) */
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * Gros bouton en relief (3D), facile à toucher, utilisé dans toute l'application.
 * Il est fait de deux couches : la tranche (foncée) et le dessus (dégradé de lumière avec
 * un reflet). Quand on appuie, le dessus descend sur la tranche, comme une vraie touche.
 * Aucune ombre floue : rapide même sur les vieux téléphones.
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
  const { colors, effects, depth, radius, spacing, touch, fontSize } = theme.app;
  const look: ButtonLook = effects.button[variant];
  const isGreyed = disabled && !loading;
  const textColor = isGreyed ? colors.textSecondary : look.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      accessibilityLabel={accessibilityLabel}
      // La tranche : visible sous le dessus, sur l'épaisseur du relief
      style={[
        {
          borderRadius: radius.lg,
          paddingBottom: depth.button,
          backgroundColor: isGreyed ? 'transparent' : look.edge,
        },
        style,
      ]}>
      {({ pressed }) => (
        <View
          style={[
            styles.top,
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
                },
            // Appuyé : le dessus descend presque jusqu'au bas de la tranche
            pressed && { transform: [{ translateY: depth.button - 1 }] },
          ]}>
          {isGreyed ? null : (
            <View
              style={[
                styles.shine,
                {
                  borderTopLeftRadius: radius.lg,
                  borderTopRightRadius: radius.lg,
                  backgroundImage: effects.buttonShine,
                },
              ]}
            />
          )}
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
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  // Le reflet : la moitié haute du bouton, un peu plus claire
  shine: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  label: {
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
});
