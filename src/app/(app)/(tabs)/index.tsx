import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  Button,
  Dialog,
  Divider,
  List,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';

import { Card } from '@/components/card';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { BigButton } from '@/components/big-button';
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
  searchProducts,
} from '@/domain/catalog';
import { type CurrencyCode, formatMoney, parseMoney } from '@/domain/money';
import { maxDiscountPercent } from '@/domain/permissions';
import { cartSubtotal, discountAmount, type DiscountInput, maxDiscount } from '@/domain/sale';
import { useCatalog } from '@/products/product-data';
import { ProductListItem } from '@/products/product-list-item';
import { ProductPicker } from '@/products/product-picker';
import { CartLineRow } from '@/sales/cart-line-row';
import { useCart } from '@/sales/cart-provider';
import { CashSessionNotice } from '@/sales/cash-session-notice';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Rubrique « Caisse » : chercher ou scanner, remplir le panier, encaisser. */
export default function SellScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { can, member } = useActiveMember();
  const settings = useShopSettings();
  const { products } = useCatalog();
  const cart = useCart();
  const { customer } = useCustomer(cart.customerId);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const isLargeScreen = width >= theme.app.layout.largeScreenMinWidth;
  const { spacing } = theme.app;
  const currency = settings?.currencyCode ?? 'XOF';

  if (!can('sale.create')) {
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
  const results = query.trim() ? searchProducts(products, query).slice(0, 8) : [];

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
    } else if (results.length === 1) {
      add(results[0], null);
    } else {
      setMessage(t('sell.unknownBarcode', { code }));
    }
  }

  const searchPanel = (
    <View style={{ gap: spacing.md }}>
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
      {message ? <Notice message={message} /> : null}
      {results.length > 0 ? (
        <Card mode="outlined">
          {results.map((product, index) => (
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
          icon="cash-register"
          variant="accent"
          style={styles.fill}
          disabled={cart.lines.length === 0}
          onPress={() => router.push('/sale/checkout')}>
          {t('sell.checkout')}
        </BigButton>
      </View>
    </View>
  );

  return (
    <Screen title={t('nav.sell')}>
      <CashSessionNotice />
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
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
});
