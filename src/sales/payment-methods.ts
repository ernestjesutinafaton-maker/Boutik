import { useQuery } from '@powersync/react';

import { useShop } from '@/shop/shop-provider';

/** Un mode de paiement de la boutique : Espèces, MTN MoMo, Moov Money… */
export type PaymentMethod = {
  id: string;
  code: string;
  label: string;
  kind: 'cash' | 'mobile_money' | 'card' | 'other';
  isCash: boolean;
};

type MethodRow = { id: string; code: string; label: string; kind: PaymentMethod['kind'] };

/** Les modes de paiement actifs, dans l'ordre choisi (les espèces d'abord en général). */
export function usePaymentMethods(): PaymentMethod[] {
  const { shop } = useShop();
  const { data } = useQuery<MethodRow>(
    `SELECT id, code, label, kind FROM payment_methods
      WHERE shop_id = ? AND active = 1
      ORDER BY sort_order, label`,
    [shop?.id ?? '']
  );
  return data.map((row) => ({ ...row, isCash: row.kind === 'cash' }));
}
