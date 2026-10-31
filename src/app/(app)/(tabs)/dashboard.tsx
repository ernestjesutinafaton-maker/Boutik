import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Divider, List, SegmentedButtons, Text } from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { HeroCard } from '@/components/hero-card';
import { Icon3D, type Icon3DName } from '@/components/icon-3d';
import { MoneyText } from '@/components/money-text';
import { QuickActions } from '@/components/quick-actions';
import { Screen } from '@/components/screen';
import { StatusChip } from '@/components/status-chip';
import { type DashboardPeriod, useDashboard } from '@/dashboard/dashboard-data';
import { RoleDashboard } from '@/dashboard/role-dashboard';
import { SalesChart } from '@/dashboard/sales-chart';
import { isLowStock } from '@/domain/catalog';
import { today } from '@/domain/dates';
import { DEFAULT_EXPIRY_ALERT_DAYS } from '@/domain/expiry';
import { type CurrencyCode, formatMoney } from '@/domain/money';
import { formatQuantityWithUnit } from '@/domain/quantity';
import { useCatalog } from '@/products/catalog-provider';
import { useShopSettings } from '@/shop/shop-settings';
import { useExpiringLots } from '@/stock/stock-data';
import { useActiveMember } from '@/team/active-member-provider';
import { LimitedNotice, useIsLimited } from '@/subscription/limited-notice';
import { useIsPlatformAdmin } from '@/subscription/subscription-data';
import { useAppTheme } from '@/theme/paper-theme';

/**
 * Rubrique « Tableau de bord » : ventes, bénéfice réel, argent encaissé, dettes,
 * valeur du stock, produits qui se vendent et qui dorment, alertes, écarts de caisse.
 * Réservée au propriétaire et au gérant (le bénéfice : au propriétaire seulement).
 */
export default function DashboardScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { can } = useActiveMember();
  const settings = useShopSettings();
  const { data, isLoading } = useDashboard();
  const { products } = useCatalog();
  const lots = useExpiringLots(
    settings?.id ?? '',
    today(),
    settings?.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS
  );
  const [period, setPeriod] = useState<DashboardPeriod>('today');
  const limited = useIsLimited();
  const isPlatformAdmin = useIsPlatformAdmin();
  const currency: CurrencyCode = settings?.currencyCode ?? 'XOF';
  const { spacing } = theme.app;

  // Sans accès aux comptes : le tableau de bord de ses rôles (ventes, caisse, stock)
  if (!can('reports.account')) {
    return (
      <Screen title={t('nav.dashboard')}>
        <RoleDashboard />
      </Screen>
    );
  }

  if (limited) {
    return (
      <Screen title={t('nav.dashboard')}>
        <LimitedNotice />
      </Screen>
    );
  }

  const report = data?.reports[period];
  const expired = lots.filter((lot) => lot.level === 'expired').length;
  const soon = lots.filter((lot) => lot.level === 'urgent').length;
  const lowStock = products.filter((product) => isLowStock(product) || product.stock <= 0).length;

  return (
    <Screen title={t('nav.dashboard')}>
      <QuickActions />
      {isPlatformAdmin ? (
        <BigButton
          icon="shield-account"
          variant="accent"
          onPress={() => router.push('/admin-payments')}>
          {t('subscription.adminMenu')}
        </BigButton>
      ) : null}
      <SegmentedButtons
        value={period}
        onValueChange={(value) =>
          setPeriod(value === 'week' ? 'week' : value === 'month' ? 'month' : 'today')
        }
        buttons={[
          { value: 'today', label: t('dashboard.today') },
          { value: 'week', label: t('dashboard.week') },
          { value: 'month', label: t('dashboard.month') },
        ]}
      />

      {!report ? (
        <Text variant="bodyLarge">{isLoading ? t('dashboard.loading') : ''}</Text>
      ) : (
        <>
          <HeroCard
            label={t('report.revenue')}
            amount={report.sales.revenue}
            currency={currency}
            icon="chart-increasing"
            details={[
              { label: t('dashboard.salesShort'), value: String(report.sales.count) },
              {
                label: t('dashboard.cashedIn'),
                value: formatMoney(report.payments.total, currency),
              },
            ]}
          />
          <View style={[styles.tiles, { gap: spacing.sm }]}>
            {can('reports.profit') ? (
              <Tile
                label={t('report.netProfit')}
                amount={report.netProfit}
                currency={currency}
                tone={report.netProfit < 0 ? 'danger' : 'success'}
              />
            ) : null}
            <Tile
              label={t('report.expensesTotal')}
              amount={report.expenses.total}
              currency={currency}
            />
            <Tile
              label={t('dashboard.debts')}
              amount={report.totalDebt}
              currency={currency}
              tone={report.totalDebt > 0 ? 'danger' : 'default'}
            />
            <Tile
              label={t('dashboard.stockValue')}
              amount={report.stock.valueAtEnd}
              currency={currency}
            />
            <Tile
              label={t('dashboard.cashDifferences')}
              amount={report.cashDifferences.total}
              currency={currency}
              tone={report.cashDifferences.total < 0 ? 'danger' : 'default'}
            />
          </View>

          {data ? (
            <Card mode="outlined">
              <Card.Title
                title={t('dashboard.chartTitle')}
                titleVariant="titleLarge"
                left={() => <TitleIcon name="bar-chart" />}
              />
              <Card.Content>
                <SalesChart series={data.series} currency={currency} />
              </Card.Content>
            </Card>
          ) : null}

          <Card mode="outlined">
            <Card.Title
              title={t('dashboard.alerts')}
              titleVariant="titleLarge"
              left={() => <TitleIcon name="warning" />}
            />
            <Card.Content style={[styles.wrap, { gap: spacing.sm }]}>
              <StatusChip
                tone={expired > 0 ? 'danger' : 'ok'}
                icon="calendar-remove"
                label={t('dashboard.expired', { count: expired })}
              />
              <StatusChip
                tone={soon > 0 ? 'warning' : 'ok'}
                icon="calendar-alert"
                label={t('dashboard.expiringSoon', { count: soon })}
              />
              <StatusChip
                tone={lowStock > 0 ? 'warning' : 'ok'}
                icon="package-variant"
                label={t('dashboard.lowStock', { count: lowStock })}
              />
            </Card.Content>
            <List.Item
              title={t('dashboard.seeAlerts')}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/stock/alerts')}
            />
          </Card>

          <Card mode="outlined">
            <Card.Title
              title={t('report.sections.topProducts')}
              titleVariant="titleLarge"
              left={() => <TitleIcon name="cart" />}
            />
            <Card.Content style={{ gap: spacing.xs }}>
              {report.topProducts.length === 0 ? (
                <Text variant="bodyLarge">{t('dashboard.noSales')}</Text>
              ) : null}
              {report.topProducts.slice(0, 5).map((product, index) => (
                <Row
                  key={`${product.name}-${index}`}
                  label={`${index + 1}. ${product.name} (${formatQuantityWithUnit(product.quantity, product.baseUnit)})`}
                  value={formatMoney(product.revenue, currency)}
                />
              ))}
            </Card.Content>
          </Card>

          {data && data.sleeping.length > 0 ? (
            <Card mode="outlined">
              <Card.Title
                title={t('dashboard.sleeping')}
                subtitle={t('dashboard.sleepingHelp')}
                titleVariant="titleLarge"
                left={() => <TitleIcon name="hourglass" />}
              />
              <Card.Content style={{ gap: spacing.xs }}>
                {data.sleeping.slice(0, 8).map((product) => (
                  <Row
                    key={product.id}
                    label={product.name}
                    value={
                      product.daysWithoutSale === null
                        ? t('dashboard.neverSold')
                        : t('dashboard.daysWithoutSale', { count: product.daysWithoutSale })
                    }
                  />
                ))}
              </Card.Content>
            </Card>
          ) : null}

          <Card mode="outlined">
            <Card.Title
              title={t('report.sections.debtors')}
              titleVariant="titleLarge"
              left={() => <TitleIcon name="ledger" />}
            />
            <Card.Content style={{ gap: spacing.xs }}>
              {report.debtors.length === 0 ? (
                <Text variant="bodyLarge">{t('report.noDebtors')}</Text>
              ) : null}
              {report.debtors.slice(0, 5).map((debtor, index) => (
                <Row
                  key={`${debtor.name}-${index}`}
                  label={t('report.debtorLine', { name: debtor.name, count: debtor.ageDays })}
                  value={formatMoney(debtor.balance, currency)}
                  danger={debtor.ageDays > 60}
                />
              ))}
            </Card.Content>
            <List.Item
              title={t('dashboard.seeCustomers')}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/customers')}
            />
          </Card>
        </>
      )}

      <Card mode="outlined">
        {can('cash.session') ? (
          <List.Item
            title={t('cash.title')}
            titleStyle={styles.bold}
            description={t('more.cashHelp')}
            left={(props) => <Icon3D name="coin" style={props.style} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push('/cash')}
          />
        ) : null}
        <Divider />
        <List.Item
          title={t('report.archivesTitle')}
          titleStyle={styles.bold}
          description={t('more.reportsHelp')}
          left={(props) => <Icon3D name="bar-chart" style={props.style} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/report')}
        />
      </Card>
    </Screen>
  );
}

/** Une « tuile » : un chiffre clé en gros, avec son nom. */
function Tile(props: {
  label: string;
  amount?: number;
  value?: string;
  currency: CurrencyCode;
  tone?: 'default' | 'primary' | 'success' | 'danger';
}) {
  const theme = useAppTheme();
  return (
    <Card mode="outlined" style={styles.tile}>
      <Card.Content style={{ gap: theme.app.spacing.xs }}>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {props.label}
        </Text>
        {props.amount !== undefined ? (
          <MoneyText
            amount={props.amount}
            currency={props.currency}
            tone={props.tone ?? 'default'}
            style={{ fontSize: theme.app.fontSize.title, lineHeight: 28 }}
          />
        ) : (
          <Text variant="headlineSmall" style={styles.bold}>
            {props.value}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

/** L'icône 3D d'un titre de carte. */
function TitleIcon({ name }: { name: Icon3DName }) {
  return <Icon3D name={name} size={36} />;
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  const theme = useAppTheme();
  const color = danger ? { color: theme.app.colors.danger } : null;
  return (
    <View style={styles.between}>
      <Text variant="bodyLarge" style={[styles.fill, color]}>
        {label}
      </Text>
      <Text variant="bodyLarge" style={[styles.bold, color]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
    flexGrow: 1,
    flexBasis: 160,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
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
