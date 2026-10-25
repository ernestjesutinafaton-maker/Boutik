import { Stack } from 'expo-router';

// L'écran de connexion est le premier écran de ce groupe
export const unstable_settings = {
  initialRouteName: 'sign-in',
};

/** Groupe des écrans accessibles sans être connecté : connexion et inscription. */
export default function AuthGroupLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
