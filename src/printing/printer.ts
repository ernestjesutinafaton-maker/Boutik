/**
 * Imprimante de tickets Bluetooth — version NAVIGATEUR (web).
 * Le navigateur ne parle pas aux imprimantes Bluetooth : sur ordinateur, on imprime
 * le ticket par l'impression du système (imprimante USB installée dans Windows).
 * La version téléphone est dans printer.native.ts.
 */

export type PrinterInfo = { address: string; name: string };

/** Les raisons d'un échec d'impression (traduites à l'écran). */
export type PrinterErrorCode =
  | 'bluetooth_off'
  | 'permission_denied'
  | 'not_connected'
  | 'write_failed'
  | 'unsupported'
  | 'unknown';

/** Erreur d'impression avec son code (traduit en message clair à l'écran). */
export class PrinterError extends Error {
  constructor(readonly code: PrinterErrorCode) {
    super(`Impression impossible : ${code}`);
    this.name = 'PrinterError';
  }
}

export const isBluetoothPrintingSupported = false;

export async function requestPrinterPermission(): Promise<boolean> {
  return false;
}

export async function listPrinters(): Promise<PrinterInfo[]> {
  return [];
}

export async function printToPrinter(_address: string, _bytes: Uint8Array): Promise<void> {
  throw new PrinterError('unsupported');
}

/** Lit le code d'une erreur d'impression, quelle que soit sa forme. */
export function printerErrorCode(error: unknown): PrinterErrorCode {
  const code = (error as { code?: unknown } | null)?.code;
  const known: PrinterErrorCode[] = [
    'bluetooth_off',
    'permission_denied',
    'not_connected',
    'write_failed',
    'unsupported',
  ];
  return typeof code === 'string' && known.includes(code as PrinterErrorCode)
    ? (code as PrinterErrorCode)
    : 'unknown';
}
