import { SITE_URL } from './site';

/**
 * Où télécharger l'appli Android (APK). L'adresse peut être changée sans toucher au code
 * avec la variable EXPO_PUBLIC_APK_URL (fichier .env et eas.json). Par défaut : la dernière
 * version publiée sur GitHub (dépôt public Boutik-presentation, rubrique « Releases ») ;
 * le fichier est trop gros pour l'hébergement du site (Vercel : 100 Mo par envoi).
 * Même adresse que « downloads.android » dans site/config.json.
 */
export const ANDROID_APK_URL =
  process.env.EXPO_PUBLIC_APK_URL ||
  'https://github.com/ernestjesutinafaton-maker/Boutik-presentation/releases/latest/download/boutik.apk';

/**
 * Le petit fichier qui annonce la dernière version de l'APK (sur le site, public/version.json) :
 * { "android": { "version": "1.0.1", "url": "https://…/boutik.apk" } }
 * L'appli le lit pour proposer « Nouvelle version disponible ». Par défaut : celui du site.
 */
export const VERSION_INFO_URL =
  process.env.EXPO_PUBLIC_VERSION_URL || `${SITE_URL}/app/version.json`;
