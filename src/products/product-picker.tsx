import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Platform, StyleSheet, View } from 'react-native';
import { Divider, IconButton, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { TextField } from '@/components/text-field';
import {
  type CatalogProduct,
  type CatalogUnit,
  matchBarcode,
  searchProducts,
} from '@/domain/catalog';
import { useAppTheme } from '@/theme/paper-theme';

import { useCatalog } from './catalog-provider';
import { ProductListItem } from './product-list-item';

type ProductPickerProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  /** unit = l'unité du code-barres scanné (carton…), sinon null */
  onPick: (product: CatalogProduct, unit: CatalogUnit | null) => void;
};

/** Choisir un produit : recherche, code-barres (caméra ou lecteur USB), liste. */
export function ProductPicker({ visible, title, onClose, onPick }: ProductPickerProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { products } = useCatalog();
  const [query, setQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const results = searchProducts(products, query);

  function pick(product: CatalogProduct, unit: CatalogUnit | null) {
    setQuery('');
    onPick(product, unit);
  }

  function pickByBarcode(code: string) {
    setIsScannerOpen(false);
    const found = matchBarcode(products, code);
    if (found) {
      pick(found.product, found.unit);
    } else {
      setQuery(code);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View
        style={[
          styles.fill,
          {
            backgroundColor: theme.colors.background,
            paddingTop: insets.top + theme.app.spacing.sm,
            paddingBottom: insets.bottom,
            paddingHorizontal: theme.app.spacing.md,
            gap: theme.app.spacing.sm,
          },
        ]}>
        <View style={styles.header}>
          <Text variant="titleLarge" style={[styles.fill, styles.bold]}>
            {title}
          </Text>
          <IconButton icon="close" onPress={onClose} accessibilityLabel={t('common.close')} />
        </View>
        <TextField
          label={t('products.search')}
          value={query}
          onChangeText={setQuery}
          autoFocus
          onSubmitEditing={() => query.trim() && pickByBarcode(query)}
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
        <FlatList
          data={results}
          keyExtractor={(product) => product.id}
          keyboardShouldPersistTaps="handled"
          // Dessiner peu de lignes à la fois : rapide même sur les vieux téléphones
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          ItemSeparatorComponent={Divider}
          ListEmptyComponent={
            <Text variant="bodyLarge" style={[styles.centered, { padding: theme.app.spacing.lg }]}>
              {t('products.noResult')}
            </Text>
          }
          renderItem={({ item }) => (
            <ProductListItem product={item} onPress={() => pick(item, null)} />
          )}
        />
      </View>
      <BarcodeScanner
        visible={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanned={pickByBarcode}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bold: {
    fontWeight: '700',
  },
  centered: {
    textAlign: 'center',
  },
});
