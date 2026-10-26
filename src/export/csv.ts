import { type CurrencyCode, formatMoneyInput } from '@/domain/money';
import { MILLI } from '@/domain/quantity';

/**
 * Fichiers CSV pour Excel (version française) :
 *   - séparateur « ; » (Excel français l'attend, car la virgule sert aux décimales) ;
 *   - nombres avec une virgule décimale et SANS espace des milliers (sinon Excel y voit du texte) ;
 *   - un « BOM » au début, pour qu'Excel lise bien les accents (é, è, à…).
 */

export type CsvCell = string | number | null;

/** Le BOM UTF-8 : indique à Excel que le fichier est en UTF-8. */
export const BOM = String.fromCharCode(0xfeff);

function escapeCell(cell: CsvCell): string {
  if (cell === null) return '';
  const text = String(cell);
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Le contenu complet du fichier CSV (avec le BOM). */
export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(';'));
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

/** Une quantité (millièmes) pour Excel : 2500 → « 2,5 » ; 1500000 → « 1500 ». */
export function quantityCell(milli: number): string {
  const sign = milli < 0 ? '-' : '';
  const absolute = Math.abs(milli);
  const decimals = String(absolute % MILLI)
    .padStart(3, '0')
    .replace(/0+$/, '');
  return `${sign}${Math.floor(absolute / MILLI)}${decimals ? `,${decimals}` : ''}`;
}

/** Un montant pour Excel : 32000 → « 32000 » ; 150050 (naira) → « 1500,50 ». */
export function moneyCell(amount: number, currency: CurrencyCode): string {
  return formatMoneyInput(amount, currency);
}

/** Un nom de fichier sûr : « ventes-2026-10.csv ». */
export function csvFileName(name: string, suffix: string): string {
  const clean = `${name}-${suffix}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${clean}.csv`;
}
