import { useQuery } from '@powersync/react';

import { isRole, type Role } from '@/domain/permissions';
import { useShop } from '@/shop/shop-provider';

/** Une personne de l'équipe, telle que lue dans la base locale. */
export type TeamMember = {
  id: string;
  name: string;
  /** Compte de connexion (null = profil avec code PIN seulement) */
  userId: string | null;
  roles: Role[];
  pinHash: string | null;
  pinSalt: string | null;
  hasPin: boolean;
  maxDiscountPercent: number | null;
  active: boolean;
};

type MemberRow = {
  id: string;
  display_name: string;
  user_id: string | null;
  pin_hash: string | null;
  pin_salt: string | null;
  max_discount_percent: number | null;
  active: number;
  roles: string | null;
};

/** Transforme la liste de rôles lue en base (« seller,cashier ») en rôles connus. */
export function parseRoles(text: string | null): Role[] {
  return (text ?? '').split(',').filter(isRole);
}

function toTeamMember(row: MemberRow): TeamMember {
  return {
    id: row.id,
    name: row.display_name,
    userId: row.user_id,
    roles: parseRoles(row.roles),
    pinHash: row.pin_hash,
    pinSalt: row.pin_salt,
    hasPin: Boolean(row.pin_hash && row.pin_salt),
    maxDiscountPercent: row.max_discount_percent,
    active: row.active === 1,
  };
}

/** Toute l'équipe de la boutique (se met à jour toute seule quand la base change). */
export function useTeamMembers(): { members: TeamMember[]; isLoading: boolean } {
  const { shop } = useShop();
  const { data, isLoading } = useQuery<MemberRow>(
    `SELECT m.id, m.display_name, m.user_id, m.pin_hash, m.pin_salt,
            m.max_discount_percent, m.active,
            (SELECT group_concat(r.role) FROM shop_member_roles r
              WHERE r.member_id = m.id AND r.revoked_at IS NULL) AS roles
       FROM shop_members m
      WHERE m.shop_id = ?
      ORDER BY m.active DESC, m.display_name COLLATE NOCASE`,
    [shop?.id ?? '']
  );
  return { members: data.map(toTeamMember), isLoading };
}
