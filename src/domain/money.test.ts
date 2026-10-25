import { describe, expect, it } from 'vitest';

import { type CurrencyCode, formatMoney, formatMoneyInput, parseMoney } from './money';

/**
 * formatMoney met des espaces insécables (qui ne se coupent pas en fin de ligne).
 * Ce petit outil permet d'écrire les résultats attendus avec des espaces normales.
 */
function nbsp(text: string): string {
  return text.replace(/ /g, ' ');
}

describe('formatMoney : afficher un montant', () => {
  it('affiche des FCFA avec une espace entre les milliers', () => {
    expect(formatMoney(32000, 'XOF')).toBe(nbsp('32 000 FCFA'));
    expect(formatMoney(1234567, 'XOF')).toBe(nbsp('1 234 567 FCFA'));
  });

  it('affiche les petits montants et zéro', () => {
    expect(formatMoney(700, 'XOF')).toBe(nbsp('700 FCFA'));
    expect(formatMoney(0, 'XOF')).toBe(nbsp('0 FCFA'));
  });

  it('affiche les montants négatifs (remboursement, écart de caisse)', () => {
    expect(formatMoney(-5000, 'XOF')).toBe(nbsp('-5 000 FCFA'));
  });

  it('affiche les autres monnaies sans centimes', () => {
    expect(formatMoney(16500, 'XAF')).toBe(nbsp('16 500 FCFA'));
    expect(formatMoney(250000, 'GNF')).toBe(nbsp('250 000 FG'));
  });

  it('affiche les monnaies avec centimes (naira, cedi)', () => {
    expect(formatMoney(150050, 'NGN')).toBe(nbsp('1 500,50 ₦'));
    expect(formatMoney(5, 'NGN')).toBe(nbsp('0,05 ₦'));
    expect(formatMoney(1000, 'GHS')).toBe(nbsp('10,00 GH₵'));
  });

  it("refuse un montant à virgule (règle d'or : que des entiers)", () => {
    expect(() => formatMoney(10.5, 'XOF')).toThrow('nombre entier');
  });

  it('refuse une monnaie inconnue', () => {
    expect(() => formatMoney(100, 'EUR' as CurrencyCode)).toThrow('Monnaie inconnue');
  });
});

describe('parseMoney : comprendre un montant tapé au clavier', () => {
  it('lit un montant en FCFA, avec ou sans espaces', () => {
    expect(parseMoney('32000', 'XOF')).toBe(32000);
    expect(parseMoney('32 000', 'XOF')).toBe(32000);
    expect(parseMoney(' 700 ', 'XOF')).toBe(700);
  });

  it('comprend le point ou la virgule comme séparateur de milliers en FCFA', () => {
    expect(parseMoney('32.000', 'XOF')).toBe(32000);
    expect(parseMoney('1.250.000', 'XOF')).toBe(1250000);
    expect(parseMoney('32,000', 'XOF')).toBe(32000);
  });

  it("refuse des centimes pour le FCFA, qui n'en a pas", () => {
    expect(parseMoney('12,5', 'XOF')).toBeNull();
    expect(parseMoney('12.50', 'XOF')).toBeNull();
  });

  it('lit les centimes des monnaies qui en ont', () => {
    expect(parseMoney('1 500,50', 'NGN')).toBe(150050);
    expect(parseMoney('1500.5', 'NGN')).toBe(150050);
    expect(parseMoney('0,05', 'NGN')).toBe(5);
    expect(parseMoney('10', 'GHS')).toBe(1000);
  });

  it('ne fait pas les erreurs des nombres à virgule', () => {
    // Avec un calcul classique : 10.05 * 100 = 1004.9999999999999
    expect(parseMoney('10,05', 'NGN')).toBe(1005);
  });

  it('refuse les saisies invalides', () => {
    expect(parseMoney('', 'XOF')).toBeNull();
    expect(parseMoney('abc', 'XOF')).toBeNull();
    expect(parseMoney('-500', 'XOF')).toBeNull();
    expect(parseMoney('1,005', 'NGN')).toBeNull(); // 3 chiffres après la virgule
  });

  it('pré-remplit un champ sans symbole ni espaces', () => {
    expect(formatMoneyInput(32000, 'XOF')).toBe('32000');
    expect(formatMoneyInput(150050, 'NGN')).toBe('1500,50');
    expect(formatMoneyInput(5, 'NGN')).toBe('0,05');
    expect(parseMoney(formatMoneyInput(150050, 'NGN'), 'NGN')).toBe(150050);
  });

  it('retrouve le même montant après affichage puis saisie', () => {
    const amount = 150050;
    const displayed = formatMoney(amount, 'NGN').replace(/[^\d\s,]/g, '');
    expect(parseMoney(displayed, 'NGN')).toBe(amount);
  });
});
