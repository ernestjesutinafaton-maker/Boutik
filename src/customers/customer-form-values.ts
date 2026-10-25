import { type CurrencyCode, formatMoneyInput, parseMoney } from '@/domain/money';
import { normalizePhone } from '@/domain/phone';
import type { TranslationKey } from '@/i18n/keys';

import type { Customer } from './customer-data';

/** Le formulaire d'un client, tel que tapé (des textes). */
export type CustomerInput = {
  name: string;
  phone: string;
  creditLimit: string;
  notes: string;
};

export type CustomerValues = {
  name: string;
  /** Format international (+229…), ou null */
  phone: string | null;
  creditLimit: number | null;
  notes: string | null;
};

export type CustomerErrors = Partial<Record<keyof CustomerInput, TranslationKey>>;

export function emptyCustomerInput(): CustomerInput {
  return { name: '', phone: '', creditLimit: '', notes: '' };
}

export function customerToInput(customer: Customer, currency: CurrencyCode): CustomerInput {
  return {
    name: customer.name,
    phone: customer.phone ?? '',
    creditLimit:
      customer.creditLimit === null ? '' : formatMoneyInput(customer.creditLimit, currency),
    notes: customer.notes ?? '',
  };
}

/** Vérifie le formulaire ; le téléphone est mis au format international du pays. */
export function parseCustomerInput(
  input: CustomerInput,
  currency: CurrencyCode,
  dialCode: string
): { success: true; data: CustomerValues } | { success: false; errors: CustomerErrors } {
  const errors: CustomerErrors = {};
  const name = input.name.trim();
  if (name.length < 2) {
    errors.name = 'errors.customerNameTooShort';
  } else if (name.length > 100) {
    errors.name = 'errors.customerNameTooLong';
  }

  let phone: string | null = null;
  if (input.phone.trim()) {
    phone = normalizePhone(input.phone, dialCode);
    if (!phone) {
      errors.phone = 'errors.phoneInvalid';
    }
  }

  let creditLimit: number | null = null;
  if (input.creditLimit.trim()) {
    creditLimit = parseMoney(input.creditLimit, currency);
    if (creditLimit === null) {
      errors.creditLimit = 'errors.priceInvalid';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }
  return {
    success: true,
    data: { name, phone, creditLimit, notes: input.notes.trim() || null },
  };
}
