import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Text, TextInput } from 'react-native-paper';

import { fitChip } from '@/components/fit-chip';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { BigButton } from '@/components/big-button';
import { CardList } from '@/components/card-list';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { isLowStock, matchBarcode, searchProducts } from '@/domain/catalog';
import { today } from '@/domain/dates';
import { DEFAULT_EXPIRY_ALERT_DAYS } from '@/domain/expiry';
import { ExpiryChip } from '@/products/expiry-chip';
import { useCatalog } from '@/products/catalog-provider';
import { useCategories } from '@/products/product-data';
import { ProductListItem } from '@/products/product-list-item';
import { useShopSettings } from '@/shop/shop-settings';
import { expiryLevelsByProduct, useExpiringLots } from '@/stock/stock-data';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

const LOW_STOCK_FILTER = 'low-stock';

/**
 * Rubrique « Produits » : chercher, scanner, filtrer par rayon ou stock bas.
 * La liste ne dessine que les produits visibles : fluide même avec des milliers d'articles.
 */
export default function ProductsScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { can } = useActiveMember();
  const { products, isLoading } = useCatalog();
  const categories = useCategories();
  const settings = useShopSettings();
  const [query, setQuery] = useState('');
  // Rayon choisi, ou filtre « stock bas » (null = tout)
  const [filter, setFilter] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { spacing } = theme.app;

  const filtered = searchProducts(products, query).filter((product) =>
    filter === null
      ? true
      : filter === LOW_STOCK_FILTER
        ? isLowStock(product)
        : product.categoryId === filter
  );
  const lowStockCount = products.filter(isLowStock).length;
  const expiringLots = useExpiringLots(
    settings?.id ?? '',
    today(),
    settings?.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS
  );
  const expiryLevels = expiryLevelsByProduct(expiringLots);
  const alertCount =
    expiringLots.filter((lot) => lot.level !== 'soon').length +
    products.filter((product) => isLowStock(product) || product.stock <= 0).length;

  /** Code scanné, ou tapé par un lecteur USB suivi de « Entrée » : on ouvre le produit. */
  function openByBarcode(code: string) {
    setIsScannerOpen(false);
    const found = matchBarcode(products, code);
    if (found) {
      setQuery('');
      router.push(`/product/${found.product.id}`);
    } else if (can('catalog.edit')) {
      router.push({ pathname: '/product/new', params: { barcode: code } });
    } else {
      setQuery(code);
    }
  }

  const header = (
    <>
      <View style={[styles.actions, { gap: spacing.sm }]}>
        {can('catalog.edit') ? (
          <BigButton icon="plus" style={styles.action} onPress={() => router.push('/product/new')}>
            {t('products.add')}
          </BigButton>
        ) : null}
        {can('stock.receive') ? (
          <BigButton
            icon="truck-delivery"
            variant="accent"
            style={styles.action}
            onPress={() => router.push('/stock/receive')}>
            {t('products.receive')}
          </BigButton>
        ) : null}
      </View>

      <View style={[styles.actions, { gap: spacing.sm }]}>
        <BigButton
          icon="alert-decagram"
          variant="outline"
          style={styles.action}
          onPress={() => router.push('/stock/alerts')}>
          {alertCount > 0 ? t('products.alertsCount', { count: alertCount }) : t('products.alerts')}
        </BigButton>
        {can('stock.count') ? (
          <BigButton
            icon="clipboard-list"
            variant="outline"
            style={styles.action}
            onPress={() => router.push('/inventory')}>
            {t('products.inventory')}
          </BigButton>
        ) : null}
        {can('stock.adjust') ? (
          <BigButton
            icon="delete-alert"
            variant="outline"
            style={styles.action}
            onPress={() => router.push('/stock/loss')}>
            {t('losses.declare')}
          </BigButton>
        ) : null}
      </View>

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[styles.chips, { gap: spacing.sm }]}>
          <Chip
            style={fitChip.chip}
            textStyle={fitChip.text}
            selected={filter === null}
            onPress={() => setFilter(null)}>
            {t('products.all', { count: products.length })}
          </Chip>
          <Chip
            style={fitChip.chip}
            textStyle={fitChip.text}
            icon="alert"
            selected={filter === LOW_STOCK_FILTER}
            onPress={() => setFilter(LOW_STOCK_FILTER)}>
            {t('products.lowStockFilter', { count: lowStockCount })}
          </Chip>
          {categories.map((category) => (
            <Chip
              style={fitChip.chip}
              textStyle={fitChip.text}
              key={category.id}
              selected={filter === category.id}
              onPress={() => setFilter(category.id)}>
              {category.name}
            </Chip>
          ))}
        </View>
      </ScrollView>
    </>
  );

  return (
    <Screen title={t('nav.products')} scroll={false}>
      <CardList
        data={filtered}
        keyExtractor={(product) => product.id}
        header={header}
        empty={
          isLoading ? null : (
            <Text variant="bodyLarge" style={styles.centered}>
              {products.length === 0 ? t('products.empty') : t('products.noResult')}
            </Text>
          )
        }
        renderItem={(product) => (
          <ProductListItem
            product={product}
            onPress={() => router.push(`/product/${product.id}`)}
            extra={<ExpiryChip level={expiryLevels.get(product.id) ?? 'ok'} />}
          />
        )}
      />

      <BarcodeScanner
        visible={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanned={openByBarcode}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  action: {
    flexGrow: 1,
  },
  chips: {
    flexDirection: 'row',
  },
  centered: {
    textAlign: 'center',
  },
});
