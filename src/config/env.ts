/**
 * Réglages lus dans le fichier « .env » (modèle : .env.example).
 *
 * Expo remplace chaque « process.env.EXPO_PUBLIC_… » par sa valeur au moment de construire
 * l'application : il faut donc les écrire en toutes lettres, comme ci-dessous.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const powersyncUrl = process.env.EXPO_PUBLIC_POWERSYNC_URL;

if (!supabaseUrl || !supabasePublishableKey || !powersyncUrl) {
  throw new Error(
    'Réglages manquants : copie le fichier .env.example sous le nom .env, ' +
      'remplis EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY et ' +
      'EXPO_PUBLIC_POWERSYNC_URL, puis relance « npx expo start ».'
  );
}

export const env = {
  supabaseUrl,
  supabasePublishableKey,
  powersyncUrl,
};
