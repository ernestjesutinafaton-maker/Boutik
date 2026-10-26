/**
 * Enregistrer un fichier — version NAVIGATEUR : le fichier est téléchargé
 * (il arrive dans le dossier « Téléchargements » de l'ordinateur).
 * La version téléphone est dans share-file.native.ts.
 */
export async function shareTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
