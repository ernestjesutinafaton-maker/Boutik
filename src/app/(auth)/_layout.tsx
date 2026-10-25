import { Stack } from 'expo-router';

// L'écran de connexion est le premier écran de ce groupe (« anchor » = point d'ancrage)
export const unstable_settings = {
  anchor: 'sign-in',
};

/** Groupe des écrans accessibles sans être connecté : connexion et inscription. */
export default function AuthGroupLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
