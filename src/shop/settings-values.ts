import { normalizePhone } from '@/domain/phone';
import type { TranslationKey } from '@/i18n/keys';

import type { ShopSettings } from './shop-settings';

/** Le formulaire des paramètres de la boutique, tel que tapé (des textes). */
export type SettingsInput = {
  name: string;
  phone: string;
  address: string;
  invoiceFooter: string;
  expiryFirst: string;
  expirySecond: string;
  sellerMaxDiscount: string;
  allowSaleWithoutStock: boolean;
  /** Délai pour modifier une vente, en heures (choisi parmi RETURN_WINDOW_CHOICES) */
  returnWindowHours: number;
};

export type SettingsValues = {
  name: string;
  phone: string | null;
  address: string | null;
  invoiceFooter: string | null;
  expiryFirst: number;
  expirySecond: number;
  sellerMaxDiscount: number;
  allowSaleWithoutStock: boolean;
  returnWindowHours: number;
};

export type SettingsErrors = Partial<Record<keyof SettingsInput, TranslationKey>>;

export function settingsToInput(settings: ShopSettings): SettingsInput {
  return {
    name: settings.name,
    phone: settings.phone ?? '',
    address: settings.address ?? '',
    invoiceFooter: settings.invoiceFooter ?? '',
    expiryFirst: String(settings.expiryAlertDays.first),
    expirySecond: String(settings.expiryAlertDays.second),
    sellerMaxDiscount: String(settings.sellerMaxDiscountPercent),
    allowSaleWithoutStock: settings.allowSaleWithoutStock,
    returnWindowHours: settings.returnWindowHours,
  };
}

/** Un nombre entier tapé, entre min et max (null si invalide). */
function readInteger(text: string, min: number, max: number): number | null {
  const value = text.trim();
  if (!/^\d{1,4}$/.test(value)) return null;
  const number = Number(value);
  return number >= min && number <= max ? number : null;
}

export function parseSettingsInput(
  input: SettingsInput,
  dialCode: string
): { success: true; data: SettingsValues } | { success: false; errors: SettingsErrors } {
  const errors: SettingsErrors = {};
  const name = input.name.trim();
  if (name.length < 2) errors.name = 'errors.shopNameTooShort';
  else if (name.length > 100) errors.name = 'errors.shopNameTooLong';

  let phone: string | null = null;
  if (input.phone.trim()) {
    phone = normalizePhone(input.phone, dialCode);
    if (!phone) errors.phone = 'errors.phoneInvalid';
  }

  const footer = input.invoiceFooter.trim();
  if (footer.length > 300) errors.invoiceFooter = 'errors.footerTooLong';

  const expiryFirst = readInteger(input.expiryFirst, 0, 365);
  const expirySecond = readInteger(input.expirySecond, 0, 365);
  if (expiryFirst === null) errors.expiryFirst = 'errors.daysInvalid';
  if (expirySecond === null) errors.expirySecond = 'errors.daysInvalid';
  else if (expiryFirst !== null && expirySecond > expiryFirst) {
    errors.expirySecond = 'errors.secondAlertAfterFirst';
  }

  const sellerMaxDiscount = readInteger(input.sellerMaxDiscount, 0, 100);
  if (sellerMaxDiscount === null) errors.sellerMaxDiscount = 'errors.discountPercentInvalid';

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }
  return {
    success: true,
    data: {
      name,
      phone,
      address: input.address.trim() || null,
      invoiceFooter: footer || null,
      expiryFirst: expiryFirst ?? 30,
      expirySecond: expirySecond ?? 7,
      sellerMaxDiscount: sellerMaxDiscount ?? 0,
      allowSaleWithoutStock: input.allowSaleWithoutStock,
      returnWindowHours: Math.min(Math.max(Math.round(input.returnWindowHours), 0), 8760),
    },
  };
}
