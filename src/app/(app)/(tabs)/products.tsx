import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Chip, Divider, Text, TextInput } from 'react-native-paper';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { BigButton } from '@/components/big-button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { isLowStock, matchBarcode, searchProducts } from '@/domain/catalog';
import { useCatalog, useCategories } from '@/products/product-data';
import { ProductListItem } from '@/products/product-list-item';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

const LOW_STOCK_FILTER = 'low-stock';

/** Rubrique « Produits » : chercher, scanner, filtrer par rayon ou stock bas. */
export default function ProductsScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { can } = useActiveMember();
  const { products, isLoading } = useCatalog();
  const categories = useCategories();
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

  return (
    <Screen title={t('nav.products')}>
      <View style={[styles.actions, { gap: spacing.sm }]}>
        {can('catalog.edit') ? (
          <BigButton icon="plus" style={styles.action} onPress={() => router.push('/product/new')}>
            {t('products.add')}
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
          <Chip selected={filter === null} onPress={() => setFilter(null)}>
            {t('products.all', { count: products.length })}
          </Chip>
          <Chip
            icon="alert"
            selected={filter === LOW_STOCK_FILTER}
            onPress={() => setFilter(LOW_STOCK_FILTER)}>
            {t('products.lowStockFilter', { count: lowStockCount })}
          </Chip>
          {categories.map((category) => (
            <Chip
              key={category.id}
              selected={filter === category.id}
              onPress={() => setFilter(category.id)}>
              {category.name}
            </Chip>
          ))}
        </View>
      </ScrollView>

      <Card mode="outlined">
        {filtered.length === 0 && !isLoading ? (
          <Card.Content style={{ paddingVertical: spacing.lg }}>
            <Text variant="bodyLarge" style={styles.centered}>
              {products.length === 0 ? t('products.empty') : t('products.noResult')}
            </Text>
          </Card.Content>
        ) : null}
        {filtered.map((product, index) => (
          <View key={product.id}>
            {index > 0 ? <Divider /> : null}
            <ProductListItem
              product={product}
              onPress={() => router.push(`/product/${product.id}`)}
            />
          </View>
        ))}
      </Card>

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
