import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CurrentShop } from './shop-provider';

/**
 * La dernière boutique connue, gardée dans l'appareil :
 * elle permet de démarrer l'application sans internet.
 */
const CACHE_KEY = 'boutik.current-shop';

export async function saveShopCache(userId: string, shop: CurrentShop): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ userId, shop })).catch(() => {});
}

export async function readShopCache(userId: string): Promise<CurrentShop | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const cached = raw ? (JSON.parse(raw) as { userId: string; shop: CurrentShop }) : null;
    if (cached?.userId !== userId) {
      return null;
    }
    // Les mémoires gardées avant l'étape 7 n'avaient pas encore les rôles
    return { ...cached.shop, memberRoles: cached.shop.memberRoles ?? [] };
  } catch {
    return null;
  }
}

/** Oublie la dernière boutique connue (à la déconnexion). */
export async function clearShopCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}
