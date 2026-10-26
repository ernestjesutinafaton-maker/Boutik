import { describe, expect, it } from 'vitest';

import { compareVersions } from './version';

describe('Numéros de version', () => {
  it('compare chiffre par chiffre (10 est plus grand que 9)', () => {
    expect(compareVersions('1.2.10', '1.2.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.1.0')).toBeLessThan(0);
    expect(compareVersions('2.0', '2.0.0')).toBe(0);
    expect(compareVersions('1.0.1', '1.0.1')).toBe(0);
  });
});
