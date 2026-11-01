import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Divider, IconButton, List, Text } from 'react-native-paper';

import { fitChip } from '@/components/fit-chip';
import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { addDays, dayRange, formatDay, formatTime, today } from '@/domain/dates';
import { type AuditEntry, useAuditLog } from '@/history/audit-data';
import { type AuditGroup, auditGroup, auditSummary } from '@/history/audit-summary';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

const GROUPS: AuditGroup[] = ['sales', 'credit', 'stock', 'cash', 'team'];

/** Où mène une ligne du journal quand on la touche (la vente, le produit, le client…). */
function targetOf(entry: AuditEntry): string | null {
  if (!entry.entityId) return null;
  switch (entry.entityType) {
    case 'sale':
      return `/sale/${entry.entityId}`;
    case 'product':
      return `/product/${entry.entityId}`;
    case 'customer':
      return `/customer/${entry.entityId}`;
    case 'report':
      return `/report/${entry.entityId}`;
    case 'inventory_count':
      return `/inventory/${entry.entityId}`;
    default:
      return null;
  }
}

/** Le journal des actions : qui a fait quoi, quand, sur quel appareil. Jour par jour. */
export default function HistoryScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { can } = useActiveMember();
  const settings = useShopSettings();
  const [day, setDay] = useState(today());
  const [group, setGroup] = useState<AuditGroup | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const entries = useAuditLog(dayRange(day));
  const currency = settings?.currencyCode ?? 'XOF';
  const { spacing } = theme.app;

  if (!can('reports.account')) {
    return (
      <Screen title={t('audit.title')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  const members = [
    ...new Map(
      entries
        .filter((entry) => entry.memberId)
        .map((entry) => [entry.memberId ?? '', entry.memberName ?? '?'])
    ),
  ];
  const visible = entries.filter(
    (entry) =>
      (!group || auditGroup(entry.action) === group) && (!memberId || entry.memberId === memberId)
  );
  const isToday = day === today();

  return (
    <Screen title={t('audit.title')} stack>
      <Card mode="outlined">
        <Card.Content style={styles.dayRow}>
          <IconButton
            icon="chevron-left"
            onPress={() => setDay(addDays(day, -1))}
            accessibilityLabel={t('history.previousDay')}
          />
          <Text variant="titleLarge" style={styles.bold}>
            {isToday ? t('history.today') : formatDay(day)}
          </Text>
          <IconButton
            icon="chevron-right"
            disabled={isToday}
            onPress={() => setDay(addDays(day, 1))}
            accessibilityLabel={t('history.nextDay')}
          />
        </Card.Content>
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Chip
            style={fitChip.chip}
            textStyle={fitChip.text}
            selected={group === null}
            onPress={() => setGroup(null)}>
            {t('audit.allActions')}
          </Chip>
          {GROUPS.map((candidate) => (
            <Chip
              style={fitChip.chip}
              textStyle={fitChip.text}
              key={candidate}
              selected={group === candidate}
              onPress={() => setGroup(candidate)}>
              {t(`audit.groups.${candidate}`)}
            </Chip>
          ))}
        </View>
      </ScrollView>
      {members.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[styles.row, { gap: spacing.sm }]}>
            <Chip
              style={fitChip.chip}
              textStyle={fitChip.text}
              icon="account-multiple"
              selected={memberId === null}
              onPress={() => setMemberId(null)}>
              {t('audit.everyone')}
            </Chip>
            {members.map(([id, name]) => (
              <Chip
                style={fitChip.chip}
                textStyle={fitChip.text}
                key={id}
                icon="account"
                selected={memberId === id}
                onPress={() => setMemberId(id)}>
                {name}
              </Chip>
            ))}
          </View>
        </ScrollView>
      ) : null}

      <Card mode="outlined">
        {visible.length === 0 ? (
          <Card.Content style={{ paddingVertical: spacing.md }}>
            <Text variant="bodyLarge">{t('audit.empty')}</Text>
          </Card.Content>
        ) : null}
        {visible.map((entry, index) => {
          const target = targetOf(entry);
          const summary = auditSummary(entry.action, entry.details, currency);
          const label = t(
            `audit.actions.${entry.action.replace('.', '_')}` as 'audit.actions.sale_create',
            {
              defaultValue: entry.action,
            }
          );
          return (
            <View key={entry.id}>
              {index > 0 ? <Divider /> : null}
              <List.Item
                title={label}
                titleStyle={styles.bold}
                description={[
                  formatTime(entry.occurredAt),
                  entry.memberName,
                  entry.deviceNumber ? t('audit.device', { number: entry.deviceNumber }) : null,
                  summary,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                descriptionNumberOfLines={3}
                onPress={target ? () => router.push(target) : undefined}
                right={
                  target ? (props) => <List.Icon {...props} icon="chevron-right" /> : undefined
                }
              />
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
  },
  bold: {
    fontWeight: '700',
  },
});
