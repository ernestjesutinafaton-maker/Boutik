import { frCustomers } from './fr-customers';
import { frProductErrors, frProducts } from './fr-products';
import { frSales, frSalesErrors } from './fr-sales';
import { frTeam } from './fr-team';

/**
 * Tous les textes de l'application, en français.
 * Les textes de chaque grande partie sont rangés dans leur propre fichier (fr-team.ts…)
 * et rassemblés ici.
 *
 * Les écrans n'écrivent jamais de texte en dur : ils demandent une « clé »
 * (par exemple t('nav.sell') → « Caisse »).
 * Pour ajouter l'anglais plus tard : créer « en.ts » avec exactement les mêmes clés.
 *
 * {{step}}, {{version}}… sont des « trous » remplis au moment de l'affichage.
 */
export const fr = {
  common: {
    back: 'Retour',
    save: 'Enregistrer',
    cancel: 'Annuler',
    add: 'Ajouter',
    edit: 'Modifier',
    confirm: 'Confirmer',
    close: 'Fermer',
    search: 'Rechercher',
    none: 'Aucun',
    yes: 'Oui',
    no: 'Non',
    forbidden: 'Tu n’as pas le droit d’utiliser cette fonction.',
    notFound: 'Élément introuvable.',
    saved: 'Enregistré.',
  },
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
    users: 'Équipe et codes PIN',
    usersHelp: 'Rôles et codes PIN des personnes de la boutique',
    salesHelp: 'Retrouver, renvoyer ou réimprimer une facture',
    printerHelp: 'Imprimante Bluetooth 58 ou 80 mm',
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
    device: 'Cet appareil : {{name}} (n° {{number}})',
    deviceNotRegistered: 'Cet appareil : {{name}} (pas encore enregistré)',
    signOut: 'Se déconnecter',
    signOutConfirmTitle: 'Se déconnecter ?',
    signOutConfirmText:
      'Les données de la boutique seront effacées de cet appareil. Il faudra internet pour te reconnecter.',
    signOutBlockedTitle: 'Pas encore possible',
    signOutBlockedText:
      '{{count}} opération(s) n’ont pas encore été envoyées au serveur. Reconnecte-toi à internet, attends que tout soit envoyé, puis réessaie.',
    cancel: 'Annuler',
    ok: 'J’ai compris',
  },
  sync: {
    online: 'En ligne',
    offline: 'Hors ligne',
    syncing: 'Synchronisation…',
    firstSync: 'Première synchronisation…',
    allSynced: 'tout est à jour',
    pending_one: '{{count}} opération en attente',
    pending_other: '{{count}} opérations en attente',
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
    memberNameTooShort: 'Le nom doit faire au moins 2 caractères.',
    memberNameTooLong: 'Le nom doit faire au plus 60 caractères.',
    rolesRequired: 'Choisis au moins un rôle.',
    discountPercentInvalid: 'Entre un pourcentage entre 0 et 100, ou laisse vide.',
    pinFormat: 'Le code PIN doit contenir exactement 4 chiffres.',
    pinsDontMatch: 'Les deux codes PIN ne sont pas identiques.',
    ...frProductErrors,
    ...frSalesErrors,
  },
  ...frTeam,
  ...frProducts,
  ...frSales,
  ...frCustomers,
} as const;
