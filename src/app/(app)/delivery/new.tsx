import { usePowerSync } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { getCountry } from '@/config/countries';
import { useCustomer } from '@/customers/customer-data';
import { useActionContext } from '@/data/use-action-context';
import { createDelivery, updateDelivery } from '@/deliveries/delivery-actions';
import { type Delivery, useCouriers, useDelivery } from '@/deliveries/delivery-data';
import {
  type DeliveryFormErrors,
  type DeliveryFormValues,
  parseDeliveryForm,
} from '@/deliveries/delivery-form';
import { addDays, dayOfMoment, formatDay, formatTime, today } from '@/domain/dates';
import { isFinalStatus } from '@/domain/delivery';
import { type CurrencyCode, formatMoney, formatMoneyInput } from '@/domain/money';
import { useSale } from '@/sales/sale-data';
import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/**
 * Nouvelle livraison (depuis une vente : ?saleId=…) ou livraison à corriger (?deliveryId=…) :
 * l'adresse, un repère, qui appeler, quand, qui livre, et l'argent à encaisser.
 */
export default function DeliveryFormScreen() {
  const { t } = useTranslation();
  const { can } = useActiveMember();
  const params = useLocalSearchParams<{ saleId?: string; deliveryId?: string }>();
  const editing = Boolean(params.deliveryId);
  const { delivery, isLoading: deliveryLoading } = useDelivery(params.deliveryId ?? '');
  const saleId = editing ? (delivery?.saleId ?? null) : (params.saleId ?? null);
  const { sale, isLoading: saleLoading } = useSale(saleId ?? '');
  const { customer } = useCustomer(sale?.customerId ?? delivery?.customerId ?? null);
  const title = editing ? t('deliveries.new.editTitle') : t('deliveries.new.title');

  if (!can('delivery.create')) {
    return (
      <Screen title={title} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }
  if ((editing && deliveryLoading) || (saleId && saleLoading)) {
    return (
      <Screen title={title} stack>
        {null}
      </Screen>
    );
  }
  if ((editing && !delivery) || (!editing && !sale)) {
    return (
      <Screen title={title} stack>
        <Notice message={t('common.notFound')} />
      </Screen>
    );
  }
  if (delivery && isFinalStatus(delivery.status)) {
    return (
      <Screen title={title} stack>
        <Notice message={t('common.forbidden')} />
      </Screen>
    );
  }

  // Ce qui reste à payer sur la vente (on n'encaisse pas plus) : la dette du client, au plus
  const due = sale && sale.status === 'completed' ? sale.due : 0;
  const maxAmount = customer ? Math.min(due, Math.max(0, customer.balance)) : 0;

  return (
    <Screen title={title} stack>
      <DeliveryForm
        // Une nouvelle clé recharge le formulaire si la livraison change entre-temps
        key={delivery?.updatedAt ?? 'new'}
        delivery={delivery}
        saleId={saleId}
        saleNumber={sale?.invoiceNumber ?? null}
        customerId={customer?.id ?? null}
        initialContact={{ name: customer?.name ?? '', phone: customer?.phone ?? '' }}
        maxAmount={maxAmount}
      />
    </Screen>
  );
}

function initialValues(
  delivery: Delivery | null,
  contact: { name: string; phone: string },
  maxAmount: number,
  currency: CurrencyCode
): DeliveryFormValues {
  if (delivery) {
    const day = delivery.requestedAt ? dayOfMoment(delivery.requestedAt) : null;
    return {
      address: delivery.address,
      landmark: delivery.landmark ?? '',
      contactName: delivery.contactName ?? '',
      contactPhone: delivery.contactPhone ?? '',
      when: day ?? 'asap',
      time: delivery.requestedAt ? formatTime(delivery.requestedAt) : '',
      courierId: delivery.assignedTo,
      amount:
        delivery.amountToCollect > 0 ? formatMoneyInput(delivery.amountToCollect, currency) : '',
      note: delivery.note ?? '',
    };
  }
  return {
    address: '',
    landmark: '',
    contactName: contact.name,
    contactPhone: contact.phone,
    when: 'asap',
    time: '',
    courierId: null,
    amount: maxAmount > 0 ? formatMoneyInput(maxAmount, currency) : '',
    note: '',
  };
}

/** L'heure ronde suivante (« 15:00 ») : proposée quand on choisit aujourd'hui. */
function nextHour(): string {
  const hour = Math.min(new Date().getHours() + 1, 23);
  return `${String(hour).padStart(2, '0')}:00`;
}

function DeliveryForm(props: {
  delivery: Delivery | null;
  saleId: string | null;
  saleNumber: string | null;
  customerId: string | null;
  initialContact: { name: string; phone: string };
  maxAmount: number;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const { shop } = useShop();
  const couriers = useCouriers();
  const currency: CurrencyCode = shop?.currencyCode ?? 'XOF';
  const [values, setValues] = useState<DeliveryFormValues>(() =>
    initialValues(props.delivery, props.initialContact, props.maxAmount, currency)
  );
  const [errors, setErrors] = useState<DeliveryFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const { spacing } = theme.app;
  const day = today();
  const tomorrow = addDays(day, 1);
  // Les jours proposés ; une livraison déjà prévue un autre jour garde son jour
  const days = [
    day,
    tomorrow,
    ...(values.when !== 'asap' && ![day, tomorrow].includes(values.when) ? [values.when] : []),
  ];

  const set = (field: keyof DeliveryFormValues) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));
  const chooseDay = (when: string) =>
    setValues((current) => ({
      ...current,
      when,
      time: when === 'asap' || current.time ? current.time : when === day ? nextHour() : '09:00',
    }));

  async function handleSave() {
    if (!context || !shop) {
      return;
    }
    const result = parseDeliveryForm(values, {
      currency,
      dialCode: getCountry(shop.countryCode).dialCode,
      maxAmount: props.maxAmount,
    });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setIsSaving(true);
    setFailed(false);
    try {
      if (props.delivery) {
        await updateDelivery(db, context, props.delivery.id, result.data);
        router.back();
      } else {
        const id = await createDelivery(db, context, {
          ...result.data,
          saleId: props.saleId,
          customerId: props.customerId,
        });
        router.replace(`/delivery/${id}`);
      }
    } catch (error) {
      console.warn('Livraison non enregistrée :', error);
      setFailed(true);
    } finally {
      setIsSaving(false);
    }
  }

  const amountError =
    errors.amount === 'amountTooMuch'
      ? t('deliveries.errors.amountTooMuch', { amount: formatMoney(props.maxAmount, currency) })
      : errors.amount
        ? t('deliveries.errors.amount')
        : null;

  return (
    <>
      {props.saleNumber ? (
        <Text variant="titleMedium">{t('deliveries.sale', { number: props.saleNumber })}</Text>
      ) : null}
      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.md }}>
          <TextField
            label={t('deliveries.new.address')}
            value={values.address}
            onChangeText={set('address')}
            multiline
            errorMessage={errors.address ? t('deliveries.errors.address') : null}
          />
          <TextField
            label={t('deliveries.new.landmark')}
            value={values.landmark}
            onChangeText={set('landmark')}
          />
          <TextField
            label={t('deliveries.new.contactName')}
            value={values.contactName}
            onChangeText={set('contactName')}
          />
          <TextField
            label={t('deliveries.new.contactPhone')}
            value={values.contactPhone}
            onChangeText={set('contactPhone')}
            keyboardType="phone-pad"
            errorMessage={errors.contactPhone ? t('errors.phoneInvalid') : null}
          />
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.md }}>
          <Text variant="titleMedium">{t('deliveries.new.when')}</Text>
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            <Chip selected={values.when === 'asap'} onPress={() => chooseDay('asap')}>
              {t('deliveries.new.whenAsap')}
            </Chip>
            {days.map((candidate) => (
              <Chip
                key={candidate}
                selected={values.when === candidate}
                onPress={() => chooseDay(candidate)}>
                {candidate === day
                  ? t('deliveries.new.whenToday')
                  : candidate === tomorrow
                    ? t('deliveries.new.whenTomorrow')
                    : formatDay(candidate)}
              </Chip>
            ))}
          </View>
          {values.when !== 'asap' ? (
            <TextField
              label={t('deliveries.new.time')}
              value={values.time}
              onChangeText={set('time')}
              keyboardType="numbers-and-punctuation"
              errorMessage={errors.time ? t('deliveries.errors.time') : null}
            />
          ) : null}

          <Text variant="titleMedium">{t('deliveries.new.courierLabel')}</Text>
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            <Chip
              selected={values.courierId === null}
              onPress={() => setValues((current) => ({ ...current, courierId: null }))}>
              {t('deliveries.openToAll')}
            </Chip>
            {couriers.map((courier) => (
              <Chip
                key={courier.id}
                selected={values.courierId === courier.id}
                onPress={() => setValues((current) => ({ ...current, courierId: courier.id }))}>
                {courier.name}
              </Chip>
            ))}
          </View>
          {couriers.length === 0 ? (
            <Notice tone="info" message={t('deliveries.new.noCourier')} />
          ) : null}
        </Card.Content>
      </Card>

      {props.maxAmount > 0 || values.amount ? (
        <Card mode="outlined">
          <Card.Content style={{ gap: spacing.sm }}>
            <TextField
              label={t('deliveries.new.amountToCollect')}
              value={values.amount}
              onChangeText={set('amount')}
              keyboardType="numeric"
              errorMessage={amountError}
            />
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('deliveries.new.amountHelp', { amount: formatMoney(props.maxAmount, currency) })}
            </Text>
          </Card.Content>
        </Card>
      ) : null}

      <TextField
        label={t('deliveries.new.note')}
        value={values.note}
        onChangeText={set('note')}
        multiline
      />
      {failed ? <Notice message={t('deliveries.errors.failed')} /> : null}
      <BigButton icon="content-save" loading={isSaving} disabled={isSaving} onPress={handleSave}>
        {t('deliveries.new.save')}
      </BigButton>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
