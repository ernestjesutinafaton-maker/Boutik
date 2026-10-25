import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { ComingSoon } from '@/components/coming-soon';
import { MoneyText } from '@/components/money-text';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { DEFAULT_CURRENCY } from '@/config/defaults';
import { parseMoney } from '@/domain/money';
import { useAppTheme } from '@/theme/paper-theme';

/**
 * Rubrique « Caisse » (écran d'accueil).
 * Pour l'instant : un essai des composants de base. La vraie caisse arrive à l'étape 11.
 */
export default function SellScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { spacing } = theme.app;

  // Ce que l'utilisateur tape dans le champ « Montant reçu »
  const [amountText, setAmountText] = useState('');
  // Le même montant converti en nombre entier (null si la saisie est invalide)
  const amount = parseMoney(amountText, DEFAULT_CURRENCY);
  const showError = amountText.trim() !== '' && amount === null;

  return (
    <Screen title={t('nav.sell')}>
      <Card mode="outlined">
        <Card.Title title={t('sell.demoTitle')} titleVariant="titleLarge" />
        <Card.Content style={{ gap: spacing.md }}>
          <Text variant="bodyLarge">{t('sell.demoHelp')}</Text>
          <TextField
            label={t('sell.amountLabel')}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="numeric"
            errorMessage={showError ? t('sell.amountInvalid') : null}
          />
          <MoneyText amount={amount ?? 0} size="large" tone="primary" />
          <View style={[styles.buttons, { gap: spacing.sm }]}>
            <BigButton icon="cash-register" style={styles.button}>
              {t('sell.cashIn')}
            </BigButton>
            <BigButton variant="accent" icon="cart-plus" style={styles.button}>
              {t('sell.newSale')}
            </BigButton>
            <BigButton variant="danger" icon="close" style={styles.button}>
              {t('sell.cancel')}
            </BigButton>
          </View>
        </Card.Content>
      </Card>

      <ComingSoon icon="cash-register" description={t('sell.description')} step={11} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  button: {
    flexGrow: 1,
  },
});
