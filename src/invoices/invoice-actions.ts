import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';

import { whatsappLink } from '@/domain/phone';
import type { SaleDetail } from '@/sales/sale-data';
import type { ShopSettings } from '@/shop/shop-settings';

import { type InvoiceData, type InvoiceFormat, invoiceHtml, invoiceText } from './invoice-html';

/**
 * Partager et imprimer les factures.
 *   - PDF : fabriqué dans l'appareil (même hors ligne), puis partagé (WhatsApp, e-mail…).
 *   - Impression A4 : par l'imprimante du téléphone ou de l'ordinateur.
 *   - Message WhatsApp : la facture en texte, envoyée au numéro du client.
 */

/** Tailles des pages en points (1 point = 1/72 de pouce). */
const PAGE_SIZES: Record<InvoiceFormat, { width: number; height?: number }> = {
  a4: { width: 595, height: 842 },
  ticket80: { width: 227 },
  ticket58: { width: 164 },
};

/** Les informations de la facture, à partir de la vente et des réglages de la boutique. */
export function toInvoiceData(sale: SaleDetail, shop: ShopSettings): InvoiceData {
  const payments = sale.payments.filter((payment) => payment.kind === 'sale');
  return {
    shop: {
      name: shop.name,
      phone: shop.phone,
      address: shop.address,
      footer: shop.invoiceFooter,
    },
    currency: shop.currencyCode,
    invoiceNumber: sale.invoiceNumber,
    occurredAt: sale.occurredAt,
    sellerName: sale.sellerName,
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    items: sale.items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      unitName: item.unitName,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    payments: payments.map((payment) => ({ label: payment.methodLabel, amount: payment.amount })),
    due: sale.due,
    change: payments.reduce((sum, payment) => sum + (payment.changeGiven ?? 0), 0),
    cancelled: sale.status === 'cancelled',
    cancelReason: sale.cancelReason,
  };
}

/** Vrai si l'appareil sait fabriquer et partager un fichier PDF (téléphone, tablette). */
export function canSharePdf(): boolean {
  return Platform.OS !== 'web';
}

/** Hauteur d'un ticket : selon le nombre de lignes (un ticket est une longue bande de papier). */
function ticketHeight(data: InvoiceData): number {
  return 260 + data.items.length * 34 + data.payments.length * 16;
}

/** Fabrique le PDF de la facture et ouvre le partage (WhatsApp, e-mail, Bluetooth…). */
export async function shareInvoicePdf(data: InvoiceData, format: InvoiceFormat = 'a4') {
  const size = PAGE_SIZES[format];
  const { uri } = await Print.printToFileAsync({
    html: invoiceHtml(data, format),
    width: size.width,
    height: size.height ?? ticketHeight(data),
  });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Facture ${data.invoiceNumber}`,
  });
}

/** Imprime la facture (A4, ou ticket sur une imprimante reconnue par le système). */
export async function printInvoice(data: InvoiceData, format: InvoiceFormat = 'a4') {
  const size = PAGE_SIZES[format];
  await Print.printAsync({
    html: invoiceHtml(data, format),
    width: size.width,
    height: size.height ?? ticketHeight(data),
  });
}

/**
 * Ouvre WhatsApp avec la facture en texte, sur la conversation du client
 * (ou, sans numéro, WhatsApp demande à qui l'envoyer).
 */
export async function sendInvoiceByWhatsApp(data: InvoiceData, phone: string | null) {
  const text = invoiceText(data);
  const url = phone ? whatsappLink(phone, text) : `https://wa.me/?text=${encodeURIComponent(text)}`;
  await Linking.openURL(url);
}
