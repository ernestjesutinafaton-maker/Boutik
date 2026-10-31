import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { formatMoment } from '@/domain/dates';
import { canSharePdf, printHtml, shareHtmlAsPdf } from '@/invoices/invoice-actions';
import { useReport } from '@/reports/report-data';
import { reportHtml } from '@/reports/report-html';
import { ReportView } from '@/reports/report-view';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Une fiche de rapport archivée (clôture de journée ou compte). */
export default function ReportScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const settings = useShopSettings();
  const { can } = useActiveMember();
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const report = useReport(reportId);
  const [error, setError] = useState<string | null>(null);
  const showProfit = can('reports.profit');

  if (!report || !settings) {
    return (
      <Screen title={t('report.title')} stack>
        {null}
      </Screen>
    );
  }
  if (report.kind === 'account' && !can('reports.account')) {
    return (
      <Screen title={t('report.title')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  const title = t(`report.kinds.${report.kind}`);
  const html = reportHtml({
    report: report.data,
    title,
    shopName: settings.name,
    currency: settings.currencyCode,
    showProfit,
  });
  const run = (action: () => Promise<void>) =>
    action().catch((actionError: unknown) => {
      console.warn('Rapport : action impossible :', actionError);
      setError(t('invoice.error'));
    });

  return (
    <Screen title={title} stack>
      <Card mode="outlined">
        <Card.Content style={{ gap: theme.app.spacing.xs }}>
          <Text variant="titleMedium" style={styles.bold}>
            {t('report.period', {
              start: formatMoment(report.periodStart),
              end: formatMoment(report.periodEnd),
            })}
          </Text>
          {report.createdByName ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('report.madeBy', { name: report.createdByName })}
            </Text>
          ) : null}
          {report.notes ? <Text variant="bodyMedium">{report.notes}</Text> : null}
          <View
            style={[styles.row, { gap: theme.app.spacing.sm, marginTop: theme.app.spacing.sm }]}>
            {canSharePdf() ? (
              <Button
                mode="contained"
                icon="file-pdf-box"
                onPress={() => run(() => shareHtmlAsPdf(html, title))}>
                {t('invoice.sharePdf')}
              </Button>
            ) : null}
            <Button mode="outlined" icon="printer" onPress={() => run(() => printHtml(html))}>
              {t('invoice.printA4')}
            </Button>
          </View>
        </Card.Content>
      </Card>
      {error ? <Notice message={error} /> : null}
      <ReportView report={report.data} currency={settings.currencyCode} showProfit={showProfit} />
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
});
