import { usePowerSync } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Divider, Portal, Text } from 'react-native-paper';

import { Card } from '@/components/card';
import { BigButton } from '@/components/big-button';
import { MoneyText } from '@/components/money-text';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { StatusChip } from '@/components/status-chip';
import { TextField } from '@/components/text-field';
import { useActionContext } from '@/data/use-action-context';
import { formatMoment } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { formatQuantity, pluralUnit } from '@/domain/quantity';
import { SaleDeliveryCard } from '@/deliveries/sale-delivery-card';
import { SaleDocuments } from '@/invoices/sale-documents';
import { useCart } from '@/sales/cart-provider';
import { cancelSale } from '@/sales/sale-actions';
import { useSale } from '@/sales/sale-data';
import { useSaleEditRight } from '@/sales/use-sale-edit-right';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';
import { useAppTheme } from '@/theme/paper-theme';

/**
 * Une vente (la facture à l'écran) : partager, imprimer, MODIFIER (pendant le délai choisi par
 * le propriétaire), reprendre des articles ou supprimer.
 */
export default function SaleScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const context = useActionContext();
  const settings = useShopSettings();
  const { can } = useActiveMember();
  const { saleId, created, refunded } = useLocalSearchParams<{
    saleId: string;
    created?: string;
    refunded?: string;
  }>();
  const { sale, isLoading } = useSale(saleId);
  const cart = useCart();
  const right = useSaleEditRight(sale);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isModifyOpen, setIsModifyOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const currency = settings?.currencyCode ?? 'XOF';
  const { spacing } = theme.app;

  if (!sale) {
    return (
      <Screen title={t('sale.title')} stack>
        {isLoading ? null : <Notice message={t('common.notFound')} />}
      </Screen>
    );
  }

  async function handleCancel() {
    if (!context || !sale || !reason.trim()) {
      return;
    }
    setIsWorking(true);
    try {
      await cancelSale(db, context, sale.id, reason.trim());
      setIsCancelOpen(false);
    } finally {
      setIsWorking(false);
    }
  }

  /** Remplit le panier avec cette vente, puis va à la caisse pour la modifier */
  function startModifying() {
    // La vente doit être chargée en entier (lignes ET paiements) avant de la modifier
    if (!sale || isLoading) return;
    cart.startEditing(sale);
    setIsModifyOpen(false);
    router.navigate('/');
  }

  const isCancelled = sale.status === 'cancelled';
  const refundedNow = Number(refunded ?? 0);
  const totalChange = sale.payments.reduce((sum, payment) => sum + (payment.changeGiven ?? 0), 0);
  const hasReturns = sale.items.some((item) => item.returnedQuantity > 0);

  return (
    <Screen title={t('sale.titleNumber', { number: sale.invoiceNumber })} stack>
      {created ? <Notice tone="info" message={t('sale.created')} /> : null}
      {sale.replacedBy ? (
        <View style={{ gap: spacing.sm }}>
          <Notice
            tone="info"
            message={t('modify.replacedBy', { number: sale.replacedBy.invoiceNumber })}
          />
          <BigButton
            icon="file-document-arrow-right"
            variant="outline"
            onPress={() => sale.replacedBy && router.replace(`/sale/${sale.replacedBy.id}`)}>
            {t('modify.seeNew')}
          </BigButton>
        </View>
      ) : isCancelled ? (
        <Notice
          message={t('sale.cancelledInfo', {
            date: sale.cancelledAt ? formatMoment(sale.cancelledAt) : '',
            reason: sale.cancelReason ?? '',
          })}
        />
      ) : null}
      {sale.replaces ? (
        <Notice
          tone="info"
          message={t('modify.replaces', { number: sale.replaces.invoiceNumber })}
        />
      ) : null}

      {created && refundedNow > 0 ? (
        <Card mode="outlined">
          <Card.Content style={[styles.center, { paddingVertical: spacing.md }]}>
            <Text variant="titleMedium">{t('modify.refundNow')}</Text>
            <MoneyText amount={refundedNow} currency={currency} size="large" tone="danger" />
          </Card.Content>
        </Card>
      ) : null}

      {created && totalChange > 0 ? (
        <Card mode="outlined">
          <Card.Content style={[styles.center, { paddingVertical: spacing.md }]}>
            <Text variant="titleMedium">{t('checkout.change')}</Text>
            <MoneyText amount={totalChange} currency={currency} size="large" tone="primary" />
          </Card.Content>
        </Card>
      ) : null}

      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.xs }}>
          <View style={styles.between}>
            <Text variant="titleLarge" style={styles.bold}>
              {sale.invoiceNumber}
            </Text>
            <StatusChip
              tone={
                sale.replacedBy
                  ? 'neutral'
                  : isCancelled
                    ? 'danger'
                    : sale.due > 0
                      ? 'warning'
                      : 'ok'
              }
              label={
                sale.replacedBy
                  ? t('sale.status.modified')
                  : isCancelled
                    ? t('sale.status.cancelled')
                    : sale.due > 0
                      ? t('sale.status.credit')
                      : t('sale.status.paid')
              }
            />
          </View>
          <Text variant="bodyLarge">{formatMoment(sale.occurredAt)}</Text>
          {sale.sellerName ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('sale.seller', { name: sale.sellerName })}
            </Text>
          ) : null}
          {sale.customerName ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('sale.customer', { name: sale.customerName })}
            </Text>
          ) : null}
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content style={{ gap: spacing.sm }}>
          {sale.items.map((item, index) => (
            <View key={item.id} style={{ gap: 2 }}>
              {index > 0 ? <Divider style={{ marginBottom: spacing.sm }} /> : null}
              <Text variant="titleMedium" style={styles.bold}>
                {item.productName}
              </Text>
              <View style={styles.between}>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t('sale.itemLine', {
                    quantity: formatQuantity(item.quantity),
                    unit: pluralUnit(item.unitName, item.quantity),
                    price: formatMoney(item.unitPrice, currency),
                  })}
                </Text>
                <Text variant="titleMedium">{formatMoney(item.lineTotal, currency)}</Text>
              </View>
              {item.returnedQuantity > 0 ? (
                <Text variant="bodySmall" style={{ color: theme.app.colors.danger }}>
                  {t('sale.returned', {
                    quantity: formatQuantity(
                      Math.round((item.returnedQuantity * 1000) / item.unitFactor)
                    ),
                    unit: pluralUnit(
                      item.unitName,
                      Math.round((item.returnedQuantity * 1000) / item.unitFactor)
                    ),
                  })}
                </Text>
              ) : null}
            </View>
          ))}
          <Divider />
          {sale.discount > 0 ? (
            <>
              <Row label={t('sale.subtotal')} value={formatMoney(sale.subtotal, currency)} />
              <Row label={t('sale.discount')} value={`− ${formatMoney(sale.discount, currency)}`} />
            </>
          ) : null}
          <View style={styles.between}>
            <Text variant="titleLarge" style={styles.bold}>
              {t('sale.total')}
            </Text>
            <MoneyText amount={sale.total} currency={currency} />
          </View>
          {sale.payments.map((payment) => (
            <Row
              key={payment.id}
              label={
                payment.kind === 'refund'
                  ? t('sale.refund', { method: payment.methodLabel })
                  : payment.methodLabel
              }
              value={formatMoney(payment.amount, currency)}
            />
          ))}
          {sale.due > 0 ? (
            <Row
              label={t('sale.dueLabel')}
              value={formatMoney(sale.due, currency)}
              color={theme.app.colors.danger}
            />
          ) : null}
        </Card.Content>
      </Card>

      <SaleDocuments sale={sale} />
      <SaleDeliveryCard sale={sale} />

      <BigButton
        icon="cart-plus"
        onPress={() => (created ? router.replace('/') : router.navigate('/'))}>
        {t('sale.newSale')}
      </BigButton>

      {right?.allowed ? (
        <View style={{ gap: spacing.sm }}>
          <BigButton icon="pencil" disabled={isLoading} onPress={() => setIsModifyOpen(true)}>
            {t('modify.button')}
          </BigButton>
          <Text
            variant="bodyMedium"
            style={[
              styles.centerText,
              { color: right.late ? theme.app.colors.danger : theme.colors.onSurfaceVariant },
            ]}>
            {right.late
              ? t('modify.lateOwner', { date: formatMoment(right.deadline) })
              : t('modify.until', { date: formatMoment(right.deadline) })}
          </Text>
          <BigButton
            icon="keyboard-return"
            variant="outline"
            onPress={() => router.push(`/sale/${sale.id}/return`)}>
            {t('sale.return')}
          </BigButton>
          {can('sale.cancel') ? (
            <BigButton icon="cancel" variant="danger" onPress={() => setIsCancelOpen(true)}>
              {t('sale.cancel')}
            </BigButton>
          ) : null}
        </View>
      ) : right?.reason === 'late' ? (
        <Notice
          tone="info"
          message={t('modify.archived', { date: formatMoment(right.deadline) })}
        />
      ) : right?.reason === 'notOwnSale' ? (
        <Notice tone="info" message={t('modify.notOwnSale')} />
      ) : null}

      <Portal>
        <Dialog visible={isModifyOpen} onDismiss={() => setIsModifyOpen(false)}>
          <Dialog.Title>{t('modify.confirmTitle')}</Dialog.Title>
          <Dialog.Content style={{ gap: spacing.sm }}>
            <Text variant="bodyLarge">
              {t('modify.confirmText', { number: sale.invoiceNumber })}
            </Text>
            {cart.lines.length > 0 && cart.editing?.saleId !== sale.id ? (
              <Text variant="bodyMedium" style={{ color: theme.app.colors.danger }}>
                {t('modify.confirmCartNotEmpty')}
              </Text>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsModifyOpen(false)}>{t('common.back')}</Button>
            <Button onPress={startModifying}>{t('modify.confirm')}</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={isCancelOpen} onDismiss={() => setIsCancelOpen(false)}>
          <Dialog.Title>{t('sale.cancelTitle')}</Dialog.Title>
          <Dialog.Content style={{ gap: spacing.md }}>
            <Text variant="bodyLarge">
              {hasReturns ? t('sale.cancelTextWithReturns') : t('sale.cancelText')}
            </Text>
            <TextField
              label={t('sale.cancelReason')}
              value={reason}
              onChangeText={setReason}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsCancelOpen(false)}>{t('common.back')}</Button>
            <Button
              textColor={theme.app.colors.danger}
              onPress={handleCancel}
              loading={isWorking}
              disabled={!reason.trim() || isWorking}>
              {t('sale.cancel')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.between}>
      <Text variant="bodyLarge" style={color ? { color } : undefined}>
        {label}
      </Text>
      <Text variant="bodyLarge" style={[styles.bold, color ? { color } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bold: {
    fontWeight: '700',
  },
  fill: {
    flex: 1,
  },
});
