import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { getAppTheme } from './paper-theme';
import { DEFAULT_THEME_COLOR, fontFamily, THEME_COLORS, type ThemeColor } from './tokens';

/** Choix de l'utilisateur : clair (par défaut), sombre, ou comme le réglage du téléphone. */
export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Clés sous lesquelles les choix sont enregistrés dans l'appareil.
 * Sur le web, le site vitrine écrit les mêmes clés : le style choisi sur le site
 * est repris par l'application (même adresse, donc même stockage du navigateur).
 */
export const THEME_MODE_KEY = 'boutik.theme-preference';
export const THEME_COLOR_KEY = 'boutik.theme-color';

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Le thème choisi : vert (par défaut), violet ou orangé */
  color: ThemeColor;
  setColor: (color: ThemeColor) => void;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function isThemeColor(value: unknown): value is ThemeColor {
  return THEME_COLORS.includes(value as ThemeColor);
}

/** Enregistre un choix ; si c'est impossible, il reste valable jusqu'à la fermeture. */
function save(key: string, value: string) {
  AsyncStorage.setItem(key, value).catch(() => undefined);
}

/**
 * Applique le thème (vert, violet ou orangé ; clair ou sombre) à toute l'application
 * et se souvient du choix de l'utilisateur, même hors ligne.
 * brandFont : la police Nunito est chargée (sinon, la police du téléphone en attendant).
 */
export function ThemePreferenceProvider({
  brandFont = false,
  children,
}: {
  brandFont?: boolean;
  children: ReactNode;
}) {
  const systemScheme = useColorScheme();
  // Thème clair par défaut : lisible en plein soleil
  const [preference, setPreferenceState] = useState<ThemePreference>('light');
  const [color, setColorState] = useState<ThemeColor>(DEFAULT_THEME_COLOR);

  // Au démarrage, on relit les choix enregistrés dans l'appareil
  useEffect(() => {
    AsyncStorage.multiGet([THEME_MODE_KEY, THEME_COLOR_KEY])
      .then(([[, savedMode], [, savedColor]]) => {
        if (isThemePreference(savedMode)) setPreferenceState(savedMode);
        if (isThemeColor(savedColor)) setColorState(savedColor);
      })
      .catch(() => {
        // Lecture impossible : pas grave, on garde le thème vert clair
      });
  }, []);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    save(THEME_MODE_KEY, next);
  }

  function setColor(next: ThemeColor) {
    setColorState(next);
    save(THEME_COLOR_KEY, next);
  }

  const isDark = preference === 'dark' || (preference === 'system' && systemScheme === 'dark');
  const paperTheme = getAppTheme(color, isDark, brandFont);

  // Les mêmes couleurs pour la navigation d'Expo Router (fond derrière les écrans…)
  const baseNavigationTheme = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseNavigationTheme,
    // Les titres des barres du haut avec la police de l'application
    fonts: brandFont
      ? {
          regular: { fontFamily: fontFamily.brand, fontWeight: '500' as const },
          medium: { fontFamily: fontFamily.brand, fontWeight: '700' as const },
          bold: { fontFamily: fontFamily.brand, fontWeight: '800' as const },
          heavy: { fontFamily: fontFamily.brand, fontWeight: '800' as const },
        }
      : baseNavigationTheme.fonts,
    colors: {
      ...baseNavigationTheme.colors,
      primary: paperTheme.app.colors.primary,
      background: paperTheme.app.colors.background,
      card: paperTheme.app.colors.surface,
      text: paperTheme.app.colors.text,
      border: paperTheme.app.colors.border,
      notification: paperTheme.app.colors.danger,
    },
  };

  return (
    <ThemePreferenceContext.Provider value={{ preference, setPreference, color, setColor }}>
      <PaperProvider theme={paperTheme}>
        <ThemeProvider value={navigationTheme}>
          {/* Icônes de la barre d'état (heure, batterie…) : foncées sur fond clair, et inversement */}
          <StatusBar style={isDark ? 'light' : 'dark'} />
          {children}
        </ThemeProvider>
      </PaperProvider>
    </ThemePreferenceContext.Provider>
  );
}

/** Pour lire ou changer le thème (couleur, clair ou sombre) depuis un écran. */
export function useThemePreference(): ThemePreferenceContextValue {
  const value = useContext(ThemePreferenceContext);
  if (!value) {
    throw new Error(
      'useThemePreference doit être utilisé à l’intérieur de ThemePreferenceProvider.'
    );
  }
  return value;
}
