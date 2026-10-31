import { usePowerSync } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useActionContext } from '@/data/use-action-context';
import { type CatalogProduct, type CatalogUnit, sortUnits } from '@/domain/catalog';
import { formatDay, today } from '@/domain/dates';
import { formatQuantityWithUnit, parseUnitQuantity } from '@/domain/quantity';
import { isExpired } from '@/domain/stock';
import { useProduct } from '@/products/product-data';
import { ProductPicker } from '@/products/product-picker';
import { UnitQuantityField } from '@/products/unit-quantity-field';
import type { LossReason } from '@/stock/movements';
import { declareLoss, LossExceedsStockError } from '@/stock/stock-actions';
import { useProductLots } from '@/stock/stock-data';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

const REASONS: LossReason[] = ['expired', 'broken', 'stolen', 'other'];

function isLossReason(value: string | undefined): value is LossReason {
  return REASONS.includes(value as LossReason);
}

/** Déclarer une perte : périmé, cassé, volé… (avec le lot concerné si on le connaît). */
export default function LossScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ productId?: string; lotId?: string; reason?: string }>();
  const [productId, setProductId] = useState(params.productId ?? '');
  const { product } = useProduct(productId);
  const { can } = useActiveMember();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  if (!can('stock.adjust')) {
    return (
      <Screen title={t('losses.title')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  return (
    <Screen title={t('losses.title')} stack>
      {product ? (
        <LossForm
          key={product.id}
          product={product}
          initialLotId={product.id === params.productId ? (params.lotId ?? null) : null}
          initialReason={isLossReason(params.reason) ? params.reason : 'broken'}
        />
      ) : null}
      <BigButton icon="magnify" variant="outline" onPress={() => setIsPickerOpen(true)}>
        {product ? t('losses.otherProduct') : t('losses.chooseProduct')}
      </BigButton>
      <ProductPicker
        visible={isPickerOpen}
        title={t('losses.chooseProduct')}
        onClose={() => setIsPickerOpen(false)}
        onPick={(picked) => {
          setIsPickerOpen(false);
          setProductId(picked.id);
        }}
      />
    </Screen>
  );
}

function LossForm({
  product,
  initialLotId,
  initialReason,
}: {
  product: CatalogProduct;
  initialLotId: string | null;
  initialReason: LossReason;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const lots = useProductLots(product.id).filter((lot) => lot.remaining > 0);
  const units = sortUnits(product.units);
  const [lotId, setLotId] = useState<string | null>(initialLotId);
  const [unit, setUnit] = useState<CatalogUnit | undefined>(units[0]);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<LossReason>(initialReason);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { spacing } = theme.app;
  const day = today();
  const selectedLot = lots.find((lot) => lot.id === lotId);

  async function handleSave() {
    if (!context || !unit) {
      return;
    }
    const parsed = parseUnitQuantity(quantity, unit.factor, product.allowDecimal);
    if (!parsed) {
      setError(t('errors.quantityRequired'));
      return;
    }
    if (selectedLot && parsed.baseQuantity > selectedLot.remaining) {
      setError(
        t('losses.moreThanLot', {
          quantity: formatQuantityWithUnit(selectedLot.remaining, product.baseUnit),
        })
      );
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await declareLoss(db, context, {
        productId: product.id,
        productName: product.name,
        lotId: selectedLot ? selectedLot.id : null,
        quantity: parsed.baseQuantity,
        reason,
        note: note.trim() || null,
      });
      router.back();
    } catch (saveError) {
      if (saveError instanceof LossExceedsStockError) {
        setError(
          t('losses.moreThanStock', {
            quantity: formatQuantityWithUnit(saveError.available, product.baseUnit),
          })
        );
      } else {
        console.warn('Perte impossible à enregistrer :', saveError);
        setError(t('errors.unknown'));
      }
      setIsSaving(false);
    }
  }

  return (
    <>
      <Card mode="outlined">
        <Card.Title title={product.name} titleVariant="titleLarge" titleNumberOfLines={2} />
        <Card.Content style={{ gap: spacing.md }}>
          <Text variant="titleMedium">{t('losses.lot')}</Text>
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            <Chip selected={lotId === null} onPress={() => setLotId(null)}>
              {t('losses.automaticLot')}
            </Chip>
            {lots.map((lot) => (
              <Chip
                key={lot.id}
                selected={lot.id === lotId}
                icon={isExpired(lot, day) ? 'calendar-remove' : undefined}
                onPress={() => setLotId(lot.id)}>
                {[
                  formatQuantityWithUnit(lot.remaining, product.baseUnit),
                  lot.expiryDate ? formatDay(lot.expiryDate) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Chip>
            ))}
          </View>

          {unit ? (
            <UnitQuantityField
              units={units}
              unitId={unit.id}
              onUnitChange={setUnit}
              quantity={quantity}
              onQuantityChange={setQuantity}
              label={t('losses.quantity', { unit: unit.name })}
            />
          ) : null}

          <Text variant="titleMedium">{t('losses.reason')}</Text>
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            {REASONS.map((candidate) => (
              <Chip
                key={candidate}
                selected={candidate === reason}
                onPress={() => setReason(candidate)}>
                {t(`losses.reasons.${candidate}`)}
              </Chip>
            ))}
          </View>
          <TextField label={t('losses.note')} value={note} onChangeText={setNote} />
        </Card.Content>
      </Card>
      {error ? <Notice message={error} /> : null}
      <BigButton
        icon="delete-alert"
        variant="danger"
        onPress={handleSave}
        loading={isSaving}
        disabled={isSaving}>
        {t('losses.save')}
      </BigButton>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
