import { describe, expect, it } from 'vitest';

import { balanceOf, debtAging, type LedgerEntry } from './credit';
import { normalizePhone, whatsappLink } from './phone';

const TODAY = '2026-10-25';

function entry(type: LedgerEntry['type'], amount: number, day: string): LedgerEntry {
  return { type, amount, occurredAt: `${day}T10:00:00.000Z` };
}

describe('Le carnet de dettes', () => {
  it('la dette est la somme des lignes', () => {
    expect(
      balanceOf([
        entry('debt', 20_000, '2026-10-01'),
        entry('repayment', -5000, '2026-10-05'),
        entry('debt', 3000, '2026-10-10'),
      ])
    ).toBe(18_000);
  });

  it('deux remboursements faits hors ligne sur deux appareils s’additionnent', () => {
    const debts = [entry('debt', 20_000, '2026-10-01')];
    const telephone = entry('repayment', -5000, '2026-10-20');
    const tablette = entry('repayment', -3000, '2026-10-20');
    expect(balanceOf([...debts, telephone, tablette])).toBe(12_000);
    expect(balanceOf([tablette, ...debts, telephone])).toBe(12_000);
  });
});

describe('Ancienneté de la dette', () => {
  it('pas de dette : rien à signaler', () => {
    expect(debtAging([], TODAY)).toEqual({
      balance: 0,
      oldestUnpaidDay: null,
      ageDays: 0,
      bucket: 'none',
    });
  });

  it('dette récente (moins de 30 jours)', () => {
    const aging = debtAging([entry('debt', 5000, '2026-10-10')], TODAY);
    expect(aging).toMatchObject({ bucket: 'recent', ageDays: 15, oldestUnpaidDay: '2026-10-10' });
  });

  it('les remboursements effacent d’abord les plus vieilles dettes', () => {
    const aging = debtAging(
      [
        entry('debt', 10_000, '2026-07-01'), // très ancienne
        entry('debt', 8000, '2026-09-10'),
        entry('repayment', -10_000, '2026-10-01'), // efface celle de juillet
      ],
      TODAY
    );
    expect(aging.balance).toBe(8000);
    expect(aging.oldestUnpaidDay).toBe('2026-09-10');
    expect(aging.ageDays).toBe(45);
    expect(aging.bucket).toBe('over30');
  });

  it('plus de 60 jours : dette en retard', () => {
    const aging = debtAging(
      [entry('debt', 10_000, '2026-07-01'), entry('repayment', -4000, '2026-10-01')],
      TODAY
    );
    expect(aging).toMatchObject({ balance: 6000, bucket: 'over60', oldestUnpaidDay: '2026-07-01' });
  });

  it('un remboursement en avance (avoir) compte pour la dette suivante', () => {
    const aging = debtAging(
      [entry('repayment', -3000, '2026-08-01'), entry('debt', 5000, '2026-10-20')],
      TODAY
    );
    expect(aging).toMatchObject({ balance: 2000, oldestUnpaidDay: '2026-10-20', bucket: 'recent' });
  });

  it('tout remboursé : plus de dette', () => {
    const aging = debtAging(
      [entry('debt', 5000, '2026-01-01'), entry('cancellation', -5000, '2026-01-02')],
      TODAY
    );
    expect(aging.bucket).toBe('none');
  });
});

describe('Téléphone et WhatsApp', () => {
  it('met les numéros au format international', () => {
    expect(normalizePhone('01 97 00 00 00', '+229')).toBe('+2290197000000');
    expect(normalizePhone('+229 01-97-00-00-00', '+229')).toBe('+2290197000000');
    expect(normalizePhone('00229 0197000000', '+229')).toBe('+2290197000000');
    expect(normalizePhone('77 123 45 67', '+221')).toBe('+221771234567');
  });

  it('refuse ce qui n’est pas un numéro', () => {
    expect(normalizePhone('abc', '+229')).toBeNull();
    expect(normalizePhone('12', '+229')).toBeNull();
  });

  it('prépare le lien WhatsApp avec le message', () => {
    expect(whatsappLink('+2290197000000', 'Bonjour Awa, 5 000 FCFA')).toBe(
      'https://wa.me/2290197000000?text=Bonjour%20Awa%2C%205%20000%20FCFA'
    );
  });
});
