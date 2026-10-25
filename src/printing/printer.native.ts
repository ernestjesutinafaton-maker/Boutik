import {
  connectToPrinter,
  ensureBluetoothPermission,
  findPrinters,
  isPrintingSupported,
  printBytes,
} from '@ricka7x/expo-thermal-printer';

/**
 * Imprimante de tickets Bluetooth — version TÉLÉPHONE et TABLETTE.
 *   - Android : imprimante Bluetooth « classique », appairée une fois dans les
 *     réglages Bluetooth du téléphone.
 *   - iPhone : seulement les imprimantes « BLE » (Bluetooth basse consommation).
 * Les octets du ticket sont fabriqués par escpos.ts ; ce fichier ne fait que les envoyer.
 */

export type { PrinterErrorCode, PrinterInfo } from './printer';
export { printerErrorCode } from './printer';

export const isBluetoothPrintingSupported = isPrintingSupported();

export function requestPrinterPermission(): Promise<boolean> {
  return ensureBluetoothPermission();
}

export async function listPrinters(): Promise<{ address: string; name: string }[]> {
  const printers = await findPrinters({ scanTimeoutMs: 5000 });
  return printers.map((printer) => ({ address: printer.address, name: printer.name }));
}

/** Se connecte (si besoin) puis envoie le ticket. */
export async function printToPrinter(address: string, bytes: Uint8Array): Promise<void> {
  await connectToPrinter(address);
  await printBytes(bytes);
}
