import type { ComponentProps } from 'react';
import { Card as PaperCard } from 'react-native-paper';

import { useAppTheme } from '@/theme/paper-theme';

type CardProps = ComponentProps<typeof PaperCard>;

/**
 * La carte de Boutik : coins bien arrondis, contour léger et ombre douce teintée de violet
 * (un peu de relief). S'utilise exactement comme la carte de React Native Paper.
 */
function AppCard({ style, ...rest }: CardProps) {
  const theme = useAppTheme();
  const { colors, effects, radius } = theme.app;

  return (
    <PaperCard
      {...rest}
      style={[
        { borderRadius: radius.lg, borderColor: colors.border, boxShadow: effects.cardShadow },
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
