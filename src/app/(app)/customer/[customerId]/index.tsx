import { usePowerSync } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Divider, List, Portal, Text } from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { MoneyText } from '@/components/money-text';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { AgingChip } from '@/customers/aging-chip';
import { archiveCustomer, deleteCustomer, writeOffDebt } from '@/customers/customer-actions';
import { useCustomer, useCustomerLedger } from '@/customers/customer-data';
import { useActionContext } from '@/data/use-action-context';
import { debtAging } from '@/domain/credit';
import { canSeeCustomers } from '@/domain/permissions';
import { formatDay, formatMoment, today } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { openWhatsApp } from '@/invoices/invoice-actions';
import { addToOutbox } from '@/invoices/outbox';
import { reminderText } from '@/invoices/receipt';
import { useCustomerSales } from '@/sales/sale-data';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Fiche client : ce qu'il doit, depuis quand, son carnet, ses achats ; rembourser, relancer. */
export default function CustomerScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const settings = useShopSettings();
  const { can, member } = useActiveMember();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const { customer, isLoading } = useCustomer(customerId);
  const ledger = useCustomerLedger(customerId);
  const sales = useCustomerSales(customerId);
  const [dialog, setDialog] = useState<'writeOff' | 'archive' | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const currency = settings?.currencyCode ?? 'XOF';
  const { spacing } = theme.app;

  if (!canSeeCustomers(member?.roles ?? [])) {
    return (
      <Screen title={t('customers.detailTitle')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }
  if (!customer || !settings) {
    return (
      <Screen title={t('customers.detailTitle')} stack>
        {isLoading ? null : <Notice message={t('common.notFound')} />}
      </Screen>
    );
  }

  const aging = debtAging(ledger, today());
  const reminder = reminderText({
    shopName: settings.name,
    customerName: customer.name,
    balance: customer.balance,
    currency,
    since: aging.oldestUnpaidDay,
  });

  async function remindLater() {
    if (!customer || !settings) return;
    await addToOutbox(db, {
      shopId: settings.id,
      kind: 'reminder',
      customerId: customer.id,
      label: `${customer.name} · ${formatMoney(customer.balance, currency)}`,
    });
    setMessage(t('invoice.queued'));
  }

  async function confirmDialog() {
    if (!context || !customer) return;
    if (dialog === 'writeOff' && customer.balance > 0) {
      await writeOffDebt(db, context, {
        customer,
        amount: customer.balance,
        note: note.trim() || null,
      });
    } else if (dialog === 'archive') {
      // Le propriétaire supprime même un client qui doit encore (la dette est effacée et notée)
      if (can('data.delete')) {
        await deleteCustomer(db, context, customer);
      } else if (customer.balance === 0) {
        await archiveCustomer(db, context, customer);
      }
      router.back();
    }
    setDialog(null);
    setNote('');
  }

  return (
    <Screen title={customer.name} stack>
      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.sm }}>
          <Text variant="titleLarge" style={styles.bold}>
            {customer.name}
          </Text>
          {customer.phone ? <Text variant="bodyLarge">{customer.phone}</Text> : null}
          {customer.notes ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {customer.notes}
            </Text>
          ) : null}
          <Divider />
          <Text variant="titleMedium">
            {customer.balance >= 0 ? t('customers.owes') : t('customers.credit')}
          </Text>
          <MoneyText
            amount={Math.abs(customer.balance)}
            currency={currency}
            size="large"
            tone={customer.balance > 0 ? 'danger' : 'success'}
          />
          <AgingChip aging={aging} />
          {aging.oldestUnpaidDay ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('customers.oldestDebt', {
                date: formatDay(aging.oldestUnpaidDay),
                count: aging.ageDays,
              })}
            </Text>
          ) : null}
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {customer.creditLimit === null
              ? t('customers.noLimit')
              : t('customers.limit', { amount: formatMoney(customer.creditLimit, currency) })}
          </Text>
        </Card.Content>
      </Card>

      {can('credit.repayment') && customer.balance > 0 ? (
        <BigButton
          icon="cash-plus"
          variant="accent"
          onPress={() => router.push(`/customer/${customer.id}/repay`)}>
          {t('customers.repay')}
        </BigButton>
      ) : null}

      {customer.balance > 0 ? (
        <View style={[styles.row, { gap: spacing.sm }]}>
          <BigButton
            icon="whatsapp"
            variant="outline"
            style={styles.fill}
            onPress={() =>
              openWhatsApp(customer.phone, reminder).catch(() => setMessage(t('invoice.error')))
            }>
            {t('customers.remind')}
          </BigButton>
          <BigButton icon="send-clock" variant="outline" style={styles.fill} onPress={remindLater}>
            {t('invoice.later')}
          </BigButton>
        </View>
      ) : null}
      {customer.balance > 0 && !customer.phone ? (
        <Notice tone="info" message={t('customers.noPhone')} />
      ) : null}
      {message ? <Notice tone="info" message={message} /> : null}

      <Card mode="outlined">
        <Card.Title title={t('customers.ledgerTitle')} titleVariant="titleLarge" />
        {ledger.length === 0 ? (
          <Card.Content>
            <Text variant="bodyLarge">{t('customers.ledgerEmpty')}</Text>
          </Card.Content>
        ) : null}
        {ledger.map((entry, index) => (
          <View key={entry.id}>
            {index > 0 ? <Divider /> : null}
            <List.Item
              title={`${t(`customers.ledgerTypes.${entry.type}`)} · ${entry.amount > 0 ? '+' : '−'}${formatMoney(Math.abs(entry.amount), currency)}`}
              titleStyle={{
                fontWeight: '700',
                color: entry.amount > 0 ? theme.app.colors.danger : theme.colors.primary,
              }}
              description={[
                formatMoment(entry.occurredAt),
                entry.invoiceNumber,
                entry.methodLabel,
                entry.memberName,
                entry.note,
              ]
                .filter(Boolean)
                .join(' · ')}
              descriptionNumberOfLines={3}
              onPress={
                entry.saleId
                  ? () => router.push(`/sale/${entry.saleId}`)
                  : entry.paymentId
                    ? () =>
                        router.push({
                          pathname: '/customer/[customerId]/receipt',
                          params: { customerId: customer.id, paymentId: entry.paymentId ?? '' },
                        })
                    : undefined
              }
            />
          </View>
        ))}
      </Card>

      {sales.length > 0 ? (
        <Card mode="outlined">
          <Card.Title title={t('customers.salesTitle')} titleVariant="titleLarge" />
          {sales.slice(0, 20).map((sale, index) => (
            <View key={sale.id}>
              {index > 0 ? <Divider /> : null}
              <List.Item
                title={`${sale.invoiceNumber} · ${formatMoney(sale.total, currency)}`}
                description={formatMoment(sale.occurredAt)}
                titleStyle={sale.status === 'cancelled' ? styles.cancelled : undefined}
                onPress={() => router.push(`/sale/${sale.id}`)}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
              />
            </View>
          ))}
        </Card>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        {can('customers.edit') ? (
          <View style={[styles.row, { gap: spacing.sm }]}>
            <BigButton
              icon="pencil"
              variant="outline"
              style={styles.fill}
              onPress={() => router.push(`/customer/${customer.id}/edit`)}>
              {t('common.edit')}
            </BigButton>
            <BigButton
              icon="notebook-plus"
              variant="outline"
              style={styles.fill}
              onPress={() => router.push(`/customer/${customer.id}/old-debt`)}>
              {t('customers.oldDebt')}
            </BigButton>
          </View>
        ) : null}
        {can('credit.write_off') && customer.balance > 0 ? (
          <Button
            textColor={theme.app.colors.danger}
            icon="eraser"
            onPress={() => setDialog('writeOff')}>
            {t('customers.writeOff')}
          </Button>
        ) : null}
        {can('data.delete') || (can('customers.edit') && customer.balance === 0) ? (
          <Button
            icon="delete-outline"
            textColor={theme.app.colors.danger}
            onPress={() => setDialog('archive')}>
            {t('customers.archive')}
          </Button>
        ) : null}
      </View>

      <Portal>
        <Dialog visible={dialog !== null} onDismiss={() => setDialog(null)}>
          <Dialog.Title>
            {dialog === 'writeOff' ? t('customers.writeOffTitle') : t('customers.archiveTitle')}
          </Dialog.Title>
          <Dialog.Content style={{ gap: spacing.md }}>
            <Text variant="bodyLarge">
              {dialog === 'writeOff'
                ? t('customers.writeOffText', { amount: formatMoney(customer.balance, currency) })
                : customer.balance > 0
                  ? t('customers.archiveTextDebt', {
                      amount: formatMoney(customer.balance, currency),
                    })
                  : t('customers.archiveText')}
            </Text>
            {dialog === 'writeOff' ? (
              <TextField
                label={t('customers.writeOffReason')}
                value={note}
                onChangeText={setNote}
              />
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialog(null)}>{t('common.back')}</Button>
            <Button textColor={theme.app.colors.danger} onPress={confirmDialog}>
              {t('common.confirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bold: {
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  fill: {
    flexGrow: 1,
  },
  cancelled: {
    textDecorationLine: 'line-through',
  },
});
