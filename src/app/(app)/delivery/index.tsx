import { DeliveryList } from '@/deliveries/delivery-list';

/** Les livraisons, ouvertes depuis un menu (vendeurs, caisse, responsables). */
export default function DeliveriesScreen() {
  return <DeliveryList stack />;
}
