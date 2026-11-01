import { getRandomBytes } from 'expo-crypto';
import { Platform, Share } from 'react-native';

import { isRole, type Role } from '@/domain/permissions';
import { hashPin, saltFromBytes } from '@/domain/pin';
import { supabase } from '@/lib/supabase';

import { type AcceptFailure, acceptFailure, inviteLink, isInviteCode } from './invite-links';

/**
 * Inviter un membre avec un lien personnel, et accepter ce lien.
 * Tout passe par des fonctions du serveur (internet nécessaire) : il fixe les rôles, vérifie le
 * lien (une seule fois, 7 jours) et relie le compte du membre à son profil.
 */

export type InviteStatus = 'valid' | 'used' | 'revoked' | 'expired' | 'unknown';
const STATUSES: readonly InviteStatus[] = ['valid', 'used', 'revoked', 'expired', 'unknown'];

export type InviteDetails = {
  status: InviteStatus;
  shopName: string | null;
  memberName: string | null;
  roles: Role[];
  suggestedEmail: string | null;
};

const UNKNOWN: InviteDetails = {
  status: 'unknown',
  shopName: null,
  memberName: null,
  roles: [],
  suggestedEmail: null,
};

/** Ce que montre un lien (boutique, nom, rôles). null = pas de réseau. */
export async function fetchInvite(code: string): Promise<InviteDetails | null> {
  if (!isInviteCode(code)) {
    return UNKNOWN;
  }
  const { data, error } = await supabase.rpc('get_team_invite', { p_code: code });
  if (error) {
    return null;
  }
  const row = data?.[0];
  if (!row) {
    return UNKNOWN;
  }
  return {
    status: STATUSES.find((status) => status === row.invite_status) ?? 'unknown',
    shopName: row.shop_name ?? null,
    memberName: row.member_name ?? null,
    roles: (row.member_roles ?? []).filter(isRole),
    suggestedEmail: row.suggested_email ?? null,
  };
}

export type CreatedInvite = { link: string; expiresAt: Date };

/** Le propriétaire invite une nouvelle personne : rôles choisis, nom et e-mail facultatifs. */
export async function inviteNewMember(input: {
  shopId: string;
  name: string;
  email: string;
  roles: readonly Role[];
}): Promise<CreatedInvite> {
  const { data, error } = await supabase.rpc('invite_team_member', {
    p_shop_id: input.shopId,
    p_display_name: input.name.trim(),
    p_roles: [...input.roles],
    p_email: input.email.trim(),
  });
  const row = data?.[0];
  if (error || !row) {
    throw error ?? new Error('Invitation impossible');
  }
  return { link: inviteLink(row.invite_code), expiresAt: new Date(row.invite_expires_at) };
}

/** Un nouveau lien pour une personne de l'équipe qui n'a pas encore son compte. */
export async function inviteExistingMember(
  memberId: string,
  email: string
): Promise<CreatedInvite> {
  const { data, error } = await supabase.rpc('create_team_invite', {
    p_member_id: memberId,
    p_email: email.trim(),
  });
  const row = data?.[0];
  if (error || !row) {
    throw error ?? new Error('Invitation impossible');
  }
  return { link: inviteLink(row.invite_code), expiresAt: new Date(row.invite_expires_at) };
}

/** Annule le lien encore valable d'une personne. */
export async function revokeInvite(memberId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_team_invite', { p_member_id: memberId });
  if (error) {
    throw error;
  }
}

/** Les liens encore valables de la boutique : profil → fin de validité. Vide hors ligne. */
export async function fetchPendingInvites(shopId: string): Promise<Record<string, Date>> {
  const { data, error } = await supabase
    .from('team_invites')
    .select('member_id, expires_at')
    .eq('shop_id', shopId)
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString());
  if (error || !data) {
    return {};
  }
  const pending: Record<string, Date> = {};
  for (const row of data) {
    pending[row.member_id] = new Date(row.expires_at);
  }
  return pending;
}

export type AcceptResult = { ok: true; shopId: string } | { ok: false; reason: AcceptFailure };

/** Le membre accepte : son compte est relié à son profil, avec son nom et son code PIN. */
export async function acceptInvite(code: string, name: string, pin: string): Promise<AcceptResult> {
  const salt = saltFromBytes(getRandomBytes(16));
  const { data, error } = await supabase.rpc('accept_team_invite', {
    p_code: code,
    p_display_name: name.trim(),
    p_pin_hash: hashPin(pin, salt),
    p_pin_salt: salt,
  });
  if (error || !data) {
    return { ok: false, reason: acceptFailure(error) };
  }
  return { ok: true, shopId: data };
}

type WebNavigator = {
  share?: (data: { text: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

/**
 * Partager un texte : la feuille de partage du téléphone (WhatsApp, SMS, Copier…) ; sur un
 * ordinateur sans partage, copie dans le presse-papiers.
 */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (Platform.OS !== 'web') {
      await Share.share({ message: text });
      return 'shared';
    }
    const navigator = (globalThis as { navigator?: WebNavigator }).navigator;
    if (navigator?.share) {
      await navigator.share({ text });
      return 'shared';
    }
    if (navigator?.clipboard) {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
    return 'failed';
  } catch {
    return 'failed';
  }
}
