import type { ReactElement } from 'react';
import { FlatList, Platform, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/paper-theme';

import { Card } from './card';

type CardListProps<T> = {
  data: readonly T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactElement;
  /** Ce qui défile au-dessus de la liste (boutons, recherche, filtres…) */
  header?: ReactElement;
  /** Ce qui s'affiche à la place de la liste quand elle est vide */
  empty?: ReactElement | null;
  /** Ce qui défile sous la liste */
  footer?: ReactElement;
};

/**
 * Une longue liste (produits, clients…) présentée comme une carte en relief.
 *
 * Pour la vitesse, seules les lignes visibles à l'écran (et quelques-unes autour) sont
 * dessinées, même avec des milliers d'articles : la liste reste fluide sur les vieux
 * téléphones. À utiliser dans un écran sans défilement global : <Screen scroll={false}>.
 */
export function CardList<T>({
  data,
  keyExtractor,
  renderItem,
  header,
  empty,
  footer,
}: CardListProps<T>) {
  const theme = useAppTheme();
  const { colors, effects, depth, radius, spacing } = theme.app;
  const last = data.length - 1;

  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      style={styles.fill}
      renderItem={({ item, index }) => (
        // Chaque ligne est un morceau de la carte : bords sur les côtés, coins arrondis
        // en haut pour la première, tranche en relief en bas pour la dernière
        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
            index === 0
              ? {
                  borderTopWidth: 1,
                  borderTopLeftRadius: radius.lg,
                  borderTopRightRadius: radius.lg,
                }
              : { borderTopWidth: StyleSheet.hairlineWidth },
            index === last && {
              borderBottomWidth: depth.card,
              borderBottomColor: effects.cardEdge,
              borderBottomLeftRadius: radius.lg,
              borderBottomRightRadius: radius.lg,
            },
          ]}>
          {renderItem(item)}
        </View>
      )}
      ListHeaderComponent={
        header ? (
          <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>{header}</View>
        ) : undefined
      }
      ListEmptyComponent={
        empty ? (
          <Card mode="outlined">
            <Card.Content style={{ paddingVertical: spacing.lg }}>{empty}</Card.Content>
          </Card>
        ) : undefined
      }
      ListFooterComponent={
        footer ? (
          <View style={{ gap: spacing.md, paddingTop: spacing.md }}>{footer}</View>
        ) : undefined
      }
      contentContainerStyle={{ paddingBottom: spacing.lg }}
      keyboardShouldPersistTaps="handled"
      // Dessiner peu de lignes à la fois : démarrage rapide, peu de mémoire
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      windowSize={7}
      removeClippedSubviews={Platform.OS === 'android'}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  row: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
});
