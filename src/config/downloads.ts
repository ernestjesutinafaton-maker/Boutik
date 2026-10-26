/**
 * Où télécharger l'appli Android (APK). L'adresse peut être changée sans toucher au code
 * avec la variable EXPO_PUBLIC_APK_URL (fichier .env et eas.json). Par défaut : le fichier
 * « boutik.apk » à la racine du site.
 */
export const ANDROID_APK_URL = process.env.EXPO_PUBLIC_APK_URL || '/boutik.apk';

/**
 * Le petit fichier qui annonce la dernière version de l'APK (sur le site) :
 * { "android": { "version": "1.0.1", "url": "https://…/boutik-1.0.1.apk" } }
 * L'appli le lit pour proposer « Nouvelle version disponible ».
 */
export const VERSION_INFO_URL = process.env.EXPO_PUBLIC_VERSION_URL || '';
