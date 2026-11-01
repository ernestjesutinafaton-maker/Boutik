import { usePowerSync } from '@powersync/react';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Chip, Divider, Text } from 'react-native-paper';

import { fitChip } from '@/components/fit-chip';
import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useActionContext } from '@/data/use-action-context';
import { declareExpense } from '@/deliveries/delivery-actions';
import { useDeliveries, useDeliveryExpenses } from '@/deliveries/delivery-data';
import { pickReceiptPhoto } from '@/deliveries/delivery-proofs';
import { ExpenseLines } from '@/deliveries/expense-parts';
import { COURIER_EXPENSE_CATEGORIES, type CourierExpenseCategory } from '@/domain/delivery';
import { type CurrencyCode, parseMoney } from '@/domain/money';
import { dataUri } from '@/products/photos';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Les livraisons proposées pour relier une dépense : les siennes des dernières 24 heures. */
const RECENT_MS = 24 * 3_600_000;

/**
 * Le livreur note une dépense (carburant, transport…) avec la PHOTO du reçu, obligatoire.
 * Elle est enregistrée tout de suite, même sans internet ; la photo part dès qu'il y en a.
 * En dessous : ses dépenses, remboursées, refusées (avec la raison) ou en attente.
 */
export default function DeliveryExpenseScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { shop } = useShop();
  const { can, member } = useActiveMember();
  const { deliveries } = useDeliveries();
  const mine = useDeliveryExpenses(member?.id ?? '');
  const [category, setCategory] = useState<CourierExpenseCategory>('fuel');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ amount?: boolean; photo?: boolean }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const currency: CurrencyCode = shop?.currencyCode ?? 'XOF';
  const { spacing } = theme.app;
  const memberId = member?.id ?? '';

  // Lu une fois à l'ouverture de l'écran
  const [since] = useState(() => new Date(Date.now() - RECENT_MS).toISOString());
  const recent = useMemo(() => {
    return deliveries.filter(
      (delivery) =>
        delivery.assignedTo === memberId &&
        delivery.status !== 'cancelled' &&
        delivery.updatedAt >= since
    );
  }, [deliveries, memberId, since]);

  if (!can('delivery.handle')) {
    return (
      <Screen title={t('deliveries.expense.title')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  async function choosePhoto(source: 'camera' | 'library') {
    const picked = await pickReceiptPhoto(source);
    if (picked) {
      setPhoto(picked);
      setErrors((current) => ({ ...current, photo: false }));
    }
  }

  async function handleSave() {
    if (!context) {
      return;
    }
    const parsed = parseMoney(amount, currency);
    const next = { amount: parsed === null || parsed <= 0, photo: !photo };
    setErrors(next);
    if (next.amount || next.photo || parsed === null || !photo) {
      return;
    }
    setIsSaving(true);
    setSaved(false);
    setFailed(false);
    try {
      await declareExpense(db, context, {
        deliveryId,
        category,
        amount: parsed,
        note: note.trim() ? note.trim().slice(0, 300) : null,
        photo,
      });
      setAmount('');
      setNote('');
      setPhoto(null);
      setDeliveryId(null);
      setSaved(true);
    } catch (error) {
      console.warn('Dépense non enregistrée :', error);
      setFailed(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen title={t('deliveries.expense.title')} stack>
      {saved ? <Notice tone="info" message={t('deliveries.expense.saved')} /> : null}
      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.md }}>
          <Text variant="titleMedium">{t('deliveries.expense.category')}</Text>
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            {COURIER_EXPENSE_CATEGORIES.map((candidate) => (
              <Chip
                key={candidate}
                style={fitChip.chip}
                textStyle={fitChip.text}
                selected={category === candidate}
                onPress={() => setCategory(candidate)}>
                {t(`deliveries.expense.categories.${candidate}`)}
              </Chip>
            ))}
          </View>
          <TextField
            label={t('deliveries.expense.amount')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            errorMessage={errors.amount ? t('deliveries.errors.amount') : null}
          />
          {recent.length > 0 ? (
            <>
              <Text variant="titleMedium">{t('deliveries.expense.delivery')}</Text>
              <View style={[styles.wrap, { gap: spacing.sm }]}>
                <Chip
                  style={fitChip.chip}
                  textStyle={fitChip.text}
                  selected={deliveryId === null}
                  onPress={() => setDeliveryId(null)}>
                  {t('deliveries.expense.noDelivery')}
                </Chip>
                {recent.map((delivery) => (
                  <Chip
                    key={delivery.id}
                    style={fitChip.chip}
                    textStyle={fitChip.text}
                    selected={deliveryId === delivery.id}
                    onPress={() => setDeliveryId(delivery.id)}>
                    {delivery.address}
                  </Chip>
                ))}
              </View>
            </>
          ) : null}
          <TextField label={t('deliveries.expense.note')} value={note} onChangeText={setNote} />

          <Text variant="titleMedium">{t('deliveries.expense.photo')}</Text>
          {photo ? (
            <Image
              source={{ uri: dataUri(photo) }}
              style={[styles.photo, { borderRadius: theme.app.radius.md }]}
              contentFit="contain"
              accessibilityLabel={t('deliveries.expense.photo')}
            />
          ) : null}
          {errors.photo ? <Notice message={t('deliveries.errors.photo')} /> : null}
          <View style={{ gap: spacing.sm }}>
            <BigButton
              icon="camera"
              variant="outline"

              onPress={() => choosePhoto('camera')}>
              {t('deliveries.expense.takePhoto')}
            </BigButton>
            <BigButton
              icon="image"
              variant="outline"

              onPress={() => choosePhoto('library')}>
              {t('deliveries.expense.choosePhoto')}
            </BigButton>
          </View>
        </Card.Content>
      </Card>
      {failed ? <Notice message={t('deliveries.errors.failed')} /> : null}
      <BigButton icon="content-save" loading={isSaving} disabled={isSaving} onPress={handleSave}>
        {t('deliveries.expense.save')}
      </BigButton>

      <Card mode="outlined">
        <Card.Title title={t('deliveries.expense.mine')} titleVariant="titleLarge" />
        <Card.Content style={{ gap: spacing.sm }}>
          {mine.length === 0 ? (
            <Text variant="bodyLarge">{t('deliveries.expense.noneYet')}</Text>
          ) : null}
          {mine.map((expense, index) => (
            <View key={expense.id} style={{ gap: spacing.sm }}>
              {index > 0 ? <Divider /> : null}
              <ExpenseLines expense={expense} currency={currency} withStatus />
            </View>
          ))}
        </Card.Content>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  photo: {
    width: '100%',
    height: 240,
  },
});
