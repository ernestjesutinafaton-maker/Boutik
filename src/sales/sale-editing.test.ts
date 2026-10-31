import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));

const { cartFromSale } = await import('./sale-editing');
type SaleDetail = Parameters<typeof cartFromSale>[0];

const sale: SaleDetail = {
  id: 'vente-1',
  invoiceNumber: 'F1-000012',
  status: 'completed',
  total: 14_500,
  paid: 14_500,
  due: 0,
  occurredAt: '2026-10-31T10:00:00.000Z',
  customerName: null,
  sellerName: 'Awa',
  sellerId: 'awa',
  replaced: false,
  corrected: false,
  subtotal: 15_000,
  discount: 500,
  note: 'Livrer demain',
  customerId: 'koffi',
  customerPhone: null,
  deviceNumber: 1,
  cancelledAt: null,
  cancelReason: null,
  replaces: null,
  replacedBy: null,
  items: [
    {
      id: 'ligne-1',
      productId: 'ciment',
      unitId: 'sac',
      productName: 'Ciment',
      unitName: 'sac',
      unitFactor: 1000,
      quantity: 2000,
      baseQuantity: 2000,
      unitPrice: 5500,
      lineTotal: 11_000,
      returnedQuantity: 0,
    },
    {
      // 10 m vendus, 4 m déjà repris : il en reste 6 dans le panier
      id: 'ligne-2',
      productId: 'cable',
      unitId: 'metre',
      productName: 'Câble',
      unitName: 'mètre',
      unitFactor: 1000,
      quantity: 10_000,
      baseQuantity: 10_000,
      unitPrice: 400,
      lineTotal: 4000,
      returnedQuantity: 4000,
    },
  ],
  payments: [
    {
      id: 'p1',
      kind: 'sale',
      methodId: 'cash',
      methodLabel: 'Espèces',
      amount: 10_000,
      cashReceived: 10_000,
      changeGiven: 0,
      occurredAt: '',
    },
    {
      id: 'p2',
      kind: 'sale',
      methodId: 'momo',
      methodLabel: 'MTN MoMo',
      amount: 4500,
      cashReceived: null,
      changeGiven: null,
      occurredAt: '',
    },
    {
      id: 'p3',
      kind: 'refund',
      methodId: 'cash',
      methodLabel: 'Espèces',
      amount: -1500,
      cashReceived: null,
      changeGiven: null,
      occurredAt: '',
    },
  ],
};

describe('Remettre une vente dans le panier pour la modifier', () => {
  it('les quantités déjà reprises sont déduites, les prix de la vente gardés', () => {
    const { lines } = cartFromSale(sale);
    expect(
      lines.map((line) => [line.productId, line.unitId, line.quantity, line.unitPrice])
    ).toEqual([
      ['ciment', 'sac', 2000, 5500],
      ['cable', 'metre', 6000, 400],
    ]);
  });

  it('client, remise, remarque et argent déjà payé (moins ce qui a été rendu)', () => {
    const filled = cartFromSale(sale);
    expect(filled.customerId).toBe('koffi');
    expect(filled.discount).toEqual({ kind: 'amount', amount: 500 });
    expect(filled.note).toBe('Livrer demain');
    expect(filled.editing).toEqual({
      saleId: 'vente-1',
      invoiceNumber: 'F1-000012',
      alreadyPaid: 13_000,
      // Le mode le plus utilisé d'abord (pour rendre l'argent en trop)
      paidMethodIds: ['cash', 'momo'],
      originalDiscount: 500,
    });
  });
});
