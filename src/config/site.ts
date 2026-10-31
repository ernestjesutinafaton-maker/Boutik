/**
 * Adresse du site vitrine (la version web de l'appli vit dessous, sous /app). Elle peut être
 * changée sans toucher au code avec la variable EXPO_PUBLIC_SITE_URL.
 * Même adresse que « siteUrl » dans site/config.json.
 */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || 'https://boutik-services.vercel.app')
  .trim()
  .replace(/\/+$/, '');

/**
 * Page du site où arrive la personne qui touche le lien de confirmation reçu par e-mail.
 * Elle doit figurer dans les « Redirect URLs » de Supabase (Authentication → URL Configuration) :
 * sinon Supabase renvoie vers sa « Site URL ».
 */
export const EMAIL_CONFIRMED_URL = `${SITE_URL}/email-confirme`;
