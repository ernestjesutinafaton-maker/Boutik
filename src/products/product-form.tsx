import { usePowerSync } from '@powersync/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  Dialog,
  IconButton,
  Portal,
  RadioButton,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';

import { fitChip } from '@/components/fit-chip';
import { Card } from '@/components/card';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { TextField } from '@/components/text-field';
import { useActionContext } from '@/data/use-action-context';
import { newId } from '@/data/ids';
import { formatMoney } from '@/domain/money';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { MILLI, pluralUnit } from '@/domain/quantity';
import { useAppTheme } from '@/theme/paper-theme';

import { createCategory } from './product-actions';
import { useCategories } from './product-data';
import {
  BASE_KEY,
  type PackagingInput,
  type ProductErrors,
  previewMargins,
  type ProductInput,
} from './product-form-values';
import { ProductPhoto } from './product-photo';
import { dataUri, pickProductPhoto } from './photos';

/** Unités de base les plus courantes, proposées en un clic. */
const BASE_UNIT_SUGGESTIONS = [
  'pièce',
  'kg',
  'litre',
  'boîte',
  'sachet',
  'bouteille',
  'paquet',
  'mètre',
];

type ProductFormProps = {
  productId: string | null;
  photoPath: string | null;
  values: ProductInput;
  onChange: (values: ProductInput) => void;
  errors: ProductErrors;
  photo: string | null;
  onPhotoChange: (base64: string | null) => void;
  formError: string | null;
  isSaving: boolean;
  onSave: () => void;
};

/** Le formulaire d'un produit : photo, nom, rayon, code-barres, unités et prix. */
export function ProductForm(props: ProductFormProps) {
  const { values, onChange, errors, formError, isSaving, onSave } = props;
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { can } = useActiveMember();
  const categories = useCategories();
  const canEditPrices = can('prices.edit');
  const { spacing } = theme.app;
  const currency = useShopSettings()?.currencyCode ?? 'XOF';
  const margins = previewMargins(values, currency);

  // Où ira le code scanné : le produit lui-même, ou un conditionnement
  const [scanTarget, setScanTarget] = useState<string | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [photoError, setPhotoError] = useState<string | null>(null);

  const unitName = values.baseUnit.trim() || t('productForm.baseUnitFallback');
  // « Indique combien de pièces… » : le nom au pluriel
  const unitPlural = pluralUnit(unitName, 2 * MILLI);

  function updatePackaging(key: string, changes: Partial<PackagingInput>) {
    onChange({
      ...values,
      packagings: values.packagings.map((packaging) =>
        packaging.key === key ? { ...packaging, ...changes } : packaging
      ),
    });
  }

  function addPackaging() {
    const packaging: PackagingInput = {
      key: newId(),
      id: null,
      name: '',
      contains: '',
      price: '',
      cost: '',
      barcode: '',
    };
    onChange({ ...values, packagings: [...values.packagings, packaging] });
  }

  function removePackaging(key: string) {
    onChange({
      ...values,
      packagings: values.packagings.filter((packaging) => packaging.key !== key),
      defaultKey: values.defaultKey === key ? BASE_KEY : values.defaultKey,
    });
  }

  function handleScanned(code: string) {
    if (scanTarget === BASE_KEY) {
      onChange({ ...values, barcode: code });
    } else if (scanTarget) {
      updatePackaging(scanTarget, { barcode: code });
    }
    setScanTarget(null);
  }

  async function handlePickPhoto(source: 'camera' | 'library') {
    setPhotoError(null);
    try {
      const base64 = await pickProductPhoto(source);
      if (base64) {
        props.onPhotoChange(base64);
      }
    } catch (error) {
      console.warn('Photo impossible :', error);
      setPhotoError(t('productForm.photoError'));
    }
  }

  async function handleCreateCategory() {
    const name = categoryName.trim();
    if (!name || !context) {
      return;
    }
    const id = await createCategory(db, context, name.slice(0, 60));
    onChange({ ...values, categoryId: id });
    setCategoryName('');
    setIsCategoryDialogOpen(false);
  }

  const scanIcon = (target: string) => (
    <TextInput.Icon
      icon="barcode-scan"
      onPress={() => setScanTarget(target)}
      accessibilityLabel={t('productForm.scan')}
    />
  );

  return (
    <>
      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.md }}>
          <View style={[styles.row, { gap: spacing.md }]}>
            <ProductPhoto
              productId={props.productId ?? ''}
              photoPath={props.photoPath}
              previewUri={props.photo ? dataUri(props.photo) : null}
              size={96}
            />
            <View style={[styles.fill, { gap: spacing.sm }]}>
              <Button mode="outlined" icon="camera" onPress={() => handlePickPhoto('camera')}>
                {t('productForm.takePhoto')}
              </Button>
              <Button mode="outlined" icon="image" onPress={() => handlePickPhoto('library')}>
                {t('productForm.choosePhoto')}
              </Button>
            </View>
          </View>
          {photoError ? <Notice message={photoError} /> : null}

          <TextField
            label={t('productForm.name')}
            placeholder={t('productForm.namePlaceholder')}
            value={values.name}
            onChangeText={(name) => onChange({ ...values, name })}
            errorMessage={errors.fields.name ? t(errors.fields.name) : null}
          />

          <View style={{ gap: spacing.sm }}>
            <Text variant="titleMedium">{t('productForm.category')}</Text>
            <View style={[styles.wrap, { gap: spacing.sm }]}>
              <Chip
                style={fitChip.chip}
                textStyle={fitChip.text}
                selected={values.categoryId === null}
                onPress={() => onChange({ ...values, categoryId: null })}>
                {t('common.none')}
              </Chip>
              {categories.map((category) => (
                <Chip
                  style={fitChip.chip}
                  textStyle={fitChip.text}
                  key={category.id}
                  selected={values.categoryId === category.id}
                  onPress={() => onChange({ ...values, categoryId: category.id })}>
                  {category.name}
                </Chip>
              ))}
              <Chip
                style={fitChip.chip}
                textStyle={fitChip.text}
                icon="plus"
                onPress={() => setIsCategoryDialogOpen(true)}>
                {t('productForm.newCategory')}
              </Chip>
            </View>
          </View>

          <TextField
            label={t('productForm.barcode')}
            value={values.barcode}
            onChangeText={(barcode) => onChange({ ...values, barcode })}
            right={scanIcon(BASE_KEY)}
            errorMessage={errors.fields.barcode ? t(errors.fields.barcode) : null}
          />
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Title title={t('productForm.unitsTitle')} titleVariant="titleLarge" />
        <Card.Content style={{ gap: spacing.md }}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('productForm.baseUnitHelp')}
          </Text>
          <TextField
            label={t('productForm.baseUnit')}
            value={values.baseUnit}
            onChangeText={(baseUnit) => onChange({ ...values, baseUnit })}
            autoCapitalize="none"
            errorMessage={errors.fields.baseUnit ? t(errors.fields.baseUnit) : null}
          />
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            {BASE_UNIT_SUGGESTIONS.map((suggestion) => (
              <Chip
                style={fitChip.chip}
                textStyle={fitChip.text}
                key={suggestion}
                compact
                selected={values.baseUnit === suggestion}
                onPress={() => onChange({ ...values, baseUnit: suggestion })}>
                {suggestion}
              </Chip>
            ))}
          </View>

          <SwitchRow
            label={t('productForm.allowDecimal', { unit: unitName })}
            value={values.allowDecimal}
            onChange={(allowDecimal) => onChange({ ...values, allowDecimal })}
          />

          <View style={[styles.row, { gap: spacing.sm }]}>
            <RadioButton.Android
              value={BASE_KEY}
              status={values.defaultKey === BASE_KEY ? 'checked' : 'unchecked'}
              onPress={() => onChange({ ...values, defaultKey: BASE_KEY })}
            />
            <View style={styles.fill}>
              <TextField
                label={t('productForm.basePrice', { unit: unitName })}
                value={values.basePrice}
                onChangeText={(basePrice) => onChange({ ...values, basePrice })}
                keyboardType="numeric"
                disabled={!canEditPrices}
                errorMessage={errors.fields.basePrice ? t(errors.fields.basePrice) : null}
              />
              <TextField
                label={t('productForm.baseCost', { unit: unitName })}
                value={values.baseCost}
                onChangeText={(baseCost) => onChange({ ...values, baseCost })}
                keyboardType="numeric"
                disabled={!canEditPrices}
                errorMessage={errors.fields.baseCost ? t(errors.fields.baseCost) : null}
              />
            </View>
          </View>

          <Text variant="titleMedium">{t('productForm.packagingsTitle')}</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('productForm.packagingsHelp', { unit: unitPlural })}
          </Text>

          {values.packagings.map((packaging) => {
            const packagingErrors = errors.packagings[packaging.key] ?? {};
            return (
              <View
                key={packaging.key}
                style={[
                  styles.packaging,
                  {
                    gap: spacing.sm,
                    padding: spacing.sm,
                    borderRadius: theme.app.radius.md,
                    borderColor: theme.app.colors.border,
                  },
                ]}>
                <View style={[styles.row, { gap: spacing.sm }]}>
                  <RadioButton.Android
                    value={packaging.key}
                    status={values.defaultKey === packaging.key ? 'checked' : 'unchecked'}
                    onPress={() => onChange({ ...values, defaultKey: packaging.key })}
                  />
                  <View style={styles.fill}>
                    <TextField
                      label={t('productForm.packagingName')}
                      placeholder={t('productForm.packagingNamePlaceholder')}
                      value={packaging.name}
                      onChangeText={(name) => updatePackaging(packaging.key, { name })}
                      errorMessage={packagingErrors.name ? t(packagingErrors.name) : null}
                    />
                  </View>
                  <IconButton
                    icon="delete"
                    iconColor={theme.app.colors.danger}
                    accessibilityLabel={t('productForm.removePackaging')}
                    onPress={() => removePackaging(packaging.key)}
                  />
                </View>
                <TextField
                  label={t('productForm.packagingContains', { unit: unitPlural })}
                  value={packaging.contains}
                  onChangeText={(contains) => updatePackaging(packaging.key, { contains })}
                  keyboardType="numeric"
                  errorMessage={packagingErrors.contains ? t(packagingErrors.contains) : null}
                />
                <TextField
                  label={t('productForm.packagingPrice')}
                  value={packaging.price}
                  onChangeText={(price) => updatePackaging(packaging.key, { price })}
                  keyboardType="numeric"
                  disabled={!canEditPrices}
                  errorMessage={packagingErrors.price ? t(packagingErrors.price) : null}
                />
                <TextField
                  label={t('productForm.packagingCost')}
                  value={packaging.cost}
                  onChangeText={(cost) => updatePackaging(packaging.key, { cost })}
                  keyboardType="numeric"
                  disabled={!canEditPrices}
                  errorMessage={packagingErrors.cost ? t(packagingErrors.cost) : null}
                />
                <TextField
                  label={t('productForm.packagingBarcode')}
                  value={packaging.barcode}
                  onChangeText={(barcode) => updatePackaging(packaging.key, { barcode })}
                  right={scanIcon(packaging.key)}
                  errorMessage={packagingErrors.barcode ? t(packagingErrors.barcode) : null}
                />
              </View>
            );
          })}

          <Button mode="outlined" icon="plus" onPress={addPackaging}>
            {t('productForm.addPackaging')}
          </Button>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('productForm.defaultUnitHelp')}
          </Text>
        </Card.Content>
      </Card>

      {canEditPrices && margins.some((unit) => unit.margin !== null) ? (
        <Card mode="outlined">
          <Card.Title title={t('productForm.marginsTitle')} titleVariant="titleLarge" />
          <Card.Content style={{ gap: spacing.xs }}>
            {margins.map((unit) => (
              <View key={unit.unitId} style={[styles.row, { gap: spacing.sm }]}>
                <Text variant="bodyLarge" style={styles.fill}>
                  {unit.unitName}
                  {unit.cost !== null
                    ? ` · ${t(unit.derived ? 'productForm.costDerived' : 'productForm.cost', {
                        amount: formatMoney(unit.cost, currency),
                      })}`
                    : ''}
                </Text>
                <Text
                  variant="bodyLarge"
                  style={{
                    fontWeight: '700',
                    color:
                      unit.margin !== null && unit.margin < 0
                        ? theme.app.colors.danger
                        : theme.colors.primary,
                  }}>
                  {unit.margin === null
                    ? '—'
                    : `${unit.margin > 0 ? '+' : ''}${formatMoney(unit.margin, currency)}`}
                </Text>
              </View>
            ))}
            {margins.some((unit) => unit.margin !== null && unit.margin < 0) ? (
              <Notice tone="error" message={t('productForm.marginLoss')} />
            ) : null}
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('productForm.marginsHelp')}
            </Text>
          </Card.Content>
        </Card>
      ) : null}

      <Card mode="outlined">
        <Card.Title title={t('productForm.stockTitle')} titleVariant="titleLarge" />
        <Card.Content style={{ gap: spacing.md }}>
          <TextField
            label={t('productForm.lowStock', { unit: unitName })}
            value={values.lowStock}
            onChangeText={(lowStock) => onChange({ ...values, lowStock })}
            keyboardType="numeric"
            errorMessage={errors.fields.lowStock ? t(errors.fields.lowStock) : null}
          />
          <SwitchRow
            label={t('productForm.trackExpiry')}
            value={values.trackExpiry}
            onChange={(trackExpiry) => onChange({ ...values, trackExpiry })}
          />
        </Card.Content>
      </Card>

      {!canEditPrices ? <Notice tone="info" message={t('productForm.pricesLocked')} /> : null}
      {formError ? <Notice message={formError} /> : null}
      <BigButton icon="content-save" onPress={onSave} loading={isSaving} disabled={isSaving}>
        {t('common.save')}
      </BigButton>

      <BarcodeScanner
        visible={scanTarget !== null}
        onClose={() => setScanTarget(null)}
        onScanned={handleScanned}
      />

      <Portal>
        <Dialog visible={isCategoryDialogOpen} onDismiss={() => setIsCategoryDialogOpen(false)}>
          <Dialog.Title>{t('productForm.newCategory')}</Dialog.Title>
          <Dialog.Content>
            <TextField
              label={t('productForm.categoryName')}
              value={categoryName}
              onChangeText={setCategoryName}
              autoFocus
              onSubmitEditing={handleCreateCategory}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsCategoryDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onPress={handleCreateCategory} disabled={!categoryName.trim()}>
              {t('common.add')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

function SwitchRow(props: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.row, { gap: theme.app.spacing.md }]}>
      <Text variant="bodyLarge" style={styles.fill} onPress={() => props.onChange(!props.value)}>
        {props.label}
      </Text>
      <Switch value={props.value} onValueChange={props.onChange} />
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
  packaging: {
    borderWidth: 1,
  },
});
