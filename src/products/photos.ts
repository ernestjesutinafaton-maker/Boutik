import { useQuery, useStatus, usePowerSync } from '@powersync/react';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef } from 'react';

import { supabase } from '@/lib/supabase';

/**
 * Les photos des produits.
 *
 * 1. La photo est prise (ou choisie), réduite à 800 pixels de large et compressée
 *    (environ 60 à 120 Ko) : elle reste légère pour les petits forfaits internet.
 * 2. Elle est gardée dans l'appareil (table locale « local_photo_uploads »), donc visible
 *    tout de suite, même hors ligne.
 * 3. Dès qu'internet est là, elle part dans le stockage Supabase (dossier de la boutique),
 *    et le produit reçoit son adresse : les autres appareils la voient à leur tour.
 */

const BUCKET = 'product-photos';
const MAX_WIDTH = 800;

/** Prend une photo (appareil photo) ou en choisit une (galerie). Renvoie l'image en base64, ou null. */
export async function pickProductPhoto(source: 'camera' | 'library'): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
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
  if ((asset.width ?? 0) > MAX_WIDTH || !asset.width) {
    context.resize({ width: MAX_WIDTH });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return saved.base64 ?? null;
}

/** Adresse publique d'une photo envoyée sur le serveur. */
export function photoUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Une photo gardée dans l'appareil, affichable directement. */
export function dataUri(base64: string): string {
  return `data:image/jpeg;base64,${base64}`;
}

/** La photo à afficher pour un produit : celle en attente d'envoi d'abord, sinon celle du serveur. */
export function useProductPhoto(productId: string, photoPath: string | null): string | null {
  const { data } = useQuery<{ data: string }>(
    'SELECT data FROM local_photo_uploads WHERE product_id = ? ORDER BY created_at DESC LIMIT 1',
    [productId]
  );
  const pending = data[0]?.data;
  if (pending) {
    return dataUri(pending);
  }
  return photoPath ? photoUrl(photoPath) : null;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

type PendingPhoto = { id: string; shop_id: string; product_id: string; data: string };

/**
 * Envoie les photos en attente dès qu'internet est là.
 * À placer une seule fois, dans la mise en page des écrans connectés.
 */
export function usePhotoUploader(): void {
  const db = usePowerSync();
  const { connected } = useStatus();
  const { data: pending } = useQuery<PendingPhoto>(
    'SELECT id, shop_id, product_id, data FROM local_photo_uploads ORDER BY created_at'
  );
  const isUploading = useRef(false);

  useEffect(() => {
    if (!connected || pending.length === 0 || isUploading.current) {
      return;
    }
    isUploading.current = true;
    (async () => {
      for (const photo of pending) {
        // Nom unique à chaque envoi : les appareils ne gardent pas une ancienne version en cache
        const path = `${photo.shop_id}/${photo.product_id}/${photo.id}.jpg`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, base64ToBytes(photo.data), { contentType: 'image/jpeg', upsert: true });
        if (error) {
          console.warn('Envoi de la photo impossible (nouvel essai plus tard) :', error.message);
          break;
        }
        await db.writeTransaction(async (tx) => {
          await tx.execute('UPDATE products SET photo_path = ?, updated_at = ? WHERE id = ?', [
            path,
            new Date().toISOString(),
            photo.product_id,
          ]);
          await tx.execute('DELETE FROM local_photo_uploads WHERE id = ?', [photo.id]);
        });
      }
    })()
      .catch((error: unknown) => console.warn('Envoi des photos interrompu :', error))
      .finally(() => {
        isUploading.current = false;
      });
  }, [connected, pending, db]);
}
