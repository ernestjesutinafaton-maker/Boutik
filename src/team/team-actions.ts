import type { CommonPowerSyncDatabase, Transaction } from '@powersync/common';
import { getRandomBytes } from 'expo-crypto';

import { type ActionContext, logAction } from '@/data/audit';
import { newId, nowIso } from '@/data/ids';
import type { Role } from '@/domain/permissions';
import { hashPin, saltFromBytes } from '@/domain/pin';

import type { TeamMember } from './team-data';

/**
 * Écritures sur l'équipe (dans la base LOCALE : elles marchent hors ligne
 * et partent vers le serveur dès que possible). Chacune est notée dans le journal.
 */

/** Calcule l'empreinte d'un nouveau PIN, avec un sel tiré au hasard. */
function protectPin(pin: string): { hash: string; salt: string } {
  const salt = saltFromBytes(getRandomBytes(16));
  return { hash: hashPin(pin, salt), salt };
}

async function grantRole(
  tx: Transaction,
  context: ActionContext,
  memberId: string,
  role: Role,
  now: string
) {
  await tx.execute(
    `INSERT INTO shop_member_roles
       (id, shop_id, member_id, role, granted_by, granted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId(), context.shopId, memberId, role, context.memberId, now, now, now]
  );
}

/** Ajoute une personne à l'équipe, avec un ou plusieurs rôles et son code PIN. */
export async function createMember(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  input: { name: string; roles: Role[]; maxDiscountPercent: number | null; pin: string }
): Promise<string> {
  const memberId = newId();
  const now = nowIso();
  const { hash, salt } = protectPin(input.pin);

  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO shop_members
         (id, shop_id, user_id, display_name, pin_hash, pin_salt, max_discount_percent,
          active, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, 1, ?, ?)`,
      [memberId, context.shopId, input.name, hash, salt, input.maxDiscountPercent, now, now]
    );
    for (const role of input.roles) {
      await grantRole(tx, context, memberId, role, now);
    }
    await logAction(
      tx,
      context,
      'member.create',
      { type: 'member', id: memberId },
      {
        name: input.name,
        roles: input.roles,
      }
    );
  });
  return memberId;
}

/** Modifie une personne : nom, rôles (ajoutés ou retirés), limite de remise, active ou non. */
export async function updateMember(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  member: TeamMember,
  changes: { name: string; roles: Role[]; maxDiscountPercent: number | null; active: boolean }
): Promise<void> {
  const now = nowIso();
  const added = changes.roles.filter((role) => !member.roles.includes(role));
  const removed = member.roles.filter((role) => !changes.roles.includes(role));

  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE shop_members
          SET display_name = ?, max_discount_percent = ?, active = ?, updated_at = ?
        WHERE id = ?`,
      [changes.name, changes.maxDiscountPercent, changes.active ? 1 : 0, now, member.id]
    );
    for (const role of added) {
      await grantRole(tx, context, member.id, role, now);
    }
    for (const role of removed) {
      // Un rôle retiré n'est pas effacé : sa ligne garde qui l'a retiré, et quand
      await tx.execute(
        `UPDATE shop_member_roles
            SET revoked_at = ?, revoked_by = ?, updated_at = ?
          WHERE member_id = ? AND role = ? AND revoked_at IS NULL`,
        [now, context.memberId, now, member.id, role]
      );
    }
    await logAction(
      tx,
      context,
      'member.update',
      { type: 'member', id: member.id },
      {
        before: {
          name: member.name,
          roles: member.roles,
          maxDiscountPercent: member.maxDiscountPercent,
          active: member.active,
        },
        after: changes,
      }
    );
  });
}

/** Change le code PIN d'une personne (le PIN lui-même n'est jamais noté dans le journal). */
export async function setMemberPin(
  db: CommonPowerSyncDatabase,
  context: ActionContext,
  memberId: string,
  pin: string
): Promise<void> {
  const now = nowIso();
  const { hash, salt } = protectPin(pin);
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      'UPDATE shop_members SET pin_hash = ?, pin_salt = ?, updated_at = ? WHERE id = ?',
      [hash, salt, now, memberId]
    );
    await logAction(tx, context, 'member.pin_change', { type: 'member', id: memberId });
  });
}
