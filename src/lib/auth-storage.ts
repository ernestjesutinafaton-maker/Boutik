/**
 * Où ranger la session de connexion — version NAVIGATEUR (web et PC).
 *
 * Le navigateur la garde dans son « localStorage ». La version téléphone,
 * chiffrée, est dans auth-storage.native.ts (Expo choisit le bon fichier tout seul).
 */

export type AuthStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export const authStorage: AuthStorage = {
  async getItem(key) {
    return globalThis.localStorage?.getItem(key) ?? null;
  },
  async setItem(key, value) {
    globalThis.localStorage?.setItem(key, value);
  },
  async removeItem(key) {
    globalThis.localStorage?.removeItem(key);
  },
};
