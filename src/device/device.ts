import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * L'appareil (téléphone, tablette, navigateur) dans une boutique.
 *
 * Chaque appareil reçoit du serveur un numéro (1, 2, 3…), utilisé dans les numéros de facture
 * (F2-000123 = appareil n° 2) : deux appareils hors ligne ne fabriquent jamais le même numéro.
 */
export type ShopDevice = {
  /** Identifiant créé par l'appareil lui-même */
  id: string;
  /** Numéro donné par le serveur ; null tant que l'appareil n'a pas pu s'enregistrer */
  number: number | null;
};

const idKey = (shopId: string) => `boutik.device-id.${shopId}`;
const numberKey = (shopId: string) => `boutik.device-number.${shopId}`;

/** L'identifiant de cet appareil pour cette boutique (créé à la première utilisation). */
async function getDeviceId(shopId: string): Promise<string> {
  const existing = await AsyncStorage.getItem(idKey(shopId));
  if (existing) {
    return existing;
  }
  const id = randomUUID();
  await AsyncStorage.setItem(idKey(shopId), id);
  return id;
}

function getDeviceName(): string {
  if (Platform.OS === 'web') {
    return 'Navigateur web';
  }
  return Device.modelName ?? Device.deviceName ?? 'Appareil';
}

function getPlatform(): 'android' | 'ios' | 'web' {
  return Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
}

/**
 * Enregistre l'appareil auprès du serveur (en ligne) et retient son numéro.
 * Hors ligne, on reprend le numéro déjà connu.
 */
export async function registerDevice(shopId: string): Promise<ShopDevice> {
  const id = await getDeviceId(shopId);
  const { data, error } = await supabase.rpc('register_device', {
    p_device_id: id,
    p_shop_id: shopId,
    p_name: getDeviceName(),
    p_platform: getPlatform(),
  });

  if (!error && typeof data === 'number') {
    await AsyncStorage.setItem(numberKey(shopId), String(data)).catch(() => {});
    return { id, number: data };
  }

  const saved = await AsyncStorage.getItem(numberKey(shopId)).catch(() => null);
  return { id, number: saved ? Number(saved) : null };
}

/** Le nom de cet appareil, pour l'afficher (« Redmi Pad 2 », « Navigateur web »…). */
export const deviceName = getDeviceName();
