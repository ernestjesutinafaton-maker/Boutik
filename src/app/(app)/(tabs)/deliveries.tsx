import { DeliveryList } from '@/deliveries/delivery-list';

/** Onglet « Livraisons » du livreur (à la place de « Vendre ») : ses livraisons et son argent. */
export default function DeliveriesTab() {
  return <DeliveryList stack={false} />;
}
