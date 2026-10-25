import { useQuery } from '@powersync/react';

import { DEFAULT_EXPIRY_ALERT_DAYS, type ExpiryAlertDays } from '@/domain/expiry';
import type { CurrencyCode } from '@/domain/money';

import { useShop } from './shop-provider';

/** Les réglages de la boutique, lus dans la base locale (marche hors ligne). */
export type ShopSettings = {
  id: string;
  name: string;
  countryCode: string;
  currencyCode: CurrencyCode;
  phone: string | null;
  address: string | null;
  invoiceFooter: string | null;
  expiryAlertDays: ExpiryAlertDays;
  /** Remise maximale des vendeurs, en % (sauf limite propre à la personne) */
  sellerMaxDiscountPercent: number;
  /** Vendre même si le stock affiché est à 0 (avec avertissement) */
  allowSaleWithoutStock: boolean;
};

type ShopRow = {
  name: string;
  phone: string | null;
  address: string | null;
  invoice_footer: string | null;
  expiry_alert_days_first: number | null;
  expiry_alert_days_second: number | null;
  seller_max_discount_percent: number | null;
  allow_sale_without_stock: number | null;
};

/**
 * Les réglages de la boutique. Tant que la première synchronisation n'est pas finie,
 * on utilise les valeurs par défaut (celles du serveur).
 */
export function useShopSettings(): ShopSettings | null {
  const { shop } = useShop();
  const { data } = useQuery<ShopRow>(
    `SELECT name, phone, address, invoice_footer, expiry_alert_days_first,
            expiry_alert_days_second, seller_max_discount_percent, allow_sale_without_stock
       FROM shops WHERE id = ?`,
    [shop?.id ?? '']
  );
  if (!shop) {
    return null;
  }
  const row = data[0];
  return {
    id: shop.id,
    name: row?.name ?? shop.name,
    countryCode: shop.countryCode,
    currencyCode: shop.currencyCode,
    phone: row?.phone ?? null,
    address: row?.address ?? null,
    invoiceFooter: row?.invoice_footer ?? null,
    expiryAlertDays: {
      first: row?.expiry_alert_days_first ?? DEFAULT_EXPIRY_ALERT_DAYS.first,
      second: row?.expiry_alert_days_second ?? DEFAULT_EXPIRY_ALERT_DAYS.second,
    },
    sellerMaxDiscountPercent: row?.seller_max_discount_percent ?? 0,
    allowSaleWithoutStock: (row?.allow_sale_without_stock ?? 1) === 1,
  };
}
