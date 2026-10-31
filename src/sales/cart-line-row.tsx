import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, IconButton, Portal, Text } from 'react-native-paper';

import { TextField } from '@/components/text-field';
import { type CatalogProduct, sellableUnits } from '@/domain/catalog';
import { type CurrencyCode, formatMoney } from '@/domain/money';
import { formatQuantity, MILLI, parseUnitQuantity, pluralUnit } from '@/domain/quantity';
import { type CartLine, lineTotal } from '@/domain/sale';
import { useAppTheme } from '@/theme/paper-theme';

type CartLineRowProps = {
  line: CartLine;
  /** Le produit du catalogue (pour proposer ses autres unités) ; null s'il a disparu */
  product: CatalogProduct | null;
  currency: CurrencyCode;
  onChange: (changes: Partial<CartLine>) => void;
  onRemove: () => void;
};

/** Une ligne du panier : unité (sac, kilo…), quantité (− / + ou tapée), total de la ligne. */
export function CartLineRow({ line, product, currency, onChange, onRemove }: CartLineRowProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const units = product ? sellableUnits(product) : [];
  const { spacing } = theme.app;

  function step(delta: number) {
    const quantity = line.quantity + delta * MILLI;
    if (quantity <= 0) {
      onRemove();
    } else {
      onChange({ quantity });
    }
  }

  function openEditor() {
    setText(formatQuantity(line.quantity));
    setError(null);
    setIsEditing(true);
  }

  function saveQuantity() {
    const parsed = parseUnitQuantity(text, line.unitFactor, product?.allowDecimal ?? false);
    if (!parsed) {
      setError(t('errors.quantityInvalid'));
      return;
    }
    onChange({ quantity: parsed.quantityInUnit });
    setIsEditing(false);
  }

  return (
    <View style={{ gap: spacing.xs, paddingVertical: spacing.sm }}>
      <View style={styles.row}>
        <Text variant="titleMedium" style={[styles.fill, styles.bold]} numberOfLines={2}>
          {line.productName}
        </Text>
        <IconButton
          icon="close"
          size={20}
          onPress={onRemove}
          accessibilityLabel={t('sell.removeLine')}
        />
      </View>
      {units.length > 1 ? (
        <View style={[styles.wrap, { gap: spacing.xs }]}>
          {units.map((unit) => (
            <Chip
              key={unit.id}
              compact
              selected={unit.id === line.unitId}
              onPress={() =>
                onChange({
                  unitId: unit.id,
                  unitName: unit.name,
                  unitFactor: unit.factor,
                  unitPrice: unit.salePrice ?? 0,
                })
              }>
              {unit.name}
            </Chip>
          ))}
        </View>
      ) : null}
      <View style={[styles.row, { gap: spacing.sm }]}>
        <IconButton
          icon="minus"
          mode="contained-tonal"
          onPress={() => step(-1)}
          accessibilityLabel={t('sell.less')}
        />
        <Pressable onPress={openEditor} accessibilityRole="button" style={styles.quantity}>
          <Text variant="titleLarge" style={styles.bold}>
            {formatQuantity(line.quantity)}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {pluralUnit(line.unitName, line.quantity)}
          </Text>
        </Pressable>
        <IconButton
          icon="plus"
          mode="contained-tonal"
          onPress={() => step(1)}
          accessibilityLabel={t('sell.more')}
        />
        <View style={[styles.fill, styles.end]}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('sell.unitPrice', { price: formatMoney(line.unitPrice, currency) })}
          </Text>
          <Text variant="titleMedium" style={[styles.bold, { color: theme.colors.primary }]}>
            {formatMoney(lineTotal(line), currency)}
          </Text>
        </View>
      </View>

      <Portal>
        <Dialog visible={isEditing} onDismiss={() => setIsEditing(false)}>
          <Dialog.Title>{line.productName}</Dialog.Title>
          <Dialog.Content>
            <TextField
              label={t('sell.quantityIn', { unit: line.unitName })}
              value={text}
              onChangeText={setText}
              keyboardType="numeric"
              autoFocus
              selectTextOnFocus
              onSubmitEditing={saveQuantity}
              errorMessage={error}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsEditing(false)}>{t('common.cancel')}</Button>
            <Button onPress={saveQuantity}>{t('common.confirm')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  fill: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
  quantity: {
    minWidth: 64,
    alignItems: 'center',
  },
  end: {
    alignItems: 'flex-end',
  },
});
