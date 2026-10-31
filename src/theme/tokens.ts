/**
 * Thème « Violet Boutik » : TOUTES les valeurs visuelles de l'application.
 *
 * C'est le SEUL endroit du projet où l'on écrit des couleurs, des tailles et
 * des espacements. Pour changer de thème plus tard, il suffit de modifier ce fichier.
 *
 * Inspiré de la charte d'Ernest : violet #7138D9, dégradé vers #A52BFF, nuit violette
 * (#35166F → #160D35), fonds lavande, coins très arrondis et un peu de relief (3D douce).
 */

/** Couleurs du mode clair (le mode par défaut, lisible en plein soleil). */
const light = {
  primary: '#7138D9', // violet : couleur principale
  onPrimary: '#FFFFFF', // texte posé sur le violet
  primaryContainer: '#EDE5FC', // lavande : élément sélectionné, zone mise en avant
  onPrimaryContainer: '#2E1468',
  primaryBright: '#A52BFF', // violet vif : fin des dégradés
  primaryDeep: '#4B1FA8', // violet profond : tranche des boutons en relief
  accent: '#F59E0B', // orange : boutons importants, alertes de stock bas
  onAccent: '#1F2937', // texte foncé sur l'orange (bien plus lisible que du blanc)
  accentContainer: '#FEF3C7',
  onAccentContainer: '#78350F',
  danger: '#DC2626', // rouge : dettes, produits périmés, erreurs
  onDanger: '#FFFFFF',
  dangerContainer: '#FEE2E2',
  onDangerContainer: '#7F1D1D',
  success: '#059669', // vert : tout va bien, bénéfice
  successContainer: '#D1FAE5',
  onSuccessContainer: '#065F46',
  background: '#F7F4FD', // fond des écrans (lavande très pâle)
  surface: '#FFFFFF', // fond des cartes et des barres de navigation
  surfaceVariant: '#F0EBFA', // fond des zones secondaires
  text: '#28134F', // texte principal (violet presque noir)
  textSecondary: '#6E6188', // texte moins important
  border: '#E6DFF5', // traits fins, contour des cartes
  outline: '#958AB8', // contour des champs de saisie (assez marqué pour bien les voir)
  night: '#160D35', // nuit violette : fonds sombres (connexion, grande carte des chiffres)
  nightMid: '#35166F',
  onNight: '#FFFFFF', // texte sur la nuit violette
  onNightSecondary: '#D9CCF7',
  nightSurface: 'rgba(255, 255, 255, 0.12)', // pastille translucide posée sur la nuit violette
  // Fonds des éléments « surélevés » (du moins au plus haut)
  elevation1: '#F6F2FD',
  elevation2: '#F2EDFC',
  elevation3: '#EFE8FB',
  elevation4: '#EDE6FA',
  elevation5: '#EAE2F9',
};

/** Le type « Palette » oblige le mode sombre à définir exactement les mêmes couleurs. */
export type Palette = typeof light;

/** Couleurs du mode sombre (en option, dans « Plus »). */
const dark: Palette = {
  primary: '#B79CFF', // violet clair, lisible sur fond sombre
  onPrimary: '#21104F',
  primaryContainer: '#3E2384',
  onPrimaryContainer: '#EDE5FC',
  primaryBright: '#C084FC',
  primaryDeep: '#2E1468',
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
  background: '#110A24',
  surface: '#1B1236',
  surfaceVariant: '#261A49',
  text: '#F4EFFF',
  textSecondary: '#B9ACD9',
  border: '#33275C',
  outline: '#8273AE',
  night: '#0B0619',
  nightMid: '#2A1260',
  onNight: '#FFFFFF',
  onNightSecondary: '#D9CCF7',
  nightSurface: 'rgba(255, 255, 255, 0.10)',
  elevation1: '#1E1440',
  elevation2: '#22174A',
  elevation3: '#261A52',
  elevation4: '#281C56',
  elevation5: '#2B1E5C',
};

export const palette = { light, dark };

/** Un bouton en relief : son dégradé, sa tranche (le dessous), son halo et la couleur du texte. */
export type ButtonLook = {
  gradient: string;
  edge: string;
  glow: string;
  text: string;
  border?: string;
};

/**
 * Le relief : dégradés et ombres douces (la « 3D » légère de l'application).
 * Les ombres sont teintées de violet, comme la lumière qui traverse la marque.
 */
const lightEffects = {
  /** Fond des écrans : une lueur lavande en haut */
  screenGradient: 'linear-gradient(180deg, #EEE6FD 0px, #F7F4FD 320px)',
  /** La grande carte des chiffres, et le fond des écrans de connexion */
  heroGradient: 'linear-gradient(135deg, #7138D9 0%, #35166F 58%, #160D35 100%)',
  authGradient: 'linear-gradient(180deg, #7138D9 0%, #35166F 42%, #160D35 100%)',
  cardShadow: '0px 1px 2px rgba(40, 19, 79, 0.06), 0px 10px 24px -8px rgba(113, 56, 217, 0.22)',
  heroShadow: '0px 18px 32px -12px rgba(53, 22, 111, 0.55)',
  navShadow: '0px -6px 24px rgba(76, 29, 149, 0.10)',
  /** Le bouton du menu de l'écran affiché */
  navActiveGradient: 'linear-gradient(135deg, #7138D9 0%, #A52BFF 100%)',
  navActiveShadow: '0px 6px 14px -4px rgba(113, 56, 217, 0.55)',
  /** Le reflet sur le haut des boutons en relief */
  buttonHighlight: 'inset 0px 1px 0px rgba(255, 255, 255, 0.35)',
  button: {
    primary: {
      gradient: 'linear-gradient(90deg, #7138D9 0%, #A52BFF 100%)',
      edge: '#4B1FA8',
      glow: 'rgba(113, 56, 217, 0.45)',
      text: '#FFFFFF',
    },
    accent: {
      gradient: 'linear-gradient(90deg, #F59E0B 0%, #FBBF24 100%)',
      edge: '#B45309',
      glow: 'rgba(245, 158, 11, 0.45)',
      text: '#1F2937',
    },
    danger: {
      gradient: 'linear-gradient(90deg, #B91C1C 0%, #DC2626 100%)',
      edge: '#7F1D1D',
      glow: 'rgba(220, 38, 38, 0.40)',
      text: '#FFFFFF',
    },
    outline: {
      gradient: 'linear-gradient(180deg, #FFFFFF 0%, #F7F3FE 100%)',
      edge: '#D9CCF7',
      glow: 'rgba(113, 56, 217, 0.12)',
      text: '#7138D9',
      border: '#D9CCF7',
    },
  } satisfies Record<string, ButtonLook>,
};

export type Effects = typeof lightEffects;

const darkEffects: Effects = {
  screenGradient: 'linear-gradient(180deg, #1C1140 0px, #110A24 320px)',
  heroGradient: 'linear-gradient(135deg, #5B2BC0 0%, #2A1260 58%, #0B0619 100%)',
  authGradient: 'linear-gradient(180deg, #5B2BC0 0%, #2A1260 42%, #0B0619 100%)',
  cardShadow: '0px 10px 24px -10px rgba(0, 0, 0, 0.65)',
  heroShadow: '0px 18px 32px -12px rgba(0, 0, 0, 0.7)',
  navShadow: '0px -6px 24px rgba(0, 0, 0, 0.5)',
  navActiveGradient: 'linear-gradient(135deg, #7138D9 0%, #A52BFF 100%)',
  navActiveShadow: '0px 6px 14px -4px rgba(0, 0, 0, 0.6)',
  buttonHighlight: 'inset 0px 1px 0px rgba(255, 255, 255, 0.18)',
  button: {
    primary: lightEffects.button.primary,
    accent: lightEffects.button.accent,
    danger: lightEffects.button.danger,
    outline: {
      gradient: 'linear-gradient(180deg, #2A1D52 0%, #22174A 100%)',
      edge: '#140C2E',
      glow: 'rgba(0, 0, 0, 0.4)',
      text: '#D7C8FF',
      border: '#4A3A85',
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
