import {
  configureFonts,
  MD3DarkTheme,
  MD3LightTheme,
  type MD3Theme,
  useTheme,
} from 'react-native-paper';

import {
  depth,
  type Effects,
  effects,
  fontFamily,
  fontSize,
  layout,
  palette,
  type Palette,
  radius,
  spacing,
  touch,
} from './tokens';

/**
 * Traduit nos couleurs « Vert Boutik 3D » dans le format de React Native Paper
 * (la bibliothèque qui fournit les boutons, champs, cartes…).
 */

/** Textes un peu plus grands que ceux prévus par Paper, pour bien lire. */
const systemFonts = configureFonts({
  config: {
    bodyLarge: { fontSize: 18, lineHeight: 26 },
    bodyMedium: { fontSize: 16, lineHeight: 24 },
    labelLarge: { fontSize: 16, lineHeight: 22 },
    titleMedium: { fontSize: 18, lineHeight: 26 },
  },
});

/** L'épaisseur de chaque sorte de texte avec la police Nunito (titres bien marqués). */
const BRAND_WEIGHTS: Partial<Record<keyof typeof systemFonts, '500' | '700' | '800'>> = {
  displayLarge: '800',
  displayMedium: '800',
  displaySmall: '800',
  headlineLarge: '800',
  headlineMedium: '800',
  headlineSmall: '800',
  titleLarge: '800',
  titleMedium: '700',
  titleSmall: '700',
  labelLarge: '700',
  labelMedium: '700',
  labelSmall: '700',
};

/** Les mêmes tailles, avec la police Nunito (une fois chargée). */
const brandFonts = Object.fromEntries(
  Object.entries(systemFonts).map(([variant, font]) => [
    variant,
    {
      ...font,
      fontFamily: fontFamily.brand,
      fontWeight: BRAND_WEIGHTS[variant as keyof typeof systemFonts] ?? '500',
    },
  ])
) as typeof systemFonts;

function buildTheme(
  base: MD3Theme,
  colors: Palette,
  look: Effects,
  isDark: boolean,
  withBrandFont: boolean
) {
  return {
    ...base,
    dark: isDark,
    fonts: withBrandFont ? brandFonts : systemFonts,
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
      // Contour des champs (bien visible) ; traits de séparation (discrets)
      outline: colors.outline,
      outlineVariant: colors.border,
      inversePrimary: colors.primaryContainer,
      shadow: colors.nightMid,
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
    app: { colors, effects: look, depth, spacing, radius, fontSize, touch, layout },
  };
}

export const lightTheme = buildTheme(MD3LightTheme, palette.light, effects.light, false, false);
export const darkTheme = buildTheme(MD3DarkTheme, palette.dark, effects.dark, true, false);
/** Les mêmes thèmes, avec la police Nunito (utilisés dès qu'elle est chargée). */
export const lightBrandTheme = buildTheme(MD3LightTheme, palette.light, effects.light, false, true);
export const darkBrandTheme = buildTheme(MD3DarkTheme, palette.dark, effects.dark, true, true);

export type AppTheme = typeof lightTheme;

/** À utiliser dans les écrans pour lire le thème actuel (clair ou sombre). */
export const useAppTheme = () => useTheme<AppTheme>();
