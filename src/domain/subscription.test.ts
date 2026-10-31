import { describe, expect, it } from 'vitest';

import {
  addMonths,
  currentQuarter,
  isBlocked,
  monthlyPrice,
  monthsSince,
  parsePaymentMoment,
  subscriptionStatus,
  tierFor,
} from './subscription';

const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('Abonnement : les prix', () => {
  it('trois paliers selon la moyenne mensuelle des ventes', () => {
    expect(tierFor(800_000).monthlyPrice).toBe(10_000);
    expect(tierFor(1_500_000).monthlyPrice).toBe(15_000);
    expect(tierFor(4_999_999).monthlyPrice).toBe(15_000);
    expect(tierFor(5_000_000).monthlyPrice).toBe(25_000);
  });

  it('mois 1 à 3 : 10 000 F (bienvenue), même si la boutique vend beaucoup', () => {
    const price = monthlyPrice({
      shopCreatedAt: d('2026-01-10'),
      now: d('2026-04-09'),
      revenueOfPreviousQuarter: 90_000_000,
    });
    expect(price).toEqual({ price: 10_000, reason: 'welcome', tierLabel: null });
  });

  it('ensuite, le trimestre précédent fixe le prix (moyenne par mois)', () => {
    const now = d('2026-04-11'); // 4e mois
    expect(
      monthlyPrice({ shopCreatedAt: d('2026-01-10'), now, revenueOfPreviousQuarter: 3_000_000 })
        .price
    ).toBe(10_000);
    expect(
      monthlyPrice({ shopCreatedAt: d('2026-01-10'), now, revenueOfPreviousQuarter: 9_000_000 })
        .price
    ).toBe(15_000);
    expect(
      monthlyPrice({ shopCreatedAt: d('2026-01-10'), now, revenueOfPreviousQuarter: 18_000_000 })
        .price
    ).toBe(25_000);
  });

  it('les trimestres se comptent depuis la création de la boutique', () => {
    expect(monthsSince(d('2026-01-31'), d('2026-02-28'))).toBe(1);
    expect(addMonths(d('2026-01-31'), 1).toISOString().slice(0, 10)).toBe('2026-02-28');
    const quarter = currentQuarter(d('2026-01-10'), d('2026-08-01'));
    expect(quarter.index).toBe(2);
    expect(quarter.start.toISOString().slice(0, 10)).toBe('2026-07-10');
    expect(quarter.previousStart?.toISOString().slice(0, 10)).toBe('2026-04-10');
  });
});

describe('Abonnement : l’état de la boutique', () => {
  const created = d('2026-10-01');

  it('15 jours d’essai gratuit', () => {
    expect(
      subscriptionStatus({
        shopCreatedAt: created,
        paidUntil: null,
        provisionalUntil: null,
        now: d('2026-10-10'),
      }).state
    ).toBe('trial');
  });

  it('abonnée jusqu’à la date payée', () => {
    const status = subscriptionStatus({
      shopCreatedAt: created,
      paidUntil: d('2026-12-20'),
      provisionalUntil: null,
      now: d('2026-11-20'),
    });
    expect(status).toMatchObject({ state: 'active', daysLeft: 30 });
  });

  it('7 jours de grâce, puis la boutique est en pause (tout bloqué sauf le paiement)', () => {
    const grace = subscriptionStatus({
      shopCreatedAt: created,
      paidUntil: null,
      provisionalUntil: null,
      now: d('2026-10-19'),
    });
    expect(grace.state).toBe('grace');
    expect(isBlocked(grace)).toBe(false);
    const expired = subscriptionStatus({
      shopCreatedAt: created,
      paidUntil: null,
      provisionalUntil: null,
      now: d('2026-11-01'),
    });
    expect(expired.state).toBe('expired');
    expect(isBlocked(expired)).toBe(true);
  });

  it('paiement déclaré : la boutique travaille pendant l’accès provisoire, sans grâce ensuite', () => {
    const during = subscriptionStatus({
      shopCreatedAt: created,
      paidUntil: null,
      provisionalUntil: d('2026-11-03'),
      now: d('2026-11-01'),
    });
    expect(during).toMatchObject({ state: 'provisional', daysLeft: 2 });
    expect(isBlocked(during)).toBe(false);
    // Accès provisoire terminé (paiement refusé ou pas encore validé) : de nouveau en pause
    const after = subscriptionStatus({
      shopCreatedAt: created,
      paidUntil: null,
      provisionalUntil: d('2026-11-03'),
      now: d('2026-11-04'),
    });
    expect(isBlocked(after)).toBe(true);
  });

  it('une fois le paiement validé, l’abonnement l’emporte sur l’accès provisoire', () => {
    const status = subscriptionStatus({
      shopCreatedAt: created,
      paidUntil: d('2026-12-01'),
      provisionalUntil: d('2026-11-03'),
      now: d('2026-11-02'),
    });
    expect(status.state).toBe('active');
  });
});

describe('Abonnement : l’heure du paiement déclarée', () => {
  const now = new Date(2026, 10, 1, 10, 0); // 1er novembre 2026, 10 h (heure du téléphone)

  it('date et heure tapées → le moment exact', () => {
    expect(parsePaymentMoment('31/10/2026', '14:05', now)).toEqual(new Date(2026, 9, 31, 14, 5));
    expect(parsePaymentMoment('1/11/26', '9h30', now)).toEqual(new Date(2026, 10, 1, 9, 30));
  });

  it('refuse une heure impossible, le futur, ou plus de 30 jours', () => {
    expect(parsePaymentMoment('31/10/2026', '25:00', now)).toBeNull();
    expect(parsePaymentMoment('31/10/2026', 'midi', now)).toBeNull();
    expect(parsePaymentMoment('01/11/2026', '12:00', now)).toBeNull();
    expect(parsePaymentMoment('15/09/2026', '12:00', now)).toBeNull();
  });
});
