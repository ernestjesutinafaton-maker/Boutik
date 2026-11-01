import { describe, expect, it } from 'vitest';

import { asksWhoIsThere } from './shared-device';

describe('« Qui êtes-vous ? » : seulement sur l’appareil de la boutique', () => {
  it('le propriétaire seul : pas de choix de la personne', () => {
    expect(
      asksWhoIsThere({ accountRoles: ['owner'], accountMemberId: 'moi', membersWithPin: ['moi'] })
    ).toBe(false);
  });

  it('le compte du propriétaire et une vendeuse avec son code PIN : on demande qui est là', () => {
    expect(
      asksWhoIsThere({
        accountRoles: ['owner'],
        accountMemberId: 'moi',
        membersWithPin: ['moi', 'awa'],
      })
    ).toBe(true);
    // Même si le propriétaire n'a pas encore de code (il se déverrouille avec son mot de passe)
    expect(
      asksWhoIsThere({ accountRoles: ['owner'], accountMemberId: 'moi', membersWithPin: ['awa'] })
    ).toBe(true);
  });

  it('un membre invité sans code PIN ne verrouille pas l’appareil de la boutique', () => {
    expect(
      asksWhoIsThere({ accountRoles: ['owner'], accountMemberId: 'moi', membersWithPin: [] })
    ).toBe(false);
  });

  it('sur le téléphone d’un vendeur (son propre compte) : jamais', () => {
    expect(
      asksWhoIsThere({
        accountRoles: ['seller'],
        accountMemberId: 'awa',
        membersWithPin: ['moi', 'awa', 'koffi'],
      })
    ).toBe(false);
  });
});
