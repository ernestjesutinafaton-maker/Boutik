import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, List, Text, TextInput } from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { CardList } from '@/components/card-list';
import { MoneyText } from '@/components/money-text';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { AgingChip } from '@/customers/aging-chip';
import { useCustomers, useLedgerByCustomer } from '@/customers/customer-data';
import { searchCustomers } from '@/customers/customer-picker';
import { type AgingBucket, debtAging } from '@/domain/credit';
import { Notice } from '@/components/notice';
import { canSeeCustomers } from '@/domain/permissions';
import { today } from '@/domain/dates';
import { formatPhone } from '@/domain/phone';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

type Filter = 'all' | 'debtors' | 'over30' | 'over60';

const FILTER_MATCH: Record<Filter, (bucket: AgingBucket, balance: number) => boolean> = {
  all: () => true,
  debtors: (_bucket, balance) => balance > 0,
  over30: (bucket) => bucket === 'over30' || bucket === 'over60',
  over60: (bucket) => bucket === 'over60',
};

/**
 * Rubrique « Clients » : la liste, ceux qui doivent de l'argent, et depuis combien de temps.
 * La liste ne dessine que les clients visibles : fluide même avec des centaines de clients.
 */
export default function CustomersScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { can, member } = useActiveMember();
  const settings = useShopSettings();
  const { customers, isLoading } = useCustomers();
  const ledger = useLedgerByCustomer();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const currency = settings?.currencyCode ?? 'XOF';
  const day = today();
  const { spacing } = theme.app;

  // L'ancienneté des dettes : recalculée seulement quand les données changent,
  // pas à chaque lettre tapée dans la recherche
  const withAging = useMemo(
    () =>
      customers.map((customer) => ({
        customer,
        aging: debtAging(ledger.get(customer.id) ?? [], day),
      })),
    [customers, ledger, day]
  );
  const debtors = withAging.filter(({ customer }) => customer.balance > 0);
  const totalOwed = debtors.reduce((sum, { customer }) => sum + customer.balance, 0);
  const count = (wanted: Filter) =>
    withAging.filter(({ customer, aging }) => FILTER_MATCH[wanted](aging.bucket, customer.balance))
      .length;

  const matching = new Set(searchCustomers(customers, query).map((customer) => customer.id));
  const visible = withAging
    .filter(({ customer }) => matching.has(customer.id))
    .filter(({ customer, aging }) => FILTER_MATCH[filter](aging.bucket, customer.balance))
    // Les débiteurs : la plus vieille dette d'abord ; sinon par nom
    .sort((a, b) =>
      filter === 'all'
        ? a.customer.name.localeCompare(b.customer.name)
        : b.aging.ageDays - a.aging.ageDays || b.customer.balance - a.customer.balance
    );

  if (!canSeeCustomers(member?.roles ?? [])) {
    return (
      <Screen title={t('nav.customers')}>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  const header = (
    <>
      <Card mode="outlined">
        <Card.Content style={[styles.between, { paddingVertical: spacing.sm }]}>
          <View>
            <Text variant="titleMedium">{t('customers.totalOwed')}</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('customers.debtorCount', { count: debtors.length })}
            </Text>
          </View>
          <MoneyText
            amount={totalOwed}
            currency={currency}
            tone={totalOwed > 0 ? 'danger' : 'default'}
          />
        </Card.Content>
      </Card>

      {can('customers.edit') ? (
        <BigButton icon="account-plus" onPress={() => router.push('/customer/new')}>
          {t('customers.add')}
        </BigButton>
      ) : null}

      <TextField
        label={t('customerPicker.search')}
        value={query}
        onChangeText={setQuery}
        left={<TextInput.Icon icon="magnify" />}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[styles.row, { gap: spacing.sm }]}>
          {(['all', 'debtors', 'over30', 'over60'] as const).map((value) => (
            <Chip key={value} selected={filter === value} onPress={() => setFilter(value)}>
              {t(`customers.filters.${value}`, { count: count(value) })}
            </Chip>
          ))}
        </View>
      </ScrollView>
    </>
  );

  return (
    <Screen title={t('nav.customers')} scroll={false}>
      <CardList
        data={visible}
        keyExtractor={({ customer }) => customer.id}
        header={header}
        empty={
          isLoading ? null : (
            <Text variant="bodyLarge" style={styles.centered}>
              {customers.length === 0 ? t('customers.empty') : t('customerPicker.empty')}
            </Text>
          )
        }
        renderItem={({ customer, aging }) => (
          <List.Item
            title={customer.name}
            titleStyle={styles.bold}
            description={() => (
              <View style={{ gap: spacing.xs, marginTop: 2 }}>
                {customer.phone ? (
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    {formatPhone(customer.phone)}
                  </Text>
                ) : null}
                <AgingChip aging={aging} />
              </View>
            )}
            left={(props) => <List.Icon {...props} icon="account" />}
            right={() =>
              customer.balance !== 0 ? (
                <View style={styles.center}>
                  <MoneyText
                    amount={customer.balance}
                    currency={currency}
                    tone={customer.balance > 0 ? 'danger' : 'success'}
                    style={{ fontSize: theme.app.fontSize.large }}
                  />
                </View>
              ) : null
            }
            onPress={() => router.push(`/customer/${customer.id}`)}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  row: {
    flexDirection: 'row',
  },
  center: {
    justifyContent: 'center',
  },
  bold: {
    fontWeight: '700',
  },
  centered: {
    textAlign: 'center',
  },
});
