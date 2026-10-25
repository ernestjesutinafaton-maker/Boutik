import './polyfills';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from '@/config/env';

import { authStorage } from './auth-storage';
import type { Database } from './database.types';

/**
 * Le client Supabase : c'est par lui que l'application parle au serveur
 * (connexion, création de la boutique…).
 *
 * « Database » décrit nos tables (fichier généré par « npm run db:types ») :
 * TypeScript vérifie ainsi chaque requête.
 */
export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    storage: authStorage, // la session est gardée dans l'appareil (chiffrée sur téléphone)
    persistSession: true, // on reste connecté quand on rouvre l'application
    autoRefreshToken: true, // la session est renouvelée automatiquement
    detectSessionInUrl: false, // pas de connexion par lien e-mail dans cette application
  },
});

// Sur téléphone : on ne renouvelle la session que quand l'application est au premier plan.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
