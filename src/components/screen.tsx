import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SubscriptionBanner } from '@/subscription/subscription-banner';
import { useAppTheme } from '@/theme/paper-theme';

import { ActiveMemberBar } from './active-member-bar';
import { SyncStatusBanner } from './sync-status-banner';
import { UpdateBanner } from './update-banner';

type ScreenProps = {
  /** Titre de l'écran */
  title: string;
  /**
   * Écran « empilé » (fiche, formulaire…) : le titre et le bouton retour sont dans la
   * barre du haut. Sinon (rubrique principale), le titre est écrit en grand dans la page.
   */
  stack?: boolean;
  /** Ne pas faire défiler (pour les écrans qui ont leur propre liste) */
  scroll?: boolean;
  children: ReactNode;
};

/**
 * Cadre commun à tous les écrans : bandeau de synchronisation, personne active,
 * fond, marges, titre et défilement. Sur grand écran, le contenu est centré
 * avec une largeur limitée pour rester lisible.
 */
export function Screen({ title, stack = false, scroll = true, children }: ScreenProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { spacing, layout } = theme.app;

  const content = (
    <View style={[styles.inner, { maxWidth: layout.contentMaxWidth, gap: spacing.md }]}>
      <UpdateBanner />
      <SyncStatusBanner />
      <SubscriptionBanner />
      <ActiveMemberBar />
      {stack ? null : (
        <Text variant="headlineMedium" style={styles.title}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );

  const containerStyle = [
    styles.content,
    // Sans barre du haut, on laisse la place à la barre d'état du téléphone
    { padding: spacing.md, paddingTop: (stack ? 0 : insets.top) + spacing.md },
  ];

  return (
    <>
      {stack ? <Stack.Screen options={{ title }} /> : null}
      {scroll ? (
        <ScrollView
          style={[styles.fill, { backgroundColor: theme.colors.background }]}
          contentContainerStyle={containerStyle}
          keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      ) : (
        <View style={[styles.fill, containerStyle, { backgroundColor: theme.colors.background }]}>
          {content}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    flexGrow: 1,
  },
  title: {
    fontWeight: '700',
  },
});
