import { usePowerSync } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Chip, Divider, Text } from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { MoneyText } from '@/components/money-text';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useActionContext } from '@/data/use-action-context';
import { formatQuantity, parseUnitQuantity } from '@/domain/quantity';
import { returnValue } from '@/domain/sale';
import { usePaymentMethods } from '@/sales/payment-methods';
import { returnSaleItems } from '@/sales/sale-actions';
import { type SaleDetail, useSale } from '@/sales/sale-data';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Retour d'articles : le client rapporte une partie de ce qu'il a acheté. */
export default function ReturnScreen() {
  const { t } = useTranslation();
  const { saleId } = useLocalSearchParams<{ saleId: string }>();
  const { sale } = useSale(saleId);
  const { can } = useActiveMember();

  if (!can('sale.cancel')) {
    return (
      <Screen title={t('saleReturn.title')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }
  if (!sale) {
    return (
      <Screen title={t('saleReturn.title')} stack>
        {null}
      </Screen>
    );
  }
  return <ReturnForm sale={sale} />;
}

function ReturnForm({ sale }: { sale: SaleDetail }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const settings = useShopSettings();
  const methods = usePaymentMethods();
  const currency = settings?.currencyCode ?? 'XOF';
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [methodId, setMethodId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { spacing } = theme.app;
  const refundMethodId = methodId ?? methods.find((method) => method.isCash)?.id ?? methods[0]?.id;

  // Ce que le client rapporte, ligne par ligne, converti en unité de base
  const requests = sale.items.map((item) => {
    const text = quantities[item.id] ?? '';
    const parsed = text.trim() ? parseUnitQuantity(text, item.unitFactor, true) : null;
    const remaining = item.baseQuantity - item.returnedQuantity;
    return {
      item,
      remaining,
      baseQuantity: parsed?.baseQuantity ?? 0,
      invalid: Boolean(text.trim()) && (!parsed || parsed.baseQuantity > remaining),
    };
  });
  const value = requests.reduce(
    (sum, request) =>
      request.invalid || request.baseQuantity === 0
        ? sum
        : sum +
          returnValue({
            lineTotal: request.item.lineTotal,
            lineBaseQuantity: request.item.baseQuantity,
            returnedBaseQuantity: request.baseQuantity,
            saleSubtotal: sale.subtotal,
            saleTotal: sale.total,
          }),
    0
  );

  async function handleSave() {
    if (!context || !refundMethodId) {
      return;
    }
    if (requests.some((request) => request.invalid)) {
      setError(t('saleReturn.invalid'));
      return;
    }
    const items = requests
      .filter((request) => request.baseQuantity > 0)
      .map((request) => ({ saleItemId: request.item.id, baseQuantity: request.baseQuantity }));
    if (items.length === 0 || !reason.trim()) {
      setError(t('saleReturn.missing'));
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await returnSaleItems(db, context, {
        saleId: sale.id,
        items,
        refundMethodId,
        reason: reason.trim(),
      });
      router.back();
    } catch (saveError) {
      console.warn('Retour impossible :', saveError);
      setError(t('errors.unknown'));
      setIsSaving(false);
    }
  }

  return (
    <Screen title={t('saleReturn.title')} stack>
      <Notice tone="info" message={t('saleReturn.help')} />
      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.md }}>
          {requests.map(({ item, remaining, invalid }, index) => (
            <View key={item.id} style={{ gap: spacing.sm }}>
              {index > 0 ? <Divider /> : null}
              <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                {item.productName}
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('saleReturn.canReturn', {
                  quantity: formatQuantity(Math.round((remaining * 1000) / item.unitFactor)),
                  unit: item.unitName,
                })}
              </Text>
              <TextField
                label={t('saleReturn.quantity', { unit: item.unitName })}
                value={quantities[item.id] ?? ''}
                onChangeText={(text) =>
                  setQuantities((current) => ({ ...current, [item.id]: text }))
                }
                keyboardType="numeric"
                disabled={remaining <= 0}
                errorMessage={invalid ? t('saleReturn.tooMuch') : null}
              />
            </View>
          ))}
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.md }}>
          <Text variant="titleMedium">{t('saleReturn.refundMethod')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {methods.map((method) => (
              <Chip
                key={method.id}
                selected={method.id === refundMethodId}
                onPress={() => setMethodId(method.id)}>
                {method.label}
              </Chip>
            ))}
          </View>
          <TextField label={t('saleReturn.reason')} value={reason} onChangeText={setReason} />
          <Text variant="titleMedium">{t('saleReturn.value')}</Text>
          <MoneyText amount={value} currency={currency} />
          {sale.due > 0 ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('saleReturn.debtFirst')}
            </Text>
          ) : null}
        </Card.Content>
      </Card>

      {error ? <Notice message={error} /> : null}
      <BigButton
        icon="keyboard-return"
        onPress={handleSave}
        loading={isSaving}
        disabled={isSaving || value === 0}>
        {t('saleReturn.save')}
      </BigButton>
    </Screen>
  );
}
