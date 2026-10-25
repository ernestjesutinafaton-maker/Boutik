import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Card, Divider, Text } from 'react-native-paper';

import { MoneyText } from '@/components/money-text';
import { type CurrencyCode, formatMoney } from '@/domain/money';
import { formatQuantity } from '@/domain/quantity';
import type { ReportData } from '@/domain/report';
import { useAppTheme } from '@/theme/paper-theme';

import { EXPENSE_LABELS } from './report-html';

type ReportViewProps = {
  report: ReportData;
  currency: CurrencyCode;
  /** Les bénéfices ne sont montrés qu'au propriétaire */
  showProfit: boolean;
};

/** La fiche de rapport à l'écran : ventes, caisse, paiements, crédit, dépenses, bénéfice, stock. */
export function ReportView({ report, currency, showProfit }: ReportViewProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const money = (amount: number) => formatMoney(amount, currency);

  return (
    <>
      <Section title={t('report.sections.sales')}>
        <Row label={t('report.salesCount')} value={String(report.sales.count)} />
        {report.sales.cancelledCount > 0 ? (
          <Row label={t('report.cancelledCount')} value={String(report.sales.cancelledCount)} />
        ) : null}
        <Row label={t('report.salesTotal')} value={money(report.sales.total)} />
        {report.sales.discounts > 0 ? (
          <Row label={t('report.discounts')} value={money(report.sales.discounts)} />
        ) : null}
        {report.sales.returns > 0 ? (
          <Row label={t('report.returns')} value={`− ${money(report.sales.returns)}`} />
        ) : null}
        <Divider />
        <View style={styles.between}>
          <Text variant="titleMedium" style={styles.bold}>
            {t('report.revenue')}
          </Text>
          <MoneyText amount={report.sales.revenue} currency={currency} tone="primary" />
        </View>
      </Section>

      {report.closing ? (
        <Section title={t('report.sections.closing')}>
          <Row label={t('report.openingFloat')} value={money(report.closing.openingFloat)} />
          {report.closing.methods.map((method) => (
            <View key={method.label} style={{ gap: 2 }}>
              <Text variant="titleSmall" style={styles.bold}>
                {method.label}
              </Text>
              <Row label={t('report.expected')} value={money(method.expected)} />
              <Row label={t('report.counted')} value={money(method.counted)} />
              <Row
                label={t('report.difference')}
                value={money(method.difference)}
                color={method.difference < 0 ? theme.app.colors.danger : undefined}
              />
            </View>
          ))}
          <Divider />
          <Row
            label={t('report.totalDifference')}
            value={money(report.closing.totalDifference)}
            bold
            color={report.closing.totalDifference < 0 ? theme.app.colors.danger : undefined}
          />
        </Section>
      ) : null}

      <Section title={t('report.sections.payments')}>
        {report.payments.byMethod.map((method) => (
          <Row key={method.label} label={method.label} value={money(method.amount)} />
        ))}
        <Row label={t('report.total')} value={money(report.payments.total)} bold />
      </Section>

      <Section title={t('report.sections.credit')}>
        <Row label={t('report.creditGiven')} value={money(report.credit.given)} />
        <Row label={t('report.creditRepaid')} value={money(report.credit.repaid)} />
        {report.credit.oldDebts > 0 ? (
          <Row label={t('report.oldDebts')} value={money(report.credit.oldDebts)} />
        ) : null}
        {report.credit.writtenOff > 0 ? (
          <Row label={t('report.writtenOff')} value={money(report.credit.writtenOff)} />
        ) : null}
      </Section>

      <Section title={t('report.sections.expenses')}>
        {Object.entries(report.expenses.byCategory).map(([category, amount]) => (
          <Row key={category} label={EXPENSE_LABELS[category] ?? category} value={money(amount)} />
        ))}
        <Row label={t('report.expensesTotal')} value={money(report.expenses.total)} bold />
        <Row label={t('report.stockPurchases')} value={money(report.cash.stockPurchases)} />
        <Row label={t('report.withdrawals')} value={money(report.cash.withdrawals)} />
        {report.cash.deposits > 0 ? (
          <Row label={t('report.deposits')} value={money(report.cash.deposits)} />
        ) : null}
      </Section>

      {showProfit ? (
        <Section title={t('report.sections.profit')}>
          <Row label={t('report.revenue')} value={money(report.sales.revenue)} />
          <Row label={t('report.costOfGoods')} value={`− ${money(report.costOfGoods)}`} />
          <Row label={t('report.grossProfit')} value={money(report.grossProfit)} bold />
          <Row label={t('report.expensesTotal')} value={`− ${money(report.expenses.total)}`} />
          <Row label={t('report.losses')} value={`− ${money(report.losses)}`} />
          {report.adjustments !== 0 ? (
            <Row label={t('report.adjustments')} value={money(report.adjustments)} />
          ) : null}
          <Divider />
          <View style={styles.between}>
            <Text variant="titleMedium" style={styles.bold}>
              {t('report.netProfit')}
            </Text>
            <MoneyText
              amount={report.netProfit}
              currency={currency}
              tone={report.netProfit < 0 ? 'danger' : 'primary'}
            />
          </View>
        </Section>
      ) : null}

      <Section title={t('report.sections.stock')}>
        <Row label={t('report.received')} value={money(report.stock.receivedValue)} />
        <Row label={t('report.losses')} value={money(report.losses)} />
        <Row label={t('report.stockValue')} value={money(report.stock.valueAtEnd)} bold />
        <Row
          label={t('report.cashDifferences', { count: report.cashDifferences.sessions })}
          value={money(report.cashDifferences.total)}
        />
      </Section>

      {report.topProducts.length > 0 ? (
        <Section title={t('report.sections.topProducts')}>
          {report.topProducts.map((product, index) => (
            <Row
              key={`${product.name}-${index}`}
              label={`${index + 1}. ${product.name} (${formatQuantity(product.quantity)} ${product.baseUnit})`}
              value={money(product.revenue)}
            />
          ))}
        </Section>
      ) : null}

      <Section title={t('report.sections.debtors')}>
        {report.debtors.length === 0 ? (
          <Text variant="bodyLarge">{t('report.noDebtors')}</Text>
        ) : null}
        {report.debtors.map((debtor, index) => (
          <Row
            key={`${debtor.name}-${index}`}
            label={t('report.debtorLine', { name: debtor.name, count: debtor.ageDays })}
            value={money(debtor.balance)}
            color={debtor.ageDays > 60 ? theme.app.colors.danger : undefined}
          />
        ))}
        <Row label={t('report.totalDebt')} value={money(report.totalDebt)} bold />
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <Card mode="outlined">
      <Card.Title title={title} titleVariant="titleLarge" />
      <Card.Content style={{ gap: theme.app.spacing.xs }}>{children}</Card.Content>
    </Card>
  );
}

function Row(props: { label: string; value: string; bold?: boolean; color?: string }) {
  const style = [props.bold ? styles.bold : null, props.color ? { color: props.color } : null];
  return (
    <View style={styles.between}>
      <Text variant="bodyLarge" style={[styles.label, ...style]}>
        {props.label}
      </Text>
      <Text variant="bodyLarge" style={style}>
        {props.value}
      </Text>
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
  label: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
});
