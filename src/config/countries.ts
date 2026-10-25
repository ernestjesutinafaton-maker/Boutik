import type { CurrencyCode } from '@/domain/money';

/**
 * Les pays pris en charge, avec leur indicatif, leur monnaie
 * et les modes de paiement proposés à la création d'une boutique.
 * Pour ajouter un pays : ajouter une ligne dans COUNTRIES.
 */

export type PaymentMethodPreset = {
  code: string;
  label: string;
  kind: 'cash' | 'mobile_money' | 'card' | 'other';
};

export type Country = {
  /** Code officiel à 2 lettres (ISO 3166) */
  code: string;
  name: string;
  /** Indicatif téléphonique */
  dialCode: string;
  currency: CurrencyCode;
  paymentMethods: PaymentMethodPreset[];
};

const CASH: PaymentMethodPreset = { code: 'cash', label: 'Espèces', kind: 'cash' };
const MOBILE_MONEY: PaymentMethodPreset = {
  code: 'mobile_money',
  label: 'Mobile Money',
  kind: 'mobile_money',
};
const OTHER: PaymentMethodPreset = { code: 'other', label: 'Autre', kind: 'other' };

/** Modes de paiement par défaut des pays sans liste détaillée (modifiables dans les paramètres). */
const GENERIC_METHODS = [CASH, MOBILE_MONEY, OTHER];

// Le crédit n'est pas un mode de paiement : c'est le reste non payé, noté dans le carnet de dettes.
export const COUNTRIES: Country[] = [
  {
    code: 'BJ',
    name: 'Bénin',
    dialCode: '+229',
    currency: 'XOF',
    paymentMethods: [
      CASH,
      { code: 'mtn_momo', label: 'MTN MoMo', kind: 'mobile_money' },
      { code: 'moov_money', label: 'Moov Money', kind: 'mobile_money' },
      { code: 'celtiis_cash', label: 'Celtiis Cash', kind: 'mobile_money' },
      OTHER,
    ],
  },
  {
    code: 'BF',
    name: 'Burkina Faso',
    dialCode: '+226',
    currency: 'XOF',
    paymentMethods: GENERIC_METHODS,
  },
  {
    code: 'CI',
    name: 'Côte d’Ivoire',
    dialCode: '+225',
    currency: 'XOF',
    paymentMethods: GENERIC_METHODS,
  },
  {
    code: 'GW',
    name: 'Guinée-Bissau',
    dialCode: '+245',
    currency: 'XOF',
    paymentMethods: GENERIC_METHODS,
  },
  { code: 'ML', name: 'Mali', dialCode: '+223', currency: 'XOF', paymentMethods: GENERIC_METHODS },
  { code: 'NE', name: 'Niger', dialCode: '+227', currency: 'XOF', paymentMethods: GENERIC_METHODS },
  {
    code: 'SN',
    name: 'Sénégal',
    dialCode: '+221',
    currency: 'XOF',
    paymentMethods: GENERIC_METHODS,
  },
  { code: 'TG', name: 'Togo', dialCode: '+228', currency: 'XOF', paymentMethods: GENERIC_METHODS },
  {
    code: 'CM',
    name: 'Cameroun',
    dialCode: '+237',
    currency: 'XAF',
    paymentMethods: GENERIC_METHODS,
  },
  {
    code: 'CF',
    name: 'Centrafrique',
    dialCode: '+236',
    currency: 'XAF',
    paymentMethods: GENERIC_METHODS,
  },
  { code: 'CG', name: 'Congo', dialCode: '+242', currency: 'XAF', paymentMethods: GENERIC_METHODS },
  { code: 'GA', name: 'Gabon', dialCode: '+241', currency: 'XAF', paymentMethods: GENERIC_METHODS },
  {
    code: 'GQ',
    name: 'Guinée équatoriale',
    dialCode: '+240',
    currency: 'XAF',
    paymentMethods: GENERIC_METHODS,
  },
  { code: 'TD', name: 'Tchad', dialCode: '+235', currency: 'XAF', paymentMethods: GENERIC_METHODS },
  {
    code: 'GN',
    name: 'Guinée',
    dialCode: '+224',
    currency: 'GNF',
    paymentMethods: GENERIC_METHODS,
  },
  {
    code: 'NG',
    name: 'Nigeria',
    dialCode: '+234',
    currency: 'NGN',
    paymentMethods: GENERIC_METHODS,
  },
  { code: 'GH', name: 'Ghana', dialCode: '+233', currency: 'GHS', paymentMethods: GENERIC_METHODS },
];

/** Pays proposé par défaut : le Bénin, pays de lancement. */
export const DEFAULT_COUNTRY_CODE = 'BJ';

/** Renvoie un pays à partir de son code. */
export function getCountry(code: string): Country {
  const country = COUNTRIES.find((candidate) => candidate.code === code);
  if (!country) {
    throw new Error(`Pays inconnu : « ${code} ».`);
  }
  return country;
}
