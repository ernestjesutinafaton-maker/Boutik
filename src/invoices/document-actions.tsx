import { usePowerSync } from '@powersync/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';

import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import type { PaperWidth } from '@/printing/escpos';
import { useAppTheme } from '@/theme/paper-theme';

import { canSharePdf, openWhatsApp, printHtml, shareHtmlAsPdf } from './invoice-actions';
import { addToOutbox, type OutboxKind } from './outbox';
import { TicketPrintButton } from './ticket-print-button';

type DocumentActionsProps = {
  title: string;
  /** Le document A4 en HTML (PDF et impression) */
  html: string;
  pdfTitle: string;
  /** Le message WhatsApp, et le numéro du client (s'il est connu) */
  whatsappText: string;
  phone: string | null;
  ticketBytes: (width: PaperWidth) => Uint8Array;
  printTicketHtml: (width: PaperWidth) => Promise<void>;
  outbox: {
    shopId: string;
    kind: OutboxKind;
    saleId?: string | null;
    customerId?: string | null;
    paymentId?: string | null;
    label: string;
  };
};

/** Les boutons d'un document (facture, reçu) : PDF, WhatsApp, impression A4, ticket, plus tard. */
export function DocumentActions(props: DocumentActionsProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const db = usePowerSync();
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);

  async function run(action: () => Promise<void>) {
    setMessage(null);
    try {
      await action();
    } catch (error) {
      console.warn('Document : action impossible :', error);
      setMessage({ text: t('invoice.error'), tone: 'error' });
    }
  }

  async function later() {
    await addToOutbox(db, props.outbox);
    setMessage({ text: t('invoice.queued'), tone: 'info' });
  }

  return (
    <Card mode="outlined">
      <Card.Title title={props.title} titleVariant="titleLarge" />
      <Card.Content style={{ gap: theme.app.spacing.sm }}>
        <View style={[styles.wrap, { gap: theme.app.spacing.sm }]}>
          {canSharePdf() ? (
            <Button
              mode="contained"
              icon="file-pdf-box"
              onPress={() => run(() => shareHtmlAsPdf(props.html, props.pdfTitle))}>
              {t('invoice.sharePdf')}
            </Button>
          ) : null}
          <Button
            mode="contained-tonal"
            icon="whatsapp"
            onPress={() => run(() => openWhatsApp(props.phone, props.whatsappText))}>
            {t('invoice.whatsapp')}
          </Button>
          <Button mode="outlined" icon="printer" onPress={() => run(() => printHtml(props.html))}>
            {t('invoice.printA4')}
          </Button>
          <TicketPrintButton
            ticketBytes={props.ticketBytes}
            printTicketHtml={props.printTicketHtml}
            onError={(text) => setMessage({ text, tone: 'error' })}
          />
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
