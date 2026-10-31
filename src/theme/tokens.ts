/**
 * Thème « Vert Boutik 3D » : TOUTES les valeurs visuelles de l'application.
 *
 * C'est le SEUL endroit du projet où l'on écrit des couleurs, des tailles et
 * des espacements. Pour changer de thème plus tard, il suffit de modifier ce fichier.
 *
 * Le relief (la « 3D ») est fait sans flou, pour rester rapide sur les vieux téléphones :
 * une tranche plus foncée sous les cartes et les boutons, un reflet clair en haut et des
 * dégradés de lumière (du clair en haut vers le foncé en bas).
 */

/** Couleurs du mode clair (le mode par défaut, lisible en plein soleil). */
const light = {
  primary: '#047857', // vert émeraude profond : couleur principale (bien lisible sur blanc)
  onPrimary: '#FFFFFF', // texte posé sur le vert
  primaryContainer: '#D1FAE5', // vert très pâle : élément sélectionné, zone mise en avant
  onPrimaryContainer: '#064E3B',
  primaryBright: '#10B981', // vert vif : décorations et dégradés (jamais sous du texte)
  primaryDeep: '#064E3B', // vert sombre : tranche des boutons en relief
  accent: '#F59E0B', // orange : boutons importants, alertes de stock bas
  onAccent: '#1F2937', // texte foncé sur l'orange (bien plus lisible que du blanc)
  accentContainer: '#FEF3C7',
  onAccentContainer: '#78350F',
  danger: '#DC2626', // rouge : dettes, produits périmés, erreurs
  onDanger: '#FFFFFF',
  dangerContainer: '#FEE2E2',
  onDangerContainer: '#7F1D1D',
  success: '#047857', // vert : tout va bien, bénéfice
  successContainer: '#D1FAE5',
  onSuccessContainer: '#065F46',
  background: '#F2F6F4', // fond des écrans (gris-vert très pâle)
  surface: '#FFFFFF', // fond des cartes et des barres de navigation
  surfaceVariant: '#E7F0EC', // fond des zones secondaires
  text: '#13231D', // texte principal (presque noir, nuance verte)
  textSecondary: '#4A5C55', // texte moins important
  border: '#DCE7E1', // traits fins, contour des cartes
  outline: '#7F948B', // contour des champs de saisie (assez marqué pour bien les voir)
  night: '#022C22', // vert nuit : fonds sombres (connexion, grande carte des chiffres)
  nightMid: '#064E3B',
  onNight: '#FFFFFF', // texte sur le vert nuit
  onNightSecondary: '#A7F3D0',
  nightSurface: 'rgba(255, 255, 255, 0.12)', // pastille translucide posée sur le vert nuit
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
  onPrimary: '#022C22',
  primaryContainer: '#065F46',
  onPrimaryContainer: '#D1FAE5',
  primaryBright: '#6EE7B7',
  primaryDeep: '#022C22',
  accent: '#FBBF24',
  onAccent: '#1F2937',
  accentContainer: '#5C3A06',
  onAccentContainer: '#FEF3C7',
  danger: '#F87171',
  onDanger: '#450A0A',
  dangerContainer: '#7F1D1D',
  onDangerContainer: '#FEE2E2',
  success: '#34D399',
  successContainer: '#064E3B',
  onSuccessContainer: '#D1FAE5',
  background: '#08130F',
  surface: '#0F1F19',
  surfaceVariant: '#16291F',
  text: '#E8F3EE',
  textSecondary: '#9DB5AB',
  border: '#1F3A2F',
  outline: '#5E7D70',
  night: '#020F0B',
  nightMid: '#053D2E',
  onNight: '#FFFFFF',
  onNightSecondary: '#A7F3D0',
  nightSurface: 'rgba(255, 255, 255, 0.10)',
  elevation1: '#122219',
  elevation2: '#15271D',
  elevation3: '#182C21',
  elevation4: '#1A2F23',
  elevation5: '#1D3326',
};

export const palette = { light, dark };

/** Un bouton en relief : son dégradé, sa tranche (le dessous), la couleur du texte. */
export type ButtonLook = { gradient: string; edge: string; text: string; border?: string };

/** Le relief : dégradés de lumière et tranches plus foncées (sans flou : rapide partout). */
const lightEffects = {
  /** La grande carte des chiffres, et le fond des écrans de connexion */
  heroGradient: 'linear-gradient(135deg, #059669 0%, #064E3B 55%, #022C22 100%)',
  authGradient: 'linear-gradient(180deg, #047857 0%, #064E3B 45%, #022C22 100%)',
  /** Le reflet de lumière en haut à droite de la grande carte */
  heroShine:
    'radial-gradient(circle at 90% 0%, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 55%)',
  heroEdge: '#011A14',
  /** La tranche sous les cartes (elles semblent posées, en relief) */
  cardEdge: '#C9DCD2',
  /** Le reflet sur le haut des boutons */
  buttonShine: 'linear-gradient(180deg, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0) 100%)',
  /** Le bouton du menu de l'écran affiché */
  navActiveGradient: 'linear-gradient(180deg, #10B981 0%, #047857 100%)',
  navActiveEdge: '#064E3B',
  /** La tranche des petites étiquettes et des encadrés */
  chipEdge: { danger: '#FCA5A5', warning: '#FCD34D', ok: '#6EE7B7', neutral: '#C9DCD2' },
  noticeEdge: { error: '#FECACA', info: '#A7F3D0' },
  button: {
    primary: {
      gradient: 'linear-gradient(180deg, #059669 0%, #047857 55%, #065F46 100%)',
      edge: '#064E3B',
      text: '#FFFFFF',
    },
    accent: {
      gradient: 'linear-gradient(180deg, #FBBF24 0%, #F59E0B 100%)',
      edge: '#B45309',
      text: '#1F2937',
    },
    danger: {
      gradient: 'linear-gradient(180deg, #EF4444 0%, #DC2626 50%, #B91C1C 100%)',
      edge: '#7F1D1D',
      text: '#FFFFFF',
    },
    outline: {
      gradient: 'linear-gradient(180deg, #FFFFFF 0%, #F1F7F4 100%)',
      edge: '#C9DCD2',
      text: '#047857',
      border: '#C9DCD2',
    },
  } satisfies Record<string, ButtonLook>,
};

export type Effects = typeof lightEffects;

const darkEffects: Effects = {
  heroGradient: 'linear-gradient(135deg, #047857 0%, #053D2E 55%, #020F0B 100%)',
  authGradient: 'linear-gradient(180deg, #065F46 0%, #053D2E 45%, #020F0B 100%)',
  heroShine:
    'radial-gradient(circle at 90% 0%, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0) 55%)',
  heroEdge: '#000805',
  cardEdge: '#06100C',
  buttonShine: 'linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 100%)',
  navActiveGradient: 'linear-gradient(180deg, #10B981 0%, #047857 100%)',
  navActiveEdge: '#022C22',
  chipEdge: { danger: '#450A0A', warning: '#3B2504', ok: '#022C22', neutral: '#06100C' },
  noticeEdge: { error: '#450A0A', info: '#022C22' },
  button: {
    primary: lightEffects.button.primary,
    accent: lightEffects.button.accent,
    danger: lightEffects.button.danger,
    outline: {
      gradient: 'linear-gradient(180deg, #1A3328 0%, #142A20 100%)',
      edge: '#06100C',
      text: '#6EE7B7',
      border: '#2A4A3C',
    },
  },
};

export const effects = { light: lightEffects, dark: darkEffects };

/** La police de l'application (ronde et très lisible), chargée au démarrage. */
export const fontFamily = {
  brand: 'Nunito',
} as const;

/** Espacements (marges, écarts entre les éléments), en points. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** Arrondis des coins (généreux : c'est la signature du style Boutik). */
export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Épaisseur des tranches (le relief) : cartes, boutons, grande carte des chiffres. */
export const depth = {
  card: 3,
  button: 4,
  hero: 6,
  chip: 2,
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
