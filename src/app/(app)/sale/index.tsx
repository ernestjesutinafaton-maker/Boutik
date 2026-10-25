import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Card, Divider, IconButton, List, Text, TextInput } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { MoneyText } from '@/components/money-text';
import { Screen } from '@/components/screen';
import { StatusChip } from '@/components/status-chip';
import { TextField } from '@/components/text-field';
import { normalizeText } from '@/domain/catalog';
import { addDays, dayRange, formatDay, formatTime, today } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { useOutbox } from '@/invoices/outbox';
import { useSales } from '@/sales/sale-data';
import { useShopSettings } from '@/shop/shop-settings';
import { useAppTheme } from '@/theme/paper-theme';

/** Historique des ventes, jour par jour : retrouver une facture pour la renvoyer ou la réimprimer. */
export default function SalesHistoryScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const settings = useShopSettings();
  const [day, setDay] = useState(today());
  const [query, setQuery] = useState('');
  const sales = useSales(dayRange(day));
  const outbox = useOutbox();
  const currency = settings?.currencyCode ?? 'XOF';

  const search = normalizeText(query);
  const visible = search
    ? sales.filter((sale) =>
        normalizeText(`${sale.invoiceNumber} ${sale.customerName ?? ''}`).includes(search)
      )
    : sales;
  const completed = sales.filter((sale) => sale.status === 'completed');
  const total = completed.reduce((sum, sale) => sum + sale.total, 0);
  const isToday = day === today();

  return (
    <Screen title={t('history.title')} stack>
      {outbox.length > 0 ? (
        <BigButton icon="send-clock" variant="accent" onPress={() => router.push('/sale/outbox')}>
          {t('history.outbox', { count: outbox.length })}
        </BigButton>
      ) : null}

      <Card mode="outlined">
        <Card.Content style={styles.dayRow}>
          <IconButton
            icon="chevron-left"
            onPress={() => setDay(addDays(day, -1))}
            accessibilityLabel={t('history.previousDay')}
          />
          <View style={styles.center}>
            <Text variant="titleLarge" style={styles.bold}>
              {isToday ? t('history.today') : formatDay(day)}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('history.count', { count: completed.length })}
            </Text>
          </View>
          <IconButton
            icon="chevron-right"
            disabled={isToday}
            onPress={() => setDay(addDays(day, 1))}
            accessibilityLabel={t('history.nextDay')}
          />
        </Card.Content>
        <Divider />
        <Card.Content style={[styles.between, { paddingVertical: theme.app.spacing.md }]}>
          <Text variant="titleMedium">{t('history.total')}</Text>
          <MoneyText amount={total} currency={currency} />
        </Card.Content>
      </Card>

      <TextField
        label={t('history.search')}
        value={query}
        onChangeText={setQuery}
        left={<TextInput.Icon icon="magnify" />}
      />

      <Card mode="outlined">
        {visible.length === 0 ? (
          <Card.Content style={{ paddingVertical: theme.app.spacing.md }}>
            <Text variant="bodyLarge">{t('history.empty')}</Text>
          </Card.Content>
        ) : null}
        {visible.map((sale, index) => (
          <View key={sale.id}>
            {index > 0 ? <Divider /> : null}
            <List.Item
              title={`${sale.invoiceNumber} · ${formatTime(sale.occurredAt)}`}
              titleStyle={[styles.bold, sale.status === 'cancelled' && styles.cancelled]}
              description={[sale.customerName, sale.sellerName].filter(Boolean).join(' · ')}
              onPress={() => router.push(`/sale/${sale.id}`)}
              right={() => (
                <View style={[styles.end, { gap: 2 }]}>
                  <Text variant="titleMedium" style={styles.bold}>
                    {formatMoney(sale.total, currency)}
                  </Text>
                  {sale.status === 'cancelled' ? (
                    <StatusChip tone="danger" label={t('sale.status.cancelled')} />
                  ) : sale.due > 0 ? (
                    <StatusChip tone="warning" label={t('sale.status.credit')} />
                  ) : null}
                </View>
              )}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  center: {
    alignItems: 'center',
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  end: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  bold: {
    fontWeight: '700',
  },
  cancelled: {
    textDecorationLine: 'line-through',
  },
});
