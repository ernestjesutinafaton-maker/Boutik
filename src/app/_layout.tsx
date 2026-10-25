import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/**
 * Mise en page racine : elle entoure TOUS les écrans de l'application.
 *
 * Pour l'instant, c'est une simple « pile » d'écrans, sans barre de titre.
 * La vraie navigation (onglets en bas sur téléphone, menu sur le côté
 * sur grand écran) arrivera à l'étape 3.
 */
export default function RootLayout() {
  return (
    <>
      {/* Icônes de la barre d'état (heure, batterie…) en foncé, car le fond est clair */}
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
