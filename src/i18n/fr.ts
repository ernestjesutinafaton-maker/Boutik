/**
 * Tous les textes de l'application, en français.
 *
 * Les écrans n'écrivent jamais de texte en dur : ils demandent une « clé »
 * (par exemple t('nav.sell') → « Caisse »).
 * Pour ajouter l'anglais plus tard : créer « en.ts » avec exactement les mêmes clés.
 *
 * {{step}}, {{version}}… sont des « trous » remplis au moment de l'affichage.
 */
export const fr = {
  app: {
    name: 'Boutik',
    tagline: 'Stock · Caisse · Crédit',
  },
  nav: {
    sell: 'Caisse',
    products: 'Produits',
    customers: 'Clients',
    dashboard: 'Tableau de bord',
    dashboardShort: 'Bilan',
    more: 'Plus',
  },
  comingSoon: {
    title: 'Bientôt disponible',
    plannedStep: "Prévu à l'étape {{step}} du plan",
  },
  sell: {
    description:
      'Vendre en quelques touches : chercher ou scanner un produit, remplir le panier, encaisser.',
    demoTitle: 'Essai des composants',
    demoHelp: 'Tape un montant, par exemple 32.000 : il s’affiche aussitôt au bon format.',
    amountLabel: 'Montant reçu',
    amountInvalid: 'Montant invalide : le FCFA n’a pas de centimes.',
    cashIn: 'Encaisser',
    newSale: 'Nouvelle vente',
    cancel: 'Annuler',
  },
  products: {
    description: 'Fiches produits, unités (sac, kilo, carton…), codes-barres, prix et stock.',
  },
  customers: {
    description: 'Fiches clients, carnet de dettes, remboursements et relances WhatsApp.',
  },
  dashboard: {
    description: 'Ventes, bénéfice réel, valeur du stock, dettes et alertes.',
  },
  more: {
    appearance: 'Apparence',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    themeSystem: 'Auto',
    themeHelp:
      'Le mode clair est conseillé en plein soleil. « Auto » suit le réglage du téléphone.',
    upcoming: 'À venir',
    users: 'Utilisateurs et codes PIN',
    cashSession: 'Caisse du jour',
    history: 'Historique des actions',
    shopSettings: 'Paramètres de la boutique',
    export: 'Export Excel / CSV',
    version: 'Version {{version}}',
  },
} as const;
