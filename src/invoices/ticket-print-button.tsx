import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'react-native-paper';

import type { PaperWidth } from '@/printing/escpos';
import { isBluetoothPrintingSupported, printerErrorCode, printToPrinter } from '@/printing/printer';
import { usePrinterSettings } from '@/printing/printer-settings';

type TicketPrintButtonProps = {
  /** Les octets ESC/POS du ticket (imprimante Bluetooth) */
  ticketBytes: (width: PaperWidth) => Uint8Array;
  /** Le ticket en HTML (impression par le système, sur ordinateur) */
  printTicketHtml: (width: PaperWidth) => Promise<void>;
  onError: (text: string) => void;
};

/**
 * Bouton « Ticket » :
 *   - téléphone ou tablette : imprimante Bluetooth 58 / 80 mm (choisie une fois, puis un clic) ;
 *   - ordinateur : ticket imprimé par le système (imprimante de tickets USB).
 */
export function TicketPrintButton({
  ticketBytes,
  printTicketHtml,
  onError,
}: TicketPrintButtonProps) {
  const { t } = useTranslation();
  const { settings, isLoaded } = usePrinterSettings();
  const [isPrinting, setIsPrinting] = useState(false);

  async function handlePress() {
    if (!isBluetoothPrintingSupported) {
      await printTicketHtml(settings?.width ?? 80).catch(() =>
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
      await printToPrinter(settings.address, ticketBytes(settings.width));
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
