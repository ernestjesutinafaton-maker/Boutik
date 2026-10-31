import { usePowerSync } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { MoneyText } from '@/components/money-text';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { recordRepayment } from '@/customers/customer-actions';
import { useCustomer } from '@/customers/customer-data';
import { useActionContext } from '@/data/use-action-context';
import { formatMoney, formatMoneyInput, parseMoney } from '@/domain/money';
import { usePaymentMethods } from '@/sales/payment-methods';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Remboursement d'un client (même partiel) : l'argent entre en caisse, la dette baisse. */
export default function RepayScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const settings = useShopSettings();
  const { can } = useActiveMember();
  const methods = usePaymentMethods();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const { customer } = useCustomer(customerId);
  const [amountText, setAmountText] = useState('');
  const [receivedText, setReceivedText] = useState('');
  const [methodId, setMethodId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const currency = settings?.currencyCode ?? 'XOF';
  const { spacing } = theme.app;

  if (!can('credit.repayment')) {
    return (
      <Screen title={t('repay.title')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }
  if (!customer) {
    return (
      <Screen title={t('repay.title')} stack>
        {null}
      </Screen>
    );
  }

  const method = methods.find((candidate) => candidate.id === methodId) ?? methods[0];
  const amount = parseMoney(amountText, currency);
  const received =
    method?.isCash && receivedText.trim() ? parseMoney(receivedText, currency) : null;
  const change = amount !== null && received !== null ? received - amount : 0;

  async function handleSave() {
    if (!context || !customer || !method) {
      return;
    }
    if (amount === null || amount <= 0) {
      setError(t('repay.amountInvalid'));
      return;
    }
    if (amount > customer.balance) {
      setError(t('repay.moreThanDebt', { amount: formatMoney(customer.balance, currency) }));
      return;
    }
    if (received !== null && received < amount) {
      setError(t('repay.notEnoughCash'));
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const paymentId = await recordRepayment(db, context, {
        customer,
        amount,
        methodId: method.id,
        cashReceived: method.isCash ? (received ?? amount) : null,
        changeGiven: method.isCash ? Math.max(change, 0) : null,
      });
      router.replace({
        pathname: '/customer/[customerId]/receipt',
        params: { customerId: customer.id, paymentId, created: '1' },
      });
    } catch (saveError) {
      console.warn('Remboursement impossible :', saveError);
      setError(t('errors.unknown'));
      setIsSaving(false);
    }
  }

  return (
    <Screen title={t('repay.title')} stack>
      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.xs }}>
          <Text variant="titleMedium">{t('repay.owes', { name: customer.name })}</Text>
          <MoneyText amount={customer.balance} currency={currency} tone="danger" />
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.md }}>
          <TextField
            label={t('repay.amount')}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="numeric"
            autoFocus
          />
          <Chip
            icon="cash-check"
            style={styles.start}
            onPress={() => setAmountText(formatMoneyInput(customer.balance, currency))}>
            {t('repay.all', { amount: formatMoney(customer.balance, currency) })}
          </Chip>
          <Text variant="titleMedium">{t('repay.method')}</Text>
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            {methods.map((candidate) => (
              <Chip
                key={candidate.id}
                selected={candidate.id === method?.id}
                onPress={() => setMethodId(candidate.id)}>
                {candidate.label}
              </Chip>
            ))}
          </View>
          {method?.isCash ? (
            <TextField
              label={t('repay.received')}
              value={receivedText}
              onChangeText={setReceivedText}
              keyboardType="numeric"
            />
          ) : null}
          {change > 0 ? (
            <View style={styles.between}>
              <Text variant="titleMedium">{t('checkout.change')}</Text>
              <MoneyText amount={change} currency={currency} tone="primary" />
            </View>
          ) : null}
          {amount !== null && amount > 0 && amount <= customer.balance ? (
            <Text variant="bodyLarge">
              {t('repay.after', { amount: formatMoney(customer.balance - amount, currency) })}
            </Text>
          ) : null}
        </Card.Content>
      </Card>

      {error ? <Notice message={error} /> : null}
      <BigButton
        icon="check-bold"
        variant="accent"
        onPress={handleSave}
        loading={isSaving}
        disabled={isSaving}>
        {t('repay.save')}
      </BigButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  start: {
    alignSelf: 'flex-start',
  },
});
