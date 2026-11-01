import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { StatusChip } from '@/components/status-chip';
import type { SaleDetail } from '@/sales/sale-data';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

import { useSaleDeliveries } from './delivery-data';
import { STATUS_TONE } from './delivery-list';

/**
 * Sur la fiche d'une vente : sa livraison (état, bouton pour la voir), ou « Livrer cette vente ».
 */
export function SaleDeliveryCard({ sale }: { sale: SaleDetail }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { can } = useActiveMember();
  const deliveries = useSaleDeliveries(sale.id);
  const current = deliveries.find((delivery) => delivery.status !== 'cancelled') ?? null;

  if (current) {
    return (
      <Card mode="outlined">
        <Card.Content style={{ gap: theme.app.spacing.sm }}>
          <View style={[styles.between, { gap: theme.app.spacing.sm }]}>
            <Text variant="titleMedium" style={styles.shrink}>
              {current.address}
            </Text>
            <StatusChip
              tone={STATUS_TONE[current.status]}
              label={t(`deliveries.status.${current.status}`)}
            />
          </View>
          <BigButton
            icon="moped"
            variant="outline"
            onPress={() => router.push(`/delivery/${current.id}`)}>
            {t('deliveries.seeDelivery')}
          </BigButton>
        </Card.Content>
      </Card>
    );
  }
  if (!can('delivery.create') || sale.status !== 'completed' || sale.replacedBy) {
    return null;
  }
  return (
    <BigButton
      icon="moped"
      variant="outline"
      onPress={() => router.push(`/delivery/new?saleId=${sale.id}`)}>
      {t('deliveries.deliverSale')}
    </BigButton>
  );
}

const styles = StyleSheet.create({
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  shrink: {
    flexShrink: 1,
  },
});
