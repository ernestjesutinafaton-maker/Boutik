/**
 * Les thèmes de Boutik : TOUTES les valeurs visuelles de l'application.
 *
 * C'est le SEUL endroit du projet où l'on écrit des couleurs, des tailles et
 * des espacements. Trois thèmes au choix (vert par défaut, violet, orangé), chacun en
 * mode clair et en mode sombre. La personne choisit dès l'écran de connexion, et peut
 * changer ensuite dans « Plus » → Apparence.
 *
 * Le relief (la « 3D ») est fait sans flou, pour rester rapide sur les vieux téléphones :
 * une tranche plus foncée sous les cartes et les boutons, un reflet clair en haut et des
 * dégradés de lumière (du clair en haut vers le foncé en bas).
 */

/** Les thèmes proposés (le nom est aussi celui enregistré dans l'appareil). */
export type ThemeColor = 'vert' | 'violet' | 'orange';
export const THEME_COLORS: readonly ThemeColor[] = ['vert', 'violet', 'orange'];
export const DEFAULT_THEME_COLOR: ThemeColor = 'vert';

// ---------- Couleurs communes à tous les thèmes ----------

/** Alertes et actions importantes (orange), danger (rouge), succès (vert) : mode clair. */
const sharedLight = {
  accent: '#F59E0B', // orange : alertes de stock bas, actions importantes
  onAccent: '#1F2937', // texte foncé sur l'orange (bien plus lisible que du blanc)
  accentContainer: '#FEF3C7',
  onAccentContainer: '#78350F',
  danger: '#DC2626', // rouge : dettes, produits périmés, erreurs
  onDanger: '#FFFFFF',
  dangerContainer: '#FEE2E2',
  onDangerContainer: '#7F1D1D',
  success: '#047857', // vert : tout va bien, bénéfice (dans tous les thèmes)
  successContainer: '#D1FAE5',
  onSuccessContainer: '#065F46',
  surface: '#FFFFFF', // fond des cartes et des barres de navigation
  onNight: '#FFFFFF', // texte sur les fonds sombres (connexion, grande carte des chiffres)
  nightSurface: 'rgba(255, 255, 255, 0.12)', // pastille translucide posée sur un fond sombre
};

const sharedDark: typeof sharedLight = {
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
  surface: '#0F1F19',
  onNight: '#FFFFFF',
  nightSurface: 'rgba(255, 255, 255, 0.10)',
};

// ---------- Thème VERT (par défaut) ----------

const vertLight = {
  ...sharedLight,
  primary: '#047857', // vert émeraude profond : couleur principale (bien lisible sur blanc)
  onPrimary: '#FFFFFF', // texte posé sur la couleur principale
  primaryContainer: '#D1FAE5', // version très pâle : élément sélectionné, zone mise en avant
  onPrimaryContainer: '#064E3B',
  primaryBright: '#10B981', // version vive : décorations et dégradés (jamais sous du texte)
  primaryDeep: '#064E3B', // version sombre : tranche des boutons en relief
  background: '#F2F6F4', // fond des écrans
  surfaceVariant: '#E7F0EC', // fond des zones secondaires
  text: '#13231D', // texte principal
  textSecondary: '#4A5C55', // texte moins important
  border: '#DCE7E1', // traits fins, contour des cartes
  outline: '#7F948B', // contour des champs de saisie (assez marqué pour bien les voir)
  night: '#022C22', // fond sombre : connexion, grande carte des chiffres
  nightMid: '#064E3B',
  onNightSecondary: '#A7F3D0',
  // Fonds des éléments « surélevés » (du moins au plus haut)
  elevation1: '#F1F6F3',
  elevation2: '#ECF3EF',
  elevation3: '#E7F0EB',
  elevation4: '#E5EEE9',
  elevation5: '#E1ECE6',
};

/** Le type « Palette » oblige chaque thème à définir exactement les mêmes couleurs. */
export type Palette = typeof vertLight;

const vertDark: Palette = {
  ...sharedDark,
  primary: '#34D399',
  onPrimary: '#022C22',
  primaryContainer: '#065F46',
  onPrimaryContainer: '#D1FAE5',
  primaryBright: '#6EE7B7',
  primaryDeep: '#022C22',
  background: '#08130F',
  surface: '#0F1F19',
  surfaceVariant: '#16291F',
  text: '#E8F3EE',
  textSecondary: '#9DB5AB',
  border: '#1F3A2F',
  outline: '#5E7D70',
  night: '#020F0B',
  nightMid: '#053D2E',
  onNightSecondary: '#A7F3D0',
  elevation1: '#122219',
  elevation2: '#15271D',
  elevation3: '#182C21',
  elevation4: '#1A2F23',
  elevation5: '#1D3326',
};

// ---------- Thème VIOLET (la charte d'Ernest) ----------

const violetLight: Palette = {
  ...sharedLight,
  primary: '#7138D9',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EDE5FC',
  onPrimaryContainer: '#2E1468',
  primaryBright: '#A52BFF',
  primaryDeep: '#4B1FA8',
  success: '#059669',
  background: '#F7F4FD',
  surfaceVariant: '#F0EBFA',
  text: '#28134F',
  textSecondary: '#6E6188',
  border: '#E6DFF5',
  outline: '#958AB8',
  night: '#160D35',
  nightMid: '#35166F',
  onNightSecondary: '#D9CCF7',
  elevation1: '#F6F2FD',
  elevation2: '#F2EDFC',
  elevation3: '#EFE8FB',
  elevation4: '#EDE6FA',
  elevation5: '#EAE2F9',
};

const violetDark: Palette = {
  ...sharedDark,
  primary: '#B79CFF',
  onPrimary: '#21104F',
  primaryContainer: '#3E2384',
  onPrimaryContainer: '#EDE5FC',
  primaryBright: '#C084FC',
  primaryDeep: '#2E1468',
  background: '#110A24',
  surface: '#1B1236',
  surfaceVariant: '#261A49',
  text: '#F4EFFF',
  textSecondary: '#B9ACD9',
  border: '#33275C',
  outline: '#8273AE',
  night: '#0B0619',
  nightMid: '#2A1260',
  onNightSecondary: '#D9CCF7',
  elevation1: '#1E1440',
  elevation2: '#22174A',
  elevation3: '#261A52',
  elevation4: '#281C56',
  elevation5: '#2B1E5C',
};

// ---------- Thème ORANGÉ ----------

const orangeLight: Palette = {
  ...sharedLight,
  primary: '#C2410C', // orange brûlé : assez foncé pour un texte blanc bien lisible
  onPrimary: '#FFFFFF',
  primaryContainer: '#FFEDD5',
  onPrimaryContainer: '#7C2D12',
  primaryBright: '#F97316',
  primaryDeep: '#7C2D12',
  background: '#FBF6F2',
  surfaceVariant: '#F6ECE4',
  text: '#2A160C',
  textSecondary: '#6B5546',
  border: '#EFE1D6',
  outline: '#A08A7B',
  night: '#2A0E04',
  nightMid: '#7C2D12',
  onNightSecondary: '#FED7AA',
  elevation1: '#FBF3EE',
  elevation2: '#F8EEE7',
  elevation3: '#F5E9E0',
  elevation4: '#F3E6DD',
  elevation5: '#F0E2D8',
};

const orangeDark: Palette = {
  ...sharedDark,
  primary: '#FB923C',
  onPrimary: '#431407',
  primaryContainer: '#7C2D12',
  onPrimaryContainer: '#FFEDD5',
  primaryBright: '#FDBA74',
  primaryDeep: '#431407',
  background: '#140A05',
  surface: '#1F120A',
  surfaceVariant: '#2B1A0F',
  text: '#FBEFE6',
  textSecondary: '#C9AE9C',
  border: '#3D2615',
  outline: '#8E6F5A',
  night: '#0D0502',
  nightMid: '#4A1A08',
  onNightSecondary: '#FED7AA',
  elevation1: '#24150C',
  elevation2: '#28180E',
  elevation3: '#2C1B10',
  elevation4: '#2F1D11',
  elevation5: '#331F12',
};

/** Toutes les palettes : palettes[thème][mode]. */
export const palettes: Record<ThemeColor, { light: Palette; dark: Palette }> = {
  vert: { light: vertLight, dark: vertDark },
  violet: { light: violetLight, dark: violetDark },
  orange: { light: orangeLight, dark: orangeDark },
};

/** Les couleurs des documents (factures, reçus, rapports PDF) : le vert de la marque. */
export const palette = palettes.vert;

// ---------- Le relief ----------

/** Un bouton en relief : son dégradé, sa tranche (le dessous), la couleur du texte. */
export type ButtonLook = { gradient: string; edge: string; text: string; border?: string };

/** Ce qui est pareil dans tous les thèmes : reflets, bouton rouge, tranches des alertes. */
const shine = {
  heroShine:
    'radial-gradient(circle at 90% 0%, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 55%)',
  buttonShine: 'linear-gradient(180deg, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0) 100%)',
};
const darkShine = {
  heroShine:
    'radial-gradient(circle at 90% 0%, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0) 55%)',
  buttonShine: 'linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 100%)',
};
const dangerButton: ButtonLook = {
  gradient: 'linear-gradient(180deg, #EF4444 0%, #DC2626 50%, #B91C1C 100%)',
  edge: '#7F1D1D',
  text: '#FFFFFF',
};
const amberButton: ButtonLook = {
  gradient: 'linear-gradient(180deg, #FBBF24 0%, #F59E0B 100%)',
  edge: '#B45309',
  text: '#1F2937',
};
const lightEdges = { danger: '#FCA5A5', warning: '#FCD34D', ok: '#6EE7B7' };
const darkEdges = { danger: '#450A0A', warning: '#3B2504', ok: '#022C22' };

const vertLightEffects = {
  ...shine,
  /** La grande carte des chiffres, et le fond des écrans de connexion */
  heroGradient: 'linear-gradient(135deg, #059669 0%, #064E3B 55%, #022C22 100%)',
  authGradient: 'linear-gradient(180deg, #047857 0%, #064E3B 45%, #022C22 100%)',
  heroEdge: '#011A14',
  /** La tranche sous les cartes (elles semblent posées, en relief) */
  cardEdge: '#C9DCD2',
  /** Le bouton du menu de l'écran affiché */
  navActiveGradient: 'linear-gradient(180deg, #10B981 0%, #047857 100%)',
  navActiveEdge: '#064E3B',
  /** La tranche des petites étiquettes et des encadrés */
  chipEdge: { ...lightEdges, neutral: '#C9DCD2' },
  noticeEdge: { error: '#FECACA', info: '#A7F3D0' },
  button: {
    primary: {
      gradient: 'linear-gradient(180deg, #059669 0%, #047857 55%, #065F46 100%)',
      edge: '#064E3B',
      text: '#FFFFFF',
    },
    accent: amberButton,
    danger: dangerButton,
    outline: {
      gradient: 'linear-gradient(180deg, #FFFFFF 0%, #F1F7F4 100%)',
      edge: '#C9DCD2',
      text: '#047857',
      border: '#C9DCD2',
    },
  } as Record<'primary' | 'accent' | 'danger' | 'outline', ButtonLook>,
};

export type Effects = typeof vertLightEffects;

const vertDarkEffects: Effects = {
  ...darkShine,
  heroGradient: 'linear-gradient(135deg, #047857 0%, #053D2E 55%, #020F0B 100%)',
  authGradient: 'linear-gradient(180deg, #065F46 0%, #053D2E 45%, #020F0B 100%)',
  heroEdge: '#000805',
  cardEdge: '#06100C',
  navActiveGradient: vertLightEffects.navActiveGradient,
  navActiveEdge: '#022C22',
  chipEdge: { ...darkEdges, neutral: '#06100C' },
  noticeEdge: { error: '#450A0A', info: '#022C22' },
  button: {
    primary: vertLightEffects.button.primary,
    accent: amberButton,
    danger: dangerButton,
    outline: {
      gradient: 'linear-gradient(180deg, #1A3328 0%, #142A20 100%)',
      edge: '#06100C',
      text: '#6EE7B7',
      border: '#2A4A3C',
    },
  },
};

const violetLightEffects: Effects = {
  ...shine,
  heroGradient: 'linear-gradient(135deg, #7138D9 0%, #35166F 58%, #160D35 100%)',
  authGradient: 'linear-gradient(180deg, #7138D9 0%, #35166F 42%, #160D35 100%)',
  heroEdge: '#0B0619',
  cardEdge: '#DCD0F5',
  navActiveGradient: 'linear-gradient(180deg, #A52BFF 0%, #7138D9 100%)',
  navActiveEdge: '#4B1FA8',
  chipEdge: { ...lightEdges, neutral: '#DCD0F5' },
  noticeEdge: { error: '#FECACA', info: '#D9CCF7' },
  button: {
    primary: {
      gradient: 'linear-gradient(180deg, #8B5CF6 0%, #7138D9 55%, #5B2BC0 100%)',
      edge: '#3B1A8C',
      text: '#FFFFFF',
    },
    accent: amberButton,
    danger: dangerButton,
    outline: {
      gradient: 'linear-gradient(180deg, #FFFFFF 0%, #F6F2FE 100%)',
      edge: '#DCD0F5',
      text: '#7138D9',
      border: '#DCD0F5',
    },
  },
};

const violetDarkEffects: Effects = {
  ...darkShine,
  heroGradient: 'linear-gradient(135deg, #5B2BC0 0%, #2A1260 58%, #0B0619 100%)',
  authGradient: 'linear-gradient(180deg, #5B2BC0 0%, #2A1260 42%, #0B0619 100%)',
  heroEdge: '#05020D',
  cardEdge: '#0E0820',
  navActiveGradient: violetLightEffects.navActiveGradient,
  navActiveEdge: '#2E1468',
  chipEdge: { ...darkEdges, neutral: '#0E0820' },
  noticeEdge: { error: '#450A0A', info: '#1E1440' },
  button: {
    primary: violetLightEffects.button.primary,
    accent: amberButton,
    danger: dangerButton,
    outline: {
      gradient: 'linear-gradient(180deg, #2A1D52 0%, #22174A 100%)',
      edge: '#140C2E',
      text: '#D7C8FF',
      border: '#4A3A85',
    },
  },
};

/** Dans le thème orangé, les actions importantes sont bleu-vert (pour ne pas se confondre). */
const tealButton: ButtonLook = {
  gradient: 'linear-gradient(180deg, #0D9488 0%, #0F766E 55%, #115E59 100%)',
  edge: '#134E4A',
  text: '#FFFFFF',
};

const orangeLightEffects: Effects = {
  ...shine,
  heroGradient: 'linear-gradient(135deg, #EA580C 0%, #7C2D12 58%, #2A0E04 100%)',
  authGradient: 'linear-gradient(180deg, #EA580C 0%, #7C2D12 45%, #2A0E04 100%)',
  heroEdge: '#1A0802',
  cardEdge: '#EAD5C6',
  navActiveGradient: 'linear-gradient(180deg, #F97316 0%, #C2410C 100%)',
  navActiveEdge: '#7C2D12',
  chipEdge: { ...lightEdges, neutral: '#EAD5C6' },
  noticeEdge: { error: '#FECACA', info: '#FED7AA' },
  button: {
    primary: {
      gradient: 'linear-gradient(180deg, #EA580C 0%, #C2410C 55%, #9A3412 100%)',
      edge: '#7C2D12',
      text: '#FFFFFF',
    },
    accent: tealButton,
    danger: dangerButton,
    outline: {
      gradient: 'linear-gradient(180deg, #FFFFFF 0%, #FDF5EF 100%)',
      edge: '#EAD5C6',
      text: '#C2410C',
      border: '#EAD5C6',
    },
  },
};

const orangeDarkEffects: Effects = {
  ...darkShine,
  heroGradient: 'linear-gradient(135deg, #C2410C 0%, #4A1A08 58%, #0D0502 100%)',
  authGradient: 'linear-gradient(180deg, #C2410C 0%, #4A1A08 45%, #0D0502 100%)',
  heroEdge: '#050100',
  cardEdge: '#0D0603',
  navActiveGradient: orangeLightEffects.navActiveGradient,
  navActiveEdge: '#431407',
  chipEdge: { ...darkEdges, neutral: '#0D0603' },
  noticeEdge: { error: '#450A0A', info: '#2B1A0F' },
  button: {
    primary: orangeLightEffects.button.primary,
    accent: tealButton,
    danger: dangerButton,
    outline: {
      gradient: 'linear-gradient(180deg, #33200F 0%, #2A1A0C 100%)',
      edge: '#120804',
      text: '#FDBA74',
      border: '#5A3A22',
    },
  },
};

/** Tous les reliefs : themeEffects[thème][mode]. */
export const themeEffects: Record<ThemeColor, { light: Effects; dark: Effects }> = {
  vert: { light: vertLightEffects, dark: vertDarkEffects },
  violet: { light: violetLightEffects, dark: violetDarkEffects },
  orange: { light: orangeLightEffects, dark: orangeDarkEffects },
};

// ---------- Tailles (communes à tous les thèmes) ----------

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
  tabletMinSide: 600, // plus petit côté d'une tablette (un téléphone tourné n'y arrive pas)
  contentMaxWidth: 960, // largeur maximale du contenu, pour rester lisible sur grand écran
  sideNavWidth: 248, // largeur du menu sur le côté
} as const;
