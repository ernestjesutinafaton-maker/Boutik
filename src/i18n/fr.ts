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
  auth: {
    signInTitle: 'Connexion',
    signInSubtitle: 'Connecte-toi pour retrouver ta boutique.',
    signUpTitle: 'Créer un compte',
    signUpSubtitle: 'Le compte du propriétaire de la boutique.',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    passwordConfirmation: 'Confirme le mot de passe',
    showPassword: 'Afficher ou cacher le mot de passe',
    signIn: 'Se connecter',
    signUp: 'Créer mon compte',
    noAccount: 'Pas encore de compte ? Créer un compte',
    haveAccount: 'Déjà un compte ? Se connecter',
    firstTimeOnline:
      'La toute première connexion demande internet. Ensuite, Boutik fonctionne aussi sans réseau.',
    checkEmail:
      'Compte créé ! Ouvre l’e-mail que tu viens de recevoir pour confirmer ton adresse, puis connecte-toi.',
  },
  createShop: {
    title: 'Créons ta boutique',
    subtitle: 'Quelques informations, et c’est parti.',
    shopName: 'Nom de la boutique',
    shopNamePlaceholder: 'Ex. Boutique Chez Maman',
    ownerName: 'Ton nom',
    country: 'Pays',
    chooseCountry: 'Choisis ton pays',
    currency: 'Monnaie : {{currency}}',
    paymentMethods: 'Modes de paiement : {{list}}',
    paymentMethodsHelp: 'Tu pourras les modifier plus tard dans les paramètres.',
    submit: 'Créer ma boutique',
    wrongAccount: 'Ce n’est pas ton compte ? Se déconnecter',
  },
  shopError: {
    title: 'Impossible de charger ta boutique',
    description: 'Vérifie ta connexion internet, puis réessaie.',
    retry: 'Réessayer',
  },
  account: {
    title: 'Mon compte',
    shop: 'Boutique : {{name}}',
    signOut: 'Se déconnecter',
    signOutConfirmTitle: 'Se déconnecter ?',
    signOutConfirmText: 'Il faudra internet pour te reconnecter.',
    cancel: 'Annuler',
  },
  errors: {
    emailRequired: 'Entre ton adresse e-mail.',
    emailInvalid: 'Cette adresse e-mail n’est pas valide.',
    passwordRequired: 'Entre ton mot de passe.',
    passwordTooShort: 'Le mot de passe doit faire au moins 8 caractères.',
    passwordsDontMatch: 'Les deux mots de passe ne sont pas identiques.',
    shopNameTooShort: 'Le nom de la boutique doit faire au moins 2 caractères.',
    shopNameTooLong: 'Le nom de la boutique doit faire au plus 100 caractères.',
    ownerNameTooShort: 'Ton nom doit faire au moins 2 caractères.',
    ownerNameTooLong: 'Ton nom doit faire au plus 60 caractères.',
    countryRequired: 'Choisis un pays.',
    invalidCredentials: 'E-mail ou mot de passe incorrect.',
    emailAlreadyUsed: 'Un compte existe déjà avec cette adresse e-mail : connecte-toi.',
    weakPassword: 'Ce mot de passe est trop facile à deviner : choisis-en un plus long.',
    emailNotConfirmed: 'Confirme d’abord ton adresse : ouvre l’e-mail reçu à l’inscription.',
    tooManyAttempts: 'Trop de tentatives. Attends quelques minutes, puis réessaie.',
    signupDisabled: 'Les inscriptions sont fermées pour le moment.',
    network: 'Pas de connexion internet. Vérifie ton réseau, puis réessaie.',
    unknown: 'Une erreur inattendue est survenue. Réessaie dans un instant.',
  },
} as const;
