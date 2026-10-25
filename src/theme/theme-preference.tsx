import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { darkTheme, lightTheme } from './paper-theme';

/** Choix de l'utilisateur : clair (par défaut), sombre, ou comme le réglage du téléphone. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** Clé sous laquelle le choix est enregistré dans l'appareil. */
const STORAGE_KEY = 'boutik.theme-preference';

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Applique le thème clair ou sombre à toute l'application
 * et se souvient du choix de l'utilisateur, même hors ligne.
 */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  // Thème clair par défaut : lisible en plein soleil
  const [preference, setPreferenceState] = useState<ThemePreference>('light');

  // Au démarrage, on relit le choix enregistré dans l'appareil
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (isThemePreference(saved)) {
          setPreferenceState(saved);
        }
      })
      .catch(() => {
        // Lecture impossible : pas grave, on garde le thème clair
      });
  }, []);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Enregistrement impossible : le choix restera valable jusqu'à la fermeture de l'appli
    });
  }

  const isDark = preference === 'dark' || (preference === 'system' && systemScheme === 'dark');
  const paperTheme = isDark ? darkTheme : lightTheme;

  // Les mêmes couleurs pour la navigation d'Expo Router (fond derrière les écrans…)
  const baseNavigationTheme = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseNavigationTheme,
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
    <ThemePreferenceContext.Provider value={{ preference, setPreference }}>
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

/** Pour lire ou changer le choix du thème depuis un écran. */
export function useThemePreference(): ThemePreferenceContextValue {
  const value = useContext(ThemePreferenceContext);
  if (!value) {
    throw new Error(
      'useThemePreference doit être utilisé à l’intérieur de ThemePreferenceProvider.'
    );
  }
  return value;
}
