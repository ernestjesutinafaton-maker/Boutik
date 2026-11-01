import { SITE_URL } from '@/config/site';

/**
 * Les liens d'invitation des membres de l'équipe (voir la migration …_comptes_equipe.sql).
 * Fonctions « pures » : faciles à tester.
 */

/** Le lien envoyé au futur membre : la page « Rejoindre l'équipe » de la version web. */
export function inviteLink(code: string): string {
  return `${SITE_URL}/app/invitation/${code}`;
}

/** Un code bien formé (64 caractères hexadécimaux) : le reste est refusé sans interroger le serveur. */
export function isInviteCode(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

/** Pourquoi l'acceptation d'un lien n'a pas marché (traduit à l'écran, jamais l'erreur brute). */
export type AcceptFailure =
  'used' | 'expired' | 'invalid' | 'alreadyMember' | 'formerMember' | 'network';

/** Les refus du serveur (ses propres messages, voir la migration) → une raison affichable. */
export function acceptFailure(error: { message?: string } | null): AcceptFailure {
  const message = error?.message ?? '';
  if (/déjà servi/.test(message)) return 'used';
  if (/expiré/.test(message)) return 'expired';
  if (/appartient déjà/.test(message)) return 'alreadyMember';
  if (/réactiver/.test(message)) return 'formerMember';
  if (/valable/.test(message)) return 'invalid';
  return 'network';
}

/** WhatsApp : la personne choisit elle-même le contact (aucun numéro imposé). */
export function whatsappShareLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Le nom donné par le serveur à un membre invité sans nom (même valeur que la migration). */
export const PLACEHOLDER_MEMBER_NAME = 'Nouveau membre';
