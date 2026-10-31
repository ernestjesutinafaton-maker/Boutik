import { usePowerSync } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Divider, List, Portal, Text, TextInput } from 'react-native-paper';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { StatusChip } from '@/components/status-chip';
import { TextField } from '@/components/text-field';
import { useActionContext } from '@/data/use-action-context';
import {
  type CatalogProduct,
  type CatalogUnit,
  displayUnits,
  matchBarcode,
  searchProducts,
  sortUnits,
} from '@/domain/catalog';
import { formatMoment, today } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { formatMixedStock, parseUnitQuantity } from '@/domain/quantity';
import { csvFileName, toCsv } from '@/export/csv';
import { buildExport } from '@/export/datasets';
import { shareTextFile } from '@/export/share-file';
import { canSharePdf, printHtml, shareHtmlAsPdf } from '@/invoices/invoice-actions';
import { tableHtml } from '@/reports/table-html';
import { useCatalog } from '@/products/product-data';
import { UnitQuantityField } from '@/products/unit-quantity-field';
import { useShop } from '@/shop/shop-provider';
import {
  cancelInventory,
  type InventoryLine,
  saveCount,
  useInventoryCount,
  useInventoryLines,
  validateInventory,
} from '@/stock/inventory';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/**
 * Un inventaire : on compte chaque produit (le compteur ne voit pas le stock calculé),
 * puis le responsable valide et les écarts corrigent le stock.
 */
export default function InventoryCountScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { shop } = useShop();
  const { can } = useActiveMember();
  const { countId } = useLocalSearchParams<{ countId: string }>();
  const count = useInventoryCount(countId);
  const lines = useInventoryLines(countId);
  const { products } = useCatalog();
  const [query, setQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [counting, setCounting] = useState<CatalogProduct | null>(null);
  const [confirm, setConfirm] = useState<'validate' | 'cancel' | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Le compteur compte « à l'aveugle » : seuls les responsables voient le stock calculé
  const showExpected = can('stock.adjust');
  const { spacing } = theme.app;

  if (!can('stock.count')) {
    return (
      <Screen title={t('inventory.title')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }
  if (!count) {
    return (
      <Screen title={t('inventory.title')} stack>
        {null}
      </Screen>
    );
  }

  const isDraft = count.status === 'draft';
  const counted = products.filter((product) => lines.has(product.id));
  const differences = counted.filter((product) => {
    const line = lines.get(product.id);
    return line && line.countedQuantity !== line.expectedQuantity;
  });
  const visible = isDraft ? searchProducts(products, query) : counted;

  function openByBarcode(code: string) {
    setIsScannerOpen(false);
    const found = matchBarcode(products, code);
    if (found) {
      setCounting(found.product);
    } else {
      setQuery(code);
    }
  }

  async function handleConfirm() {
    if (!context) {
      return;
    }
    setIsWorking(true);
    try {
      if (confirm === 'validate') {
        setResult(await validateInventory(db, context, countId));
      } else if (confirm === 'cancel') {
        await cancelInventory(db, countId);
        router.back();
      }
    } finally {
      setConfirm(null);
      setIsWorking(false);
    }
  }

  const title = count.notes || t('inventory.defaultName', { date: formatMoment(count.startedAt) });

  /** Le rapport de ce comptage, en Excel ou en PDF (sans la valeur pour qui ne voit pas les coûts). */
  async function handleDownload(format: 'csv' | 'pdf') {
    if (!shop) return;
    setDownloadError(null);
    try {
      const day = today();
      const table = await buildExport(db, {
        kind: 'inventory',
        shopId: shop.id,
        currency: shop.currencyCode,
        range: { start: '', end: '' },
        today: day,
        countId,
      });
      if (!can('stock.view_costs')) {
        table.headers = table.headers.slice(0, -1);
        table.rows = table.rows.map((row) => row.slice(0, -1));
      }
      if (format === 'csv') {
        const fileName = csvFileName(
          shop.name,
          `inventaire-${count?.startedAt.slice(0, 10) ?? day}`
        );
        await shareTextFile(fileName, toCsv(table.headers, table.rows), 'text/csv');
        return;
      }
      const html = tableHtml({
        table,
        title,
        shopName: shop.name,
        subtitle: t(`inventory.status.${count?.status ?? 'draft'}`),
      });
      const landscape = { width: 842, height: 595 };
      await (canSharePdf() ? shareHtmlAsPdf(html, title, landscape) : printHtml(html, landscape));
    } catch (error) {
      console.warn('Rapport d’inventaire impossible :', error);
      setDownloadError(t('errors.unknown'));
    }
  }

  return (
    <Screen
      title={count.notes || t('inventory.defaultName', { date: formatMoment(count.startedAt) })}
      stack>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <StatusChip
          tone={isDraft ? 'warning' : count.status === 'validated' ? 'ok' : 'neutral'}
          label={t(`inventory.status.${count.status}`)}
        />
        <Text variant="bodyLarge">{t('inventory.countedProducts', { count: counted.length })}</Text>
      </View>

      {result !== null ? (
        <Notice
          tone="info"
          message={
            can('stock.view_costs') && shop
              ? t('inventory.validatedWithValue', {
                  amount: formatMoney(result, shop.currencyCode),
                })
              : t('inventory.validated')
          }
        />
      ) : null}

      {isDraft ? (
        <>
          <Notice tone="info" message={t('inventory.countHelp')} />
          <TextField
            label={t('products.search')}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => query.trim() && openByBarcode(query)}
            returnKeyType="search"
            left={<TextInput.Icon icon="magnify" />}
            right={
              <TextInput.Icon
                icon="barcode-scan"
                onPress={() => setIsScannerOpen(true)}
                accessibilityLabel={t('productForm.scan')}
              />
            }
          />
        </>
      ) : null}

      <Card mode="outlined">
        {visible.length === 0 ? (
          <Card.Content style={{ paddingVertical: spacing.md }}>
            <Text variant="bodyLarge">{t('products.noResult')}</Text>
          </Card.Content>
        ) : null}
        {visible.map((product, index) => (
          <View key={product.id}>
            {index > 0 ? <Divider /> : null}
            <CountRow
              product={product}
              line={lines.get(product.id)}
              showExpected={showExpected}
              onPress={isDraft ? () => setCounting(product) : undefined}
            />
          </View>
        ))}
      </Card>

      {showExpected && counted.length > 0 ? (
        <Card mode="outlined">
          <Card.Content style={{ gap: spacing.sm }}>
            <Text variant="bodyLarge">{t('export.countHelp')}</Text>
            <View style={[styles.row, { gap: spacing.sm }]}>
              <Button mode="contained" icon="file-pdf-box" onPress={() => handleDownload('pdf')}>
                {canSharePdf() ? t('export.buttonPdf') : t('export.buttonPrint')}
              </Button>
              <Button mode="outlined" icon="file-excel" onPress={() => handleDownload('csv')}>
                {t('export.button')}
              </Button>
            </View>
            {downloadError ? <Notice message={downloadError} /> : null}
          </Card.Content>
        </Card>
      ) : null}

      {isDraft && can('stock.adjust') ? (
        <View style={{ gap: spacing.sm }}>
          <BigButton
            icon="check-decagram"
            disabled={counted.length === 0}
            onPress={() => setConfirm('validate')}>
            {t('inventory.validate')}
          </BigButton>
          <BigButton icon="close" variant="outline" onPress={() => setConfirm('cancel')}>
            {t('inventory.cancel')}
          </BigButton>
        </View>
      ) : null}

      {counting ? (
        <CountDialog
          product={counting}
          line={lines.get(counting.id)}
          onClose={() => setCounting(null)}
          onSave={async (quantity) => {
            if (context) {
              await saveCount(db, context, {
                countId,
                productId: counting.id,
                countedQuantity: quantity,
              });
            }
            setCounting(null);
            setQuery('');
          }}
        />
      ) : null}

      <BarcodeScanner
        visible={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanned={openByBarcode}
      />

      <Portal>
        <Dialog visible={confirm !== null} onDismiss={() => setConfirm(null)}>
          <Dialog.Title>
            {confirm === 'validate' ? t('inventory.validateTitle') : t('inventory.cancelTitle')}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyLarge">
              {confirm === 'validate'
                ? t('inventory.validateText', {
                    counted: counted.length,
                    differences: differences.length,
                  })
                : t('inventory.cancelText')}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirm(null)}>{t('common.back')}</Button>
            <Button onPress={handleConfirm} loading={isWorking} disabled={isWorking}>
              {t('common.confirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

function CountRow({
  product,
  line,
  showExpected,
  onPress,
}: {
  product: CatalogProduct;
  line: InventoryLine | undefined;
  showExpected: boolean;
  onPress?: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const format = (quantity: number) =>
    formatMixedStock(quantity, product.baseUnit, displayUnits(product));
  const difference = line ? line.countedQuantity - line.expectedQuantity : 0;

  const details = line
    ? [
        t('inventory.countedValue', { quantity: format(line.countedQuantity) }),
        showExpected
          ? t('inventory.expectedValue', { quantity: format(line.expectedQuantity) })
          : null,
      ]
    : [t('inventory.notCounted')];

  return (
    <List.Item
      title={product.name}
      titleStyle={{ fontWeight: '700' }}
      description={details.filter(Boolean).join(' · ')}
      descriptionNumberOfLines={2}
      onPress={onPress}
      left={(props) => (
        <List.Icon
          {...props}
          icon={line ? 'check-circle' : 'circle-outline'}
          color={line ? theme.colors.primary : props.color}
        />
      )}
      right={() =>
        line && showExpected && difference !== 0 ? (
          <View style={styles.center}>
            <StatusChip
              tone={difference < 0 ? 'danger' : 'ok'}
              label={`${difference > 0 ? '+' : '−'}${format(Math.abs(difference))}`}
            />
          </View>
        ) : null
      }
    />
  );
}

function CountDialog({
  product,
  line,
  onClose,
  onSave,
}: {
  product: CatalogProduct;
  line: InventoryLine | undefined;
  onClose: () => void;
  onSave: (quantity: number) => Promise<void>;
}) {
  const { t } = useTranslation();
  const units = sortUnits(product.units);
  const [unit, setUnit] = useState<CatalogUnit | undefined>(units[0]);
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const already = line?.countedQuantity ?? 0;

  async function submit(mode: 'add' | 'replace') {
    if (!unit) {
      return;
    }
    // « 0 » est un comptage valable (produit absent du rayon)
    const parsed =
      quantity.trim() === '0'
        ? { baseQuantity: 0 }
        : parseUnitQuantity(quantity, unit.factor, product.allowDecimal);
    if (!parsed) {
      setError(t('errors.quantityInvalid'));
      return;
    }
    await onSave(mode === 'add' ? already + parsed.baseQuantity : parsed.baseQuantity);
  }

  return (
    <Portal>
      <Dialog visible onDismiss={onClose}>
        <Dialog.Title>{product.name}</Dialog.Title>
        <Dialog.Content style={{ gap: 12 }}>
          {line ? (
            <Text variant="bodyLarge">
              {t('inventory.alreadyCounted', {
                quantity: formatMixedStock(already, product.baseUnit, displayUnits(product)),
              })}
            </Text>
          ) : null}
          {unit ? (
            <UnitQuantityField
              units={units}
              unitId={unit.id}
              onUnitChange={setUnit}
              quantity={quantity}
              onQuantityChange={setQuantity}
              label={t('inventory.countQuantity', { unit: unit.name })}
              autoFocus
              onSubmitEditing={() => submit(line ? 'add' : 'replace')}
              errorMessage={error}
            />
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onClose}>{t('common.cancel')}</Button>
          {line ? (
            <Button onPress={() => submit('replace')}>{t('inventory.replace')}</Button>
          ) : null}
          <Button mode="contained" onPress={() => submit(line ? 'add' : 'replace')}>
            {line ? t('inventory.addToCount') : t('common.save')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  center: {
    justifyContent: 'center',
  },
});
