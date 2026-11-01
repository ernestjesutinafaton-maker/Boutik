import { usePowerSync } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Divider, List, Text } from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { MoneyText } from '@/components/money-text';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { openCashSession } from '@/cash/cash-actions';
import { useSessionMovements, useSessionTotals } from '@/cash/cash-data';
import { useActionContext } from '@/data/use-action-context';
import { cashMovementSign, expectedByMethod } from '@/domain/cash';
import { formatMoment, formatTime } from '@/domain/dates';
import { formatMoney, parseMoney } from '@/domain/money';
import { EXPENSE_LABELS } from '@/reports/report-html';
import { useOpenCashSession } from '@/sales/cash-session-data';
import { usePaymentMethods } from '@/sales/payment-methods';
import { useShop } from '@/shop/shop-provider';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** La caisse du jour de cet appareil : ouverture, argent attendu, dépenses, clôture. */
export default function CashScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { device } = useShop();
  const settings = useShopSettings();
  const { can } = useActiveMember();
  const methods = usePaymentMethods();
  const deviceId = device?.number ? device.id : null;
  const { session, isLoading } = useOpenCashSession(deviceId);
  const totals = useSessionTotals(session?.id ?? null);
  const movements = useSessionMovements(session?.id ?? null);
  const [floatText, setFloatText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const currency = settings?.currencyCode ?? 'XOF';
  const { spacing } = theme.app;

  if (!can('cash.session') && !can('cash.expense')) {
    return (
      <Screen title={t('cash.title')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }
  if (!deviceId) {
    return (
      <Screen title={t('cash.title')} stack>
        <Notice message={t('checkout.deviceNotRegistered')} />
      </Screen>
    );
  }

  async function handleOpen() {
    if (!context) return;
    const openingFloat = floatText.trim() ? parseMoney(floatText, currency) : 0;
    if (openingFloat === null) {
      setError(t('errors.priceInvalid'));
      return;
    }
    setError(null);
    setIsOpening(true);
    try {
      await openCashSession(db, context, openingFloat);
      setFloatText('');
    } catch (openError) {
      console.warn('Ouverture de la caisse impossible :', openError);
      setError(t('errors.unknown'));
    } finally {
      setIsOpening(false);
    }
  }

  if (!session) {
    return (
      <Screen title={t('cash.title')} stack>
        {isLoading ? null : (
          <>
            <Notice tone="info" message={t('cash.closedHelp')} />
            {can('cash.session') ? (
              <Card mode="outlined">
                <Card.Content style={{ gap: spacing.md }}>
                  <TextField
                    label={t('cash.openingFloat')}
                    value={floatText}
                    onChangeText={setFloatText}
                    keyboardType="numeric"
                  />
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    {t('cash.openingFloatHelp')}
                  </Text>
                  {error ? <Notice message={error} /> : null}
                  <BigButton
                    icon="lock-open-variant"
                    onPress={handleOpen}
                    loading={isOpening}
                    disabled={isOpening}>
                    {t('cash.open')}
                  </BigButton>
                </Card.Content>
              </Card>
            ) : (
              <Notice message={t('cash.askCashier')} />
            )}
            <BigButton
              icon="archive-clock"
              variant="outline"
              onPress={() => router.push('/report')}>
              {t('report.archivesTitle')}
            </BigButton>
          </>
        )}
      </Screen>
    );
  }

  const expected = expectedByMethod({
    openingFloat: session.openingFloat,
    cashMethodId: methods.find((method) => method.isCash)?.id ?? null,
    payments: totals.payments,
    movements: totals.movements,
  });

  return (
    <Screen title={t('cash.title')} stack>
      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.xs }}>
          <Text variant="titleMedium" style={styles.bold}>
            {t('cash.openSince', { date: formatMoment(session.openedAt) })}
          </Text>
          {session.openedByName ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('cash.openedBy', { name: session.openedByName })}
            </Text>
          ) : null}
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('cash.float', { amount: formatMoney(session.openingFloat, currency) })}
          </Text>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Title title={t('cash.expectedTitle')} titleVariant="titleLarge" />
        <Card.Content style={{ gap: spacing.sm }}>
          {methods.map((method) => (
            <View key={method.id} style={styles.between}>
              <Text variant="bodyLarge">{method.label}</Text>
              <MoneyText
                amount={expected[method.id] ?? 0}
                currency={currency}
                style={{ fontSize: theme.app.fontSize.title }}
              />
            </View>
          ))}
        </Card.Content>
      </Card>

      <View style={[styles.row, { gap: spacing.sm }]}>
        {can('cash.expense') ? (
          <BigButton
            icon="cash-minus"
            variant="outline"
            style={styles.fill}
            onPress={() => router.push('/cash/movement')}>
            {t('cash.addMovement')}
          </BigButton>
        ) : null}
        {can('cash.session') ? (
          <BigButton
            icon="lock-check"
            variant="accent"
            style={styles.fill}
            onPress={() => router.push('/cash/close')}>
            {t('cash.closeDay')}
          </BigButton>
        ) : null}
      </View>
      {can('delivery.handover') ? (
        <BigButton icon="moped" variant="outline" onPress={() => router.push('/delivery/cash')}>
          {t('deliveries.cash.title')}
        </BigButton>
      ) : null}

      <Card mode="outlined">
        <Card.Title title={t('cash.movementsTitle')} titleVariant="titleLarge" />
        {movements.length === 0 ? (
          <Card.Content>
            <Text variant="bodyLarge">{t('cash.noMovements')}</Text>
          </Card.Content>
        ) : null}
        {movements.map((movement, index) => (
          <View key={movement.id}>
            {index > 0 ? <Divider /> : null}
            <List.Item
              title={`${
                movement.type === 'handover' && movement.courierName
                  ? t('deliveries.handoverOf', { name: movement.courierName })
                  : t(`cash.types.${movement.type}`)
              } · ${cashMovementSign(movement.type) > 0 ? '+' : '−'}${formatMoney(movement.amount, currency)}`}
              titleStyle={styles.bold}
              description={[
                formatTime(movement.occurredAt),
                movement.category ? EXPENSE_LABELS[movement.category] : null,
                movement.methodLabel,
                movement.note,
                movement.memberName,
              ]
                .filter(Boolean)
                .join(' · ')}
              descriptionNumberOfLines={3}
            />
          </View>
        ))}
      </Card>

      <BigButton icon="archive-clock" variant="outline" onPress={() => router.push('/report')}>
        {t('report.archivesTitle')}
      </BigButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bold: {
    fontWeight: '700',
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  fill: {
    flexGrow: 1,
  },
});
