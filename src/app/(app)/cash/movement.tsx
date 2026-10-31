import { usePowerSync } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { recordCashMovement } from '@/cash/cash-actions';
import { useActionContext } from '@/data/use-action-context';
import { type CashMovementType, EXPENSE_CATEGORIES, type ExpenseCategory } from '@/domain/cash';
import { parseMoney } from '@/domain/money';
import { EXPENSE_LABELS } from '@/reports/report-html';
import { usePaymentMethods } from '@/sales/payment-methods';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

const TYPES: { type: CashMovementType; permission: 'cash.expense' | 'cash.withdrawal' }[] = [
  { type: 'expense', permission: 'cash.expense' },
  { type: 'stock_purchase', permission: 'cash.expense' },
  { type: 'withdrawal', permission: 'cash.withdrawal' },
  { type: 'deposit', permission: 'cash.withdrawal' },
];

/** Dépense ou sortie de caisse : essence, livraison, achat payé par la caisse, retrait… */
export default function CashMovementScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const settings = useShopSettings();
  const { can } = useActiveMember();
  const methods = usePaymentMethods();
  const allowed = TYPES.filter((item) => can(item.permission));
  const [type, setType] = useState<CashMovementType>('expense');
  const [category, setCategory] = useState<ExpenseCategory>('transport');
  const [methodId, setMethodId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const method =
    methods.find((candidate) => candidate.id === methodId) ??
    methods.find((m) => m.isCash) ??
    methods[0];
  const { spacing } = theme.app;

  if (allowed.length === 0) {
    return (
      <Screen title={t('cash.movementTitle')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  async function handleSave() {
    if (!context || !settings || !method) return;
    const amount = parseMoney(amountText, settings.currencyCode);
    if (amount === null || amount <= 0) {
      setError(t('repay.amountInvalid'));
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await recordCashMovement(db, context, {
        type,
        category: type === 'expense' ? category : null,
        methodId: method.id,
        amount,
        note: note.trim() || null,
      });
      router.back();
    } catch (saveError) {
      console.warn('Sortie de caisse impossible :', saveError);
      setError(t('errors.unknown'));
      setIsSaving(false);
    }
  }

  return (
    <Screen title={t('cash.movementTitle')} stack>
      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.md }}>
          <Text variant="titleMedium">{t('cash.movementType')}</Text>
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            {allowed.map((item) => (
              <Chip
                key={item.type}
                selected={item.type === type}
                onPress={() => setType(item.type)}>
                {t(`cash.types.${item.type}`)}
              </Chip>
            ))}
          </View>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t(`cash.typeHelp.${type}`)}
          </Text>

          {type === 'expense' ? (
            <>
              <Text variant="titleMedium">{t('cash.category')}</Text>
              <View style={[styles.wrap, { gap: spacing.sm }]}>
                {EXPENSE_CATEGORIES.map((candidate) => (
                  <Chip
                    key={candidate}
                    selected={candidate === category}
                    onPress={() => setCategory(candidate)}>
                    {EXPENSE_LABELS[candidate]}
                  </Chip>
                ))}
              </View>
            </>
          ) : null}

          <TextField
            label={t('cash.amount')}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="numeric"
          />
          <Text variant="titleMedium">{t('cash.paidWith')}</Text>
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            {methods.map((candidate) => (
              <Chip
                key={candidate.id}
                selected={candidate.id === method?.id}
                onPress={() => setMethodId(candidate.id)}>
                {candidate.label}
              </Chip>
            ))}
          </View>
          <TextField label={t('cash.note')} value={note} onChangeText={setNote} />
        </Card.Content>
      </Card>
      {error ? <Notice message={error} /> : null}
      <BigButton icon="content-save" onPress={handleSave} loading={isSaving} disabled={isSaving}>
        {t('common.save')}
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
