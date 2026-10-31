import { describe, expect, it } from 'vitest';

import {
  costForQuantity,
  formatMixedStock,
  formatQuantity,
  formatQuantityWithUnit,
  pluralUnit,
  lineAmount,
  mulDiv,
  parseQuantity,
  parseUnitQuantity,
  toBaseQuantity,
} from './quantity';

// Les nombres et leur unité sont séparés par une espace insécable
const NBSP = String.fromCharCode(0xa0);
const nbsp = (text: string) => text.replace(/ /g, NBSP);

// Le riz de l'exemple du cahier des charges : base = kg
const SAC_50 = { name: 'Sac 50 kg', factor: 50_000 };
const SAC_25 = { name: 'Sac 25 kg', factor: 25_000 };
const KILO = { name: 'Kilo', factor: 1_000 };
const TINE = { name: 'Tine', factor: 2_500 };

describe('Saisir une quantité', () => {
  it('lit les quantités entières et à virgule, en millièmes', () => {
    expect(parseQuantity('3')).toBe(3000);
    expect(parseQuantity('2,5')).toBe(2500);
    expect(parseQuantity('0.125')).toBe(125);
    expect(parseQuantity(' 10 ')).toBe(10000);
  });

  it('refuse les saisies invalides', () => {
    expect(parseQuantity('')).toBeNull();
    expect(parseQuantity('-2')).toBeNull();
    expect(parseQuantity('2,5555')).toBeNull(); // plus de 3 chiffres après la virgule
    expect(parseQuantity('abc')).toBeNull();
  });

  it('refuse la virgule pour un produit vendu à la pièce', () => {
    expect(parseQuantity('2,5', false)).toBeNull();
    expect(parseQuantity('2', false)).toBe(2000);
    expect(parseQuantity('2,0', false)).toBe(2000);
  });
});

describe('Afficher une quantité', () => {
  it('affiche avec une virgule et sans zéros inutiles', () => {
    expect(formatQuantity(2500)).toBe('2,5');
    expect(formatQuantity(3000)).toBe('3');
    expect(formatQuantity(125)).toBe('0,125');
    expect(formatQuantity(1_500_000)).toBe(nbsp('1 500'));
    expect(formatQuantity(-1500)).toBe('-1,5');
    expect(formatQuantityWithUnit(2500, 'kg')).toBe(nbsp('2,5 kg'));
  });
});

describe('Convertir entre unités', () => {
  it('2 sacs de 50 kg = 100 kg ; 1,5 kilo = 1,5 kg ; 3 tines = 7,5 kg', () => {
    expect(toBaseQuantity(2000, SAC_50.factor)).toBe(100_000);
    expect(toBaseQuantity(1500, KILO.factor)).toBe(1500);
    expect(toBaseQuantity(3000, TINE.factor)).toBe(7500);
  });

  it('1 carton de 24 boîtes = 24 boîtes', () => {
    expect(toBaseQuantity(1000, 24_000)).toBe(24_000);
  });
});

describe('Quantité tapée dans une unité de vente', () => {
  it('1,5 kilo de riz = 1,5 kg ; 2 sacs = 100 kg', () => {
    expect(parseUnitQuantity('1,5', KILO.factor, true)).toEqual({
      quantityInUnit: 1500,
      baseQuantity: 1500,
    });
    expect(parseUnitQuantity('2', SAC_50.factor, true)?.baseQuantity).toBe(100_000);
  });

  it('un demi-carton de 24 boîtes = 12 boîtes, accepté même sans virgule', () => {
    expect(parseUnitQuantity('0,5', 24_000, false)?.baseQuantity).toBe(12_000);
  });

  it('refuse ce qui ne tombe pas juste pour un produit à la pièce', () => {
    expect(parseUnitQuantity('0,3', 24_000, false)).toBeNull(); // 7,2 boîtes
    expect(parseUnitQuantity('1,5', 1000, false)).toBeNull();
    expect(parseUnitQuantity('0', 1000, true)).toBeNull();
    expect(parseUnitQuantity('', 1000, true)).toBeNull();
  });
});

describe('Montants et coûts sans erreur d’arrondi', () => {
  it('le prix d’une ligne : 1,5 kilo à 700 = 1 050 ; 2 sacs à 32 000 = 64 000', () => {
    expect(lineAmount(700, 1500)).toBe(1050);
    expect(lineAmount(32_000, 2000)).toBe(64_000);
  });

  it('arrondit une seule fois, au plus proche', () => {
    expect(lineAmount(333, 1500)).toBe(500); // 499,5 → 500
    expect(mulDiv(10, 1, 3)).toBe(3);
    expect(mulDiv(-10, 1, 4)).toBe(-3); // -2,5 → -3 (on s'éloigne de zéro)
  });

  it('sac entamé : 3,5 kg vendus d’un sac de 50 kg acheté 28 000 coûtent 1 960', () => {
    expect(costForQuantity(28_000, 50_000, 3_500)).toBe(1960);
  });

  it('reste exact même avec de très grands nombres', () => {
    expect(lineAmount(9_000_000_000, 1_000_000)).toBe(9_000_000_000_000);
  });
});

describe('Afficher le stock de façon lisible', () => {
  it('« 9 × Sac 50 kg + 47 kg » pour 497 kg de riz', () => {
    expect(formatMixedStock(497_000, 'kg', [SAC_50, SAC_25, KILO, TINE])).toBe(
      `9${NBSP}×${NBSP}Sac 50 kg + 47${NBSP}kg`
    );
  });

  it('un nombre rond de sacs, sans reste', () => {
    expect(formatMixedStock(100_000, 'kg', [SAC_50])).toBe(`2${NBSP}×${NBSP}Sac 50 kg`);
  });

  it('un sac entamé : moins d’un sac → affiché en kg', () => {
    expect(formatMixedStock(46_500, 'kg', [SAC_50, KILO])).toBe(nbsp('46,5 kg'));
  });

  it('sans conditionnement, ou stock négatif : dans l’unité de base', () => {
    expect(formatMixedStock(12_000, 'boîte', [])).toBe(nbsp('12 boîtes'));
    expect(formatMixedStock(-3000, 'kg', [SAC_50])).toBe(nbsp('-3 kg'));
  });
});

describe('Pluriel des unités (à partir de 2, comme en français)', () => {
  it('les noms prennent un s (ou un x), les symboles ne changent pas', () => {
    expect(pluralUnit('sac', 3000)).toBe('sacs');
    expect(pluralUnit('pièce', 10_000)).toBe('pièces');
    expect(pluralUnit('rouleau', 2000)).toBe('rouleaux');
    expect(pluralUnit('mètre', 2500)).toBe('mètres');
    expect(pluralUnit('kg', 5000)).toBe('kg');
    expect(pluralUnit('L', 5000)).toBe('L');
    expect(pluralUnit('tas', 5000)).toBe('tas');
  });

  it('au singulier sous 2 (1 ; 1,5) et pour les pertes, selon la quantité', () => {
    expect(pluralUnit('sac', 1000)).toBe('sac');
    expect(pluralUnit('litre', 1500)).toBe('litre');
    expect(pluralUnit('sac', -2000)).toBe('sacs');
  });

  it('un conditionnement : seul le premier mot change', () => {
    expect(pluralUnit('sac 50 kg', 3000)).toBe('sacs 50 kg');
    expect(pluralUnit('Palette 40 sacs', 2000)).toBe('Palettes 40 sacs');
    expect(formatQuantityWithUnit(3000, 'sac')).toBe(`3${NBSP}sacs`);
  });
});
