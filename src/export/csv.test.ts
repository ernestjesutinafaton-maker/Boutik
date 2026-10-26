import { describe, expect, it } from 'vitest';

import { BOM, csvFileName, moneyCell, quantityCell, toCsv } from './csv';

describe('Export CSV pour Excel', () => {
  it('séparateur « ; », BOM au début, lignes Windows', () => {
    expect(toCsv(['Nom', 'Stock'], [['Riz', '46,5']])).toBe(`${BOM}Nom;Stock\r\nRiz;46,5\r\n`);
  });

  it('protège les cellules qui contiennent ; " ou un retour à la ligne', () => {
    const csv = toCsv(['Note'], [['Sac "50 kg"; abîmé'], ['ligne 1\nligne 2'], [null]]);
    expect(csv).toBe(`${BOM}Note\r\n"Sac ""50 kg""; abîmé"\r\n"ligne 1\nligne 2"\r\n\r\n`);
  });

  it('nombres lisibles par Excel : virgule décimale, pas d’espace des milliers', () => {
    expect(quantityCell(2500)).toBe('2,5');
    expect(quantityCell(1_500_000)).toBe('1500');
    expect(quantityCell(-125)).toBe('-0,125');
    expect(moneyCell(1_250_000, 'XOF')).toBe('1250000');
    expect(moneyCell(150_050, 'NGN')).toBe('1500,50');
  });

  it('nom de fichier sans accents ni espaces', () => {
    expect(csvFileName('Boutique Chez Maman', 'ventes 2026-10')).toBe(
      'boutique-chez-maman-ventes-2026-10.csv'
    );
  });
});
