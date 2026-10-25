import {
  configureFonts,
  MD3DarkTheme,
  MD3LightTheme,
  type MD3Theme,
  useTheme,
} from 'react-native-paper';

import { fontSize, layout, palette, type Palette, radius, spacing, touch } from './tokens';

/**
 * Traduit nos couleurs « Vert Commerce » dans le format de React Native Paper
 * (la bibliothèque qui fournit les boutons, champs, cartes…).
 */

/** Textes un peu plus grands que ceux prévus par Paper, pour bien lire. */
const fonts = configureFonts({
  config: {
    bodyLarge: { fontSize: 18, lineHeight: 26 },
    bodyMedium: { fontSize: 16, lineHeight: 24 },
    labelLarge: { fontSize: 16, lineHeight: 22 },
    titleMedium: { fontSize: 18, lineHeight: 26 },
  },
});

function buildTheme(base: MD3Theme, colors: Palette, isDark: boolean) {
  return {
    ...base,
    dark: isDark,
    fonts,
    colors: {
      ...base.colors,
      primary: colors.primary,
      onPrimary: colors.onPrimary,
      primaryContainer: colors.primaryContainer,
      onPrimaryContainer: colors.onPrimaryContainer,
      // Paper appelle « secondary » et « tertiary » ce que nous appelons « accent »
      secondary: colors.accent,
      onSecondary: colors.onAccent,
      secondaryContainer: colors.accentContainer,
      onSecondaryContainer: colors.onAccentContainer,
      tertiary: colors.accent,
      onTertiary: colors.onAccent,
      tertiaryContainer: colors.accentContainer,
      onTertiaryContainer: colors.onAccentContainer,
      // Paper appelle « error » ce que nous appelons « danger »
      error: colors.danger,
      onError: colors.onDanger,
      errorContainer: colors.dangerContainer,
      onErrorContainer: colors.onDangerContainer,
      background: colors.background,
      onBackground: colors.text,
      surface: colors.surface,
      onSurface: colors.text,
      surfaceVariant: colors.surfaceVariant,
      onSurfaceVariant: colors.textSecondary,
      outline: colors.border,
      outlineVariant: colors.border,
      inversePrimary: colors.primaryContainer,
      elevation: {
        level0: 'transparent',
        level1: colors.elevation1,
        level2: colors.elevation2,
        level3: colors.elevation3,
        level4: colors.elevation4,
        level5: colors.elevation5,
      },
    },
    /** Nos propres valeurs, que Paper ne connaît pas : on les range ici. */
    app: { colors, spacing, radius, fontSize, touch, layout },
  };
}

export const lightTheme = buildTheme(MD3LightTheme, palette.light, false);
export const darkTheme = buildTheme(MD3DarkTheme, palette.dark, true);

export type AppTheme = typeof lightTheme;

/** À utiliser dans les écrans pour lire le thème actuel (clair ou sombre). */
export const useAppTheme = () => useTheme<AppTheme>();
