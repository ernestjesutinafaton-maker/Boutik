import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, Divider, List, Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { MoneyText } from '@/components/money-text';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { StatusChip } from '@/components/status-chip';
import { TextField } from '@/components/text-field';
import {
  SUBSCRIPTION_OPERATORS,
  SUBSCRIPTION_PAYEE,
  type SubscriptionOperator,
} from '@/config/subscription';
import { formatDay, formatMoment, toDay } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { DURATIONS, type Duration, TIERS } from '@/domain/subscription';
import { supabase } from '@/lib/supabase';
import { useShop } from '@/shop/shop-provider';
import { fetchQuote, type Quote, useSubscription } from '@/subscription/subscription-data';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

type Payment = {
  id: string;
  months: number;
  amount: number;
  operator: string;
  reference: string;
  status: 'pending' | 'validated' | 'rejected';
  created_at: string;
};

/** Mon abonnement : état, prix du moment, comment payer, déclarer un paiement. */
export default function SubscriptionScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { shop } = useShop();
  const { can } = useActiveMember();
  const status = useSubscription();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [months, setMonths] = useState<Duration>(1);
  const [operator, setOperator] = useState<SubscriptionOperator>('mtn');
  const [phone, setPhone] = useState('');
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const { spacing } = theme.app;
  const shopId = shop?.id ?? null;

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    fetchQuote(shopId)
      .then((value) => !cancelled && setQuote(value))
      .catch(() => !cancelled && setMessage({ text: t('subscription.offline'), tone: 'error' }));
    supabase
      .from('subscription_payments')
      .select('id, months, amount, operator, reference, status, created_at')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => !cancelled && setPayments((data ?? []) as Payment[]));
    return () => {
      cancelled = true;
    };
  }, [shopId, reload, t]);

  if (!can('settings.manage')) {
    return (
      <Screen title={t('subscription.title')} stack>
        <Notice message={t('subscription.ownerOnly')} />
      </Screen>
    );
  }

  async function declare() {
    if (!shopId) return;
    if (phone.trim().length < 6 || reference.trim().length < 3) {
      setMessage({ text: t('subscription.missing'), tone: 'error' });
      return;
    }
    setIsSaving(true);
    setMessage(null);
    const { error } = await supabase.rpc('declare_subscription_payment', {
      p_shop_id: shopId,
      p_months: months,
      p_operator: operator,
      p_sender_phone: phone.trim(),
      p_reference: reference.trim(),
    });
    setIsSaving(false);
    if (error) {
      setMessage({ text: t('subscription.declareError'), tone: 'error' });
      return;
    }
    setPhone('');
    setReference('');
    setMessage({ text: t('subscription.declared'), tone: 'info' });
    setReload((value) => value + 1);
  }

  const statusLabel = status
    ? status.state === 'trial'
      ? t('subscription.states.trial', {
          date: formatDay(toDay(status.until)),
          count: status.daysLeft,
        })
      : status.state === 'active'
        ? t('subscription.states.active', { date: formatDay(toDay(status.until)) })
        : status.state === 'grace'
          ? t('subscription.states.grace', { count: status.daysLeft })
          : t('subscription.states.expired')
    : '';
  const tone =
    status?.state === 'active' ? 'ok' : status?.state === 'expired' ? 'danger' : 'warning';

  return (
    <Screen title={t('subscription.title')} stack>
      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.sm }}>
          {status ? <StatusChip tone={tone} label={statusLabel} /> : null}
          <Text variant="titleMedium">{t('subscription.currentPrice')}</Text>
          {quote ? (
            <>
              <MoneyText amount={quote.monthlyPrice} tone="primary" size="large" />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {quote.reason === 'welcome'
                  ? t('subscription.welcome')
                  : t('subscription.tierReason', {
                      amount: formatMoney(quote.averageRevenue, 'XOF'),
                    })}
              </Text>
            </>
          ) : (
            <Text variant="bodyLarge">…</Text>
          )}
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Title title={t('subscription.rulesTitle')} titleVariant="titleLarge" />
        <Card.Content style={{ gap: spacing.xs }}>
          <Text variant="bodyMedium">{t('subscription.rules')}</Text>
          {TIERS.map((tier) => (
            <View key={tier.monthlyPrice} style={styles.between}>
              <Text variant="bodyLarge" style={styles.fill}>
                {tier.label}
              </Text>
              <Text variant="bodyLarge" style={styles.bold}>
                {formatMoney(tier.monthlyPrice, 'XOF')}
              </Text>
            </View>
          ))}
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('subscription.neverBlocked')}
          </Text>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Title title={t('subscription.howToPay')} titleVariant="titleLarge" />
        <Card.Content style={{ gap: spacing.md }}>
          <Text variant="bodyLarge">
            {t('subscription.sendTo', {
              amount: formatMoney((quote?.monthlyPrice ?? 0) * months, 'XOF'),
            })}
          </Text>
          <View
            style={[
              styles.payee,
              {
                borderRadius: theme.app.radius.md,
                padding: spacing.md,
                backgroundColor: theme.app.colors.primaryContainer,
              },
            ]}>
            <Text
              variant="headlineSmall"
              style={[styles.bold, { color: theme.app.colors.onPrimaryContainer }]}>
              {SUBSCRIPTION_PAYEE.number}
            </Text>
            <Text variant="bodyLarge" style={{ color: theme.app.colors.onPrimaryContainer }}>
              {SUBSCRIPTION_PAYEE.holder} · {SUBSCRIPTION_PAYEE.operatorName}
            </Text>
          </View>

          <Text variant="titleMedium">{t('subscription.duration')}</Text>
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            {DURATIONS.map((value) => (
              <Chip key={value} selected={value === months} onPress={() => setMonths(value)}>
                {t('subscription.months', { count: value })}
              </Chip>
            ))}
          </View>
          <Text variant="titleMedium">{t('subscription.paidWith')}</Text>
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            {SUBSCRIPTION_OPERATORS.map((item) => (
              <Chip
                key={item.code}
                selected={item.code === operator}
                onPress={() => setOperator(item.code)}>
                {item.label}
              </Chip>
            ))}
          </View>
          <TextField
            label={t('subscription.senderPhone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <TextField
            label={t('subscription.reference')}
            value={reference}
            onChangeText={setReference}
            autoCapitalize="characters"
          />
          {message ? <Notice tone={message.tone} message={message.text} /> : null}
          <BigButton
            icon="check-decagram"
            onPress={declare}
            loading={isSaving}
            disabled={isSaving || !quote}>
            {t('subscription.declare')}
          </BigButton>
        </Card.Content>
      </Card>

      {payments.length > 0 ? (
        <Card mode="outlined">
          <Card.Title title={t('subscription.history')} titleVariant="titleLarge" />
          {payments.map((payment, index) => (
            <View key={payment.id}>
              {index > 0 ? <Divider /> : null}
              <List.Item
                title={`${formatMoney(Number(payment.amount), 'XOF')} · ${t('subscription.months', { count: payment.months })}`}
                description={`${formatMoment(payment.created_at)} · ${payment.reference}`}
                right={() => (
                  <View style={styles.center}>
                    <StatusChip
                      tone={
                        payment.status === 'validated'
                          ? 'ok'
                          : payment.status === 'rejected'
                            ? 'danger'
                            : 'warning'
                      }
                      label={t(`subscription.paymentStatus.${payment.status}`)}
                    />
                  </View>
                )}
              />
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fill: { flex: 1 },
  bold: { fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  payee: { alignItems: 'center', gap: 4 },
  center: { justifyContent: 'center' },
});
