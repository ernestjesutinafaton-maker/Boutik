import { parseTime, requestedMoment } from '@/domain/delivery';
import { type CurrencyCode, parseMoney } from '@/domain/money';
import { normalizePhone } from '@/domain/phone';

import type { DeliveryInput } from './delivery-actions';

/** Ce qui est tapé dans le formulaire d'une livraison. */
export type DeliveryFormValues = {
  address: string;
  landmark: string;
  contactName: string;
  contactPhone: string;
  /** « asap » (dès que possible) ou un jour AAAA-MM-JJ */
  when: string;
  /** Heure souhaitée, si un jour est choisi (ex. 15:30) */
  time: string;
  /** Le livreur, ou null : ouverte à tous */
  courierId: string | null;
  /** Argent à encaisser à la livraison */
  amount: string;
  note: string;
};

export type DeliveryFormErrors = {
  address?: 'address';
  contactPhone?: 'phone';
  time?: 'time';
  amount?: 'amount' | 'amountTooMuch';
};

const clean = (text: string, max: number) => {
  const value = text.trim();
  return value ? value.slice(0, max) : null;
};

/**
 * Vérifie le formulaire. maxAmount : ce qui reste à payer sur la vente (on n'encaisse pas plus) ;
 * sans client, rien ne peut être encaissé (l'argent rembourse la dette d'un client).
 */
export function parseDeliveryForm(
  values: DeliveryFormValues,
  options: { currency: CurrencyCode; dialCode: string; maxAmount: number }
):
  | { success: true; data: Omit<DeliveryInput, 'saleId' | 'customerId'> }
  | { success: false; errors: DeliveryFormErrors } {
  const errors: DeliveryFormErrors = {};

  const address = values.address.trim();
  if (address.length < 1 || address.length > 300) {
    errors.address = 'address';
  }

  let contactPhone: string | null = null;
  if (values.contactPhone.trim()) {
    contactPhone = normalizePhone(values.contactPhone, options.dialCode);
    if (!contactPhone) {
      errors.contactPhone = 'phone';
    }
  }

  let requestedAt: string | null = null;
  if (values.when !== 'asap') {
    const time = parseTime(values.time);
    if (!time || !/^\d{4}-\d{2}-\d{2}$/.test(values.when)) {
      errors.time = 'time';
    } else {
      requestedAt = requestedMoment(values.when, time);
    }
  }

  let amountToCollect = 0;
  if (values.amount.trim()) {
    const parsed = parseMoney(values.amount, options.currency);
    if (parsed === null || parsed < 0) {
      errors.amount = 'amount';
    } else if (parsed > Math.max(0, options.maxAmount)) {
      errors.amount = 'amountTooMuch';
    } else {
      amountToCollect = parsed;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }
  return {
    success: true,
    data: {
      address,
      landmark: clean(values.landmark, 300),
      contactName: clean(values.contactName, 100),
      contactPhone,
      requestedAt,
      amountToCollect,
      assignedTo: values.courierId,
      note: clean(values.note, 500),
    },
  };
}
