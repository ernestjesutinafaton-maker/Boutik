import { useShop } from '@/shop/shop-provider';
import { useActiveMember } from '@/team/active-member-provider';

import type { ActionContext } from './audit';

/**
 * Le « contexte » des actions de l'écran : boutique, personne active, appareil.
 * Null tant que la boutique ou la personne active ne sont pas connues.
 */
export function useActionContext(): ActionContext | null {
  const { shop, device } = useShop();
  const { member } = useActiveMember();
  if (!shop || !member) {
    return null;
  }
  return {
    shopId: shop.id,
    memberId: member.id,
    // L'appareil n'est indiqué que s'il est déjà enregistré sur le serveur (lien obligatoire)
    deviceId: device?.number ? device.id : null,
  };
}
