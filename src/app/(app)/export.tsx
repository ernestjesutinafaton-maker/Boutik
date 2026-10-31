import { usePowerSync } from '@powersync/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { addDays, dayRange, today } from '@/domain/dates';
import { csvFileName, toCsv } from '@/export/csv';
import { buildExport, type ExportKind } from '@/export/datasets';
import { shareTextFile } from '@/export/share-file';
import { canSharePdf, printHtml, shareHtmlAsPdf } from '@/invoices/invoice-actions';
import { tableHtml } from '@/reports/table-html';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

const KINDS: ExportKind[] = [
  'sales',
  'saleLines',
  'products',
  'inventory',
  'customers',
  'expenses',
];

/** A4 couché : les tableaux ont beaucoup de colonnes. */
const LANDSCAPE = { width: 842, height: 595 };
type Period = 'thisMonth' | 'lastMonth' | 'last30' | 'all';
const PERIODS: Period[] = ['thisMonth', 'lastMonth', 'last30', 'all'];

/** Début (inclus) et fin (exclue) d'une période, et son nom pour le fichier. */
function periodRange(period: Period, day: string): { start: string; end: string; label: string } {
  const [year, month] = day.split('-').map(Number);
  const firstOfMonth = (y: number, m: number) => new Date(y, m - 1, 1).toISOString();
  const end = dayRange(day).end;
  switch (period) {
    case 'thisMonth':
      return { start: firstOfMonth(year, month), end, label: day.slice(0, 7) };
    case 'lastMonth': {
      const previous = new Date(year, month - 2, 1);
      return {
        start: previous.toISOString(),
        end: firstOfMonth(year, month),
        label: `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`,
      };
    }
    case 'last30':
      return { start: dayRange(addDays(day, -29)).start, end, label: `30-jours-${day}` };
    case 'all':
      return { start: '2000-01-01T00:00:00.000Z', end, label: `tout-${day}` };
  }
}

/**
 * Rapports téléchargeables, en Excel (CSV) ou en PDF : ventes, lignes vendues, produits et
 * stock, inventaires, clients et dettes, dépenses.
 */
export default function ExportScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const settings = useShopSettings();
  const { can } = useActiveMember();
  const [kind, setKind] = useState<ExportKind>('sales');
  const [period, setPeriod] = useState<Period>('thisMonth');
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const { spacing } = theme.app;
  // Les produits et les clients sont exportés tels qu'ils sont aujourd'hui (pas de période)
  const usesPeriod = kind !== 'products' && kind !== 'customers';

  if (!can('reports.account')) {
    return (
      <Screen title={t('export.title')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  async function handleExport(format: 'csv' | 'pdf') {
    if (!settings) return;
    setMessage(null);
    setIsWorking(true);
    try {
      const day = today();
      const range = periodRange(period, day);
      const table = await buildExport(db, {
        kind,
        shopId: settings.id,
        currency: settings.currencyCode,
        range,
        today: day,
      });
      if (format === 'pdf') {
        const html = tableHtml({
          table,
          title: t(`export.kinds.${kind}`),
          shopName: settings.name,
          subtitle: usesPeriod ? t(`export.periods.${period}`) : t('export.asOfToday'),
        });
        await (canSharePdf()
          ? shareHtmlAsPdf(html, t(`export.kinds.${kind}`), LANDSCAPE)
          : printHtml(html, LANDSCAPE));
      } else {
        const fileName = csvFileName(
          settings.name,
          `${t(`export.files.${kind}`)}-${usesPeriod ? range.label : day}`
        );
        await shareTextFile(fileName, toCsv(table.headers, table.rows), 'text/csv');
      }
      setMessage({ text: t('export.done', { count: table.rows.length }), tone: 'info' });
    } catch (error) {
      console.warn('Export impossible :', error);
      setMessage({ text: t('errors.unknown'), tone: 'error' });
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Screen title={t('export.title')} stack>
      <Notice tone="info" message={t('export.help')} />
      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.md }}>
          <Text variant="titleMedium">{t('export.what')}</Text>
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            {KINDS.map((candidate) => (
              <Chip
                key={candidate}
                selected={candidate === kind}
                onPress={() => setKind(candidate)}>
                {t(`export.kinds.${candidate}`)}
              </Chip>
            ))}
          </View>
          {usesPeriod ? (
            <>
              <Text variant="titleMedium">{t('export.period')}</Text>
              <View style={[styles.wrap, { gap: spacing.sm }]}>
                {PERIODS.map((candidate) => (
                  <Chip
                    key={candidate}
                    selected={candidate === period}
                    onPress={() => setPeriod(candidate)}>
                    {t(`export.periods.${candidate}`)}
                  </Chip>
                ))}
              </View>
            </>
          ) : null}
        </Card.Content>
      </Card>
      {message ? <Notice tone={message.tone} message={message.text} /> : null}
      <BigButton
        icon="file-excel"
        onPress={() => handleExport('csv')}
        loading={isWorking}
        disabled={isWorking}>
        {t('export.button')}
      </BigButton>
      <BigButton
        icon="file-pdf-box"
        variant="outline"
        onPress={() => handleExport('pdf')}
        disabled={isWorking}>
        {canSharePdf() ? t('export.buttonPdf') : t('export.buttonPrint')}
      </BigButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
