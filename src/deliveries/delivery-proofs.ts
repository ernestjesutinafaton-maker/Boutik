import { useQuery, useStatus, usePowerSync } from '@powersync/react';
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { base64ToBytes, dataUri } from '@/products/photos';
import { pickPaymentProof } from '@/subscription/payment-proof';

/**
 * Les photos des reçus des livreurs (carburant, transport…).
 *
 * 1. La photo est prise (même réglage que les captures de paiement : nette, mais légère).
 * 2. Elle attend dans l'appareil (table locale « local_proof_uploads ») : la dépense est
 *    enregistrée tout de suite, même sans internet, avec le chemin où la photo ira.
 * 3. Dès qu'internet est là, elle part dans le stockage PRIVÉ « delivery-proofs », dans le
 *    dossier du livreur. Seuls lui, le propriétaire et les responsables peuvent la voir,
 *    par des adresses temporaires.
 */

const BUCKET = 'delivery-proofs';
/** Durée de validité d'une adresse pour afficher une photo */
const URL_SECONDS = 3600;

/** Prend la photo du reçu (appareil photo) ou choisit une image. Renvoie l'image en base64. */
export function pickReceiptPhoto(source: 'camera' | 'library'): Promise<string | null> {
  return pickPaymentProof(source);
}

type PendingProof = { id: string; path: string; data: string };

/** Le stockage a déjà ce fichier (un envoi précédent a réussi juste avant une coupure). */
function alreadyStored(error: { message: string; statusCode?: string }): boolean {
  return error.statusCode === '409' || /exists|duplicate/i.test(error.message);
}

/**
 * Envoie les photos de reçus en attente dès qu'internet est là.
 * À placer une seule fois, dans la mise en page des écrans connectés.
 */
export function useProofUploader(): void {
  const db = usePowerSync();
  const { connected } = useStatus();
  const { data: pending } = useQuery<PendingProof>(
    'SELECT id, path, data FROM local_proof_uploads ORDER BY created_at'
  );
  const isUploading = useRef(false);

  useEffect(() => {
    if (!connected || pending.length === 0 || isUploading.current) {
      return;
    }
    isUploading.current = true;
    (async () => {
      for (const proof of pending) {
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(proof.path, base64ToBytes(proof.data), {
            contentType: 'image/jpeg',
            upsert: false,
          });
        if (error && !alreadyStored(error as { message: string; statusCode?: string })) {
          console.warn('Envoi du reçu impossible (nouvel essai plus tard) :', error.message);
          break;
        }
        await db.execute('DELETE FROM local_proof_uploads WHERE id = ?', [proof.id]);
      }
    })()
      .catch((error: unknown) => console.warn('Envoi des reçus interrompu :', error))
      .finally(() => {
        isUploading.current = false;
      });
  }, [connected, pending, db]);
}

/**
 * La photo d'un reçu à afficher :
 *   - encore dans cet appareil (pas envoyée) → affichée directement ;
 *   - sinon, une adresse temporaire du stockage privé (internet nécessaire).
 * status « unavailable » : pas d'internet, ou la photo n'est pas encore arrivée sur le serveur
 * (le téléphone du livreur l'enverra dès qu'il aura internet).
 */
export function useReceiptImage(path: string): {
  uri: string | null;
  status: 'ready' | 'loading' | 'unavailable';
} {
  const { data } = useQuery<{ data: string }>(
    'SELECT data FROM local_proof_uploads WHERE path = ? LIMIT 1',
    [path]
  );
  const local = data[0]?.data ?? null;
  const [signed, setSigned] = useState<{ path: string; uri: string | null } | null>(null);

  useEffect(() => {
    if (local) {
      return;
    }
    let cancelled = false;
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, URL_SECONDS)
      .then(({ data: result }) => {
        if (!cancelled) {
          setSigned({ path, uri: result?.signedUrl ?? null });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSigned({ path, uri: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, local]);

  if (local) {
    return { uri: dataUri(local), status: 'ready' };
  }
  if (!signed || signed.path !== path) {
    return { uri: null, status: 'loading' };
  }
  return signed.uri ? { uri: signed.uri, status: 'ready' } : { uri: null, status: 'unavailable' };
}
