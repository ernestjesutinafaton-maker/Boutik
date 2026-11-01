import { describe, expect, it } from 'vitest';

import { redirectSystemPath } from '@/app/+native-intent';

/** Les liens du site ouverts dans l'appli Android : « /app/… » sur le site = « /… » dans l'appli. */
describe('Liens du site qui ouvrent l’appli', () => {
  const open = (path: string) => redirectSystemPath({ path, initial: true });

  it('enlève « /app » des adresses du site', () => {
    expect(open('https://boutik-services.vercel.app/app/invitation/abc123')).toBe(
      '/invitation/abc123'
    );
    expect(open('https://boutik-services.vercel.app/app')).toBe('/');
    expect(open('https://boutik-services.vercel.app/app/delivery/42?x=1')).toBe('/delivery/42?x=1');
    expect(open('/app/sign-in')).toBe('/sign-in');
  });

  it('laisse passer les autres liens, et ne plante jamais', () => {
    expect(open('boutik://invitation/abc123')).toBe('boutik://invitation/abc123');
    expect(open('/delivery')).toBe('/delivery');
    expect(open('http://[::1')).toBe('/');
  });
});
