import type { StyleProp, TextStyle } from 'react-native';
import { Text } from 'react-native-paper';

import { DEFAULT_CURRENCY } from '@/config/defaults';
import { type CurrencyCode, formatMoney } from '@/domain/money';
import { useAppTheme } from '@/theme/paper-theme';

type MoneyTextProps = {
  /** Montant en nombre entier, dans la plus petite unité de la monnaie (voir money.ts) */
  amount: number;
  currency?: CurrencyCode;
  /** normal = gros chiffres, large = très gros chiffres (total à payer) */
  size?: 'normal' | 'large';
  /** primary = vert, danger = rouge (dettes), default = couleur du texte */
  tone?: 'default' | 'primary' | 'danger';
  style?: StyleProp<TextStyle>;
};

/** Affiche un montant en gros chiffres, au bon format : « 32 000 FCFA ». */
export function MoneyText({
  amount,
  currency = DEFAULT_CURRENCY,
  size = 'normal',
  tone = 'default',
  style,
}: MoneyTextProps) {
  const theme = useAppTheme();
  const { colors, fontSize } = theme.app;

  const color = { default: colors.text, primary: colors.primary, danger: colors.danger }[tone];
  const textSize = size === 'large' ? fontSize.amountLarge : fontSize.amount;

  return (
    <Text
      style={[
        {
          color,
          fontSize: textSize,
          lineHeight: Math.round(textSize * 1.2),
          fontWeight: '800',
          // Chiffres de même largeur : les montants restent bien alignés
          fontVariant: ['tabular-nums'],
        },
        style,
      ]}>
      {formatMoney(amount, currency)}
    </Text>
  );
}
