import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

import { useAuth } from '@/auth/auth-provider';
import type { CreateShopInput } from '@/auth/schemas';
import { getCountry } from '@/config/countries';
import { CURRENCIES, type CurrencyCode } from '@/domain/money';
import { supabase } from '@/lib/supabase';

/** La boutique dans laquelle on travaille, et la personne connectée dans cette boutique. */
export type CurrentShop = {
  id: string;
  name: string;
  countryCode: string;
  currencyCode: CurrencyCode;
  memberId: string;
  memberName: string;
};

/**
 * loading = chargement en cours ; ready = boutique trouvée ;
 * none = pas encore de boutique (il faut la créer) ; error = chargement impossible.
 */
export type ShopStatus = 'loading' | 'ready' | 'none' | 'error';

type ShopResult = { status: Exclude<ShopStatus, 'loading'>; shop: CurrentShop | null };

type ShopContextValue = {
  status: ShopStatus;
  shop: CurrentShop | null;
  createShop: (input: CreateShopInput) => Promise<void>;
  reload: () => void;
};

/** Dernière boutique connue, gardée dans l'appareil pour pouvoir démarrer sans internet. */
const CACHE_KEY = 'boutik.current-shop';

const ShopContext = createContext<ShopContextValue | null>(null);

function toCurrencyCode(code: string): CurrencyCode {
  return code in CURRENCIES ? (code as CurrencyCode) : 'XOF';
}

/** Cherche sur le serveur la boutique de cette personne (ou, hors ligne, la dernière connue). */
async function fetchShop(userId: string): Promise<ShopResult> {
  const { data, error } = await supabase
    .from('shop_members')
    .select('id, display_name, shops (id, name, country_code, currency_code)')
    .eq('user_id', userId)
    .eq('active', true)
    .limit(1);

  if (error) {
    // Pas de réseau (ou serveur injoignable) : on reprend la dernière boutique connue
    const cached = await readCachedShop(userId);
    return cached ? { status: 'ready', shop: cached } : { status: 'error', shop: null };
  }

  const membership = data[0];
  if (!membership?.shops) {
    return { status: 'none', shop: null };
  }

  const shop: CurrentShop = {
    id: membership.shops.id,
    name: membership.shops.name,
    countryCode: membership.shops.country_code,
    currencyCode: toCurrencyCode(membership.shops.currency_code),
    memberId: membership.id,
    memberName: membership.display_name,
  };
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ userId, shop })).catch(() => {});
  return { status: 'ready', shop };
}

async function readCachedShop(userId: string): Promise<CurrentShop | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const cached = raw ? (JSON.parse(raw) as { userId: string; shop: CurrentShop }) : null;
    return cached?.userId === userId ? cached.shop : null;
  } catch {
    return null;
  }
}

/** Oublie la dernière boutique connue (à la déconnexion). */
export async function clearShopCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}

/** Charge la boutique de la personne connectée et la partage avec tous les écrans. */
export function ShopProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  // Résultat du dernier chargement, et pour quelle personne il a été fait
  const [loaded, setLoaded] = useState<(ShopResult & { userId: string }) | null>(null);
  // Augmenter ce compteur relance le chargement (après la création d'une boutique…)
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;
    fetchShop(userId)
      .catch((error: unknown): ShopResult => {
        console.warn('Chargement de la boutique impossible :', error);
        return { status: 'error', shop: null };
      })
      .then((result) => {
        if (!cancelled) {
          setLoaded({ ...result, userId });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadCount]);

  // Tant que le chargement de CETTE personne n'est pas terminé : « loading »
  const isCurrent = userId !== null && loaded?.userId === userId;
  const status: ShopStatus = !userId ? 'none' : isCurrent ? loaded.status : 'loading';
  const shop = isCurrent ? loaded.shop : null;

  async function createShop(input: CreateShopInput) {
    const country = getCountry(input.countryCode);
    const { error } = await supabase.rpc('create_shop', {
      p_name: input.shopName,
      p_country_code: country.code,
      p_currency_code: country.currency,
      p_owner_name: input.ownerName,
      p_payment_methods: country.paymentMethods,
    });
    if (error) {
      throw error;
    }
    setReloadCount((count) => count + 1);
  }

  function reload() {
    setReloadCount((count) => count + 1);
  }

  return (
    <ShopContext.Provider value={{ status, shop, createShop, reload }}>
      {children}
    </ShopContext.Provider>
  );
}

/** Pour lire la boutique actuelle depuis n'importe quel écran. */
export function useShop(): ShopContextValue {
  const value = useContext(ShopContext);
  if (!value) {
    throw new Error('useShop doit être utilisé à l’intérieur de ShopProvider.');
  }
  return value;
}
