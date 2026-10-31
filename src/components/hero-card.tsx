import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import type { CurrencyCode } from '@/domain/money';
import { useAppTheme } from '@/theme/paper-theme';

import { Icon3D, type Icon3DName } from './icon-3d';
import { MoneyText } from './money-text';

type HeroCardProps = {
  /** Le nom du chiffre principal (« Chiffre d'affaires ») */
  label: string;
  amount: number;
  currency: CurrencyCode;
  icon?: Icon3DName;
  /** Les chiffres secondaires, en petites pastilles sous le montant */
  details?: { label: string; value: string }[];
};

/**
 * La grande carte des chiffres clés : fond « nuit violette » en dégradé, montant en
 * blanc et en très gros, icône 3D. Elle attire l'œil en haut du tableau de bord.
 */
export function HeroCard({ label, amount, currency, icon, details = [] }: HeroCardProps) {
  const theme = useAppTheme();
  const { colors, effects, radius, spacing } = theme.app;

  return (
    <View
      style={[
        {
          backgroundColor: colors.night,
          backgroundImage: effects.heroGradient,
          boxShadow: effects.heroShadow,
          borderRadius: radius.xl,
          padding: spacing.lg,
          gap: spacing.md,
        },
      ]}>
      <View style={[styles.top, { gap: spacing.md }]}>
        <View style={[styles.fill, { gap: spacing.xs }]}>
          <Text variant="titleMedium" style={{ color: colors.onNightSecondary }}>
            {label}
          </Text>
          <MoneyText
            amount={amount}
            currency={currency}
            size="large"
            style={{ color: colors.onNight }}
          />
        </View>
        {icon ? <Icon3D name={icon} size={72} /> : null}
      </View>
      {details.length > 0 ? (
        <View style={[styles.details, { gap: spacing.sm }]}>
          {details.map((detail) => (
            <View
              key={detail.label}
              style={[
                styles.detail,
                {
                  backgroundColor: colors.nightSurface,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                },
              ]}>
              <Text variant="bodyMedium" style={{ color: colors.onNightSecondary }}>
                {detail.label}
              </Text>
              <Text variant="titleMedium" style={[styles.bold, { color: colors.onNight }]}>
                {detail.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fill: {
    flex: 1,
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detail: {
    flexGrow: 1,
    flexBasis: 130,
  },
  bold: {
    fontWeight: '800',
  },
});
