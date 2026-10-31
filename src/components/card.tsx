import type { ComponentProps } from 'react';
import { Card as PaperCard } from 'react-native-paper';

import { useAppTheme } from '@/theme/paper-theme';

/** Les réglages de la carte de Paper, sauf le mode et l'élévation (c'est le relief Boutik). */
type CardProps = Omit<ComponentProps<typeof PaperCard>, 'mode' | 'elevation'> & {
  /** Ignoré : toutes les cartes ont le même relief */
  mode?: 'outlined' | 'contained' | 'elevated';
};

/**
 * La carte de Boutik, en relief : coins bien arrondis, contour léger et une tranche plus
 * foncée en bas (elle semble posée sur l'écran). Pas d'ombre floue : rapide partout.
 * S'utilise exactement comme la carte de React Native Paper (le « mode » est ignoré).
 */
function AppCard({ style, mode: _mode, ...rest }: CardProps) {
  const theme = useAppTheme();
  const { colors, effects, depth, radius } = theme.app;

  return (
    <PaperCard
      {...rest}
      mode="contained"
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          borderBottomWidth: depth.card,
          borderBottomColor: effects.cardEdge,
        },
        style,
      ]}
    />
  );
}

export const Card = Object.assign(AppCard, {
  Title: PaperCard.Title,
  Content: PaperCard.Content,
  Actions: PaperCard.Actions,
  Cover: PaperCard.Cover,
});
