import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';

import { whatsappLink } from '@/domain/phone';
import type { SaleDetail } from '@/sales/sale-data';
import type { ShopSettings } from '@/shop/shop-settings';

import type { InvoiceData } from './invoice-html';

/**
 * Partager et imprimer les documents (factures, reçus).
 *   - PDF : fabriqué dans l'appareil (même hors ligne), puis partagé (WhatsApp, e-mail…).
 *   - Impression : par l'imprimante du téléphone ou de l'ordinateur (A4 ou ticket).
 *   - Message WhatsApp : le document en texte, envoyé au numéro du client.
 */

/** Taille d'une page en points (1 point = 1/72 de pouce). Sans hauteur : longue bande (ticket). */
export type PageSize = { width: number; height: number };

export const A4: PageSize = { width: 595, height: 842 };

/** Taille d'un ticket : largeur du papier, hauteur selon le nombre de lignes. */
export function ticketPageSize(width: 58 | 80, lineCount: number): PageSize {
  return { width: width === 58 ? 164 : 227, height: 260 + lineCount * 30 };
}

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

/** Fabrique le PDF et ouvre le partage (WhatsApp, e-mail, Bluetooth…). */
export async function shareHtmlAsPdf(html: string, title: string, size: PageSize = A4) {
  const { uri } = await Print.printToFileAsync({ html, width: size.width, height: size.height });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: title,
  });
}

/** Imprime par l'imprimante du système (A4, ou ticket sur une imprimante installée). */
export async function printHtml(html: string, size: PageSize = A4) {
  await Print.printAsync({ html, width: size.width, height: size.height });
}

/**
 * Ouvre WhatsApp avec un message, sur la conversation du client
 * (ou, sans numéro, WhatsApp demande à qui l'envoyer).
 */
export async function openWhatsApp(phone: string | null, text: string) {
  const url = phone ? whatsappLink(phone, text) : `https://wa.me/?text=${encodeURIComponent(text)}`;
  await Linking.openURL(url);
}
