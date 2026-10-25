import { usePowerSync } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Portal, Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { MoneyText } from '@/components/money-text';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { closeCashSession } from '@/cash/cash-actions';
import { useSessionTotals } from '@/cash/cash-data';
import { useActionContext } from '@/data/use-action-context';
import { closingDifferences, expectedByMethod } from '@/domain/cash';
import { formatMoney, formatMoneyInput, parseMoney } from '@/domain/money';
import { useOpenCashSession } from '@/sales/cash-session-data';
import { usePaymentMethods } from '@/sales/payment-methods';
import { useShop } from '@/shop/shop-provider';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** « Clôturer la journée » : compter l'argent, voir les écarts, archiver la fiche du jour. */
export default function CloseDayScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { device } = useShop();
  const settings = useShopSettings();
  const { can } = useActiveMember();
  const methods = usePaymentMethods();
  const { session } = useOpenCashSession(device?.number ? device.id : null);
  const totals = useSessionTotals(session?.id ?? null);
  const [countedText, setCountedText] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const currency = settings?.currencyCode ?? 'XOF';
  const { spacing } = theme.app;

  if (!can('cash.session')) {
    return (
      <Screen title={t('cash.closeDay')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }
  if (!session) {
    return (
      <Screen title={t('cash.closeDay')} stack>
        <Notice tone="info" message={t('cash.closedHelp')} />
      </Screen>
    );
  }

  const expected = expectedByMethod({
    openingFloat: session.openingFloat,
    cashMethodId: methods.find((method) => method.isCash)?.id ?? null,
    payments: totals.payments,
    movements: totals.movements,
  });
  // Les modes sans montant attendu ni compté n'apparaissent pas
  const shown = methods.filter(
    (method) => (expected[method.id] ?? 0) !== 0 || method.isCash || countedText[method.id]
  );
  const counted: Record<string, number> = {};
  let invalid = false;
  for (const method of shown) {
    const text = countedText[method.id] ?? '';
    const value = text.trim() ? parseMoney(text, currency) : null;
    if (text.trim() && value === null) invalid = true;
    counted[method.id] = value ?? 0;
  }
  const differences = closingDifferences(expected, counted);
  const allFilled = shown.every((method) => (countedText[method.id] ?? '').trim() !== '');

  async function handleClose() {
    if (!context || !session) return;
    setIsConfirmOpen(false);
    setIsSaving(true);
    try {
      const reportId = await closeCashSession(db, context, {
        sessionId: session.id,
        counted,
        methods,
        notes: notes.trim() || null,
      });
      router.replace(`/report/${reportId}`);
    } catch (closeError) {
      console.warn('Clôture impossible :', closeError);
      setError(t('errors.unknown'));
      setIsSaving(false);
    }
  }

  return (
    <Screen title={t('cash.closeDay')} stack>
      <Notice tone="info" message={t('cash.closeHelp')} />
      {shown.map((method) => {
        const difference = differences.byMethod[method.id] ?? 0;
        const filled = (countedText[method.id] ?? '').trim() !== '';
        return (
          <Card key={method.id} mode="outlined">
            <Card.Title title={method.label} titleVariant="titleLarge" />
            <Card.Content style={{ gap: spacing.sm }}>
              <View style={styles.between}>
                <Text variant="bodyLarge">{t('report.expected')}</Text>
                <Text variant="titleMedium" style={styles.bold}>
                  {formatMoney(expected[method.id] ?? 0, currency)}
                </Text>
              </View>
              <TextField
                label={t('cash.countedLabel')}
                value={countedText[method.id] ?? ''}
                onChangeText={(text) =>
                  setCountedText((current) => ({ ...current, [method.id]: text }))
                }
                keyboardType="numeric"
              />
              <Button
                mode="text"
                compact
                style={styles.start}
                onPress={() =>
                  setCountedText((current) => ({
                    ...current,
                    [method.id]: formatMoneyInput(expected[method.id] ?? 0, currency),
                  }))
                }>
                {t('cash.sameAsExpected')}
              </Button>
              {filled ? (
                <View style={styles.between}>
                  <Text variant="bodyLarge">{t('report.difference')}</Text>
                  <Text
                    variant="titleMedium"
                    style={[
                      styles.bold,
                      {
                        color:
                          difference < 0
                            ? theme.app.colors.danger
                            : difference > 0
                              ? theme.app.colors.accent
                              : theme.colors.primary,
                      },
                    ]}>
                    {difference === 0
                      ? t('cash.noDifference')
                      : `${difference > 0 ? '+' : ''}${formatMoney(difference, currency)}`}
                  </Text>
                </View>
              ) : null}
            </Card.Content>
          </Card>
        );
      })}

      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.sm }}>
          <View style={styles.between}>
            <Text variant="titleMedium">{t('report.totalDifference')}</Text>
            <MoneyText
              amount={differences.total}
              currency={currency}
              tone={differences.total < 0 ? 'danger' : 'primary'}
            />
          </View>
          <TextField label={t('cash.closeNotes')} value={notes} onChangeText={setNotes} multiline />
        </Card.Content>
      </Card>

      {invalid ? <Notice message={t('errors.priceInvalid')} /> : null}
      {error ? <Notice message={error} /> : null}
      <BigButton
        icon="lock-check"
        variant="accent"
        onPress={() => setIsConfirmOpen(true)}
        loading={isSaving}
        disabled={!allFilled || invalid || isSaving}>
        {t('cash.closeDay')}
      </BigButton>

      <Portal>
        <Dialog visible={isConfirmOpen} onDismiss={() => setIsConfirmOpen(false)}>
          <Dialog.Title>{t('cash.closeConfirmTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyLarge">
              {t('cash.closeConfirmText', { amount: formatMoney(differences.total, currency) })}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsConfirmOpen(false)}>{t('common.back')}</Button>
            <Button onPress={handleClose}>{t('common.confirm')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bold: {
    fontWeight: '700',
  },
  start: {
    alignSelf: 'flex-start',
  },
});
