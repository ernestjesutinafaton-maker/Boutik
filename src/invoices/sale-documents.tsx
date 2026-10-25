import { usePowerSync } from '@powersync/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Card } from 'react-native-paper';

import { Notice } from '@/components/notice';
import type { SaleDetail } from '@/sales/sale-data';
import { useShopSettings } from '@/shop/shop-settings';
import { useAppTheme } from '@/theme/paper-theme';

import {
  canSharePdf,
  printInvoice,
  sendInvoiceByWhatsApp,
  shareInvoicePdf,
  toInvoiceData,
} from './invoice-actions';
import { addToOutbox } from './outbox';
import { TicketPrintButton } from './ticket-print-button';

/** Les boutons « facture » d'une vente : PDF, WhatsApp, impression, envoyer plus tard. */
export function SaleDocuments({ sale }: { sale: SaleDetail }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const settings = useShopSettings();
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);

  if (!settings) {
    return null;
  }
  const data = toInvoiceData(sale, settings);

  async function run(action: () => Promise<void>) {
    setMessage(null);
    try {
      await action();
    } catch (error) {
      console.warn('Facture : action impossible :', error);
      setMessage({ text: t('invoice.error'), tone: 'error' });
    }
  }

  async function later() {
    await addToOutbox(db, {
      shopId: settings?.id ?? '',
      kind: 'invoice',
      saleId: sale.id,
      customerId: sale.customerId,
      label: `${sale.invoiceNumber}${sale.customerName ? ` · ${sale.customerName}` : ''}`,
    });
    setMessage({ text: t('invoice.queued'), tone: 'info' });
  }

  return (
    <Card mode="outlined">
      <Card.Title title={t('invoice.title')} titleVariant="titleLarge" />
      <Card.Content style={{ gap: theme.app.spacing.sm }}>
        <View style={[styles.wrap, { gap: theme.app.spacing.sm }]}>
          {canSharePdf() ? (
            <Button
              mode="contained"
              icon="file-pdf-box"
              onPress={() => run(() => shareInvoicePdf(data))}>
              {t('invoice.sharePdf')}
            </Button>
          ) : null}
          <Button
            mode="contained-tonal"
            icon="whatsapp"
            onPress={() => run(() => sendInvoiceByWhatsApp(data, sale.customerPhone))}>
            {t('invoice.whatsapp')}
          </Button>
          <Button mode="outlined" icon="printer" onPress={() => run(() => printInvoice(data))}>
            {t('invoice.printA4')}
          </Button>
          <TicketPrintButton data={data} onError={(text) => setMessage({ text, tone: 'error' })} />
          <Button mode="text" icon="send-clock" onPress={() => run(later)}>
            {t('invoice.later')}
          </Button>
        </View>
        {message ? <Notice tone={message.tone} message={message.text} /> : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
