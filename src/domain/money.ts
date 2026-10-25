/**
 * Argent : afficher et saisir les montants.
 *
 * RÈGLE D'OR : un montant est TOUJOURS un nombre entier, compté dans la plus
 * petite unité de la monnaie.
 *   - Le FCFA n'a pas de centimes : 32 000 FCFA s'enregistre 32000.
 *   - Le naira se compte en kobos : 1 500,50 ₦ s'enregistre 150050.
 * Pourquoi ? Les nombres à virgule font des erreurs d'arrondi
 * (en informatique, 0,1 + 0,2 = 0,30000000000000004), les nombres entiers jamais.
 */

/** Espace insécable : empêche « 32 000 FCFA » d'être coupé en fin de ligne. */
const NBSP = ' ';

/** Codes officiels (ISO 4217) des monnaies prises en charge. */
export type CurrencyCode = 'XOF' | 'XAF' | 'GNF' | 'NGN' | 'GHS';

export type Currency = {
  /** Nom affiché dans les réglages de la boutique */
  name: string;
  /** Symbole affiché après le montant */
  symbol: string;
  /** Nombre de chiffres après la virgule (0 pour le FCFA) */
  decimals: number;
};

/** Les monnaies connues. Pour en ajouter une, il suffit d'ajouter une ligne ici. */
export const CURRENCIES: Record<CurrencyCode, Currency> = {
  XOF: { name: "Franc CFA (Afrique de l'Ouest)", symbol: 'FCFA', decimals: 0 },
  XAF: { name: 'Franc CFA (Afrique centrale)', symbol: 'FCFA', decimals: 0 },
  GNF: { name: 'Franc guinéen', symbol: 'FG', decimals: 0 },
  NGN: { name: 'Naira', symbol: '₦', decimals: 2 },
  GHS: { name: 'Cedi', symbol: 'GH₵', decimals: 2 },
};

/**
 * Renvoie la description d'une monnaie.
 * Le code peut venir de la base de données : on vérifie donc qu'il existe vraiment.
 */
export function getCurrency(code: string): Currency {
  if (!Object.prototype.hasOwnProperty.call(CURRENCIES, code)) {
    throw new Error(`Monnaie inconnue : « ${code} ».`);
  }
  return CURRENCIES[code as CurrencyCode];
}

/**
 * Affiche un montant pour l'écran ou la facture.
 *
 * Exemples : formatMoney(32000, 'XOF') → "32 000 FCFA"
 *            formatMoney(150050, 'NGN') → "1 500,50 ₦"
 */
export function formatMoney(amount: number, currencyCode: CurrencyCode): string {
  const { symbol, decimals } = getCurrency(currencyCode);
  if (!Number.isSafeInteger(amount)) {
    throw new Error(
      `Montant invalide : ${amount}. Un montant doit être un nombre entier, ` +
        'compté dans la plus petite unité de la monnaie.'
    );
  }

  const sign = amount < 0 ? '-' : '';
  // On complète avec des zéros devant : 5 kobos → "005" → "0,05"
  const digits = String(Math.abs(amount)).padStart(decimals + 1, '0');
  const integerPart = digits.slice(0, digits.length - decimals);
  const decimalPart = digits.slice(digits.length - decimals);

  // Un espace insécable tous les 3 chiffres, en partant de la droite : 1234567 → "1 234 567"
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const number = decimals > 0 ? `${groupedInteger},${decimalPart}` : groupedInteger;

  return `${sign}${number}${NBSP}${symbol}`;
}

/**
 * Transforme un montant tapé par l'utilisateur en nombre entier (plus petite unité).
 * Renvoie `null` si la saisie n'est pas un montant valide.
 *
 * Exemples : parseMoney('32 000', 'XOF') → 32000
 *            parseMoney('32.000', 'XOF') → 32000 (le point sépare les milliers)
 *            parseMoney('12,5', 'XOF')   → null  (le FCFA n'a pas de centimes)
 *            parseMoney('1500,5', 'NGN') → 150050
 *
 * On travaille sur le TEXTE, sans jamais passer par un nombre à virgule :
 * avec un calcul classique, 10,05 × 100 donne 1004,9999999999999 au lieu de 1005.
 */
export function parseMoney(input: string, currencyCode: CurrencyCode): number | null {
  const { decimals } = getCurrency(currencyCode);

  // On enlève tous les espaces (normaux ou insécables) qui séparent les milliers
  let text = input.replace(/\s/g, '');

  // On écrit souvent « 32.000 » ou « 32,000 » pour 32 000. Si la monnaie n'a pas
  // de centimes, un point ou une virgule suivi de groupes de 3 chiffres
  // est donc compris comme un séparateur de milliers.
  if (decimals === 0 && /^\d{1,3}([.,]\d{3})+$/.test(text)) {
    text = text.replace(/[.,]/g, '');
  }

  // Partie entière, puis éventuellement une virgule (ou un point) et les centimes
  const match = /^(\d+)(?:[.,](\d*))?$/.exec(text);
  if (!match) {
    return null;
  }
  const integerPart = match[1];
  const decimalPart = match[2] ?? '';
  if (decimalPart.length > decimals) {
    return null; // trop de chiffres après la virgule pour cette monnaie
  }

  const amount = Number(integerPart + decimalPart.padEnd(decimals, '0'));
  return Number.isSafeInteger(amount) ? amount : null;
}
