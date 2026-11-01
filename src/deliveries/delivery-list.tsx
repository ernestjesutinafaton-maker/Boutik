import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { List, SegmentedButtons, Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { CardList } from '@/components/card-list';
import { MoneyText } from '@/components/money-text';
import { Screen } from '@/components/screen';
import { StatusChip } from '@/components/status-chip';
import { formatMoment } from '@/domain/dates';
import { type DeliveryGroup, deliveryGroup, type DeliveryStatus } from '@/domain/delivery';
import { type CurrencyCode, formatMoney } from '@/domain/money';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

import { type Delivery, useCourierBalances, useDeliveries } from './delivery-data';

export const STATUS_TONE: Record<DeliveryStatus, 'danger' | 'warning' | 'ok' | 'neutral'> = {
  pending: 'neutral',
  in_progress: 'warning',
  delivered: 'ok',
  failed: 'danger',
  cancelled: 'neutral',
};

const GROUPS: DeliveryGroup[] = ['todo', 'active', 'done'];

/**
 * La liste des livraisons, en trois onglets : à faire, en cours, terminées.
 *   - Un livreur voit les siennes et celles ouvertes à tous, son argent à remettre, et note
 *     ses dépenses.
 *   - La boutique voit toutes les livraisons ; les responsables suivent l'argent des livreurs.
 * stack : écran ouvert depuis un menu (bouton retour) ; sinon, onglet du livreur.
 */
export function DeliveryList({ stack }: { stack: boolean }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { can, member } = useActiveMember();
  const settings = useShopSettings();
  const { deliveries, isLoading } = useDeliveries();
  const balances = useCourierBalances();
  const [group, setGroup] = useState<DeliveryGroup>('todo');
  const currency = settings?.currencyCode ?? 'XOF';
  const { spacing } = theme.app;
  const memberId = member?.id ?? '';
  // Le livreur (sans le droit d'organiser) ne voit que les siennes et celles ouvertes à tous
  const courierView = can('delivery.handle') && !can('delivery.create');
  const myBalance = balances.find((line) => line.courierId === memberId)?.amount ?? 0;

  const visible = useMemo(
    () =>
      deliveries.filter(
        (delivery) =>
          !courierView || delivery.assignedTo === memberId || delivery.assignedTo === null
      ),
    [deliveries, courierView, memberId]
  );
  const counts = useMemo(() => {
    const result: Record<DeliveryGroup, number> = { todo: 0, active: 0, done: 0 };
    for (const delivery of visible) {
      result[deliveryGroup(delivery.status)] += 1;
    }
    return result;
  }, [visible]);
  const shown = useMemo(
    () =>
      visible
        .filter((delivery) => deliveryGroup(delivery.status) === group)
        // Les miennes d'abord, puis celles ouvertes à tous ; les terminées : les plus récentes
        .sort((a, b) =>
          group === 'done'
            ? b.updatedAt.localeCompare(a.updatedAt)
            : Number(b.assignedTo === memberId) - Number(a.assignedTo === memberId)
        ),
    [visible, group, memberId]
  );

  const header = (
    <>
      {courierView ? (
        <Card mode="outlined">
          <Card.Content style={[styles.between, { gap: spacing.sm }]}>
            <Text variant="titleMedium" style={styles.fill}>
              {t('deliveries.dashboard.held')}
            </Text>
            <MoneyText
              amount={myBalance}
              currency={currency}
              tone={myBalance > 0 ? 'primary' : 'default'}
            />
          </Card.Content>
        </Card>
      ) : null}
      {can('delivery.handle') ? (
        <BigButton
          icon="receipt"
          variant="outline"
          onPress={() => router.push('/delivery/expense')}>
          {t('deliveries.dashboard.addExpense')}
        </BigButton>
      ) : null}
      {can('delivery.handover') || can('delivery.review') ? (
        <BigButton
          icon="cash-multiple"
          variant="outline"
          onPress={() => router.push('/delivery/cash')}>
          {t('deliveries.cash.title')}
        </BigButton>
      ) : null}
      <SegmentedButtons
        value={group}
        onValueChange={(value) => setGroup(value as DeliveryGroup)}
        buttons={GROUPS.map((value) => ({
          value,
          // Le nombre des terminées n'apporte rien et ne tient pas sur un petit écran
          label:
            value === 'done'
              ? t(`deliveries.groups.${value}`)
              : `${t(`deliveries.groups.${value}`)} (${counts[value]})`,
        }))}
      />
    </>
  );

  return (
    <Screen
      title={courierView ? t('deliveries.myTitle') : t('deliveries.title')}
      stack={stack}
      scroll={false}>
      <CardList
        data={shown}
        keyExtractor={(delivery) => delivery.id}
        header={header}
        empty={
          isLoading ? null : (
            <Text variant="bodyLarge" style={styles.centered}>
              {t(`deliveries.empty.${group}`)}
            </Text>
          )
        }
        renderItem={(delivery) => (
          <DeliveryRow
            delivery={delivery}
            currency={currency}
            mine={delivery.assignedTo === memberId}
          />
        )}
      />
    </Screen>
  );
}

function DeliveryRow({
  delivery,
  currency,
  mine,
}: {
  delivery: Delivery;
  currency: CurrencyCode;
  mine: boolean;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const who =
    delivery.assignedTo === null
      ? t('deliveries.openToAll')
      : mine
        ? null
        : t('deliveries.courier', { name: delivery.courierName ?? '?' });

  return (
    <List.Item
      title={delivery.address}
      titleNumberOfLines={2}
      titleStyle={styles.bold}
      description={() => (
        <View style={{ gap: 2, marginTop: 2 }}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {[
              delivery.contactName,
              delivery.requestedAt ? formatMoment(delivery.requestedAt) : t('deliveries.asap'),
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {who ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {who}
            </Text>
          ) : null}
          {delivery.amountToCollect > 0 && delivery.status !== 'cancelled' ? (
            <Text variant="bodyMedium" style={[styles.bold, { color: theme.app.colors.accent }]}>
              {t('deliveries.toCollect', {
                amount: formatMoney(delivery.amountToCollect, currency),
              })}
            </Text>
          ) : null}
        </View>
      )}
      left={(props) => <List.Icon {...props} icon="moped" />}
      right={() => (
        <View style={styles.center}>
          <StatusChip
            tone={STATUS_TONE[delivery.status]}
            label={t(`deliveries.status.${delivery.status}`)}
          />
        </View>
      )}
      onPress={() => router.push(`/delivery/${delivery.id}`)}
    />
  );
}

const styles = StyleSheet.create({
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  fill: {
    flexShrink: 1,
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
