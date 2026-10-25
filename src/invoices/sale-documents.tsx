import { useTranslation } from 'react-i18next';

import { invoiceTicketBytes, invoiceTicketLines } from '@/printing/ticket';
import type { SaleDetail } from '@/sales/sale-data';
import { useShopSettings } from '@/shop/shop-settings';

import { DocumentActions } from './document-actions';
import { printHtml, ticketPageSize, toInvoiceData } from './invoice-actions';
import { invoiceHtml, invoiceText } from './invoice-html';

/** Les boutons « facture » d'une vente : PDF, WhatsApp, impression, envoyer plus tard. */
export function SaleDocuments({ sale }: { sale: SaleDetail }) {
  const { t } = useTranslation();
  const settings = useShopSettings();
  if (!settings) {
    return null;
  }
  const data = toInvoiceData(sale, settings);
  const lineCount = invoiceTicketLines(data).length;

  return (
    <DocumentActions
      title={t('invoice.title')}
      html={invoiceHtml(data, 'a4')}
      pdfTitle={`Facture ${sale.invoiceNumber}`}
      whatsappText={invoiceText(data)}
      phone={sale.customerPhone}
      ticketBytes={(width) => invoiceTicketBytes(data, width)}
      printTicketHtml={(width) =>
        printHtml(
          invoiceHtml(data, width === 58 ? 'ticket58' : 'ticket80'),
          ticketPageSize(width, lineCount)
        )
      }
      outbox={{
        shopId: settings.id,
        kind: 'invoice',
        saleId: sale.id,
        customerId: sale.customerId,
        label: `${sale.invoiceNumber}${sale.customerName ? ` · ${sale.customerName}` : ''}`,
      }}
    />
  );
}
