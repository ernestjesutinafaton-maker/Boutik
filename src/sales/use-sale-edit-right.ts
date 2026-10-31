import { nowIso } from '@/data/ids';
import { type SaleEditRight, saleEditRight } from '@/domain/sale-edit';
import { useShopSettings } from '@/shop/shop-settings';
import { useActiveMember } from '@/team/active-member-provider';

/**
 * Qui peut modifier cette vente, et jusqu'à quand (délai choisi par le propriétaire).
 * null tant que la vente n'est pas chargée.
 */
export function useSaleEditRight(
  sale: {
    status: 'completed' | 'cancelled';
    occurredAt: string;
    sellerId: string | null;
  } | null
): SaleEditRight | null {
  const { can, member } = useActiveMember();
  const settings = useShopSettings();
  if (!sale || !settings) {
    return null;
  }
  return saleEditRight({
    status: sale.status,
    occurredAt: sale.occurredAt,
    sellerId: sale.sellerId,
    windowHours: settings.returnWindowHours,
    now: nowIso(),
    memberId: member?.id ?? null,
    can,
  });
}
