import { describe, expect, it } from 'vitest';

import { can as roleCan, type Role } from './permissions';
import { carryPayments, editDeadline, modificationBalance, saleEditRight } from './sale-edit';

const SOLD_AT = '2026-10-31T10:00:00.000Z';

function right(roles: Role[], options: { now: string; sellerId?: string; window?: number }) {
  return saleEditRight({
    status: 'completed',
    occurredAt: SOLD_AT,
    sellerId: options.sellerId ?? 'awa',
    windowHours: options.window ?? 24,
    now: options.now,
    memberId: 'awa',
    can: (permission) => roleCan(roles, permission),
  });
}

describe('Délai pour modifier une vente', () => {
  it('24 h après la vente', () => {
    expect(editDeadline(SOLD_AT, 24)).toBe('2026-11-01T10:00:00.000Z');
  });

  it('pendant le délai : la vendeuse corrige SA vente, pas celle des autres', () => {
    const now = '2026-10-31T15:00:00.000Z';
    expect(right(['seller'], { now })).toMatchObject({ allowed: true, late: false });
    expect(right(['seller'], { now, sellerId: 'koffi' })).toMatchObject({
      allowed: false,
      reason: 'notOwnSale',
    });
    expect(right(['manager'], { now, sellerId: 'koffi' })).toMatchObject({ allowed: true });
  });

  it('après le délai : vente archivée, seul le propriétaire peut encore la modifier', () => {
    const now = '2026-11-01T10:00:00.000Z';
    expect(right(['seller'], { now })).toMatchObject({ allowed: false, reason: 'late' });
    expect(right(['manager'], { now })).toMatchObject({ allowed: false, reason: 'late' });
    expect(right(['owner'], { now })).toMatchObject({ allowed: true, late: true });
  });

  it('délai 0 : aucune modification (sauf le propriétaire), vente annulée : jamais', () => {
    expect(right(['seller'], { now: SOLD_AT, window: 0 })).toMatchObject({ allowed: false });
    const cancelled = saleEditRight({
      status: 'cancelled',
      occurredAt: SOLD_AT,
      sellerId: 'awa',
      windowHours: 24,
      now: SOLD_AT,
      memberId: 'awa',
      can: () => true,
    });
    expect(cancelled).toMatchObject({ allowed: false, reason: 'cancelled' });
  });
});

describe('L’argent déjà payé, reporté sur la vente modifiée', () => {
  it('le client prend plus : il paie seulement la différence', () => {
    expect(modificationBalance(12_000, 10_000)).toEqual({ toPay: 2000, toRefund: 0 });
  });

  it('le client rend des articles : on lui rend la différence', () => {
    expect(modificationBalance(7000, 10_000)).toEqual({ toPay: 0, toRefund: 3000 });
  });

  it('trop payé : les autres modes sont reportés d’abord, le surplus rendu en espèces', () => {
    const paid = [
      { methodId: 'cash', amount: 6000 },
      { methodId: 'momo', amount: 4000 },
    ];
    expect(carryPayments(paid, 7000, 'cash')).toEqual({
      carried: [
        { methodId: 'momo', amount: 4000 },
        { methodId: 'cash', amount: 3000 },
      ],
      refund: 3000,
    });
    expect(carryPayments(paid, 7000, 'momo').carried).toEqual([
      { methodId: 'cash', amount: 6000 },
      { methodId: 'momo', amount: 1000 },
    ]);
  });

  it('pas assez payé : tout est reporté, rien n’est rendu', () => {
    expect(carryPayments([{ methodId: 'cash', amount: 5000 }], 8000, 'cash')).toEqual({
      carried: [{ methodId: 'cash', amount: 5000 }],
      refund: 0,
    });
  });
});
