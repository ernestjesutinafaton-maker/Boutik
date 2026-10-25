/**
 * ESC/POS : le « langage » des imprimantes de tickets (58 et 80 mm).
 *
 * On fabrique nous-mêmes les octets envoyés à l'imprimante : le même code marche
 * avec n'importe quelle imprimante compatible, et il est entièrement testé.
 * Les accents français passent par la « page de code 850 » (é = 0x82, à = 0x85…),
 * reconnue par presque toutes les imprimantes de tickets.
 */

/** Nombre de caractères par ligne (police normale) : 32 en 58 mm, 48 en 80 mm. */
export type PaperWidth = 58 | 80;

export function columnsFor(width: PaperWidth): number {
  return width === 58 ? 32 : 48;
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** Les caractères accentués et spéciaux de la page de code 850. */
const CP850: Record<string, number> = {
  Ç: 0x80,
  ü: 0x81,
  é: 0x82,
  â: 0x83,
  ä: 0x84,
  à: 0x85,
  å: 0x86,
  ç: 0x87,
  ê: 0x88,
  ë: 0x89,
  è: 0x8a,
  ï: 0x8b,
  î: 0x8c,
  ì: 0x8d,
  Ä: 0x8e,
  Å: 0x8f,
  É: 0x90,
  æ: 0x91,
  Æ: 0x92,
  ô: 0x93,
  ö: 0x94,
  ò: 0x95,
  û: 0x96,
  ù: 0x97,
  ÿ: 0x98,
  Ö: 0x99,
  Ü: 0x9a,
  ø: 0x9b,
  '£': 0x9c,
  Ø: 0x9d,
  '×': 0x9e,
  á: 0xa0,
  í: 0xa1,
  ó: 0xa2,
  ú: 0xa3,
  ñ: 0xa4,
  Ñ: 0xa5,
  '«': 0xae,
  '»': 0xaf,
  Á: 0xb5,
  Â: 0xb6,
  À: 0xb7,
  Ê: 0xd2,
  Ë: 0xd3,
  È: 0xd4,
  Í: 0xd6,
  Î: 0xd7,
  Ï: 0xd8,
  Ó: 0xe0,
  ß: 0xe1,
  Ô: 0xe2,
  Ò: 0xe3,
  Ú: 0xe9,
  Û: 0xea,
  Ù: 0xeb,
  '°': 0xf8,
  '·': 0xfa,
  '²': 0xfd,
};

/** Caractères sans équivalent : remplacés par une écriture simple. */
const REPLACEMENTS: Record<string, string> = {
  ' ': ' ', // espace insécable
  ' ': ' ',
  '’': "'",
  '‘': "'",
  '“': '"',
  '”': '"',
  '…': '...',
  '–': '-',
  '—': '-',
  '−': '-',
  œ: 'oe',
  Œ: 'OE',
  '€': 'EUR',
  '₦': 'N',
  '₵': 'C',
  '•': '-',
};

/** Transforme un texte en octets pour l'imprimante (page de code 850). */
export function encodeText(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const replaced = REPLACEMENTS[char];
    if (replaced !== undefined) {
      bytes.push(...encodeText(replaced));
      continue;
    }
    const code = char.codePointAt(0) ?? 0x3f;
    if (code >= 0x20 && code < 0x7f) {
      bytes.push(code);
    } else {
      bytes.push(CP850[char] ?? 0x3f); // « ? » pour un caractère inconnu
    }
  }
  return bytes;
}

/** Longueur affichée d'un texte sur le ticket (« … » compte pour 3). */
function printedLength(text: string): number {
  return encodeText(text).length;
}

/** Coupe un texte en lignes d'au plus « columns » caractères, sans couper les mots si possible. */
export function wrapText(text: string, columns: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    let rest = word;
    // Un mot plus long que la ligne est coupé en morceaux
    while (printedLength(rest) > columns) {
      if (current) {
        lines.push(current);
        current = '';
      }
      lines.push(rest.slice(0, columns));
      rest = rest.slice(columns);
    }
    if (!rest) continue;
    const candidate = current ? `${current} ${rest}` : rest;
    if (printedLength(candidate) <= columns) {
      current = candidate;
    } else {
      lines.push(current);
      current = rest;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

/**
 * Une ligne « texte à gauche … montant à droite », sur la largeur du ticket.
 * Si tout ne tient pas sur une ligne, le montant passe seul à la ligne suivante, à droite.
 */
export function twoColumns(left: string, right: string, columns: number): string[] {
  const rightLength = printedLength(right);
  const rightAligned = `${' '.repeat(Math.max(columns - rightLength, 0))}${right}`;
  const leftLines = wrapText(left, columns);
  const last = leftLines[leftLines.length - 1];
  const spaces = columns - printedLength(last) - rightLength;
  if (spaces >= 1) {
    return [...leftLines.slice(0, -1), `${last}${' '.repeat(spaces)}${right}`];
  }
  return [...leftLines, rightAligned];
}

export type Align = 'left' | 'center' | 'right';

/** Une ligne du ticket, avant transformation en octets. */
export type TicketLine =
  | { kind: 'text'; text: string; align?: Align; bold?: boolean; big?: boolean }
  | { kind: 'columns'; left: string; right: string; bold?: boolean }
  | { kind: 'rule' }
  | { kind: 'feed'; lines: number };

/** Transforme les lignes du ticket en octets ESC/POS, prêts à envoyer à l'imprimante. */
export function encodeTicket(lines: readonly TicketLine[], width: PaperWidth): Uint8Array {
  const columns = columnsFor(width);
  const bytes: number[] = [
    ESC,
    0x40, // réinitialiser l'imprimante
    ESC,
    0x74,
    0x02, // page de code 850 (accents)
  ];
  const align = (value: Align) => bytes.push(ESC, 0x61, { left: 0, center: 1, right: 2 }[value]);
  const bold = (on: boolean) => bytes.push(ESC, 0x45, on ? 1 : 0);
  const big = (on: boolean) => bytes.push(GS, 0x21, on ? 0x11 : 0x00); // double largeur et hauteur
  const line = (text: string) => bytes.push(...encodeText(text), LF);

  for (const item of lines) {
    switch (item.kind) {
      case 'text': {
        align(item.align ?? 'left');
        if (item.bold) bold(true);
        if (item.big) big(true);
        // En grand, chaque caractère prend deux places
        for (const part of wrapText(item.text, item.big ? Math.floor(columns / 2) : columns)) {
          line(part);
        }
        if (item.big) big(false);
        if (item.bold) bold(false);
        align('left');
        break;
      }
      case 'columns':
        if (item.bold) bold(true);
        for (const part of twoColumns(item.left, item.right, columns)) {
          line(part);
        }
        if (item.bold) bold(false);
        break;
      case 'rule':
        line('-'.repeat(columns));
        break;
      case 'feed':
        bytes.push(ESC, 0x64, Math.min(Math.max(item.lines, 0), 255));
        break;
    }
  }
  // Avancer le papier pour pouvoir le déchirer, puis couper (si l'imprimante a un massicot)
  bytes.push(ESC, 0x64, 4, GS, 0x56, 0x42, 0x00);
  return Uint8Array.from(bytes);
}
