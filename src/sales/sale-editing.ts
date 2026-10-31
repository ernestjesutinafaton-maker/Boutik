import { newId } from '@/data/ids';
import { MILLI } from '@/domain/quantity';
import type { CartLine, DiscountInput } from '@/domain/sale';

import type { SaleDetail } from './sale-data';

/** La vente en cours de modification (le panier a été rempli avec ses articles). */
export type SaleEditing = {
  saleId: string;
  invoiceNumber: string;
  /** L'argent déjà payé pour cette vente (moins ce qui a déjà été rendu) */
  alreadyPaid: number;
  /** Les modes de paiement déjà utilisés, du plus gros montant au plus petit */
  paidMethodIds: string[];
  /** La remise d'origine (elle reste permise, même au-delà de la limite d'un vendeur) */
  originalDiscount: number;
};

/**
 * Le panier rempli avec une vente déjà faite, pour la modifier : les quantités déjà
 * reprises (retours) sont déduites, les prix restent ceux de la vente.
 */
export function cartFromSale(sale: SaleDetail): {
  lines: CartLine[];
  discount: DiscountInput | null;
  customerId: string | null;
  note: string;
  editing: SaleEditing;
} {
  const lines = sale.items.flatMap((item): CartLine[] => {
    const returnedInUnit = Math.round((item.returnedQuantity * MILLI) / item.unitFactor);
    const quantity = item.quantity - returnedInUnit;
    return quantity > 0
      ? [
          {
            key: newId(),
            productId: item.productId,
            productName: item.productName,
            unitId: item.unitId,
            unitName: item.unitName,
            unitFactor: item.unitFactor,
            quantity,
            unitPrice: item.unitPrice,
          },
        ]
      : [];
  });

  const byMethod = new Map<string, number>();
  for (const payment of sale.payments) {
    byMethod.set(payment.methodId, (byMethod.get(payment.methodId) ?? 0) + payment.amount);
  }
  const alreadyPaid = [...byMethod.values()].reduce((sum, amount) => sum + amount, 0);
  const paidMethodIds = [...byMethod.entries()]
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([methodId]) => methodId);

  return {
    lines,
    discount: sale.discount > 0 ? { kind: 'amount', amount: sale.discount } : null,
    customerId: sale.customerId,
    note: sale.note ?? '',
    editing: {
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      alreadyPaid: Math.max(alreadyPaid, 0),
      paidMethodIds,
      originalDiscount: sale.discount,
    },
  };
}
