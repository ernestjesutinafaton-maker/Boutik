import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, SegmentedButtons, Text } from 'react-native-paper';

import { useAppTheme } from './paper-theme';
import { useThemePreference } from './theme-preference';
import { depth, THEME_COLORS, type ThemeColor, themeEffects } from './tokens';

/**
 * Choisir son style : la couleur (vert, violet ou orangé) et le mode (clair ou sombre).
 *   - compact : sur les écrans de connexion (fond sombre), 3 pastilles et un bouton clair/sombre ;
 *   - full : dans « Plus » → Apparence, les pastilles avec leur nom, et Clair / Sombre / Auto.
 * Le changement est immédiat : on voit tout de suite si le style nous plaît.
 */
export function ThemePicker({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { color, setColor, preference, setPreference } = useThemePreference();
  const { colors, radius, spacing } = theme.app;

  if (variant === 'compact') {
    const isDark = theme.dark;
    return (
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('more.chooseStyle')}
        style={[
          styles.compact,
          {
            gap: spacing.sm,
            backgroundColor: colors.nightSurface,
            borderRadius: radius.pill,
            padding: spacing.xs + 2,
          },
        ]}>
        <Text variant="labelLarge" style={[styles.compactLabel, { color: colors.onNight }]}>
          {t('more.chooseStyle')}
        </Text>
        {THEME_COLORS.map((option) => (
          <Swatch
            key={option}
            option={option}
            size={34}
            selected={option === color}
            ringColor={colors.onNight}
            label={t(`more.colors.${option}`)}
            onPress={() => setColor(option)}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isDark ? t('more.switchToLight') : t('more.switchToDark')}
          onPress={() => setPreference(isDark ? 'light' : 'dark')}
          style={({ pressed }) => [
            styles.modeButton,
            { borderColor: colors.onNightSecondary, opacity: pressed ? 0.7 : 1 },
          ]}>
          <Icon
            source={isDark ? 'weather-sunny' : 'weather-night'}
            size={20}
            color={colors.onNight}
          />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="titleMedium">{t('more.styleTitle')}</Text>
      <View accessibilityRole="radiogroup" style={[styles.options, { gap: spacing.lg }]}>
        {THEME_COLORS.map((option) => {
          const selected = option === color;
          return (
            <View key={option} style={[styles.option, { gap: spacing.xs }]}>
              <Swatch
                option={option}
                size={56}
                selected={selected}
                ringColor={colors.primary}
                label={t(`more.colors.${option}`)}
                onPress={() => setColor(option)}
              />
              <Text
                variant="labelLarge"
                style={{ color: selected ? colors.primary : colors.textSecondary }}>
                {t(`more.colors.${option}`)}
              </Text>
            </View>
          );
        })}
      </View>
      <Text variant="titleMedium">{t('more.modeTitle')}</Text>
      <SegmentedButtons
        value={preference}
        onValueChange={(value) =>
          setPreference(value === 'dark' ? 'dark' : value === 'system' ? 'system' : 'light')
        }
        buttons={[
          { value: 'light', label: t('more.themeLight'), icon: 'weather-sunny' },
          { value: 'dark', label: t('more.themeDark'), icon: 'weather-night' },
          { value: 'system', label: t('more.themeSystem'), icon: 'theme-light-dark' },
        ]}
      />
    </View>
  );
}

/** Une pastille ronde en relief, aux couleurs du thème (coche blanche s'il est choisi). */
function Swatch({
  option,
  size,
  selected,
  ringColor,
  label,
  onPress,
}: {
  option: ThemeColor;
  size: number;
  selected: boolean;
  ringColor: string;
  label: string;
  onPress: () => void;
}) {
  const look = themeEffects[option].light.button.primary;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.ring,
        {
          width: size + 8,
          height: size + 8,
          borderRadius: (size + 8) / 2,
          borderColor: selected ? ringColor : 'transparent',
        },
        pressed && { transform: [{ translateY: 1 }] },
      ]}>
      <View
        style={[
          styles.swatch,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundImage: look.gradient,
            borderBottomWidth: depth.chip + 1,
            borderBottomColor: look.edge,
          },
        ]}>
        {selected ? <Icon source="check-bold" size={size * 0.45} color={look.text} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  compactLabel: {
    marginHorizontal: 8,
  },
  modeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  option: {
    alignItems: 'center',
  },
  ring: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
