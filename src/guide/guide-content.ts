import type { Href } from 'expo-router';

import type { Permission } from '@/domain/permissions';

/**
 * Le guide des boutons : chaque écran de Boutik et ce que fait chacun de ses boutons.
 * Les libellés sont ceux affichés dans l'appli : si un bouton change de nom, le changer ici aussi.
 */

export type GuideButton = {
  /** Le texte du bouton, tel qu'il apparaît à l'écran */
  label: string;
  icon: string;
  /** Ce que fait le bouton, en une ou deux phrases simples */
  text: string;
};

export type GuideSection = {
  id: string;
  title: string;
  icon: string;
  /** À quoi sert l'écran */
  intro: string;
  /** L'écran à ouvrir pour essayer (absent : pas de lien) */
  href?: Href;
  /** Le droit nécessaire pour ouvrir l'écran (absent : tout le monde) */
  permission?: Permission;
  buttons: GuideButton[];
};

export const GUIDE: GuideSection[] = [
  {
    id: 'sell',
    title: 'Vendre',
    icon: 'cart',
    intro:
      'Le premier onglet : la caisse enregistreuse. On ajoute les produits au panier, puis on encaisse.',
    href: '/',
    permission: 'sale.create',
    buttons: [
      {
        label: 'Rechercher / scanner',
        icon: 'barcode-scan',
        text: 'Tape le nom d’un produit, ou touche le code-barres pour le scanner avec la caméra. Touche un produit pour l’ajouter au panier.',
      },
      {
        label: 'Choisir un client',
        icon: 'account',
        text: 'Obligatoire pour vendre à crédit : la dette sera notée dans le carnet de ce client.',
      },
      {
        label: 'Faire une remise',
        icon: 'sale',
        text: 'Baisse le total, en francs ou en pourcentage. Le vendeur est limité par le maximum fixé dans les réglages.',
      },
      {
        label: 'Vider',
        icon: 'cart-remove',
        text: 'Retire tout le panier, sans rien enregistrer.',
      },
      {
        label: 'Encaisser',
        icon: 'cash',
        text: 'Ouvre le paiement : espèces, Mobile Money ou crédit, ou un mélange. La monnaie à rendre est calculée. Le stock baisse tout de suite.',
      },
      {
        label: 'Ventes et factures du jour',
        icon: 'receipt-text',
        text: 'La liste des ventes, pour revoir une facture, la partager ou la supprimer.',
      },
    ],
  },
  {
    id: 'sale',
    title: 'Une vente (facture)',
    icon: 'receipt-text',
    intro: 'Ouvre une vente depuis « Ventes et factures du jour ».',
    href: '/sale',
    permission: 'sale.create',
    buttons: [
      {
        label: 'Partager le PDF',
        icon: 'file-pdf-box',
        text: 'Fabrique la facture en PDF, même sans internet, et l’envoie par WhatsApp, e-mail…',
      },
      {
        label: 'Imprimer (A4) / ticket',
        icon: 'printer',
        text: 'Imprime la facture sur une imprimante normale ou sur une petite imprimante à tickets.',
      },
      {
        label: 'WhatsApp',
        icon: 'whatsapp',
        text: 'Envoie la facture en message au numéro du client.',
      },
      {
        label: 'Reprendre des articles',
        icon: 'keyboard-return',
        text: 'Le client rapporte une partie des articles : ils reviennent dans le stock et l’argent est rendu ou la dette baisse.',
      },
      {
        label: 'Supprimer la vente',
        icon: 'delete-outline',
        text: 'Annule toute la vente (avec une raison obligatoire). Le stock revient. La vente reste visible dans « ventes supprimées ».',
      },
    ],
  },
  {
    id: 'products',
    title: 'Produits et stock',
    icon: 'package-variant',
    intro:
      'Tous les produits, avec leur stock. Les puces rouges ou orange signalent une rupture, un stock bas ou un stock à vérifier.',
    href: '/products',
    buttons: [
      {
        label: 'Nouveau produit',
        icon: 'plus',
        text: 'Réservé au propriétaire. Nom, photo, code-barres, unités (pièce, mètre, carton…), prix de vente et prix d’achat de chaque unité. Le bénéfice par unité s’affiche pendant la saisie.',
      },
      {
        label: 'Recevoir de la marchandise',
        icon: 'truck-delivery',
        text: 'Note ce qui arrive du fournisseur : quantité, prix d’achat, date de péremption. Le stock monte.',
      },
      {
        label: 'Alertes',
        icon: 'alert',
        text: 'Les produits en rupture, presque finis, périmés ou bientôt périmés.',
      },
      {
        label: 'Inventaire',
        icon: 'clipboard-list',
        text: 'Compter ce qu’il y a vraiment dans la boutique, pour corriger le stock.',
      },
      {
        label: 'Déclarer une perte',
        icon: 'delete-alert',
        text: 'Casse, produit périmé, vol : le stock baisse et la perte compte dans le bénéfice. Impossible de déclarer plus que le stock.',
      },
      {
        label: 'Modifier / Supprimer (fiche produit)',
        icon: 'pencil',
        text: 'Réservé au propriétaire. Supprimer cache le produit, mais garde son historique.',
      },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventaire',
    icon: 'clipboard-list',
    intro:
      'Le compteur compte sans voir le stock calculé (pour un comptage honnête). Le responsable valide ensuite.',
    href: '/inventory',
    permission: 'stock.count',
    buttons: [
      {
        label: 'Commencer un inventaire',
        icon: 'clipboard-plus',
        text: 'Ouvre un nouveau comptage. Plusieurs téléphones peuvent compter en même temps.',
      },
      {
        label: 'Ajouter / Remplacer',
        icon: 'counter',
        text: 'Pour un produit : « Ajouter » additionne au comptage (un rayon, puis un autre) ; « Remplacer » corrige le chiffre.',
      },
      {
        label: 'Valider l’inventaire',
        icon: 'check-decagram',
        text: 'Les écarts corrigent le stock. La valeur des écarts au prix d’achat est affichée.',
      },
      {
        label: 'Abandonner',
        icon: 'close',
        text: 'Le comptage est ignoré, le stock ne change pas.',
      },
      {
        label: 'Télécharger en PDF / Excel',
        icon: 'file-pdf-box',
        text: 'Le rapport du comptage : stock attendu, compté, écart et sa valeur.',
      },
    ],
  },
  {
    id: 'customers',
    title: 'Clients et crédit',
    icon: 'account-group',
    intro: 'Le carnet de crédit : qui doit combien, et depuis quand.',
    href: '/customers',
    buttons: [
      {
        label: 'Nouveau client',
        icon: 'account-plus',
        text: 'Nom, téléphone et limite de crédit (le montant qu’il ne peut pas dépasser).',
      },
      {
        label: 'Encaisser un remboursement',
        icon: 'cash-plus',
        text: 'Le client rembourse tout ou une partie : sa dette baisse et un reçu est fait.',
      },
      {
        label: 'Dette ancienne',
        icon: 'notebook',
        text: 'Recopier une dette du vieux cahier, d’avant Boutik.',
      },
      {
        label: 'Relancer par WhatsApp',
        icon: 'whatsapp',
        text: 'Envoie au client un message poli avec le montant dû.',
      },
      {
        label: 'Supprimer ce client',
        icon: 'delete-outline',
        text: 'S’il doit encore de l’argent, seul le propriétaire peut le supprimer : la dette est alors effacée et notée dans le journal.',
      },
    ],
  },
  {
    id: 'cash',
    title: 'Caisse du jour',
    icon: 'cash-register',
    intro: 'L’argent du jour : ce qui entre, ce qui sort, et le compte du soir.',
    href: '/cash',
    permission: 'cash.session',
    buttons: [
      {
        label: 'Ouvrir la caisse',
        icon: 'lock-open',
        text: 'Le matin : compte les espèces de départ (le fond de caisse).',
      },
      {
        label: 'Dépense ou sortie',
        icon: 'cash-minus',
        text: 'Carburant, transport, loyer, retrait du propriétaire… L’argent sorti est noté avec sa raison.',
      },
      {
        label: 'Clôturer la journée',
        icon: 'lock-check',
        text: 'Le soir : compte l’argent de chaque mode de paiement. Boutik montre l’écart avec ce qui était attendu et garde une fiche.',
      },
    ],
  },
  {
    id: 'dashboard',
    title: 'Tableau de bord',
    icon: 'view-dashboard',
    intro:
      'Le résumé : ventes du jour, de la semaine, du mois, bénéfice, dettes et alertes. Chaque rôle voit ce qui le concerne.',
    href: '/dashboard',
    buttons: [
      {
        label: 'Voir les alertes',
        icon: 'alert',
        text: 'Ouvre la liste des produits à racheter ou périmés.',
      },
      {
        label: 'Voir tous les clients',
        icon: 'account-group',
        text: 'Ouvre le carnet de crédit, les plus gros débiteurs en premier.',
      },
    ],
  },
  {
    id: 'reports',
    title: 'Rapports et comptes',
    icon: 'archive-clock',
    intro: 'Les fiches des journées clôturées et des comptes, et les rapports à télécharger.',
    href: '/report',
    permission: 'reports.account',
    buttons: [
      {
        label: 'Faire un compte',
        icon: 'calculator-variant',
        text: 'À tout moment : le bilan complet depuis le compte précédent (ventes, dépenses, pertes, bénéfice, stock, dettes). La fiche est gardée et se télécharge en PDF.',
      },
      {
        label: 'Rapports Excel et PDF',
        icon: 'file-excel',
        text: 'Dans « Plus » : ventes, stock, inventaires, clients, dépenses, sur la période choisie.',
      },
    ],
  },
  {
    id: 'team',
    title: 'Équipe et réglages',
    icon: 'account-key',
    intro: 'Réservé au propriétaire.',
    href: '/team',
    permission: 'team.manage',
    buttons: [
      {
        label: 'Utilisateurs',
        icon: 'account-key',
        text: 'Ajoute un vendeur, un caissier, un gérant… avec un code PIN. Chacun ne voit que ce que son rôle permet.',
      },
      {
        label: 'Réglages',
        icon: 'store-cog',
        text: 'Nom de la boutique, téléphone, modes de paiement, remise maximum, pied de facture.',
      },
      {
        label: 'Journal',
        icon: 'history',
        text: 'Qui a fait quoi et quand : changements de prix, suppressions, remises…',
      },
      {
        label: 'Effacer les données de test',
        icon: 'delete-forever',
        text: 'Pendant l’essai : vide la boutique (produits, ventes, clients) pour repartir à zéro.',
      },
    ],
  },
];
