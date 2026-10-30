import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Card, Divider, List, Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { MoneyText } from '@/components/money-text';
import { Notice } from '@/components/notice';
import { isLowStock } from '@/domain/catalog';
import { formatTime, today } from '@/domain/dates';
import { DEFAULT_EXPIRY_ALERT_DAYS } from '@/domain/expiry';
import type { CurrencyCode } from '@/domain/money';
import { useCatalog } from '@/products/product-data';
import { useOpenCashSession } from '@/sales/cash-session-data';
import { useSessionTotals } from '@/cash/cash-data';
import { useShop } from '@/shop/shop-provider';
import { useShopSettings } from '@/shop/shop-settings';
import { useExpiringLots } from '@/stock/stock-data';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

import { useMySales, useOpenInventoryCount } from './role-dashboard-data';

/**
 * Tableau de bord des rôles sans accès aux comptes : chacun voit les blocs de SES droits.
 *   - vente (vendeur, caissier) : mes ventes ;
 *   - caisse (caissier) : ma caisse du jour ;
 *   - stock (magasinier, compteur) : ruptures, alertes, inventaire.
 * Une personne avec plusieurs rôles voit plusieurs blocs.
 */
export function RoleDashboard() {
  const { t } = useTranslation();
  const { can } = useActiveMember();
  const showSales = can('sale.create');
  const showCash = can('cash.session');
  const showStock = can('stock.count') || can('stock.receive');

  if (!showSales && !showCash && !showStock) {
    return <Notice tone="info" message={t('dashboard.forbidden')} />;
  }
  return (
    <>
      {showSales ? <MySalesCard /> : null}
      {showCash ? <MyCashCard /> : null}
      {showStock ? <StockCard /> : null}
    </>
  );
}

function MySalesCard() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { shop } = useShop();
  const { member } = useActiveMember();
  const settings = useShopSettings();
  const currency: CurrencyCode = settings?.currencyCode ?? 'XOF';
  const sales = useMySales(shop?.id ?? '', member?.id ?? '');

  return (
    <Card mode="outlined">
      <Card.Title title={t('roleDashboard.mySales')} titleVariant="titleLarge" />
      <Card.Content style={{ gap: theme.app.spacing.sm }}>
        <Line label={t('roleDashboard.todayCount', { count: sales.today.count })}>
          <MoneyText amount={sales.today.total} currency={currency} />
        </Line>
        <Line label={t('roleDashboard.weekCount', { count: sales.week.count })}>
          <MoneyText amount={sales.week.total} currency={currency} />
        </Line>
        {sales.week.onCredit > 0 ? (
          <Line label={t('roleDashboard.onCredit')}>
            <MoneyText amount={sales.week.onCredit} currency={currency} />
          </Line>
        ) : null}
      </Card.Content>
      {sales.recent.length > 0 ? (
        <>
          <Divider />
          {sales.recent.map((sale) => (
            <List.Item
              key={sale.id}
              title={sale.invoiceNumber}
              description={[formatTime(sale.occurredAt), sale.customerName]
                .filter(Boolean)
                .join(' · ')}
              right={() => <MoneyText amount={sale.total} currency={currency} />}
              onPress={() => router.push(`/sale/${sale.id}`)}
            />
          ))}
        </>
      ) : (
        <Card.Content>
          <Text variant="bodyLarge">{t('roleDashboard.noSales')}</Text>
        </Card.Content>
      )}
    </Card>
  );
}

function MyCashCard() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { device } = useShop();
  const settings = useShopSettings();
  const currency: CurrencyCode = settings?.currencyCode ?? 'XOF';
  const { session } = useOpenCashSession(device?.id ?? null);
  const totals = useSessionTotals(session?.id ?? null);
  const cashedIn = totals.payments.reduce((sum, line) => sum + line.amount, 0);
  const expenses = totals.movements
    .filter((line) => line.type === 'expense' || line.type === 'stock_purchase')
    .reduce((sum, line) => sum + line.amount, 0);

  return (
    <Card mode="outlined">
      <Card.Title title={t('roleDashboard.myCash')} titleVariant="titleLarge" />
      <Card.Content style={{ gap: theme.app.spacing.sm }}>
        {session ? (
          <>
            <Text variant="bodyLarge">
              {t('roleDashboard.cashOpen', { time: formatTime(session.openedAt) })}
            </Text>
            <Line label={t('roleDashboard.openingFloat')}>
              <MoneyText amount={session.openingFloat} currency={currency} />
            </Line>
            <Line label={t('dashboard.cashedIn')}>
              <MoneyText amount={cashedIn} currency={currency} />
            </Line>
            <Line label={t('report.expensesTotal')}>
              <MoneyText amount={expenses} currency={currency} />
            </Line>
          </>
        ) : (
          <Notice tone="info" message={t('roleDashboard.cashClosed')} />
        )}
        <BigButton icon="cash-register" onPress={() => router.push('/cash')}>
          {t('cash.title')}
        </BigButton>
      </Card.Content>
    </Card>
  );
}

function StockCard() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { can } = useActiveMember();
  const settings = useShopSettings();
  const { products } = useCatalog();
  const lots = useExpiringLots(
    settings?.id ?? '',
    today(),
    settings?.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS
  );
  const openCounts = useOpenInventoryCount(settings?.id ?? '');

  const outOfStock = products.filter((product) => product.stock <= 0).length;
  const low = products.filter((product) => product.stock > 0 && isLowStock(product)).length;
  const toCheck = products.filter((product) => product.needsCheck).length;
  const expired = lots.filter((lot) => lot.level === 'expired').length;
  const soon = lots.filter((lot) => lot.level === 'urgent').length;
  // Le compteur ne voit pas le stock calculé (comptage « à l'aveugle »)
  const seesStock = can('stock.adjust') || can('stock.receive');

  return (
    <Card mode="outlined">
      <Card.Title title={t('roleDashboard.stock')} titleVariant="titleLarge" />
      <Card.Content style={{ gap: theme.app.spacing.sm }}>
        {seesStock ? (
          <>
            <Line
              label={t('products.outOfStock')}
              value={String(outOfStock)}
              danger={outOfStock > 0}
            />
            <Line label={t('products.lowStock')} value={String(low)} danger={low > 0} />
            <Line label={t('products.needsCheck')} value={String(toCheck)} danger={toCheck > 0} />
            <Line label={t('roleDashboard.expired')} value={String(expired)} danger={expired > 0} />
            <Line label={t('roleDashboard.expiringSoon')} value={String(soon)} danger={soon > 0} />
          </>
        ) : null}
        <Line label={t('roleDashboard.openInventories')} value={String(openCounts)} />
        <BigButton icon="clipboard-list" onPress={() => router.push('/inventory')}>
          {t('roleDashboard.inventory')}
        </BigButton>
        {can('stock.receive') ? (
          <BigButton
            icon="truck-delivery"
            variant="outline"
            onPress={() => router.push('/stock/receive')}>
            {t('products.receive')}
          </BigButton>
        ) : null}
        {seesStock ? (
          <BigButton icon="alert" variant="outline" onPress={() => router.push('/stock/alerts')}>
            {t('products.alerts')}
          </BigButton>
        ) : null}
      </Card.Content>
    </Card>
  );
}

function Line({
  label,
  value,
  danger,
  children,
}: {
  label: string;
  value?: string;
  danger?: boolean;
  children?: React.ReactNode;
}) {
  const theme = useAppTheme();
  const color = danger ? { color: theme.app.colors.danger } : null;
  return (
    <View style={styles.between}>
      <Text variant="bodyLarge" style={[styles.fill, color]}>
        {label}
      </Text>
      {children ?? (
        <Text variant="bodyLarge" style={[styles.bold, color]}>
          {value}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fill: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
});
