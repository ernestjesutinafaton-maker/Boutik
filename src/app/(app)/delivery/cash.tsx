import { usePowerSync } from '@powersync/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, Divider, Portal, Text } from 'react-native-paper';

import { fitChip } from '@/components/fit-chip';
import { Card } from '@/components/card';
import { MoneyText } from '@/components/money-text';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import type { ActionContext } from '@/data/audit';
import { useActionContext } from '@/data/use-action-context';
import { recordHandover, reimburseExpense, rejectExpense } from '@/deliveries/delivery-actions';
import {
  type DeliveryExpense,
  useCourierBalances,
  useDeliveryExpenses,
} from '@/deliveries/delivery-data';
import { ExpenseLines, ReceiptPhoto } from '@/deliveries/expense-parts';
import { type CurrencyCode, formatMoney, formatMoneyInput, parseMoney } from '@/domain/money';
import { useOpenCashSession } from '@/sales/cash-session-data';
import { type PaymentMethod, usePaymentMethods } from '@/sales/payment-methods';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

type OpenDialog =
  | { kind: 'handover'; courierId: string; name: string; amount: number }
  | { kind: 'reimburse'; expense: DeliveryExpense }
  | { kind: 'reject'; expense: DeliveryExpense }
  | null;

/**
 * L'argent des livreurs :
 *   - ce que chacun doit remettre à la caisse (encaissé en espèces à ses livraisons), et la
 *     remise elle-même (caissier, gérant, propriétaire) : l'argent entre dans la caisse ouverte ;
 *   - leurs dépenses avec la photo du reçu : rembourser (dépense de la caisse) ou refuser.
 */
export default function DeliveryCashScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { shop, device } = useShop();
  const { can } = useActiveMember();
  const balances = useCourierBalances();
  const expenses = useDeliveryExpenses();
  const methods = usePaymentMethods();
  const { session } = useOpenCashSession(device?.id ?? null);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const currency: CurrencyCode = shop?.currencyCode ?? 'XOF';
  const { spacing } = theme.app;
  const canHandover = can('delivery.handover');
  const canReview = can('delivery.review');

  if (!canHandover && !canReview) {
    return (
      <Screen title={t('deliveries.cash.title')} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  const pending = expenses.filter((expense) => expense.status === 'pending');
  const decided = expenses.filter((expense) => expense.status !== 'pending').slice(0, 10);

  async function run(action: (actionContext: ActionContext) => Promise<void>) {
    if (!context) {
      return;
    }
    setIsWorking(true);
    setFailed(false);
    try {
      await action(context);
      setDialog(null);
    } catch (error) {
      console.warn('Argent des livreurs : action impossible', error);
      setFailed(true);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Screen title={t('deliveries.cash.title')} stack>
      {failed ? <Notice message={t('deliveries.errors.failed')} /> : null}

      <Card mode="outlined">
        <Card.Title title={t('deliveries.cash.heldTitle')} titleVariant="titleLarge" />
        <Card.Content style={{ gap: spacing.sm }}>
          {canHandover && !session ? (
            <Notice tone="info" message={t('deliveries.cash.notOpen')} />
          ) : null}
          {balances.length === 0 ? (
            <Text variant="bodyLarge">{t('deliveries.cash.nothingHeld')}</Text>
          ) : null}
          {balances.map((line, index) => (
            <View key={line.courierId} style={{ gap: spacing.xs }}>
              {index > 0 ? <Divider /> : null}
              <View style={[styles.between, { gap: spacing.sm }]}>
                <Text variant="titleMedium" style={styles.shrink}>
                  {t('deliveries.cash.held', { name: line.name })}
                </Text>
                <MoneyText amount={line.amount} currency={currency} tone="primary" />
              </View>
              {canHandover && line.amount > 0 ? (
                <Button
                  mode="contained"
                  icon="cash-plus"
                  style={styles.start}
                  onPress={() =>
                    setDialog({
                      kind: 'handover',
                      courierId: line.courierId,
                      name: line.name,
                      amount: line.amount,
                    })
                  }>
                  {t('deliveries.cash.receive')}
                </Button>
              ) : null}
            </View>
          ))}
        </Card.Content>
      </Card>

      {canReview ? (
        <Card mode="outlined">
          <Card.Title title={t('deliveries.cash.expensesTitle')} titleVariant="titleLarge" />
          <Card.Content style={{ gap: spacing.md }}>
            {pending.length === 0 ? (
              <Text variant="bodyLarge">{t('deliveries.cash.noExpenses')}</Text>
            ) : null}
            {pending.map((expense, index) => (
              <View key={expense.id} style={{ gap: spacing.sm }}>
                {index > 0 ? <Divider /> : null}
                <ExpenseLines expense={expense} currency={currency} />
                <ReceiptPhoto path={expense.proofPath} />
                <View style={[styles.wrap, { gap: spacing.sm }]}>
                  <Button
                    mode="contained"
                    icon="cash-check"
                    onPress={() => setDialog({ kind: 'reimburse', expense })}>
                    {t('deliveries.cash.reimburse')}
                  </Button>
                  <Button
                    mode="outlined"
                    icon="close"
                    onPress={() => setDialog({ kind: 'reject', expense })}>
                    {t('deliveries.cash.reject')}
                  </Button>
                </View>
              </View>
            ))}
            {decided.length > 0 ? (
              <>
                <Divider />
                <Text variant="titleMedium">{t('deliveries.cash.decided')}</Text>
                {decided.map((expense) => (
                  <ExpenseLines key={expense.id} expense={expense} currency={currency} withStatus />
                ))}
              </>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}

      <Portal>
        {dialog?.kind === 'handover' ? (
          <MoneyDialog
            title={t('deliveries.cash.handoverTitle', { name: dialog.name })}
            amountLabel={t('deliveries.cash.amount')}
            initialAmount={dialog.amount}
            currency={currency}
            methods={methods}
            isWorking={isWorking}
            onClose={() => setDialog(null)}
            onConfirm={(amount, methodId) =>
              run((ctx) =>
                recordHandover(db, ctx, {
                  courierId: dialog.courierId,
                  courierName: dialog.name,
                  amount,
                  methodId,
                })
              )
            }
          />
        ) : null}
        {dialog?.kind === 'reimburse' ? (
          <MoneyDialog
            title={t('deliveries.cash.reimburseTitle', {
              amount: formatMoney(dialog.expense.amount, currency),
              name: dialog.expense.courierName,
            })}
            help={t('deliveries.cash.reimburseHelp')}
            initialAmount={dialog.expense.amount}
            currency={currency}
            methods={methods}
            isWorking={isWorking}
            onClose={() => setDialog(null)}
            onConfirm={(_amount, methodId) =>
              run((ctx) =>
                reimburseExpense(db, ctx, {
                  expense: {
                    id: dialog.expense.id,
                    amount: dialog.expense.amount,
                    category: dialog.expense.category,
                    courierName: dialog.expense.courierName,
                  },
                  methodId,
                })
              )
            }
          />
        ) : null}
        {dialog?.kind === 'reject' ? (
          <RejectDialog
            isWorking={isWorking}
            onClose={() => setDialog(null)}
            onConfirm={(reason) => run((ctx) => rejectExpense(db, ctx, dialog.expense.id, reason))}
          />
        ) : null}
      </Portal>
    </Screen>
  );
}

/** Une somme d'argent et son mode de paiement (espèces par défaut). */
function MoneyDialog(props: {
  title: string;
  help?: string;
  /** Le montant peut être corrigé (remise partielle) ; sans amountLabel, il est fixé */
  amountLabel?: string;
  initialAmount: number;
  currency: CurrencyCode;
  methods: PaymentMethod[];
  isWorking: boolean;
  onClose: () => void;
  onConfirm: (amount: number, methodId: string) => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [amount, setAmount] = useState(formatMoneyInput(props.initialAmount, props.currency));
  const [chosenMethod, setChosenMethod] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const methodId =
    chosenMethod ??
    props.methods.find((method) => method.isCash)?.id ??
    props.methods[0]?.id ??
    null;

  function confirm() {
    const parsed = props.amountLabel ? parseMoney(amount, props.currency) : props.initialAmount;
    if (parsed === null || parsed <= 0 || !methodId) {
      setError(true);
      return;
    }
    props.onConfirm(parsed, methodId);
  }

  return (
    <Dialog visible onDismiss={props.onClose}>
      <Dialog.Title>{props.title}</Dialog.Title>
      <Dialog.Content style={{ gap: 12 }}>
        {props.amountLabel ? (
          <TextField
            label={props.amountLabel}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            errorMessage={error ? t('deliveries.errors.amount') : null}
          />
        ) : null}
        {props.help ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {props.help}
          </Text>
        ) : null}
        <Text variant="titleSmall">{t('deliveries.cash.paidWith')}</Text>
        <View style={[styles.wrap, { gap: 8 }]}>
          {props.methods.map((method) => (
            <Chip
              style={fitChip.chip}
              textStyle={fitChip.text}
              key={method.id}
              selected={methodId === method.id}
              onPress={() => setChosenMethod(method.id)}>
              {method.label}
            </Chip>
          ))}
        </View>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={props.onClose}>{t('common.back')}</Button>
        <Button loading={props.isWorking} disabled={props.isWorking} onPress={confirm}>
          {t('common.confirm')}
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}

function RejectDialog(props: {
  isWorking: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState(false);
  return (
    <Dialog visible onDismiss={props.onClose}>
      <Dialog.Title>{t('deliveries.cash.rejectTitle')}</Dialog.Title>
      <Dialog.Content>
        <TextField
          label={t('deliveries.cash.rejectReason')}
          value={reason}
          onChangeText={setReason}
          errorMessage={missing ? t('deliveries.errors.reason') : null}
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={props.onClose}>{t('common.back')}</Button>
        <Button
          loading={props.isWorking}
          disabled={props.isWorking}
          onPress={() => {
            const text = reason.trim().slice(0, 300);
            setMissing(!text);
            if (text) props.onConfirm(text);
          }}>
          {t('common.confirm')}
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  shrink: {
    flexShrink: 1,
  },
  bold: {
    fontWeight: '700',
  },
  start: {
    alignSelf: 'flex-start',
  },
});
