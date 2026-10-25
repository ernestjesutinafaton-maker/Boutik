import { usePowerSync } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, List, Portal, Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { StatusChip } from '@/components/status-chip';
import { useActionContext } from '@/data/use-action-context';
import { displayUnits, isLowStock, sortUnits } from '@/domain/catalog';
import { formatMoney } from '@/domain/money';
import { formatMixedStock, formatQuantity, formatQuantityWithUnit } from '@/domain/quantity';
import { archiveProduct } from '@/products/product-actions';
import { useProduct } from '@/products/product-data';
import { ProductPhoto } from '@/products/product-photo';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Fiche d'un produit : stock, unités et prix. */
export default function ProductScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { shop } = useShop();
  const { can } = useActiveMember();
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { product, archived, isLoading } = useProduct(productId);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const { spacing } = theme.app;

  if (!product || !shop) {
    return (
      <Screen title={t('products.detailTitle')} stack>
        {isLoading ? null : <Notice message={t('common.notFound')} />}
      </Screen>
    );
  }

  async function handleArchive() {
    setIsArchiveDialogOpen(false);
    if (product && context) {
      await archiveProduct(db, context, product);
      router.back();
    }
  }

  const units = sortUnits(product.units);

  return (
    <Screen title={product.name} stack>
      {archived ? <Notice message={t('products.archived')} /> : null}

      <Card mode="outlined">
        <Card.Content style={[styles.header, { gap: spacing.md }]}>
          <ProductPhoto productId={product.id} photoPath={product.photoPath} size={112} />
          <View style={[styles.fill, { gap: spacing.xs }]}>
            <Text variant="titleLarge" style={styles.bold}>
              {product.name}
            </Text>
            {product.categoryName ? (
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                {product.categoryName}
              </Text>
            ) : null}
            {product.barcode ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('products.barcodeLine', { code: product.barcode })}
              </Text>
            ) : null}
          </View>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Title title={t('products.stockTitle')} titleVariant="titleLarge" />
        <Card.Content style={{ gap: spacing.sm }}>
          <Text variant="headlineSmall" style={styles.bold}>
            {formatMixedStock(product.stock, product.baseUnit, displayUnits(product))}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('products.stockInBase', {
              stock: formatQuantityWithUnit(product.stock, product.baseUnit),
            })}
          </Text>
          {product.stock <= 0 ? (
            <StatusChip
              tone="danger"
              icon="package-variant-remove"
              label={t('products.outOfStock')}
            />
          ) : isLowStock(product) ? (
            <StatusChip tone="warning" icon="alert" label={t('products.lowStock')} />
          ) : null}
          {product.lowStockThreshold !== null ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('products.lowStockThreshold', {
                quantity: formatQuantityWithUnit(product.lowStockThreshold, product.baseUnit),
              })}
            </Text>
          ) : null}
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Title title={t('products.unitsTitle')} titleVariant="titleLarge" />
        {units.map((unit) => (
          <List.Item
            key={unit.id}
            title={unit.isDefault ? `${unit.name} ★` : unit.name}
            titleStyle={styles.bold}
            description={
              unit.factor === 1000 && unit.sortOrder === 0
                ? t('products.baseUnit')
                : t('products.contains', {
                    quantity: formatQuantity(unit.factor),
                    unit: product.baseUnit,
                  })
            }
            right={() => (
              <Text
                variant="titleMedium"
                style={[styles.bold, styles.price, { color: theme.colors.primary }]}>
                {unit.salePrice === null
                  ? t('products.notSold')
                  : formatMoney(unit.salePrice, shop.currencyCode)}
              </Text>
            )}
          />
        ))}
      </Card>

      {can('catalog.edit') && !archived ? (
        <View style={[styles.actions, { gap: spacing.sm }]}>
          <BigButton
            icon="pencil"
            style={styles.fill}
            onPress={() => router.push(`/product/${product.id}/edit`)}>
            {t('common.edit')}
          </BigButton>
          <BigButton
            icon="archive"
            variant="outline"
            style={styles.fill}
            onPress={() => setIsArchiveDialogOpen(true)}>
            {t('products.archive')}
          </BigButton>
        </View>
      ) : null}

      <Portal>
        <Dialog visible={isArchiveDialogOpen} onDismiss={() => setIsArchiveDialogOpen(false)}>
          <Dialog.Title>{t('products.archiveConfirmTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyLarge">{t('products.archiveConfirmText')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsArchiveDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button textColor={theme.app.colors.danger} onPress={handleArchive}>
              {t('products.archive')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fill: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
  price: {
    alignSelf: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
