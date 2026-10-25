import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Text } from 'react-native-paper';

import { BigButton } from '@/components/big-button';
import { MoneyText } from '@/components/money-text';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { useRepaymentReceipt } from '@/customers/customer-data';
import { formatMoment } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { DocumentActions } from '@/invoices/document-actions';
import { printHtml, ticketPageSize } from '@/invoices/invoice-actions';
import { type ReceiptData, receiptHtml, receiptNumber, receiptText } from '@/invoices/receipt';
import { receiptTicketBytes } from '@/printing/ticket';
import { useShopSettings } from '@/shop/shop-settings';
import { useAppTheme } from '@/theme/paper-theme';

/** Le reçu d'un remboursement : à envoyer par WhatsApp, en PDF, ou à imprimer. */
export default function ReceiptScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const settings = useShopSettings();
  const { paymentId, created } = useLocalSearchParams<{ paymentId: string; created?: string }>();
  const receipt = useRepaymentReceipt(paymentId);

  if (!receipt || !settings) {
    return (
      <Screen title={t('receipt.title')} stack>
        {null}
      </Screen>
    );
  }

  const data: ReceiptData = {
    shop: { name: settings.name, phone: settings.phone, address: settings.address },
    currency: settings.currencyCode,
    receiptNumber: receiptNumber(receipt.id),
    occurredAt: receipt.occurredAt,
    customerName: receipt.customerName,
    amount: receipt.amount,
    methodLabel: receipt.methodLabel,
    balanceAfter: receipt.balanceAfter,
    receivedBy: receipt.receivedBy,
  };

  return (
    <Screen title={t('receipt.titleNumber', { number: data.receiptNumber })} stack>
      {created ? <Notice tone="info" message={t('receipt.created')} /> : null}
      <Card mode="outlined">
        <Card.Content style={{ gap: theme.app.spacing.xs }}>
          <Text variant="titleMedium">{receipt.customerName}</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {formatMoment(receipt.occurredAt)} · {receipt.methodLabel}
          </Text>
          <MoneyText
            amount={receipt.amount}
            currency={settings.currencyCode}
            tone="primary"
            size="large"
          />
          <Text variant="bodyLarge">
            {receipt.balanceAfter > 0
              ? t('repay.after', {
                  amount: formatMoney(receipt.balanceAfter, settings.currencyCode),
                })
              : t('receipt.settled')}
          </Text>
        </Card.Content>
      </Card>

      <DocumentActions
        title={t('receipt.title')}
        html={receiptHtml(data)}
        pdfTitle={`Reçu ${data.receiptNumber}`}
        whatsappText={receiptText(data)}
        phone={receipt.customerPhone}
        ticketBytes={(width) => receiptTicketBytes(data, width)}
        printTicketHtml={(width) =>
          printHtml(
            receiptHtml(data, width === 58 ? 'ticket58' : 'ticket80'),
            ticketPageSize(width, 4)
          )
        }
        outbox={{
          shopId: settings.id,
          kind: 'receipt',
          customerId: receipt.customerId,
          paymentId: receipt.id,
          label: `${data.receiptNumber} · ${receipt.customerName}`,
        }}
      />

      <BigButton
        icon="account"
        variant="outline"
        onPress={() => (created ? router.back() : router.push(`/customer/${receipt.customerId}`))}>
        {t('receipt.backToCustomer')}
      </BigButton>
    </Screen>
  );
}
