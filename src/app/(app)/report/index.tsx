import { usePowerSync } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Dialog, Divider, List, Portal, SegmentedButtons, Text } from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { MoneyText } from '@/components/money-text';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useActionContext } from '@/data/use-action-context';
import { dayOfMoment, formatDay, formatMoment, monthOf, startOfWeek } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { makeAccount } from '@/reports/report-actions';
import {
  type ArchivedReport,
  type ReportKind,
  useLastAccountEnd,
  useReports,
} from '@/reports/report-data';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { LimitedNotice, useIsLimited } from '@/subscription/limited-notice';
import { useAppTheme } from '@/theme/paper-theme';

type Grouping = 'day' | 'week' | 'month';

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** La clé du groupe d'un rapport (jour, semaine ou mois de sa fin). */
function groupKey(report: ArchivedReport, grouping: Grouping): string {
  const day = dayOfMoment(report.periodEnd);
  return grouping === 'day' ? day : grouping === 'week' ? startOfWeek(day) : monthOf(day);
}

/** Les archives : clôtures de journée et comptes, regroupés par jour, semaine ou mois. */
export default function ReportsScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const settings = useShopSettings();
  const { can } = useActiveMember();
  const canAccount = can('reports.account');
  // Le caissier voit les clôtures de journée ; le propriétaire et le gérant voient aussi les comptes
  const kinds: ReportKind[] = canAccount ? ['day_close', 'account'] : ['day_close'];
  const reports = useReports(kinds);
  const lastAccountEnd = useLastAccountEnd();
  const [grouping, setGrouping] = useState<Grouping>('day');
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const currency = settings?.currencyCode ?? 'XOF';
  const { spacing } = theme.app;
  const limited = useIsLimited();

  if (!canAccount && !can('cash.session')) {
    return (
      <Screen title={t('report.archivesTitle')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  async function handleAccount() {
    if (!context) return;
    setIsWorking(true);
    try {
      const id = await makeAccount(db, context, notes.trim() || null);
      setIsAccountOpen(false);
      setNotes('');
      router.push(`/report/${id}`);
    } finally {
      setIsWorking(false);
    }
  }

  const groups = new Map<string, ArchivedReport[]>();
  for (const report of reports) {
    const key = groupKey(report, grouping);
    groups.set(key, [...(groups.get(key) ?? []), report]);
  }
  const groupTitle = (key: string) => {
    if (grouping === 'day') return formatDay(key);
    if (grouping === 'week') return t('report.weekOf', { date: formatDay(key) });
    const [year, month] = key.split('-');
    return `${MONTHS[Number(month) - 1]} ${year}`;
  };

  return (
    <Screen title={t('report.archivesTitle')} stack>
      {limited ? <LimitedNotice /> : null}
      {canAccount && !limited ? (
        <Card mode="outlined">
          <Card.Content style={{ gap: spacing.sm }}>
            <Text variant="bodyLarge">
              {lastAccountEnd
                ? t('report.sinceLastAccount', { date: formatMoment(lastAccountEnd) })
                : t('report.firstAccount')}
            </Text>
            <BigButton
              icon="calculator-variant"
              variant="accent"
              onPress={() => setIsAccountOpen(true)}>
              {t('report.makeAccount')}
            </BigButton>
          </Card.Content>
        </Card>
      ) : null}

      <SegmentedButtons
        value={grouping}
        onValueChange={(value) =>
          setGrouping(value === 'week' ? 'week' : value === 'month' ? 'month' : 'day')
        }
        buttons={[
          { value: 'day', label: t('report.byDay') },
          { value: 'week', label: t('report.byWeek') },
          { value: 'month', label: t('report.byMonth') },
        ]}
      />

      {reports.length === 0 ? <Notice tone="info" message={t('report.empty')} /> : null}

      {[...groups.entries()].map(([key, items]) => {
        const dayCloses = items.filter((report) => report.kind === 'day_close');
        const revenue = dayCloses.reduce((sum, report) => sum + report.data.sales.revenue, 0);
        return (
          <Card key={key} mode="outlined">
            <Card.Title
              title={groupTitle(key)}
              titleVariant="titleLarge"
              subtitle={
                dayCloses.length > 0
                  ? t('report.groupRevenue', { count: dayCloses.length })
                  : undefined
              }
              right={() =>
                dayCloses.length > 0 ? (
                  <View style={{ marginRight: spacing.md }}>
                    <MoneyText
                      amount={revenue}
                      currency={currency}
                      style={{ fontSize: theme.app.fontSize.large }}
                    />
                  </View>
                ) : null
              }
            />
            {items.map((report, index) => (
              <View key={report.id}>
                {index > 0 ? <Divider /> : null}
                <List.Item
                  title={t(`report.kinds.${report.kind}`)}
                  titleStyle={{ fontWeight: '700' }}
                  description={`${formatMoment(report.periodStart)} → ${formatMoment(report.periodEnd)}${report.createdByName ? ` · ${report.createdByName}` : ''}`}
                  descriptionNumberOfLines={2}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon={report.kind === 'account' ? 'calculator-variant' : 'lock-check'}
                    />
                  )}
                  right={() => (
                    <Text variant="titleMedium" style={{ alignSelf: 'center' }}>
                      {formatMoney(report.data.sales.revenue, currency)}
                    </Text>
                  )}
                  onPress={() => router.push(`/report/${report.id}`)}
                />
              </View>
            ))}
          </Card>
        );
      })}

      <Portal>
        <Dialog visible={isAccountOpen} onDismiss={() => setIsAccountOpen(false)}>
          <Dialog.Title>{t('report.makeAccount')}</Dialog.Title>
          <Dialog.Content style={{ gap: spacing.md }}>
            <Text variant="bodyLarge">
              {lastAccountEnd
                ? t('report.accountConfirm', { date: formatMoment(lastAccountEnd) })
                : t('report.accountConfirmFirst')}
            </Text>
            <TextField label={t('report.notes')} value={notes} onChangeText={setNotes} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsAccountOpen(false)}>{t('common.back')}</Button>
            <Button onPress={handleAccount} loading={isWorking} disabled={isWorking}>
              {t('common.confirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}
