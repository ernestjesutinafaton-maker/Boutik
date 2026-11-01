import { useQuery } from '@powersync/react';
import { useMemo, useState } from 'react';

import {
  courierBalances,
  type CourierExpenseCategory,
  type DeliveryExpenseStatus,
  type DeliveryStatus,
} from '@/domain/delivery';
import { useShop } from '@/shop/shop-provider';

import { COURIER_COLLECTED_SQL, COURIER_HANDED_OVER_SQL } from './courier-money';

/** Une livraison, avec ce qu'il faut pour l'afficher dans une liste ou sur sa fiche. */
export type Delivery = {
  id: string;
  status: DeliveryStatus;
  saleId: string | null;
  invoiceNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  /** La personne à contacter : celle notée sur la livraison, sinon le client */
  contactName: string | null;
  contactPhone: string | null;
  address: string;
  landmark: string | null;
  requestedAt: string | null;
  amountToCollect: number;
  assignedTo: string | null;
  courierName: string | null;
  failedReason: string | null;
  cancelReason: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type DeliveryRow = {
  id: string;
  status: DeliveryStatus;
  sale_id: string | null;
  invoice_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  address: string;
  landmark: string | null;
  requested_at: string | null;
  amount_to_collect: number | null;
  assigned_to: string | null;
  courier_name: string | null;
  failed_reason: string | null;
  cancel_reason: string | null;
  note: string | null;
  created_at: string;
  updated_at: string | null;
};

const DELIVERY_COLUMNS = `
  d.id, d.status, d.sale_id, s.invoice_number, d.customer_id, c.name AS customer_name,
  c.phone AS customer_phone, d.contact_name, d.contact_phone, d.address, d.landmark,
  d.requested_at, d.amount_to_collect, d.assigned_to, m.display_name AS courier_name,
  d.failed_reason, d.cancel_reason, d.note, d.created_at, d.updated_at
  FROM deliveries d
  LEFT JOIN customers c ON c.id = d.customer_id
  LEFT JOIN shop_members m ON m.id = d.assigned_to
  LEFT JOIN sales s ON s.id = d.sale_id`;

function toDelivery(row: DeliveryRow): Delivery {
  return {
    id: row.id,
    status: row.status,
    saleId: row.sale_id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    contactName: row.contact_name ?? row.customer_name,
    contactPhone: row.contact_phone ?? row.customer_phone,
    address: row.address,
    landmark: row.landmark,
    requestedAt: row.requested_at,
    amountToCollect: row.amount_to_collect ?? 0,
    assignedTo: row.assigned_to,
    courierName: row.courier_name,
    failedReason: row.failed_reason,
    cancelReason: row.cancel_reason,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

/** Les terminées restent dans la liste 30 jours. */
const DONE_DAYS = 30;

/**
 * Les livraisons de la boutique : celles à faire et en cours, et les terminées récentes.
 * Les plus urgentes d'abord (heure souhaitée, sinon date de création).
 */
export function useDeliveries(): { deliveries: Delivery[]; isLoading: boolean } {
  const { shop } = useShop();
  // Lu une fois à l'ouverture de l'écran : suffisant pour « 30 derniers jours »
  const [since] = useState(() => new Date(Date.now() - DONE_DAYS * 24 * 3_600_000).toISOString());
  const { data, isLoading } = useQuery<DeliveryRow>(
    `SELECT ${DELIVERY_COLUMNS}
      WHERE d.shop_id = ? AND (d.status NOT IN ('delivered', 'cancelled') OR d.updated_at >= ?)
      ORDER BY COALESCE(d.requested_at, d.created_at)`,
    [shop?.id ?? '', since]
  );
  return { deliveries: useMemo(() => data.map(toDelivery), [data]), isLoading };
}

/** Une livraison. */
export function useDelivery(deliveryId: string): { delivery: Delivery | null; isLoading: boolean } {
  const { data, isLoading } = useQuery<DeliveryRow>(`SELECT ${DELIVERY_COLUMNS} WHERE d.id = ?`, [
    deliveryId,
  ]);
  return { delivery: data[0] ? toDelivery(data[0]) : null, isLoading };
}

/** Les livraisons d'une vente (la plus récente d'abord). */
export function useSaleDeliveries(saleId: string): Delivery[] {
  const { data } = useQuery<DeliveryRow>(
    `SELECT ${DELIVERY_COLUMNS} WHERE d.sale_id = ? ORDER BY d.created_at DESC`,
    [saleId]
  );
  return useMemo(() => data.map(toDelivery), [data]);
}

/** Ce qu'il faut livrer : les articles de la vente. */
export function useDeliveryItems(saleId: string | null): {
  id: string;
  productName: string;
  unitName: string;
  quantity: number;
}[] {
  const { data } = useQuery<{
    id: string;
    product_name: string;
    unit_name: string;
    quantity: number;
  }>(
    'SELECT id, product_name, unit_name, quantity FROM sale_items WHERE sale_id = ? ORDER BY created_at, id',
    [saleId ?? '']
  );
  return data.map((row) => ({
    id: row.id,
    productName: row.product_name,
    unitName: row.unit_name,
    quantity: row.quantity,
  }));
}

/** L'argent encaissé à cette livraison. */
export function useDeliveryPayments(deliveryId: string): {
  id: string;
  amount: number;
  methodLabel: string;
  occurredAt: string;
}[] {
  const { data } = useQuery<{
    id: string;
    amount: number;
    method_label: string | null;
    occurred_at: string;
  }>(
    `SELECT p.id, p.amount, pm.label AS method_label, p.occurred_at
       FROM payments p LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
      WHERE p.delivery_id = ? ORDER BY p.occurred_at`,
    [deliveryId]
  );
  return data.map((row) => ({
    id: row.id,
    amount: row.amount,
    methodLabel: row.method_label ?? '',
    occurredAt: row.occurred_at,
  }));
}

/** Les livreurs de la boutique (rôle « livreur », encore dans l'équipe), par nom. */
export function useCouriers(): { id: string; name: string }[] {
  const { shop } = useShop();
  const { data } = useQuery<{ id: string; display_name: string }>(
    `SELECT m.id, m.display_name FROM shop_members m
      WHERE m.shop_id = ? AND m.active = 1
        AND EXISTS (SELECT 1 FROM shop_member_roles r
                     WHERE r.member_id = m.id AND r.role = 'delivery' AND r.revoked_at IS NULL)
      ORDER BY m.display_name`,
    [shop?.id ?? '']
  );
  return data.map((row) => ({ id: row.id, name: row.display_name }));
}

/** La boutique utilise-t-elle les livraisons ? (un livreur dans l'équipe, ou déjà une livraison) */
export function useDeliveriesInUse(): boolean {
  const { shop } = useShop();
  const { data } = useQuery<{ used: number }>(
    `SELECT (EXISTS (SELECT 1 FROM deliveries WHERE shop_id = ?)
          OR EXISTS (SELECT 1 FROM shop_member_roles WHERE shop_id = ? AND role = 'delivery'
                                                        AND revoked_at IS NULL)) AS used`,
    [shop?.id ?? '', shop?.id ?? '']
  );
  return (data[0]?.used ?? 0) === 1;
}

/** L'argent que chaque livreur doit remettre à la caisse, avec son nom. */
export function useCourierBalances(): { courierId: string; name: string; amount: number }[] {
  const { shop } = useShop();
  const shopId = shop?.id ?? '';
  const { data: collected } = useQuery<{ courierId: string; amount: number }>(
    COURIER_COLLECTED_SQL,
    [shopId]
  );
  const { data: handedOver } = useQuery<{ courierId: string; amount: number }>(
    COURIER_HANDED_OVER_SQL,
    [shopId]
  );
  const { data: members } = useQuery<{ id: string; display_name: string }>(
    'SELECT id, display_name FROM shop_members WHERE shop_id = ?',
    [shopId]
  );
  return useMemo(() => {
    const names = new Map(members.map((member) => [member.id, member.display_name]));
    return [...courierBalances(collected, handedOver)]
      .map(([courierId, amount]) => ({ courierId, name: names.get(courierId) ?? '?', amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [collected, handedOver, members]);
}

/** Une dépense de livreur. */
export type DeliveryExpense = {
  id: string;
  courierId: string;
  courierName: string;
  deliveryId: string | null;
  deliveryAddress: string | null;
  category: CourierExpenseCategory;
  amount: number;
  note: string | null;
  proofPath: string;
  status: DeliveryExpenseStatus;
  reviewNote: string | null;
  occurredAt: string;
};

type ExpenseRow = {
  id: string;
  courier_id: string;
  courier_name: string | null;
  delivery_id: string | null;
  delivery_address: string | null;
  category: CourierExpenseCategory;
  amount: number;
  note: string | null;
  proof_path: string;
  status: DeliveryExpenseStatus;
  review_note: string | null;
  occurred_at: string;
};

/**
 * Les dépenses des livreurs : celles à décider d'abord, puis les plus récentes.
 * courierId : seulement celles de ce livreur (son téléphone ne reçoit de toute façon que les siennes).
 */
export function useDeliveryExpenses(courierId: string | null = null): DeliveryExpense[] {
  const { shop } = useShop();
  const { data } = useQuery<ExpenseRow>(
    `SELECT e.id, e.courier_id, m.display_name AS courier_name, e.delivery_id,
            d.address AS delivery_address, e.category, e.amount, e.note, e.proof_path, e.status,
            e.review_note, e.occurred_at
       FROM delivery_expenses e
       LEFT JOIN shop_members m ON m.id = e.courier_id
       LEFT JOIN deliveries d ON d.id = e.delivery_id
      WHERE e.shop_id = ? AND (? IS NULL OR e.courier_id = ?)
      ORDER BY e.status = 'pending' DESC, e.occurred_at DESC
      LIMIT 100`,
    [shop?.id ?? '', courierId, courierId]
  );
  return useMemo(
    () =>
      data.map((row) => ({
        id: row.id,
        courierId: row.courier_id,
        courierName: row.courier_name ?? '?',
        deliveryId: row.delivery_id,
        deliveryAddress: row.delivery_address,
        category: row.category,
        amount: row.amount,
        note: row.note,
        proofPath: row.proof_path,
        status: row.status,
        reviewNote: row.review_note,
        occurredAt: row.occurred_at,
      })),
    [data]
  );
}
