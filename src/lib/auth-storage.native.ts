import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import type { AuthStorage } from './auth-storage';

/**
 * Où ranger la session de connexion — version TÉLÉPHONE et TABLETTE, chiffrée.
 *
 * Sur un appareil partagé par toute l'équipe, la session du propriétaire ne doit pas
 * être lisible en clair. Le « coffre-fort » du téléphone (SecureStore) est très sûr,
 * mais trop petit pour la session (environ 2 Ko). Donc :
 *   1. on chiffre la session avec une clé AES-256 tirée au hasard ;
 *   2. SEULE la clé va dans le coffre-fort ;
 *   3. la session chiffrée va dans AsyncStorage (sans la clé, elle est illisible).
 * Méthode tirée de l'exemple officiel de Supabase pour Expo.
 */

function encrypt(value: string): { encrypted: string; keyHex: string } {
  const key = getRandomBytes(32); // 32 octets = 256 bits
  const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
  const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  return {
    encrypted: aesjs.utils.hex.fromBytes(encryptedBytes),
    keyHex: aesjs.utils.hex.fromBytes(key),
  };
}

function decrypt(encrypted: string, keyHex: string): string {
  const cipher = new aesjs.ModeOfOperation.ctr(
    aesjs.utils.hex.toBytes(keyHex),
    new aesjs.Counter(1)
  );
  const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(encrypted));
  return aesjs.utils.utf8.fromBytes(decryptedBytes);
}

export const authStorage: AuthStorage = {
  async getItem(key) {
    const encrypted = await AsyncStorage.getItem(key);
    const keyHex = await SecureStore.getItemAsync(key);
    if (!encrypted || !keyHex) {
      return null;
    }
    return decrypt(encrypted, keyHex);
  },
  async setItem(key, value) {
    const { encrypted, keyHex } = encrypt(value);
    await SecureStore.setItemAsync(key, keyHex);
    await AsyncStorage.setItem(key, encrypted);
  },
  async removeItem(key) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  },
};
