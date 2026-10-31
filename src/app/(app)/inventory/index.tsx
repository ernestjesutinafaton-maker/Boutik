import { usePowerSync } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { List } from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useActionContext } from '@/data/use-action-context';
import { formatMoment } from '@/domain/dates';
import { startInventory, useInventoryCounts } from '@/stock/inventory';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Les inventaires : en cours (à compter) et terminés. */
export default function InventoryListScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { can } = useActiveMember();
  const counts = useInventoryCounts();
  const [notes, setNotes] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  if (!can('stock.count')) {
    return (
      <Screen title={t('inventory.title')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  async function handleStart() {
    if (!context) {
      return;
    }
    setIsStarting(true);
    const id = await startInventory(db, context, notes.trim() || null);
    setNotes('');
    setIsStarting(false);
    router.push(`/inventory/${id}`);
  }

  const hasDraft = counts.some((count) => count.status === 'draft');

  return (
    <Screen title={t('inventory.title')} stack>
      <Notice tone="info" message={t('inventory.help')} />

      {can('stock.adjust') ? (
        <Card mode="outlined">
          <Card.Content style={{ gap: theme.app.spacing.md }}>
            <TextField
              label={t('inventory.notes')}
              placeholder={t('inventory.notesPlaceholder')}
              value={notes}
              onChangeText={setNotes}
            />
            <BigButton
              icon="clipboard-plus"
              onPress={handleStart}
              loading={isStarting}
              disabled={isStarting}>
              {t('inventory.start')}
            </BigButton>
          </Card.Content>
        </Card>
      ) : !hasDraft ? (
        <Notice tone="info" message={t('inventory.noneForCounter')} />
      ) : null}

      <Card mode="outlined">
        {counts.length === 0 ? (
          <Card.Content style={{ paddingVertical: theme.app.spacing.md }}>
            <List.Item title={t('inventory.empty')} />
          </Card.Content>
        ) : null}
        {counts.map((count) => (
          <List.Item
            key={count.id}
            title={
              count.notes || t('inventory.defaultName', { date: formatMoment(count.startedAt) })
            }
            titleStyle={{ fontWeight: '700' }}
            description={[
              t(`inventory.status.${count.status}`),
              t('inventory.countedProducts', { count: count.lineCount }),
              count.createdByName,
            ]
              .filter(Boolean)
              .join(' · ')}
            left={(props) => (
              <List.Icon
                {...props}
                icon={
                  count.status === 'draft'
                    ? 'clipboard-edit'
                    : count.status === 'validated'
                      ? 'clipboard-check'
                      : 'clipboard-remove'
                }
                color={count.status === 'draft' ? theme.app.colors.accent : props.color}
              />
            )}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push(`/inventory/${count.id}`)}
          />
        ))}
      </Card>
    </Screen>
  );
}
