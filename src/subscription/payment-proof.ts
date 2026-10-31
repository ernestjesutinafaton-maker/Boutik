import { randomUUID } from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';
import { base64ToBytes } from '@/products/photos';

/**
 * La capture du paiement (SMS de Mobile Money, reçu…) jointe à une déclaration d'abonnement.
 *
 * Elle est gardée dans un stockage PRIVÉ (« payment-proofs ») : seuls le propriétaire de la
 * boutique et l'administrateur de Boutik peuvent la voir, par des adresses temporaires.
 * Elle est réduite à 1 080 pixels de large au plus, mais reste nette : le texte du SMS doit
 * se lire. Pas de recadrage : une capture d'écran est en hauteur.
 */

const BUCKET = 'payment-proofs';
const MAX_WIDTH = 1080;
/** Durée de validité d'une adresse pour afficher une capture */
const URL_SECONDS = 3600;

/** Prend une photo du reçu, ou choisit une capture d'écran. Renvoie l'image en base64, ou null. */
export async function pickPaymentProof(source: 'camera' | 'library'): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return null;
    }
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) {
    return null;
  }

  const context = ImageManipulator.manipulate(asset.uri);
  if (!asset.width || asset.width > MAX_WIDTH) {
    context.resize({ width: MAX_WIDTH });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  return saved.base64 ?? null;
}

/**
 * Envoie la capture dans le dossier de la boutique (internet nécessaire) et renvoie son chemin.
 * Un nom neuf à chaque fois : une preuve envoyée n'est jamais remplacée.
 */
export async function uploadPaymentProof(shopId: string, base64: string): Promise<string> {
  const path = `${shopId}/${randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, base64ToBytes(base64), { contentType: 'image/jpeg', upsert: false });
  if (error) {
    throw error;
  }
  return path;
}

/** Adresses temporaires (1 heure) pour afficher des captures : chemin → adresse. */
export async function proofUrls(paths: readonly string[]): Promise<Record<string, string>> {
  if (paths.length === 0) {
    return {};
  }
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls([...paths], URL_SECONDS);
  if (error || !data) {
    return {};
  }
  const urls: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) {
      urls[item.path] = item.signedUrl;
    }
  }
  return urls;
}
