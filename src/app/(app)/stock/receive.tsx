import { usePowerSync, useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, IconButton, Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { MoneyText } from '@/components/money-text';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { newId } from '@/data/ids';
import { useActionContext } from '@/data/use-action-context';
import { type CatalogProduct, type CatalogUnit, sortUnits } from '@/domain/catalog';
import { parseDayInput } from '@/domain/dates';
import { type CurrencyCode, formatMoneyInput, parseMoney } from '@/domain/money';
import { unitCost } from '@/domain/margin';
import { costForQuantity, lineAmount, parseQuantity } from '@/domain/quantity';
import type { TranslationKey } from '@/i18n/keys';
import { useProduct } from '@/products/product-data';
import { ProductPicker } from '@/products/product-picker';
import { useShop } from '@/shop/shop-provider';
import { type ReceiptLineInput, receiveStock } from '@/stock/stock-actions';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Une ligne en cours de saisie : produit, unité d'achat, quantité, prix d'achat, péremption. */
type LineDraft = {
  key: string;
  product: CatalogProduct;
  unitId: string;
  quantity: string;
  unitCost: string;
  expiry: string;
  /** Dernier prix d'achat connu (pour pré-remplir quand on change d'unité) */
  lastCost: LastCost;
};

type LineErrors = Partial<Record<'quantity' | 'unitCost' | 'expiry', TranslationKey>>;

/** Par défaut, on achète dans le plus gros conditionnement (sac, carton…). */
function purchaseUnit(product: CatalogProduct): CatalogUnit | undefined {
  return sortUnits(product.units).reduce<CatalogUnit | undefined>(
    (largest, unit) => (!largest || unit.factor > largest.factor ? unit : largest),
    undefined
  );
}

type LastCost = { costPrice: number; costQuantity: number } | null;

const LAST_COST_SQL =
  'SELECT cost_price, cost_quantity FROM stock_lots WHERE product_id = ? ORDER BY received_at DESC LIMIT 1';

/**
 * Le prix d'achat proposé pour une unité : d'abord celui du catalogue (fixé par le
 * propriétaire, déduit des autres unités si besoin), sinon celui de la dernière réception.
 */
function suggestedCost(
  product: CatalogProduct,
  unit: CatalogUnit,
  lastCost: LastCost,
  currency: CurrencyCode
): string | null {
  const fromCatalog = unitCost(unit, product.units).cost;
  if (fromCatalog !== null) {
    return formatMoneyInput(fromCatalog, currency);
  }
  return lastCost
    ? formatMoneyInput(
        costForQuantity(lastCost.costPrice, lastCost.costQuantity, unit.factor),
        currency
      )
    : null;
}

/** Prépare une ligne, avec le prix d'achat proposé pour l'unité choisie. */
function makeLine(
  product: CatalogProduct,
  unit: CatalogUnit,
  lastCost: LastCost,
  currency: CurrencyCode
): LineDraft {
  return {
    key: newId(),
    product,
    unitId: unit.id,
    quantity: '',
    unitCost: suggestedCost(product, unit, lastCost, currency) ?? '',
    expiry: '',
    lastCost,
  };
}

/**
 * Réception de marchandise : chaque ligne crée un lot (prix d'achat, péremption).
 * Ouverte depuis la fiche d'un produit, elle commence avec la ligne de ce produit.
 */
export default function ReceiveStockScreen() {
  const { t } = useTranslation();
  const { shop } = useShop();
  const { productId = '' } = useLocalSearchParams<{ productId?: string }>();
  const { product, isLoading } = useProduct(productId);
  const { data: costs, isLoading: isCostLoading } = useQuery<{
    cost_price: number;
    cost_quantity: number;
  }>(LAST_COST_SQL, [productId]);
  const currency = shop?.currencyCode ?? 'XOF';

  if (productId && (isLoading || isCostLoading)) {
    return (
      <Screen title={t('receive.title')} stack>
        {null}
      </Screen>
    );
  }
  const unit = product ? purchaseUnit(product) : undefined;
  const lastCost = costs[0]
    ? { costPrice: costs[0].cost_price, costQuantity: costs[0].cost_quantity }
    : null;
  const initialLines = product && unit ? [makeLine(product, unit, lastCost, currency)] : [];
  return <ReceiveForm initialLines={initialLines} currency={currency} />;
}

function ReceiveForm({
  initialLines,
  currency,
}: {
  initialLines: LineDraft[];
  currency: CurrencyCode;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { can } = useActiveMember();

  const [supplierName, setSupplierName] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<LineDraft[]>(initialLines);
  const [errors, setErrors] = useState<Record<string, LineErrors>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { spacing } = theme.app;

  async function addLine(product: CatalogProduct, scannedUnit: CatalogUnit | null) {
    setIsPickerOpen(false);
    const unit = scannedUnit ?? purchaseUnit(product);
    if (!unit) {
      return;
    }
    const last = await db.getOptional<{ cost_price: number; cost_quantity: number }>(
      LAST_COST_SQL,
      [product.id]
    );
    const lastCost = last ? { costPrice: last.cost_price, costQuantity: last.cost_quantity } : null;
    setLines((current) => [...current, makeLine(product, unit, lastCost, currency)]);
  }

  function updateLine(key: string, changes: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...changes } : line))
    );
  }

  function changeUnit(line: LineDraft, unit: CatalogUnit) {
    updateLine(line.key, {
      unitId: unit.id,
      unitCost: suggestedCost(line.product, unit, line.lastCost, currency) ?? line.unitCost,
    });
  }

  /** Vérifie chaque ligne ; renvoie les lignes prêtes, ou null s'il y a des erreurs. */
  function validate(): ReceiptLineInput[] | null {
    const nextErrors: Record<string, LineErrors> = {};
    const ready: ReceiptLineInput[] = [];
    for (const line of lines) {
      const lineErrors: LineErrors = {};
      const unit = line.product.units.find((candidate) => candidate.id === line.unitId);
      const quantity = parseQuantity(line.quantity, line.product.allowDecimal);
      const unitCost = parseMoney(line.unitCost, currency);
      const expiry = line.expiry.trim() ? parseDayInput(line.expiry) : null;
      if (!quantity) {
        lineErrors.quantity = line.product.allowDecimal
          ? 'errors.quantityRequired'
          : 'errors.quantityWholeOnly';
      }
      if (unitCost === null) {
        lineErrors.unitCost = 'errors.priceInvalid';
      }
      if (line.expiry.trim() && !expiry) {
        lineErrors.expiry = 'errors.dateInvalid';
      } else if (line.product.trackExpiry && !expiry) {
        lineErrors.expiry = 'errors.expiryRequired';
      }
      if (Object.keys(lineErrors).length > 0 || !unit || !quantity || unitCost === null) {
        nextErrors[line.key] = lineErrors;
        continue;
      }
      ready.push({
        productId: line.product.id,
        productName: line.product.name,
        unitName: unit.name,
        unitFactor: unit.factor,
        quantityInUnit: quantity,
        unitCost,
        expiryDate: expiry,
      });
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length > 0 ? null : ready;
  }

  async function handleSave() {
    if (!context) {
      return;
    }
    if (lines.length === 0) {
      setFormError(t('receive.noLines'));
      return;
    }
    const ready = validate();
    if (!ready) {
      setFormError(t('productForm.fixErrors'));
      return;
    }
    setFormError(null);
    setIsSaving(true);
    try {
      await receiveStock(db, context, {
        supplierName: supplierName.trim() || null,
        reference: reference.trim() || null,
        lines: ready,
      });
      router.back();
    } catch (error) {
      console.warn('Réception impossible :', error);
      setFormError(t('errors.unknown'));
      setIsSaving(false);
    }
  }

  if (!can('stock.receive')) {
    return (
      <Screen title={t('receive.title')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  const total = lines.reduce((sum, line) => {
    const quantity = parseQuantity(line.quantity, true);
    const unitCost = parseMoney(line.unitCost, currency);
    return quantity && unitCost !== null ? sum + lineAmount(unitCost, quantity) : sum;
  }, 0);

  return (
    <Screen title={t('receive.title')} stack>
      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.md }}>
          <TextField
            label={t('receive.supplier')}
            value={supplierName}
            onChangeText={setSupplierName}
            autoCapitalize="words"
          />
          <TextField label={t('receive.reference')} value={reference} onChangeText={setReference} />
        </Card.Content>
      </Card>

      {lines.map((line) => {
        const lineErrors = errors[line.key] ?? {};
        const unit = line.product.units.find((candidate) => candidate.id === line.unitId);
        return (
          <Card key={line.key} mode="outlined">
            <Card.Title
              title={line.product.name}
              titleVariant="titleMedium"
              titleStyle={styles.bold}
              titleNumberOfLines={2}
              right={(props) => (
                <IconButton
                  {...props}
                  icon="delete"
                  iconColor={theme.app.colors.danger}
                  accessibilityLabel={t('receive.removeLine')}
                  onPress={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                />
              )}
            />
            <Card.Content style={{ gap: spacing.sm }}>
              <View style={[styles.wrap, { gap: spacing.sm }]}>
                {sortUnits(line.product.units).map((candidate) => (
                  <Chip
                    key={candidate.id}
                    selected={candidate.id === line.unitId}
                    onPress={() => changeUnit(line, candidate)}>
                    {candidate.name}
                  </Chip>
                ))}
              </View>
              <View style={[styles.row, { gap: spacing.sm }]}>
                <View style={styles.fill}>
                  <TextField
                    label={t('receive.quantity', { unit: unit?.name ?? '' })}
                    value={line.quantity}
                    onChangeText={(quantity) => updateLine(line.key, { quantity })}
                    keyboardType="numeric"
                    errorMessage={lineErrors.quantity ? t(lineErrors.quantity) : null}
                  />
                </View>
                <View style={styles.fill}>
                  <TextField
                    label={t('receive.unitCost', { unit: unit?.name ?? '' })}
                    value={line.unitCost}
                    onChangeText={(unitCost) => updateLine(line.key, { unitCost })}
                    keyboardType="numeric"
                    errorMessage={lineErrors.unitCost ? t(lineErrors.unitCost) : null}
                  />
                </View>
              </View>
              <TextField
                label={line.product.trackExpiry ? t('receive.expiryRequired') : t('receive.expiry')}
                placeholder="31/12/2026"
                value={line.expiry}
                onChangeText={(expiry) => updateLine(line.key, { expiry })}
                keyboardType="numbers-and-punctuation"
                errorMessage={lineErrors.expiry ? t(lineErrors.expiry) : null}
              />
            </Card.Content>
          </Card>
        );
      })}

      <BigButton icon="plus" variant="outline" onPress={() => setIsPickerOpen(true)}>
        {t('receive.addProduct')}
      </BigButton>

      <Card mode="outlined">
        <Card.Content style={[styles.row, { gap: spacing.md }]}>
          <Text variant="titleMedium" style={styles.fill}>
            {t('receive.total')}
          </Text>
          <MoneyText amount={total} currency={currency} />
        </Card.Content>
      </Card>

      {formError ? <Notice message={formError} /> : null}
      <BigButton icon="truck-check" onPress={handleSave} loading={isSaving} disabled={isSaving}>
        {t('receive.save')}
      </BigButton>

      <ProductPicker
        visible={isPickerOpen}
        title={t('receive.addProduct')}
        onClose={() => setIsPickerOpen(false)}
        onPick={(product, unit) => void addLine(product, unit)}
      />
    </Screen>
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
});
