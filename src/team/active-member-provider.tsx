import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { type Permission, permissionsFor, type Role } from '@/domain/permissions';
import { lockedUntil, MAX_PIN_ATTEMPTS, verifyPin } from '@/domain/pin';
import { asksWhoIsThere } from '@/domain/shared-device';
import { supabase } from '@/lib/supabase';
import { useShop } from '@/shop/shop-provider';

import { type TeamMember, useTeamMembers } from './team-data';

/**
 * La personne ACTIVE sur l'appareil : celle qui travaille en ce moment.
 *
 * Sur un appareil partagé (plusieurs personnes dans l'équipe), chacun se choisit avec son
 * code PIN, sans internet. Après quelques minutes d'absence, l'appareil se verrouille.
 * S'il n'y a qu'une personne dans la boutique, pas de verrouillage : c'est elle.
 */

/** Verrouillage après ce temps passé hors de l'application. */
const LOCK_AFTER_MS = 5 * 60 * 1000;

export type ActiveMember = {
  id: string;
  name: string;
  roles: Role[];
  maxDiscountPercent: number | null;
};

export type UnlockResult = {
  status: 'ok' | 'wrong' | 'blocked';
  /** Essais restants avant le blocage temporaire */
  remainingAttempts: number;
};

type ActiveMemberContextValue = {
  /** Faux tant qu'on ne sait pas encore qui est actif (rien ne doit s'afficher) */
  isReady: boolean;
  /** Vrai s'il faut choisir une personne avec son code PIN */
  isLocked: boolean;
  /** Vrai si l'équipe compte plusieurs personnes (codes PIN utilisés) */
  usesPin: boolean;
  member: ActiveMember | null;
  /** Les personnes qui peuvent se choisir sur l'écran de verrouillage */
  lockableMembers: TeamMember[];
  can: (permission: Permission) => boolean;
  lock: () => void;
  /** Garde la personne actuelle active (ex. quand le propriétaire ajoute la 2e personne) */
  keepCurrentMember: () => void;
  unlock: (memberId: string, pin: string) => UnlockResult;
  /** PIN oublié : le propriétaire se reconnecte avec le mot de passe du compte (internet) */
  unlockWithPassword: (password: string) => Promise<boolean>;
  /** Fin du blocage après trop d'essais ratés (ou null) */
  blockedUntil: number | null;
};

const ActiveMemberContext = createContext<ActiveMemberContextValue | null>(null);

type Saved = { memberId: string; lastActiveAt: number };

const storageKey = (shopId: string) => `boutik.active-member.${shopId}`;

export function ActiveMemberProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { shop } = useShop();
  const { members, isLoading: membersLoading } = useTeamMembers();
  const shopId = shop?.id ?? '';

  const [activeId, setActiveId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [failures, setFailures] = useState({ count: 0, lastAt: 0 });
  // Dernier moment où l'application était utilisée (0 = pas encore connu)
  const lastActiveAt = useRef(0);

  const activeMembers = members.filter((member) => member.active);
  const lockableMembers = activeMembers.filter((member) => member.hasPin);
  const accountMember = activeMembers.find((candidate) => candidate.id === shop?.memberId);
  // Avant la première synchronisation, on utilise les rôles reçus avec la boutique
  const accountRoles = accountMember?.roles.length
    ? accountMember.roles
    : (shop?.memberRoles ?? []);
  // « Qui êtes-vous ? » seulement sur l'appareil de la boutique (compte du propriétaire) ;
  // sur le téléphone personnel d'un membre, il entre directement dans son interface
  const usesPin = asksWhoIsThere({
    accountRoles,
    accountMemberId: shop?.memberId ?? null,
    membersWithPin: lockableMembers.map((member) => member.id),
  });

  // Au démarrage : reprendre la dernière personne active si elle est partie depuis peu
  useEffect(() => {
    if (!shopId) {
      return;
    }
    AsyncStorage.getItem(storageKey(shopId))
      .then((raw) => {
        const saved = raw ? (JSON.parse(raw) as Saved) : null;
        if (saved && Date.now() - saved.lastActiveAt < LOCK_AFTER_MS) {
          setActiveId(saved.memberId);
          lastActiveAt.current = saved.lastActiveAt;
        }
      })
      .catch(() => {})
      .finally(() => setRestored(true));
  }, [shopId]);

  // Quand l'application passe en arrière-plan puis revient : verrouiller si l'absence est longue
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const now = Date.now();
      if (state === 'active') {
        if (lastActiveAt.current > 0 && now - lastActiveAt.current > LOCK_AFTER_MS) {
          setActiveId(null);
        }
      } else {
        lastActiveAt.current = now;
        if (shopId && activeId) {
          const saved: Saved = { memberId: activeId, lastActiveAt: now };
          AsyncStorage.setItem(storageKey(shopId), JSON.stringify(saved)).catch(() => {});
        }
      }
    });
    return () => subscription.remove();
  }, [shopId, activeId]);

  // La personne active : choisie avec son PIN… ou, sans équipe, le compte connecté
  const chosen = activeMembers.find((candidate) => candidate.id === activeId) ?? null;
  let member: ActiveMember | null = null;
  if (usesPin) {
    member = chosen;
  } else if (shop) {
    member = {
      id: shop.memberId,
      name: accountMember?.name ?? shop.memberName,
      roles: accountRoles,
      maxDiscountPercent: accountMember?.maxDiscountPercent ?? null,
    };
  }

  // On attend de connaître l'équipe ET la dernière personne active : sinon l'écran du
  // propriétaire pourrait s'afficher une fraction de seconde avant le verrouillage.
  const isReady = restored && !membersLoading;
  const isLocked = usesPin && member === null;
  const permissions = permissionsFor(member?.roles ?? []);
  const blockedUntil = lockedUntil(failures.count, failures.lastAt);

  function remember(memberId: string) {
    lastActiveAt.current = Date.now();
    setActiveId(memberId);
    const saved: Saved = { memberId, lastActiveAt: lastActiveAt.current };
    AsyncStorage.setItem(storageKey(shopId), JSON.stringify(saved)).catch(() => {});
  }

  function lock() {
    setActiveId(null);
    AsyncStorage.removeItem(storageKey(shopId)).catch(() => {});
  }

  function keepCurrentMember() {
    if (member) {
      remember(member.id);
    }
  }

  function unlock(memberId: string, pin: string): UnlockResult {
    if (blockedUntil !== null && Date.now() < blockedUntil) {
      return { status: 'blocked', remainingAttempts: 0 };
    }
    // Après la fin d'un blocage, on repart avec tous les essais
    const previousCount = blockedUntil !== null ? 0 : failures.count;
    const candidate = lockableMembers.find((item) => item.id === memberId);
    if (
      candidate?.pinHash &&
      candidate.pinSalt &&
      verifyPin(pin, candidate.pinSalt, candidate.pinHash)
    ) {
      setFailures({ count: 0, lastAt: 0 });
      remember(memberId);
      return { status: 'ok', remainingAttempts: MAX_PIN_ATTEMPTS };
    }
    const next = { count: previousCount + 1, lastAt: Date.now() };
    setFailures(next);
    return {
      status: lockedUntil(next.count, next.lastAt) ? 'blocked' : 'wrong',
      remainingAttempts: Math.max(0, MAX_PIN_ATTEMPTS - next.count),
    };
  }

  async function unlockWithPassword(password: string): Promise<boolean> {
    const email = session?.user.email;
    if (!email || !shop) {
      return false;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return false;
    }
    setFailures({ count: 0, lastAt: 0 });
    remember(shop.memberId);
    return true;
  }

  return (
    <ActiveMemberContext.Provider
      value={{
        isReady,
        isLocked,
        usesPin,
        member,
        lockableMembers,
        can: (permission) => permissions.has(permission),
        lock,
        keepCurrentMember,
        unlock,
        unlockWithPassword,
        blockedUntil,
      }}>
      {children}
    </ActiveMemberContext.Provider>
  );
}

/** La personne active et ses droits, depuis n'importe quel écran. */
export function useActiveMember(): ActiveMemberContextValue {
  const value = useContext(ActiveMemberContext);
  if (!value) {
    throw new Error('useActiveMember doit être utilisé à l’intérieur de ActiveMemberProvider.');
  }
  return value;
}
