import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'react-native-paper';

import { isBluetoothPrintingSupported, printerErrorCode, printToPrinter } from '@/printing/printer';
import { usePrinterSettings } from '@/printing/printer-settings';
import { invoiceTicketBytes } from '@/printing/ticket';

import { printInvoice } from './invoice-actions';
import type { InvoiceData } from './invoice-html';

type TicketPrintButtonProps = { data: InvoiceData; onError: (text: string) => void };

/**
 * Bouton « Ticket » :
 *   - téléphone ou tablette : imprimante Bluetooth 58 / 80 mm (choisie une fois, puis un clic) ;
 *   - ordinateur : ticket imprimé par le système (imprimante de tickets USB).
 */
export function TicketPrintButton({ data, onError }: TicketPrintButtonProps) {
  const { t } = useTranslation();
  const { settings, isLoaded } = usePrinterSettings();
  const [isPrinting, setIsPrinting] = useState(false);

  async function handlePress() {
    if (!isBluetoothPrintingSupported) {
      await printInvoice(data, settings?.width === 58 ? 'ticket58' : 'ticket80').catch(() =>
        onError(t('printer.errors.unknown'))
      );
      return;
    }
    if (!settings) {
      router.push('/printer');
      return;
    }
    setIsPrinting(true);
    try {
      await printToPrinter(settings.address, invoiceTicketBytes(data, settings.width));
    } catch (error) {
      onError(t(`printer.errors.${printerErrorCode(error)}`));
    } finally {
      setIsPrinting(false);
    }
  }

  return (
    <Button
      mode="outlined"
      icon="printer-pos"
      onPress={handlePress}
      loading={isPrinting}
      disabled={!isLoaded || isPrinting}>
      {settings || !isBluetoothPrintingSupported
        ? t('printer.printTicket')
        : t('printer.chooseFirst')}
    </Button>
  );
}
