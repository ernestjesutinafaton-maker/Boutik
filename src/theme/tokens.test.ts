import { describe, expect, it } from 'vitest';

import { palettes, THEME_COLORS, themeEffects } from './tokens';

/** Luminance relative d'une couleur #RRGGBB (formule des règles d'accessibilité WCAG). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste entre deux couleurs : de 1 (aucun) à 21 (noir sur blanc). */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const CASES = THEME_COLORS.flatMap((color) =>
  (['light', 'dark'] as const).map((mode) => ({ color, mode }))
);

describe('Thèmes : tout reste lisible (règles d’accessibilité)', () => {
  it.each(CASES)('$color en mode $mode', ({ color, mode }) => {
    const p = palettes[color][mode];
    // Texte principal et secondaire, sur le fond et sur les cartes
    expect(contrast(p.text, p.background)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.text, p.surface)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.textSecondary, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.textSecondary, p.background)).toBeGreaterThanOrEqual(4.5);
    // Couleur principale (liens, montants, icônes) et texte posé dessus
    expect(contrast(p.primary, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.onPrimary, p.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.onPrimaryContainer, p.primaryContainer)).toBeGreaterThanOrEqual(4.5);
    // Alertes, erreurs et bonnes nouvelles
    expect(contrast(p.onAccentContainer, p.accentContainer)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.onDangerContainer, p.dangerContainer)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.onSuccessContainer, p.successContainer)).toBeGreaterThanOrEqual(4.5);
    // Le contour des champs de saisie se voit (3 pour 1 suffit pour un contour)
    expect(contrast(p.outline, p.surface)).toBeGreaterThanOrEqual(3);
    // Les textes sur les fonds sombres (connexion, grande carte des chiffres)
    expect(contrast(p.onNight, p.night)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.onNightSecondary, p.night)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(CASES)(
    '$color en mode $mode : le texte des boutons se lit sur leur couleur',
    ({ color, mode }) => {
      const { button } = themeEffects[color][mode];
      // Le texte est au milieu du bouton : on vérifie la couleur du milieu du dégradé
      for (const look of Object.values(button)) {
        const middle = look.gradient.match(/#[0-9A-F]{6}/gi)?.[1];
        expect(middle).toBeDefined();
        expect(contrast(look.text, middle ?? '#000000')).toBeGreaterThanOrEqual(4.5);
      }
    }
  );
});
