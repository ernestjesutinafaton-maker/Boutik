import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/paper-theme';

import { SyncStatusBanner } from './sync-status-banner';

type ScreenProps = {
  /** Titre affiché en haut de l'écran */
  title: string;
  children: ReactNode;
};

/**
 * Cadre commun à tous les écrans : bandeau de synchronisation, fond, marges, titre et défilement.
 * Sur grand écran, le contenu est centré avec une largeur limitée pour rester lisible.
 */
export function Screen({ title, children }: ScreenProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { spacing, layout } = theme.app;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[
        styles.content,
        { padding: spacing.md, paddingTop: insets.top + spacing.md },
      ]}>
      <View style={[styles.inner, { maxWidth: layout.contentMaxWidth, gap: spacing.md }]}>
        <SyncStatusBanner />
        <Text variant="headlineMedium" style={styles.title}>
          {title}
        </Text>
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
  },
  title: {
    fontWeight: '700',
  },
});
