import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { StatusChip } from '@/components/status-chip';
import { type CatalogProduct, defaultSaleUnit, displayUnits, isLowStock } from '@/domain/catalog';
import { formatMoney } from '@/domain/money';
import { formatMixedStock } from '@/domain/quantity';
import { useShop } from '@/shop/shop-provider';
import { useAppTheme } from '@/theme/paper-theme';

import { ProductPhoto } from './product-photo';

type ProductListItemProps = {
  product: CatalogProduct;
  onPress: () => void;
  /** Étiquettes en plus (péremption…) */
  extra?: ReactNode;
};

/** Une ligne de produit : photo, nom, stock lisible, prix de l'unité proposée par défaut. */
export function ProductListItem({ product, onPress, extra }: ProductListItemProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { shop } = useShop();
  const unit = defaultSaleUnit(product);
  const lowStock = isLowStock(product);
  const outOfStock = product.stock <= 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        {
          gap: theme.app.spacing.md,
          padding: theme.app.spacing.sm,
          minHeight: theme.app.touch.minHeight,
          backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent',
        },
      ]}>
      <ProductPhoto productId={product.id} photoPath={product.photoPath} size={52} />
      <View style={[styles.fill, { gap: 2 }]}>
        <Text variant="titleMedium" style={styles.bold} numberOfLines={2}>
          {product.name}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('products.stockLine', {
            stock: formatMixedStock(product.stock, product.baseUnit, displayUnits(product)),
          })}
        </Text>
        <View style={[styles.chips, { gap: theme.app.spacing.xs }]}>
          {outOfStock ? (
            <StatusChip
              tone="danger"
              icon="package-variant-remove"
              label={t('products.outOfStock')}
            />
          ) : lowStock ? (
            <StatusChip tone="warning" icon="alert" label={t('products.lowStock')} />
          ) : null}
          {product.needsCheck ? (
            <StatusChip
              tone="warning"
              icon="clipboard-check-outline"
              label={t('products.needsCheck')}
            />
          ) : null}
          {extra}
        </View>
      </View>
      {unit && unit.salePrice !== null && shop ? (
        <View style={styles.price}>
          <Text variant="titleMedium" style={[styles.bold, { color: theme.colors.primary }]}>
            {formatMoney(unit.salePrice, shop.currencyCode)}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('products.perUnit', { unit: unit.name })}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fill: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  price: {
    alignItems: 'flex-end',
  },
});
