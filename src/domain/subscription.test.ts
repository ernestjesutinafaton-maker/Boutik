import { describe, expect, it } from 'vitest';

import {
  addMonths,
  currentQuarter,
  isLimited,
  monthlyPrice,
  monthsSince,
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
      subscriptionStatus({ shopCreatedAt: created, paidUntil: null, now: d('2026-10-10') }).state
    ).toBe('trial');
  });

  it('abonnée jusqu’à la date payée', () => {
    const status = subscriptionStatus({
      shopCreatedAt: created,
      paidUntil: d('2026-12-20'),
      now: d('2026-11-20'),
    });
    expect(status).toMatchObject({ state: 'active', daysLeft: 30 });
  });

  it('7 jours de grâce, puis fonctions avancées limitées (jamais les ventes)', () => {
    const grace = subscriptionStatus({
      shopCreatedAt: created,
      paidUntil: null,
      now: d('2026-10-19'),
    });
    expect(grace.state).toBe('grace');
    expect(isLimited(grace)).toBe(false);
    const expired = subscriptionStatus({
      shopCreatedAt: created,
      paidUntil: null,
      now: d('2026-11-01'),
    });
    expect(expired.state).toBe('expired');
    expect(isLimited(expired)).toBe(true);
  });
});
