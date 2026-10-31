import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Divider, List, Text } from 'react-native-paper';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { StatusChip } from '@/components/status-chip';
import { displayUnits, isLowStock } from '@/domain/catalog';
import { daysBetween, formatDay, today } from '@/domain/dates';
import type { ExpiryLevel } from '@/domain/expiry';
import { formatMixedStock, formatQuantityWithUnit } from '@/domain/quantity';
import { useCatalog } from '@/products/product-data';
import { ProductListItem } from '@/products/product-list-item';
import { useShopSettings } from '@/shop/shop-settings';
import { type DatedLot, useExpiringLots } from '@/stock/stock-data';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

const LEVELS: { level: Exclude<ExpiryLevel, 'ok'>; tone: 'danger' | 'warning' }[] = [
  { level: 'expired', tone: 'danger' },
  { level: 'urgent', tone: 'danger' },
  { level: 'soon', tone: 'warning' },
];

/** Les alertes du stock : périmés, bientôt périmés (J-7, J-30), stock bas et ruptures. */
export default function StockAlertsScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const settings = useShopSettings();
  const { can } = useActiveMember();
  const day = today();
  const lots = useExpiringLots(
    settings?.id ?? '',
    day,
    settings?.expiryAlertDays ?? { first: 30, second: 7 }
  );
  const { products } = useCatalog();
  const lowStock = products.filter((product) => isLowStock(product) || product.stock <= 0);
  const days = settings?.expiryAlertDays ?? { first: 30, second: 7 };

  function lotDescription(lot: DatedLot): string {
    const remainingDays = lot.expiryDate ? daysBetween(day, lot.expiryDate) : 0;
    const when =
      lot.level === 'expired'
        ? t('alerts.expiredSince', { date: formatDay(lot.expiryDate ?? day) })
        : t('alerts.expiresIn', { count: remainingDays, date: formatDay(lot.expiryDate ?? day) });
    return `${formatQuantityWithUnit(lot.remaining, lot.baseUnit)} · ${when}`;
  }

  return (
    <Screen title={t('alerts.title')} stack>
      {LEVELS.map(({ level, tone }) => {
        const group = lots.filter((lot) => lot.level === level);
        return (
          <Card key={level} mode="outlined">
            <Card.Title
              title={t(`alerts.${level}`, { days: level === 'urgent' ? days.second : days.first })}
              titleVariant="titleLarge"
              right={() => (
                <View style={{ marginRight: theme.app.spacing.md }}>
                  <StatusChip tone={group.length ? tone : 'ok'} label={String(group.length)} />
                </View>
              )}
            />
            {group.length === 0 ? (
              <Card.Content>
                <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t('alerts.none')}
                </Text>
              </Card.Content>
            ) : null}
            {group.map((lot, index) => (
              <View key={lot.id}>
                {index > 0 ? <Divider /> : null}
                <List.Item
                  title={lot.productName}
                  titleStyle={{ fontWeight: '700' }}
                  description={lotDescription(lot)}
                  descriptionNumberOfLines={2}
                  right={(props) =>
                    can('stock.adjust') ? (
                      <List.Icon {...props} icon="delete-alert" color={theme.app.colors.danger} />
                    ) : (
                      <List.Icon {...props} icon="chevron-right" />
                    )
                  }
                  onPress={() =>
                    can('stock.adjust')
                      ? router.push({
                          pathname: '/stock/loss',
                          params: {
                            productId: lot.productId,
                            lotId: lot.id,
                            reason: level === 'expired' ? 'expired' : 'other',
                          },
                        })
                      : router.push(`/product/${lot.productId}`)
                  }
                />
              </View>
            ))}
            {group.length > 0 && level === 'expired' && can('stock.adjust') ? (
              <Card.Content>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t('alerts.expiredHelp')}
                </Text>
              </Card.Content>
            ) : null}
          </Card>
        );
      })}

      <Card mode="outlined">
        <Card.Title
          title={t('alerts.lowStock')}
          titleVariant="titleLarge"
          right={() => (
            <View style={{ marginRight: theme.app.spacing.md }}>
              <StatusChip
                tone={lowStock.length ? 'warning' : 'ok'}
                label={String(lowStock.length)}
              />
            </View>
          )}
        />
        {lowStock.length === 0 ? (
          <Card.Content>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('alerts.none')}
            </Text>
          </Card.Content>
        ) : null}
        {lowStock.map((product, index) => (
          <View key={product.id}>
            {index > 0 ? <Divider /> : null}
            <ProductListItem
              product={product}
              onPress={() => router.push(`/product/${product.id}`)}
              extra={
                product.lowStockThreshold !== null ? (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {t('alerts.threshold', {
                      quantity: formatMixedStock(
                        product.lowStockThreshold,
                        product.baseUnit,
                        displayUnits(product)
                      ),
                    })}
                  </Text>
                ) : null
              }
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
