/**
 * Thème « Vert Commerce » : TOUTES les valeurs visuelles de l'application.
 *
 * C'est le SEUL endroit du projet où l'on écrit des couleurs, des tailles et
 * des espacements. Pour changer de thème plus tard, il suffit de modifier ce fichier.
 */

/** Couleurs du mode clair (le mode par défaut, lisible en plein soleil). */
const light = {
  primary: '#059669', // vert émeraude : couleur principale
  onPrimary: '#FFFFFF', // texte posé sur le vert
  primaryContainer: '#D1FAE5', // vert très pâle : élément sélectionné, zone mise en avant
  onPrimaryContainer: '#064E3B',
  accent: '#F59E0B', // orange : boutons importants, alertes de stock bas
  onAccent: '#1F2937', // texte foncé sur l'orange (bien plus lisible que du blanc)
  accentContainer: '#FEF3C7',
  onAccentContainer: '#78350F',
  danger: '#DC2626', // rouge : dettes, produits périmés, erreurs
  onDanger: '#FFFFFF',
  dangerContainer: '#FEE2E2',
  onDangerContainer: '#7F1D1D',
  background: '#F6F8F7', // fond des écrans
  surface: '#FFFFFF', // fond des cartes et des barres de navigation
  surfaceVariant: '#EAF0ED', // fond des zones secondaires
  text: '#111827', // texte principal
  textSecondary: '#4B5563', // texte moins important
  border: '#D1D5DB', // traits et contours
  // Fonds des éléments « surélevés » (du moins au plus haut)
  elevation1: '#F1F6F3',
  elevation2: '#ECF3EF',
  elevation3: '#E7F0EB',
  elevation4: '#E5EEE9',
  elevation5: '#E1ECE6',
};

/** Le type « Palette » oblige le mode sombre à définir exactement les mêmes couleurs. */
export type Palette = typeof light;

/** Couleurs du mode sombre (en option, dans « Plus »). */
const dark: Palette = {
  primary: '#34D399', // vert plus clair, lisible sur fond sombre
  onPrimary: '#003824',
  primaryContainer: '#065F46',
  onPrimaryContainer: '#D1FAE5',
  accent: '#FBBF24',
  onAccent: '#1F2937',
  accentContainer: '#78350F',
  onAccentContainer: '#FEF3C7',
  danger: '#F87171',
  onDanger: '#450A0A',
  dangerContainer: '#7F1D1D',
  onDangerContainer: '#FEE2E2',
  background: '#0B1210',
  surface: '#111C18',
  surfaceVariant: '#1C2925',
  text: '#F3F4F6',
  textSecondary: '#9CA3AF',
  border: '#374151',
  elevation1: '#15211C',
  elevation2: '#192822',
  elevation3: '#1D2E27',
  elevation4: '#1F312A',
  elevation5: '#22352E',
};

export const palette = { light, dark };

/** Espacements (marges, écarts entre les éléments), en points. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** Arrondis des coins. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

/** Tailles de texte : volontairement grandes, pour bien lire. */
export const fontSize = {
  small: 13,
  body: 16,
  large: 18,
  title: 22,
  amount: 32, // gros chiffres (montants)
  amountLarge: 44, // très gros chiffres (total à payer)
} as const;

/** Hauteur minimale de tout ce qui se touche du doigt (boutons, lignes de menu). */
export const touch = {
  minHeight: 56,
} as const;

/** Mise en page selon la taille de l'écran. */
export const layout = {
  largeScreenMinWidth: 768, // au-delà : tablette ou ordinateur → menu sur le côté
  contentMaxWidth: 960, // largeur maximale du contenu, pour rester lisible sur grand écran
  sideNavWidth: 248, // largeur du menu sur le côté
} as const;
