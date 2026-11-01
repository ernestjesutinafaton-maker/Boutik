import { describe, expect, it } from 'vitest';

import { acceptFailure, inviteLink, isInviteCode, whatsappShareLink } from './invite-links';

const CODE = 'a1'.repeat(32);

describe('Liens d’invitation de l’équipe', () => {
  it('le lien mène à la page « Rejoindre l’équipe » de la version web', () => {
    expect(inviteLink(CODE)).toBe(`https://boutik-services.vercel.app/app/invitation/${CODE}`);
  });

  it('seul un code bien formé est envoyé au serveur', () => {
    expect(isInviteCode(CODE)).toBe(true);
    expect(isInviteCode('A1'.repeat(32))).toBe(false);
    expect(isInviteCode('abc')).toBe(false);
    expect(isInviteCode(undefined)).toBe(false);
  });

  it('les refus du serveur deviennent une raison claire', () => {
    expect(acceptFailure({ message: 'Ce lien a déjà servi.' })).toBe('used');
    expect(acceptFailure({ message: 'Ce lien a expiré : demande un nouveau lien' })).toBe(
      'expired'
    );
    expect(acceptFailure({ message: 'Ce compte appartient déjà à une boutique.' })).toBe(
      'alreadyMember'
    );
    expect(acceptFailure({ message: 'demande au propriétaire de te réactiver.' })).toBe(
      'formerMember'
    );
    expect(acceptFailure({ message: 'Ce lien n’est pas valable.' })).toBe('invalid');
    expect(acceptFailure({ message: 'Failed to fetch' })).toBe('network');
    expect(acceptFailure(null)).toBe('network');
  });

  it('WhatsApp : le message est prêt, la personne choisit le contact', () => {
    expect(whatsappShareLink('Rejoins Boutik : https://x.y/z')).toBe(
      'https://wa.me/?text=Rejoins%20Boutik%20%3A%20https%3A%2F%2Fx.y%2Fz'
    );
  });
});
