/**
 * Couleurs du thème « Vert Commerce ».
 *
 * C'est le SEUL endroit du projet où l'on écrit des codes couleur :
 * tous les écrans viennent piocher ici. Pour changer de thème plus tard,
 * il suffira de modifier ce fichier.
 *
 * À l'étape 3, ce dossier deviendra le thème complet (mode sombre,
 * tailles de texte, espacements…).
 */
export const colors = {
  primary: '#059669', // vert émeraude : couleur principale
  accent: '#F59E0B', // orange : boutons importants, alertes de stock bas
  danger: '#DC2626', // rouge : dettes, produits périmés, erreurs
  background: '#F6F8F7', // fond clair, lisible en plein soleil
  surface: '#FFFFFF', // fond des cartes
  text: '#111827', // texte principal
  textSecondary: '#4B5563', // texte moins important
  border: '#E5E7EB', // traits de séparation
} as const;
