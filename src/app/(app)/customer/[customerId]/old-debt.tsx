import { usePowerSync } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { addOldDebt } from '@/customers/customer-actions';
import { useCustomer } from '@/customers/customer-data';
import { useActionContext } from '@/data/use-action-context';
import { formatDay, parseDayInput, today } from '@/domain/dates';
import { parseMoney } from '@/domain/money';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Dette ancienne (notée dans un cahier avant Boutik) : montant, date réelle, remarque. */
export default function OldDebtScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const settings = useShopSettings();
  const { can } = useActiveMember();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const { customer } = useCustomer(customerId);
  const [amountText, setAmountText] = useState('');
  const [dayText, setDayText] = useState(() => formatDay(today()));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!can('customers.edit')) {
    return (
      <Screen title={t('oldDebt.title')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  async function handleSave() {
    if (!context || !customer || !settings) return;
    const amount = parseMoney(amountText, settings.currencyCode);
    const day = parseDayInput(dayText);
    if (amount === null || amount <= 0) {
      setError(t('repay.amountInvalid'));
      return;
    }
    if (!day || day > today()) {
      setError(t('oldDebt.dateInvalid'));
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await addOldDebt(db, context, { customer, amount, day, note: note.trim() || null });
      router.back();
    } catch (saveError) {
      console.warn('Dette ancienne impossible :', saveError);
      setError(t('errors.unknown'));
      setIsSaving(false);
    }
  }

  return (
    <Screen title={t('oldDebt.title')} stack>
      <Notice tone="info" message={t('oldDebt.help', { name: customer?.name ?? '' })} />
      <Card mode="outlined">
        <Card.Content style={{ gap: theme.app.spacing.md }}>
          <TextField
            label={t('oldDebt.amount')}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="numeric"
            autoFocus
          />
          <TextField
            label={t('oldDebt.date')}
            value={dayText}
            onChangeText={setDayText}
            keyboardType="numbers-and-punctuation"
          />
          <TextField label={t('oldDebt.note')} value={note} onChangeText={setNote} />
        </Card.Content>
      </Card>
      {error ? <Notice message={error} /> : null}
      <BigButton icon="content-save" onPress={handleSave} loading={isSaving} disabled={isSaving}>
        {t('common.save')}
      </BigButton>
    </Screen>
  );
}
