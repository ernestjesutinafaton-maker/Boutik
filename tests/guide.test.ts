import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { GUIDE } from '@/guide/guide-content';

const APP = join(__dirname, '..', 'src', 'app', '(app)');

/** Le fichier de l'écran d'un lien : « /cash » → cash.tsx, cash/index.tsx ou (tabs)/cash.tsx. */
function screenExists(href: string): boolean {
  const path = href === '/' ? 'index' : href.slice(1);
  return [`${path}.tsx`, join(path, 'index.tsx'), join('(tabs)', `${path}.tsx`)].some((file) =>
    existsSync(join(APP, file))
  );
}

describe('Guide des boutons', () => {
  it('chaque écran a une explication et au moins un bouton, sans doublon', () => {
    expect(new Set(GUIDE.map((section) => section.id)).size).toBe(GUIDE.length);
    for (const section of GUIDE) {
      expect(section.intro.length).toBeGreaterThan(10);
      expect(section.buttons.length).toBeGreaterThan(0);
      const labels = section.buttons.map((button) => button.label);
      expect(new Set(labels).size).toBe(labels.length);
      for (const button of section.buttons) expect(button.text.length).toBeGreaterThan(10);
    }
  });

  it('chaque « Ouvrir cet écran » mène à un écran qui existe', () => {
    for (const section of GUIDE) {
      if (typeof section.href === 'string')
        expect(screenExists(section.href), section.href).toBe(true);
    }
  });
});
