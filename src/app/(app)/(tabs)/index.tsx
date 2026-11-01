import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  Button,
  Chip,
  Dialog,
  Divider,
  List,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';

import { fitChip } from '@/components/fit-chip';
import { Card } from '@/components/card';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { BigButton } from '@/components/big-button';
import { CardList } from '@/components/card-list';
import { MoneyText } from '@/components/money-text';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useCustomer } from '@/customers/customer-data';
import { CustomerPicker } from '@/customers/customer-picker';
import {
  type CatalogProduct,
  type CatalogUnit,
  matchBarcode,
  productCategories,
  searchProducts,
} from '@/domain/catalog';
import { type CurrencyCode, formatMoney, parseMoney } from '@/domain/money';
import { isCourierOnly, maxDiscountPercent } from '@/domain/permissions';
import { cartSubtotal, discountAmount, type DiscountInput, maxDiscount } from '@/domain/sale';
import { useCatalog } from '@/products/catalog-provider';
import { ProductListItem } from '@/products/product-list-item';
import { ProductPicker } from '@/products/product-picker';
import { CartLineRow } from '@/sales/cart-line-row';
import { useCart } from '@/sales/cart-provider';
import { CashSessionNotice } from '@/sales/cash-session-notice';
import { useLastSale } from '@/sales/sale-data';
import { useSaleEditRight } from '@/sales/use-sale-edit-right';
import { useShop } from '@/shop/shop-provider';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/**
 * Rubrique « Caisse » : chercher ou scanner, remplir le panier, encaisser.
 * Sert aussi à MODIFIER une vente déjà faite (bandeau en haut), et propose la dernière vente
 * en raccourci pour corriger une erreur tout de suite.
 * Sur tablette : les produits à gauche (on touche pour ajouter), le panier à droite.
 */
export default function SellScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const { can, member } = useActiveMember();
  const settings = useShopSettings();
  const { products } = useCatalog();
  const cart = useCart();
  const { customer } = useCustomer(cart.customerId);
  const { device } = useShop();
  const lastSale = useLastSale(device?.id ?? null);
  const lastSaleRight = useSaleEditRight(lastSale);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  // Rayon choisi dans la liste des produits sur tablette (null = tous)
  const [category, setCategory] = useState<string | null>(null);
  const { spacing, layout } = theme.app;
  const isLargeScreen = width >= layout.largeScreenMinWidth;
  // Vraie tablette (ou ordinateur) : assez de place dans les deux sens pour une caisse
  // « produits à gauche, panier à droite », chaque côté défilant seul.
  // Un téléphone tourné en paysage garde la mise en page qui défile.
  const isTabletLayout = isLargeScreen && Math.min(width, height) >= layout.tabletMinSide;
  const currency = settings?.currencyCode ?? 'XOF';

  if (!can('sale.create')) {
    // Le livreur seul n'a pas d'onglet « Caisse » : il arrive sur ses livraisons
    if (isCourierOnly(member?.roles ?? [])) {
      return <Redirect href="/deliveries" />;
    }
    return (
      <Screen title={t('nav.sell')}>
        <Notice message={t('sell.forbidden')} />
      </Screen>
    );
  }

  const subtotal = cartSubtotal(cart.lines);
  const discount = discountAmount(subtotal, cart.discount);
  const total = subtotal - discount;
  const allowedPercent = maxDiscountPercent(
    member?.roles ?? [],
    member?.maxDiscountPercent ?? null,
    settings?.sellerMaxDiscountPercent ?? 0
  );
  // Les produits qui correspondent à la recherche (aucun tant que rien n'est tapé)
  const matches = query.trim() ? searchProducts(products, query) : [];
  // Tablette : la recherche cherche dans TOUS les rayons ; sans recherche, le rayon choisi
  const categories = isTabletLayout ? productCategories(products) : [];
  const listed = !isTabletLayout
    ? []
    : query.trim()
      ? matches
      : products.filter((product) => category === null || product.categoryId === category);

  function add(product: CatalogProduct, unit: CatalogUnit | null) {
    const added = cart.addProduct(product, unit);
    setMessage(added ? null : t('sell.noPrice', { name: product.name }));
    setQuery('');
  }

  /** Code scanné, ou tapé par un lecteur USB suivi de « Entrée ». */
  function addByBarcode(code: string) {
    setIsScannerOpen(false);
    const found = matchBarcode(products, code);
    if (found) {
      add(found.product, found.unit);
    } else if (matches.length === 1) {
      add(matches[0], null);
    } else {
      setMessage(t('sell.unknownBarcode', { code }));
    }
  }

  const searchField = (
    <TextField
      label={t('sell.search')}
      value={query}
      onChangeText={setQuery}
      onSubmitEditing={() => query.trim() && addByBarcode(query)}
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
  );

  // Téléphone : la recherche, ses 8 premiers résultats, et la liste complète dans une fenêtre
  const searchPanel = (
    <View style={{ gap: spacing.md }}>
      {searchField}
      {message ? <Notice message={message} /> : null}
      {matches.length > 0 ? (
        <Card mode="outlined">
          {matches.slice(0, 8).map((product, index) => (
            <View key={product.id}>
              {index > 0 ? <Divider /> : null}
              <ProductListItem product={product} onPress={() => add(product, null)} />
            </View>
          ))}
        </Card>
      ) : null}
      <BigButton icon="view-list" variant="outline" onPress={() => setIsPickerOpen(true)}>
        {t('sell.allProducts')}
      </BigButton>
    </View>
  );

  // Tablette : tous les produits sous la recherche, par rayon ; seules les lignes visibles
  // sont dessinées (fluide même avec des milliers d'articles)
  const catalogPanel = (
    <CardList
      data={listed}
      keyExtractor={(product) => product.id}
      header={
        <>
          {searchField}
          {message ? <Notice message={message} /> : null}
          {/* Pendant une recherche, les rayons sont cachés : elle porte sur tout le catalogue */}
          {categories.length > 0 && !query.trim() ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <View style={[styles.chips, { gap: spacing.sm }]}>
                <Chip
                  style={fitChip.chip}
                  textStyle={fitChip.text}
                  selected={category === null}
                  onPress={() => setCategory(null)}>
                  {t('products.all', { count: products.length })}
                </Chip>
                {categories.map((item) => (
                  <Chip
                    style={fitChip.chip}
                    textStyle={fitChip.text}
                    key={item.id}
                    selected={category === item.id}
                    onPress={() => setCategory(item.id)}>
                    {item.name}
                  </Chip>
                ))}
              </View>
            </ScrollView>
          ) : null}
        </>
      }
      empty={
        <Text variant="bodyLarge" style={styles.centered}>
          {products.length === 0 ? t('products.empty') : t('products.noResult')}
        </Text>
      }
      renderItem={(product) => (
        <ProductListItem product={product} onPress={() => add(product, null)} />
      )}
    />
  );

  const cartPanel = (
    <View style={{ gap: spacing.md }}>
      <Card mode="outlined">
        <Card.Title
          title={t('sell.cartTitle', { count: cart.lines.length })}
          titleVariant="titleLarge"
        />
        <Card.Content>
          {cart.lines.length === 0 ? (
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('sell.emptyCart')}
            </Text>
          ) : null}
          {cart.lines.map((line, index) => (
            <View key={line.key}>
              {index > 0 ? <Divider /> : null}
              <CartLineRow
                line={line}
                product={products.find((product) => product.id === line.productId) ?? null}
                currency={currency}
                onChange={(changes) => cart.updateLine(line.key, changes)}
                onRemove={() => cart.removeLine(line.key)}
              />
            </View>
          ))}
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <List.Item
          title={customer ? customer.name : t('sell.noCustomer')}
          description={customer ? t('sell.changeCustomer') : t('sell.chooseCustomer')}
          left={(props) => <List.Icon {...props} icon="account" />}
          right={(props) =>
            customer ? (
              <Button onPress={() => cart.setCustomerId(null)}>{t('sell.removeCustomer')}</Button>
            ) : (
              <List.Icon {...props} icon="chevron-right" />
            )
          }
          onPress={() => setIsCustomerPickerOpen(true)}
        />
        <Divider />
        <List.Item
          title={
            discount > 0
              ? t('sell.discountValue', { amount: formatMoney(discount, currency) })
              : t('sell.addDiscount')
          }
          description={
            allowedPercent < 100 ? t('sell.discountLimit', { percent: allowedPercent }) : undefined
          }
          left={(props) => <List.Icon {...props} icon="sale" />}
          onPress={() => setIsDiscountOpen(true)}
          disabled={subtotal === 0 || allowedPercent === 0}
        />
        <Divider />
        <Card.Content style={[styles.totalRow, { paddingVertical: spacing.md }]}>
          <View>
            <Text variant="titleMedium">{t('sell.total')}</Text>
            {discount > 0 ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('sell.subtotal', { amount: formatMoney(subtotal, currency) })}
              </Text>
            ) : null}
          </View>
          <MoneyText amount={total} currency={currency} size="large" tone="primary" />
        </Card.Content>
      </Card>

      <Button icon="receipt-text" onPress={() => router.push('/sale')}>
        {t('sell.history')}
      </Button>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <BigButton
          icon="delete-sweep"
          variant="outline"
          disabled={cart.lines.length === 0}
          onPress={cart.clear}>
          {t('sell.clear')}
        </BigButton>
        <BigButton
          icon={cart.editing ? 'check-bold' : 'cash-register'}
          variant="accent"
          style={styles.fill}
          disabled={cart.lines.length === 0}
          onPress={() => router.push('/sale/checkout')}>
          {cart.editing ? t('modify.validate') : t('sell.checkout')}
        </BigButton>
      </View>
    </View>
  );

  const editingBanner = cart.editing ? (
    <Card mode="outlined" style={{ borderColor: theme.app.colors.accent }}>
      <Card.Content style={{ gap: spacing.sm }}>
        <Text variant="titleMedium" style={styles.bold}>
          {t('modify.banner', { number: cart.editing.invoiceNumber })}
        </Text>
        <Text variant="bodyLarge">
          {t('modify.bannerPaid', {
            amount: formatMoney(cart.editing.alreadyPaid, currency),
          })}
        </Text>
        <BigButton icon="close" variant="outline" onPress={cart.clear}>
          {t('modify.cancelEditing')}
        </BigButton>
      </Card.Content>
    </Card>
  ) : null;

  const lastSaleShortcut =
    !cart.editing && cart.lines.length === 0 && lastSale && lastSaleRight?.allowed ? (
      <Card mode="outlined">
        <List.Item
          title={t('modify.lastSale', {
            number: lastSale.invoiceNumber,
            amount: formatMoney(lastSale.total, currency),
          })}
          titleStyle={styles.bold}
          titleNumberOfLines={2}
          description={t('modify.lastSaleHelp')}
          descriptionNumberOfLines={2}
          left={(props) => <List.Icon {...props} icon="receipt-text-edit" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push(`/sale/${lastSale.id}`)}
        />
      </Card>
    ) : null;

  const dialogs = (
    <>
      <BarcodeScanner
        visible={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanned={addByBarcode}
      />
      <ProductPicker
        visible={isPickerOpen}
        title={t('sell.allProducts')}
        onClose={() => setIsPickerOpen(false)}
        onPick={(product, unit) => {
          setIsPickerOpen(false);
          add(product, unit);
        }}
      />
      <CustomerPicker
        visible={isCustomerPickerOpen}
        onClose={() => setIsCustomerPickerOpen(false)}
        onPick={(customerId) => {
          cart.setCustomerId(customerId);
          setIsCustomerPickerOpen(false);
        }}
      />
      {isDiscountOpen ? (
        <DiscountDialog
          subtotal={subtotal}
          maxPercent={allowedPercent}
          current={cart.discount}
          currency={currency}
          onClose={() => setIsDiscountOpen(false)}
          onSave={(value) => {
            cart.setDiscount(value);
            setIsDiscountOpen(false);
          }}
        />
      ) : null}
    </>
  );

  if (isTabletLayout) {
    // Pas de défilement global : la liste des produits et le panier défilent chacun de leur côté
    return (
      <Screen title={t('nav.sell')} scroll={false}>
        <View style={[styles.columns, { gap: spacing.md }]}>
          <View style={styles.fill}>{catalogPanel}</View>
          <ScrollView
            style={styles.fill}
            contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}
            keyboardShouldPersistTaps="handled">
            {editingBanner}
            <CashSessionNotice />
            {lastSaleShortcut}
            {cartPanel}
          </ScrollView>
        </View>
        {dialogs}
      </Screen>
    );
  }

  return (
    <Screen title={t('nav.sell')}>
      {editingBanner}
      <CashSessionNotice />
      {lastSaleShortcut}
      {isLargeScreen ? (
        <View style={[styles.row, styles.top, { gap: spacing.md }]}>
          <View style={styles.fill}>{searchPanel}</View>
          <View style={styles.fill}>{cartPanel}</View>
        </View>
      ) : (
        <>
          {searchPanel}
          {cartPanel}
        </>
      )}
      {dialogs}
    </Screen>
  );
}

/** Remise : en montant ou en pourcentage, dans la limite autorisée à la personne. */
function DiscountDialog(props: {
  subtotal: number;
  maxPercent: number;
  current: DiscountInput | null;
  currency: CurrencyCode;
  onClose: () => void;
  onSave: (discount: DiscountInput | null) => void;
}) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<DiscountInput['kind']>(props.current?.kind ?? 'amount');
  const [text, setText] = useState(() => {
    if (!props.current) return '';
    return props.current.kind === 'amount'
      ? String(props.current.amount)
      : String(props.current.percent);
  });
  const [error, setError] = useState<string | null>(null);
  const max = maxDiscount(props.subtotal, props.maxPercent);

  function save() {
    if (!text.trim()) {
      props.onSave(null);
      return;
    }
    let discount: DiscountInput | null = null;
    if (kind === 'amount') {
      const amount = parseMoney(text, props.currency);
      discount = amount === null ? null : { kind: 'amount', amount };
    } else {
      const percent = /^\d{1,3}$/.test(text.trim()) ? Number(text.trim()) : null;
      discount = percent === null || percent > 100 ? null : { kind: 'percent', percent };
    }
    if (!discount) {
      setError(t('errors.priceInvalid'));
      return;
    }
    if (discountAmount(props.subtotal, discount) > max) {
      setError(t('sell.discountTooHigh', { amount: formatMoney(max, props.currency) }));
      return;
    }
    props.onSave(discount);
  }

  return (
    <Portal>
      <Dialog visible onDismiss={props.onClose}>
        <Dialog.Title>{t('sell.discountTitle')}</Dialog.Title>
        <Dialog.Content style={{ gap: 12 }}>
          <SegmentedButtons
            value={kind}
            onValueChange={(value) => setKind(value === 'percent' ? 'percent' : 'amount')}
            buttons={[
              { value: 'amount', label: t('sell.discountAmount') },
              { value: 'percent', label: t('sell.discountPercent') },
            ]}
          />
          <TextField
            label={kind === 'amount' ? t('sell.discountAmount') : t('sell.discountPercent')}
            value={text}
            onChangeText={setText}
            keyboardType="numeric"
            autoFocus
            onSubmitEditing={save}
            errorMessage={error}
          />
          <Text variant="bodyMedium">
            {t('sell.discountMax', { amount: formatMoney(max, props.currency) })}
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => props.onSave(null)}>{t('sell.noDiscount')}</Button>
          <Button onPress={save}>{t('common.confirm')}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  top: {
    alignItems: 'flex-start',
  },
  fill: {
    flex: 1,
  },
  columns: {
    flex: 1,
    flexDirection: 'row',
  },
  chips: {
    flexDirection: 'row',
  },
  centered: {
    textAlign: 'center',
  },
  bold: {
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
});
