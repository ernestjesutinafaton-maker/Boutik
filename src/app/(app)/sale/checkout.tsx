import { usePowerSync } from '@powersync/react';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Divider, List, Switch, Text } from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { MoneyText } from '@/components/money-text';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useCustomer } from '@/customers/customer-data';
import { CustomerPicker } from '@/customers/customer-picker';
import { useActionContext } from '@/data/use-action-context';
import { formatMoney, formatMoneyInput, parseMoney } from '@/domain/money';
import { maxDiscountPercent } from '@/domain/permissions';
import { formatQuantity } from '@/domain/quantity';
import {
  cartSubtotal,
  checkSale,
  discountAmount,
  type PaymentInput,
  type SaleProblem,
  settle,
} from '@/domain/sale';
import { useCatalog } from '@/products/product-data';
import { useCart } from '@/sales/cart-provider';
import { usePaymentMethods } from '@/sales/payment-methods';
import {
  checkCartStock,
  createSale,
  SaleStockError,
  type StockProblem,
} from '@/sales/sale-actions';
import { useShop } from '@/shop/shop-provider';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/** Billets courants : propositions rapides du montant donné par le client. */
const NOTES = [500, 1000, 2000, 5000, 10_000];

/** Montants « ronds » au-dessus du total : 7 300 → 7 500, 8 000, 10 000… */
function quickCashAmounts(total: number): number[] {
  const amounts = new Set<number>([total]);
  for (const note of NOTES) {
    amounts.add(Math.ceil(total / note) * note);
  }
  return [...amounts]
    .filter((amount) => amount >= total)
    .sort((a, b) => a - b)
    .slice(0, 4);
}

const PROBLEM_KEYS = {
  emptyCart: 'checkout.problems.emptyCart',
  discountTooHigh: 'checkout.problems.discountTooHigh',
  overpaid: 'checkout.problems.overpaid',
  customerRequired: 'checkout.problems.customerRequired',
  creditLimitExceeded: 'checkout.problems.creditLimitExceeded',
} as const satisfies Record<SaleProblem, `checkout.problems.${string}`>;

/** Encaisser : paiement mixte ou partiel, monnaie à rendre, reste à crédit. */
export default function CheckoutScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { device } = useShop();
  const settings = useShopSettings();
  const { can, member } = useActiveMember();
  const cart = useCart();
  const { products } = useCatalog();
  const { customer } = useCustomer(cart.customerId);
  const methods = usePaymentMethods();
  const currency = settings?.currencyCode ?? 'XOF';
  const { spacing } = theme.app;

  // Montant tapé pour chaque mode de paiement (texte)
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [stockProblems, setStockProblems] = useState<StockProblem[]>([]);
  const [forceExpired, setForceExpired] = useState(false);
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Vérifie le stock dès l'arrivée (et si le panier change) pour prévenir avant de valider
  const { lines } = cart;
  useEffect(() => {
    let cancelled = false;
    checkCartStock(db, lines, { allowExpired: false })
      .then((problems) => {
        if (!cancelled) setStockProblems(problems);
      })
      .catch((checkError: unknown) =>
        console.warn('Vérification du stock impossible :', checkError)
      );
    return () => {
      cancelled = true;
    };
  }, [db, lines]);

  const subtotal = cartSubtotal(cart.lines);
  const discount = discountAmount(subtotal, cart.discount);
  const total = subtotal - discount;
  const cashMethod = methods.find((method) => method.isCash);

  const inputs: PaymentInput[] = methods.map((method) => ({
    methodId: method.id,
    isCash: method.isCash,
    amount: parseMoney(amounts[method.id] ?? '', currency) ?? 0,
  }));
  const settlement = settle(total, inputs);
  const problems = checkSale({
    lines: cart.lines,
    discount,
    maxDiscountPercent: maxDiscountPercent(
      member?.roles ?? [],
      member?.maxDiscountPercent ?? null,
      settings?.sellerMaxDiscountPercent ?? 0
    ),
    settlement,
    customer: customer ? { balance: customer.balance, creditLimit: customer.creditLimit } : null,
  });

  const expiredProblems = stockProblems.filter((problem) => problem.kind === 'expired');
  const shortageProblems = stockProblems.filter((problem) => problem.kind === 'shortage');
  const blockedByExpired = expiredProblems.length > 0 && !forceExpired;
  const blockedByShortage = shortageProblems.length > 0;
  const canConfirm =
    problems.length === 0 && !blockedByExpired && !blockedByShortage && Boolean(device?.number);

  function baseUnitOf(productId: string): string {
    return products.find((product) => product.id === productId)?.baseUnit ?? '';
  }

  function setAmount(methodId: string, text: string) {
    setAmounts((current) => ({ ...current, [methodId]: text }));
  }

  async function handleConfirm() {
    if (!context || !device?.number || !canConfirm) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const { saleId } = await createSale(db, context, {
        deviceNumber: device.number,
        lines: cart.lines,
        discount,
        payments: settlement.payments,
        customer: customer ? { id: customer.id, name: customer.name } : null,
        note: cart.note.trim() || null,
        forceExpired,
      });
      cart.clear();
      router.replace({ pathname: '/sale/[saleId]', params: { saleId, created: '1' } });
    } catch (saleError) {
      if (saleError instanceof SaleStockError) {
        setStockProblems(saleError.problems);
        setError(t('checkout.stockChanged'));
      } else {
        console.warn('Vente impossible :', saleError);
        setError(t('errors.unknown'));
      }
      setIsSaving(false);
    }
  }

  if (cart.lines.length === 0) {
    return (
      <Screen title={t('checkout.title')} stack>
        <Notice tone="info" message={t('sell.emptyCart')} />
        <BigButton icon="arrow-left" onPress={() => router.back()}>
          {t('common.back')}
        </BigButton>
      </Screen>
    );
  }

  return (
    <Screen title={t('checkout.title')} stack>
      <Card mode="outlined">
        <Card.Content style={[styles.center, { gap: spacing.xs, paddingVertical: spacing.md }]}>
          <Text variant="titleMedium">{t('checkout.toPay')}</Text>
          <MoneyText amount={total} currency={currency} size="large" tone="primary" />
          {discount > 0 ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('checkout.withDiscount', { amount: formatMoney(discount, currency) })}
            </Text>
          ) : null}
        </Card.Content>
      </Card>

      {!device?.number ? <Notice message={t('checkout.deviceNotRegistered')} /> : null}

      {expiredProblems.length > 0 ? (
        <Card mode="outlined">
          <Card.Content style={{ gap: spacing.sm }}>
            {expiredProblems.map((problem) => (
              <Notice
                key={problem.productId}
                message={t('checkout.expiredBlocked', {
                  name: problem.productName,
                  quantity: `${formatQuantity(problem.quantity)} ${baseUnitOf(problem.productId)}`,
                })}
              />
            ))}
            {can('expired.force') ? (
              <View style={[styles.row, { gap: spacing.md }]}>
                <Text variant="bodyLarge" style={styles.fill}>
                  {t('checkout.forceExpired')}
                </Text>
                <Switch value={forceExpired} onValueChange={setForceExpired} />
              </View>
            ) : (
              <Text variant="bodyMedium">{t('checkout.askOwner')}</Text>
            )}
          </Card.Content>
        </Card>
      ) : null}

      {shortageProblems.map((problem) => (
        <Notice
          key={problem.productId}
          tone="error"
          message={t('checkout.shortageBlocked', {
            name: problem.productName,
            quantity: `${formatQuantity(problem.quantity)} ${baseUnitOf(problem.productId)}`,
          })}
        />
      ))}

      <Card mode="outlined">
        <Card.Title title={t('checkout.payments')} titleVariant="titleLarge" />
        <Card.Content style={{ gap: spacing.md }}>
          {cashMethod ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodyMedium">{t('checkout.quickCash')}</Text>
              <View style={[styles.wrap, { gap: spacing.sm }]}>
                {quickCashAmounts(total).map((amount) => (
                  <Chip
                    key={amount}
                    icon="cash"
                    onPress={() =>
                      setAmounts({ [cashMethod.id]: formatMoneyInput(amount, currency) })
                    }>
                    {formatMoney(amount, currency)}
                  </Chip>
                ))}
              </View>
            </View>
          ) : null}
          {methods.map((method) => (
            <TextField
              key={method.id}
              label={
                method.isCash ? t('checkout.cashGiven', { label: method.label }) : method.label
              }
              value={amounts[method.id] ?? ''}
              onChangeText={(text) => setAmount(method.id, text)}
              keyboardType="numeric"
            />
          ))}
          <Button
            mode="text"
            icon="eraser"
            onPress={() => setAmounts({})}
            disabled={Object.keys(amounts).length === 0}>
            {t('checkout.clearPayments')}
          </Button>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.sm }}>
          <View style={styles.between}>
            <Text variant="titleMedium">{t('checkout.paid')}</Text>
            <MoneyText amount={settlement.paid} currency={currency} />
          </View>
          {settlement.change > 0 ? (
            <View style={styles.between}>
              <Text variant="titleMedium">{t('checkout.change')}</Text>
              <MoneyText amount={settlement.change} currency={currency} tone="primary" />
            </View>
          ) : null}
          {settlement.due > 0 ? (
            <View style={styles.between}>
              <Text variant="titleMedium">{t('checkout.due')}</Text>
              <MoneyText amount={settlement.due} currency={currency} tone="danger" />
            </View>
          ) : null}
        </Card.Content>
        {settlement.due > 0 ? (
          <>
            <Divider />
            <List.Item
              title={customer ? customer.name : t('checkout.chooseCustomer')}
              description={
                customer
                  ? t('checkout.customerDebt', {
                      balance: formatMoney(customer.balance, currency),
                      limit:
                        customer.creditLimit === null
                          ? t('checkout.noLimit')
                          : formatMoney(customer.creditLimit, currency),
                    })
                  : t('checkout.creditNeedsCustomer')
              }
              descriptionNumberOfLines={2}
              left={(props) => <List.Icon {...props} icon="account-cash" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => setIsCustomerPickerOpen(true)}
            />
          </>
        ) : null}
      </Card>

      {problems
        .filter((problem) => problem !== 'customerRequired' && problem !== 'emptyCart')
        .map((problem) => (
          <Notice key={problem} message={t(PROBLEM_KEYS[problem])} />
        ))}
      {error ? <Notice message={error} /> : null}

      <BigButton
        icon="check-bold"
        variant="accent"
        onPress={handleConfirm}
        loading={isSaving}
        disabled={!canConfirm || isSaving}>
        {settlement.due > 0
          ? t('checkout.confirmCredit', { amount: formatMoney(settlement.due, currency) })
          : t('checkout.confirm')}
      </BigButton>

      <CustomerPicker
        visible={isCustomerPickerOpen}
        onClose={() => setIsCustomerPickerOpen(false)}
        onPick={(customerId) => {
          cart.setCustomerId(customerId);
          setIsCustomerPickerOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fill: {
    flex: 1,
  },
});
