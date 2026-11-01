import { usePowerSync } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, Divider, Portal, Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { MoneyText } from '@/components/money-text';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { StatusChip } from '@/components/status-chip';
import { TextField } from '@/components/text-field';
import { type Customer, useCustomer } from '@/customers/customer-data';
import type { ActionContext } from '@/data/audit';
import { useActionContext } from '@/data/use-action-context';
import {
  assignDelivery,
  cancelDelivery,
  completeDelivery,
  failDelivery,
  releaseDelivery,
  replanDelivery,
  takeDelivery,
} from '@/deliveries/delivery-actions';
import {
  type Delivery,
  useCouriers,
  useDelivery,
  useDeliveryItems,
  useDeliveryPayments,
} from '@/deliveries/delivery-data';
import { STATUS_TONE } from '@/deliveries/delivery-list';
import { formatMoment } from '@/domain/dates';
import {
  collectionError,
  courierActions,
  isFinalStatus,
  suggestedCollection,
} from '@/domain/delivery';
import { type CurrencyCode, formatMoney, formatMoneyInput, parseMoney } from '@/domain/money';
import { formatPhone, whatsappLink } from '@/domain/phone';
import { formatQuantity, pluralUnit } from '@/domain/quantity';
import { usePaymentMethods } from '@/sales/payment-methods';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

type OpenDialog = 'complete' | 'fail' | 'release' | 'cancel' | 'assign' | null;

/**
 * Une livraison : où, quand, qui appeler, quoi livrer, l'argent à encaisser.
 *   - Le livreur : « Je m'en occupe », « Livrée » (avec l'argent reçu), « Pas livrée », la rendre.
 *   - La boutique : modifier, confier à un livreur, replanifier, annuler, ou la terminer elle-même.
 */
export default function DeliveryScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { shop } = useShop();
  const { can, member } = useActiveMember();
  const { deliveryId } = useLocalSearchParams<{ deliveryId: string }>();
  const { delivery, isLoading } = useDelivery(deliveryId);
  const items = useDeliveryItems(delivery?.saleId ?? null);
  const payments = useDeliveryPayments(deliveryId);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const currency: CurrencyCode = shop?.currencyCode ?? 'XOF';
  const { spacing } = theme.app;

  if (!delivery) {
    return (
      <Screen title={t('deliveries.title')} stack>
        {isLoading ? null : <Notice message={t('common.notFound')} />}
      </Screen>
    );
  }

  const memberId = member?.id ?? '';
  const courier = can('delivery.handle') ? courierActions(delivery, memberId) : [];
  const staff = can('delivery.create') && !isFinalStatus(delivery.status);
  const phone = delivery.contactPhone;

  /** Une action : bouton bloqué pendant l'écriture, message si elle échoue. */
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
      console.warn('Livraison : action impossible', error);
      setFailed(true);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Screen title={t('deliveries.title')} stack>
      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.xs }}>
          <View style={[styles.between, { gap: spacing.sm }]}>
            <Text variant="titleLarge" style={[styles.bold, styles.shrink]}>
              {delivery.address}
            </Text>
            <StatusChip
              tone={STATUS_TONE[delivery.status]}
              label={t(`deliveries.status.${delivery.status}`)}
            />
          </View>
          {delivery.landmark ? <Text variant="bodyLarge">{delivery.landmark}</Text> : null}
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {delivery.requestedAt ? formatMoment(delivery.requestedAt) : t('deliveries.asap')}
          </Text>
          <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {delivery.assignedTo
              ? t('deliveries.courier', { name: delivery.courierName ?? '?' })
              : t('deliveries.openToAll')}
          </Text>
          {delivery.amountToCollect > 0 && delivery.status !== 'cancelled' ? (
            <View style={styles.between}>
              <Text variant="titleMedium">{t('deliveries.toCollectLabel')}</Text>
              <MoneyText amount={delivery.amountToCollect} currency={currency} tone="primary" />
            </View>
          ) : null}
        </Card.Content>
      </Card>

      {delivery.status === 'failed' && delivery.failedReason ? (
        <Notice message={t('deliveries.failedReason', { reason: delivery.failedReason })} />
      ) : null}
      {delivery.status === 'cancelled' ? (
        <Notice
          message={t('deliveries.cancelledReason', { reason: delivery.cancelReason ?? '' })}
        />
      ) : null}
      {delivery.note ? <Notice tone="info" message={delivery.note} /> : null}

      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.sm }}>
          {delivery.contactName ? (
            <Text variant="titleMedium" style={styles.bold}>
              {delivery.contactName}
            </Text>
          ) : null}
          {phone ? (
            <>
              <Text variant="bodyLarge">{formatPhone(phone)}</Text>
              <View style={[styles.wrap, { gap: spacing.sm }]}>
                <Button
                  mode="contained-tonal"
                  icon="phone"
                  onPress={() => Linking.openURL(`tel:${phone}`)}>
                  {t('deliveries.actions.call')}
                </Button>
                <Button
                  mode="contained-tonal"
                  icon="whatsapp"
                  onPress={() =>
                    Linking.openURL(
                      whatsappLink(
                        phone,
                        t('deliveries.whatsappMessage', { shop: shop?.name ?? '' })
                      )
                    )
                  }>
                  {t('deliveries.actions.whatsapp')}
                </Button>
                <MapButton address={delivery.address} label={t('deliveries.actions.map')} />
              </View>
            </>
          ) : (
            <>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('deliveries.noContact')}
              </Text>
              <View style={styles.wrap}>
                <MapButton address={delivery.address} label={t('deliveries.actions.map')} />
              </View>
            </>
          )}
        </Card.Content>
      </Card>

      {items.length > 0 ? (
        <Card mode="outlined">
          <Card.Title title={t('deliveries.items')} titleVariant="titleLarge" />
          <Card.Content style={{ gap: spacing.xs }}>
            {items.map((item) => (
              <Text key={item.id} variant="bodyLarge">
                {`${formatQuantity(item.quantity)} ${pluralUnit(item.unitName, item.quantity)} · ${item.productName}`}
              </Text>
            ))}
            {delivery.saleId && delivery.invoiceNumber && can('sale.create') ? (
              <Button
                icon="file-document"
                style={styles.start}
                onPress={() => router.push(`/sale/${delivery.saleId}`)}>
                {t('deliveries.sale', { number: delivery.invoiceNumber })}
              </Button>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}

      {payments.length > 0 ? (
        <Card mode="outlined">
          <Card.Title title={t('deliveries.collectedTitle')} titleVariant="titleLarge" />
          <Card.Content style={{ gap: spacing.xs }}>
            {payments.map((payment) => (
              <View key={payment.id} style={styles.between}>
                <Text variant="bodyLarge">
                  {`${payment.methodLabel} · ${formatMoment(payment.occurredAt)}`}
                </Text>
                <Text variant="titleMedium">{formatMoney(payment.amount, currency)}</Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      ) : null}

      {failed ? <Notice message={t('deliveries.errors.failed')} /> : null}

      {courier.includes('take') ? (
        <BigButton
          icon="moped"
          loading={isWorking}
          disabled={isWorking}
          onPress={() => run((ctx) => takeDelivery(db, ctx, delivery.id))}>
          {t('deliveries.actions.take')}
        </BigButton>
      ) : null}
      {courier.includes('complete') || (staff && delivery.status !== 'failed') ? (
        <BigButton icon="check-circle" variant="accent" onPress={() => setDialog('complete')}>
          {t('deliveries.actions.complete')}
        </BigButton>
      ) : null}
      {courier.includes('fail') ? (
        <BigButton icon="close-circle" variant="outline" onPress={() => setDialog('fail')}>
          {t('deliveries.actions.fail')}
        </BigButton>
      ) : null}
      {courier.includes('release') ? (
        <BigButton icon="undo" variant="outline" onPress={() => setDialog('release')}>
          {t('deliveries.actions.release')}
        </BigButton>
      ) : null}

      {staff ? (
        <View style={{ gap: spacing.sm }}>
          <Divider />
          {delivery.status === 'failed' ? (
            <BigButton
              icon="calendar-refresh"
              loading={isWorking}
              disabled={isWorking}
              onPress={() => run((ctx) => replanDelivery(db, ctx, delivery.id))}>
              {t('deliveries.actions.replan')}
            </BigButton>
          ) : null}
          <BigButton
            icon="account-arrow-right"
            variant="outline"
            onPress={() => setDialog('assign')}>
            {t('deliveries.actions.assign')}
          </BigButton>
          <BigButton
            icon="pencil"
            variant="outline"
            onPress={() => router.push(`/delivery/new?deliveryId=${delivery.id}`)}>
            {t('deliveries.actions.edit')}
          </BigButton>
          <BigButton icon="cancel" variant="danger" onPress={() => setDialog('cancel')}>
            {t('deliveries.actions.cancel')}
          </BigButton>
        </View>
      ) : null}

      <Portal>
        {dialog === 'complete' ? (
          <CompleteDialog
            delivery={delivery}
            currency={currency}
            isWorking={isWorking}
            onClose={() => setDialog(null)}
            onConfirm={(customer, amount, methodId) =>
              run((ctx) =>
                completeDelivery(db, ctx, { deliveryId: delivery.id, customer, amount, methodId })
              )
            }
          />
        ) : null}
        {dialog === 'fail' || dialog === 'cancel' ? (
          <ReasonDialog
            title={dialog === 'fail' ? t('deliveries.fail.title') : t('deliveries.cancel.title')}
            label={dialog === 'fail' ? t('deliveries.fail.reason') : t('deliveries.cancel.reason')}
            isWorking={isWorking}
            onClose={() => setDialog(null)}
            onConfirm={(reason) =>
              run((ctx) =>
                dialog === 'fail'
                  ? failDelivery(db, ctx, delivery.id, reason)
                  : cancelDelivery(db, ctx, delivery.id, reason)
              )
            }
          />
        ) : null}
        {dialog === 'release' ? (
          <Dialog visible onDismiss={() => setDialog(null)}>
            <Dialog.Title>{t('deliveries.release.title')}</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyLarge">{t('deliveries.release.text')}</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setDialog(null)}>{t('common.back')}</Button>
              <Button
                loading={isWorking}
                disabled={isWorking}
                onPress={() => run((ctx) => releaseDelivery(db, ctx, delivery.id))}>
                {t('common.confirm')}
              </Button>
            </Dialog.Actions>
          </Dialog>
        ) : null}
        {dialog === 'assign' ? (
          <AssignDialog
            current={delivery.assignedTo}
            isWorking={isWorking}
            onClose={() => setDialog(null)}
            onConfirm={(courierId) => run((ctx) => assignDelivery(db, ctx, delivery.id, courierId))}
          />
        ) : null}
      </Portal>
    </Screen>
  );
}

function MapButton({ address, label }: { address: string; label: string }) {
  return (
    <Button
      mode="contained-tonal"
      icon="map-marker"
      onPress={() =>
        Linking.openURL(
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
        )
      }>
      {label}
    </Button>
  );
}

/** « Livrée » : l'argent reçu du client (proposé : ce qui était prévu, sans dépasser sa dette). */
function CompleteDialog(props: {
  delivery: Delivery;
  currency: CurrencyCode;
  isWorking: boolean;
  onClose: () => void;
  onConfirm: (customer: Customer | null, amount: number, methodId: string | null) => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { customer } = useCustomer(props.delivery.customerId);
  const methods = usePaymentMethods();
  const balance = customer?.balance ?? 0;
  const suggested = suggestedCollection(props.delivery.amountToCollect, balance);
  const [amount, setAmount] = useState(
    suggested > 0 ? formatMoneyInput(suggested, props.currency) : ''
  );
  const [chosenMethod, setMethodId] = useState<string | null>(null);
  // Par défaut : les espèces (la liste des modes peut arriver un instant après l'ouverture)
  const methodId =
    chosenMethod ?? methods.find((method) => method.isCash)?.id ?? methods[0]?.id ?? null;
  const [error, setError] = useState<string | null>(null);
  const canCollect = Boolean(customer) && balance > 0;

  function confirm() {
    if (!canCollect) {
      props.onConfirm(customer, 0, null);
      return;
    }
    const parsed = amount.trim() ? parseMoney(amount, props.currency) : 0;
    const problem = parsed === null ? 'negative' : collectionError(parsed, balance);
    if (parsed === null || problem) {
      setError(
        problem === 'tooMuch'
          ? t('deliveries.errors.collectTooMuch', { amount: formatMoney(balance, props.currency) })
          : t('deliveries.errors.amount')
      );
      return;
    }
    setError(null);
    props.onConfirm(customer, parsed, methodId);
  }

  return (
    <Dialog visible onDismiss={props.onClose}>
      <Dialog.Title>{t('deliveries.complete.title')}</Dialog.Title>
      <Dialog.Content style={{ gap: 12 }}>
        {canCollect ? (
          <>
            <TextField
              label={t('deliveries.complete.collected')}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              errorMessage={error}
            />
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('deliveries.complete.owes', { amount: formatMoney(balance, props.currency) })}
            </Text>
            <Text variant="titleSmall">{t('deliveries.complete.method')}</Text>
            <View style={[styles.wrap, { gap: 8 }]}>
              {methods.map((method) => (
                <Chip
                  key={method.id}
                  selected={methodId === method.id}
                  onPress={() => setMethodId(method.id)}>
                  {method.label}
                </Chip>
              ))}
            </View>
          </>
        ) : (
          <Text variant="bodyLarge">{t('deliveries.complete.nothing')}</Text>
        )}
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

function ReasonDialog(props: {
  title: string;
  label: string;
  isWorking: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState(false);
  return (
    <Dialog visible onDismiss={props.onClose}>
      <Dialog.Title>{props.title}</Dialog.Title>
      <Dialog.Content>
        <TextField
          label={props.label}
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

function AssignDialog(props: {
  current: string | null;
  isWorking: boolean;
  onClose: () => void;
  onConfirm: (courierId: string | null) => void;
}) {
  const { t } = useTranslation();
  const couriers = useCouriers();
  const [chosen, setChosen] = useState<string | null>(props.current);
  const choices: { id: string | null; label: ReactNode }[] = [
    { id: null, label: t('deliveries.openToAll') },
    ...couriers.map((courier) => ({ id: courier.id, label: courier.name })),
  ];
  return (
    <Dialog visible onDismiss={props.onClose}>
      <Dialog.Title>{t('deliveries.assign.title')}</Dialog.Title>
      <Dialog.Content style={[styles.wrap, { gap: 8 }]}>
        {choices.map((choice) => (
          <Chip
            key={choice.id ?? 'open'}
            selected={chosen === choice.id}
            onPress={() => setChosen(choice.id)}>
            {choice.label}
          </Chip>
        ))}
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={props.onClose}>{t('common.back')}</Button>
        <Button
          loading={props.isWorking}
          disabled={props.isWorking}
          onPress={() => props.onConfirm(chosen)}>
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
