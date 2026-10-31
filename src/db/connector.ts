import type {
  CommonPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from '@powersync/common';

import { env } from '@/config/env';
import type { Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

/** Une modification faite dans l'appareil, au format attendu par la fonction serveur apply_changes. */
type Change = {
  op: string; // PUT (création), PATCH (modification), DELETE (refusée par le serveur)
  table: string;
  id: string;
  data: { [column: string]: Json | undefined };
};

/**
 * Erreurs que le serveur renverra toujours, même en réessayant : donnée invalide (codes 22…),
 * règle de la base non respectée (23…), droit refusé ou erreur d'écriture (42…),
 * refus volontaire d'une de nos fonctions (P0…).
 * Les autres erreurs (réseau, serveur occupé…) valent la peine de réessayer plus tard.
 */
function isFatalError(code: unknown): boolean {
  return typeof code === 'string' && /^(22|23|42|P0)/.test(code);
}

/**
 * Boutique en pause (abonnement expiré) : le serveur refuse pour l'instant (code BK001).
 * Ce n'est PAS un refus définitif : rien n'est mis de côté, tout reste dans l'appareil et
 * repartira dès que le paiement sera validé.
 */
const SUBSCRIPTION_BLOCKED = 'BK001';
/** En pause, inutile d'insister : un nouvel essai toutes les 30 secondes au plus */
const BLOCKED_RETRY_DELAY_MS = 30_000;

/**
 * Garde dans l'appareil les modifications refusées par le serveur, pour pouvoir les examiner
 * (table locale « local_rejected_changes », jamais envoyée au serveur).
 */
async function saveRejectedChanges(
  database: CommonPowerSyncDatabase,
  changes: Change[],
  error: { code?: string; message?: string }
) {
  const now = new Date().toISOString();
  for (const change of changes) {
    await database.execute(
      `INSERT INTO local_rejected_changes
         (id, table_name, row_id, operation, data, error_code, error_message, rejected_at)
       VALUES (uuid(), ?, ?, ?, ?, ?, ?, ?)`,
      [
        change.table,
        change.id,
        change.op,
        JSON.stringify(change.data),
        error.code ?? '',
        error.message ?? '',
        now,
      ]
    );
  }
}

/**
 * Le « connecteur » : le lien entre la base locale (PowerSync) et notre serveur (Supabase).
 */
export const connector: PowerSyncBackendConnector = {
  /**
   * Donne à PowerSync l'adresse du service et la « carte d'identité » (jeton) de la personne
   * connectée. Sans session valide (hors ligne avec une session expirée…), on ne donne rien :
   * PowerSync réessaiera tout seul plus tard.
   */
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      return null;
    }
    return { endpoint: env.powersyncUrl, token: data.session.access_token };
  },

  /**
   * Envoie au serveur les modifications faites dans l'appareil.
   * Chaque opération (ex. une vente complète) part en UN SEUL envoi, appliqué « tout ou rien »
   * par la fonction serveur apply_changes. PowerSync rappelle cette fonction tant qu'il reste
   * des opérations en attente.
   */
  async uploadData(database: CommonPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) {
      return;
    }

    const changes: Change[] = transaction.crud.map((entry) => ({
      op: entry.op,
      table: entry.table,
      id: entry.id,
      data: entry.opData ?? {},
    }));

    const { error } = await supabase.rpc('apply_changes', { p_changes: changes });

    if (!error) {
      await transaction.complete(); // envoyé : on le retire de la file d'attente
      return;
    }
    if (error.code === SUBSCRIPTION_BLOCKED) {
      // Abonnement expiré : on garde tout et on réessaiera (après validation du paiement)
      await new Promise((resolve) => setTimeout(resolve, BLOCKED_RETRY_DELAY_MS));
      throw error;
    }
    if (isFatalError(error.code)) {
      // Refus définitif du serveur : réessayer bloquerait toutes les opérations suivantes.
      // On met l'opération de côté dans l'appareil, puis on libère la file d'attente.
      console.error('Modification refusée par le serveur, mise de côté :', error);
      await saveRejectedChanges(database, changes, error);
      await transaction.complete();
      return;
    }
    // Problème de réseau ou de serveur : PowerSync réessaiera un peu plus tard.
    throw error;
  },
};
