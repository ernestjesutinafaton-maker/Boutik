import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

// Au-delà de cette largeur (en points), on considère qu'on est sur un grand
// écran : tablette ou ordinateur. Servira à l'étape 3 pour adapter la mise en page.
const LARGE_SCREEN_MIN_WIDTH = 768;

/** Nom de la plateforme en français, pour vérifier que le MÊME code tourne partout. */
function getPlatformLabel(): string {
  switch (Platform.OS) {
    case 'android':
      return 'Android';
    case 'ios':
      return 'iPhone / iPad';
    case 'web':
      return 'Navigateur web';
    default:
      return Platform.OS;
  }
}

/** Premier écran de l'application (fichier « index » = écran d'accueil). */
export default function HomeScreen() {
  // Largeur actuelle de l'écran : elle change si on tourne la tablette
  // ou si on redimensionne la fenêtre du navigateur.
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= LARGE_SCREEN_MIN_WIDTH;

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>Boutik</Text>
        <Text style={styles.subtitle}>Stock · Caisse · Crédit</Text>

        <View style={styles.separator} />

        <Text style={styles.success}>✅ Le projet fonctionne !</Text>
        <Text style={styles.info}>Plateforme : {getPlatformLabel()}</Text>
        <Text style={styles.info}>
          Écran : {Math.round(width)} points de large ({isLargeScreen ? 'grand écran' : 'petit écran'})
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.primary,
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  separator: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  success: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  info: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
