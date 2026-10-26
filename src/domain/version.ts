/**
 * Compare deux numéros de version « 1.2.10 » et « 1.2.9 ».
 * Renvoie un nombre positif si a est plus récent que b, négatif s'il est plus ancien, 0 si égaux.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (version: string) =>
    version.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
