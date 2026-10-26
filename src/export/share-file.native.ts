import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Enregistrer un fichier — version TÉLÉPHONE : il est écrit dans l'appareil, puis le
 * partage s'ouvre (WhatsApp, e-mail, Google Drive…), pour l'ouvrir dans Excel ailleurs.
 */
export async function shareTextFile(fileName: string, content: string, mimeType: string) {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  await file.write(content);
  await Sharing.shareAsync(file.uri, {
    mimeType,
    UTI: 'public.comma-separated-values-text',
    dialogTitle: fileName,
  });
}
