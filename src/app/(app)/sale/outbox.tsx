import { usePowerSync } from '@powersync/react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Card, Divider, List, Text } from 'react-native-paper';

import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { formatMoment } from '@/domain/dates';
import { removeFromOutbox, useOutbox } from '@/invoices/outbox';
import { useAppTheme } from '@/theme/paper-theme';

/** La file « À envoyer » : ouvrir chaque document pour l'envoyer, puis le retirer de la liste. */
export default function OutboxScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const items = useOutbox();

  function open(item: (typeof items)[number]) {
    if (item.saleId) {
      router.push(`/sale/${item.saleId}`);
    } else if (item.paymentId && item.customerId) {
      router.push({
        pathname: '/customer/[customerId]/receipt',
        params: { customerId: item.customerId, paymentId: item.paymentId },
      });
    } else if (item.customerId) {
      router.push(`/customer/${item.customerId}`);
    }
  }

  return (
    <Screen title={t('outbox.title')} stack>
      <Notice tone="info" message={t('outbox.help')} />
      <Card mode="outlined">
        {items.length === 0 ? (
          <Card.Content style={{ paddingVertical: theme.app.spacing.md }}>
            <Text variant="bodyLarge">{t('outbox.empty')}</Text>
          </Card.Content>
        ) : null}
        {items.map((item, index) => (
          <View key={item.id}>
            {index > 0 ? <Divider /> : null}
            <List.Item
              title={item.label}
              titleStyle={{ fontWeight: '700' }}
              description={`${t(`outbox.kinds.${item.kind}`)} · ${formatMoment(item.createdAt)}`}
              left={(props) => (
                <List.Icon
                  {...props}
                  icon={
                    item.kind === 'invoice'
                      ? 'receipt'
                      : item.kind === 'receipt'
                        ? 'cash-check'
                        : 'bell-ring'
                  }
                />
              )}
              onPress={() => open(item)}
              right={() => (
                <Button onPress={() => removeFromOutbox(db, item.id)}>{t('outbox.done')}</Button>
              )}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
