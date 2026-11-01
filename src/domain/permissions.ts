/**
 * Les rôles de l'équipe et « qui a le droit de faire quoi ».
 *
 * Une personne peut avoir PLUSIEURS rôles : ses droits sont la réunion des droits
 * de tous ses rôles (ex. vendeur + caissier). Le propriétaire a tous les droits.
 */

export const ROLES = [
  'owner',
  'manager',
  'cashier',
  'seller',
  'stock_manager',
  'stock_counter',
  'delivery',
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'sale.create', // vendre et encaisser
  'sale.cancel', // annuler une vente, faire un retour, modifier les ventes des autres
  'sale.edit_late', // modifier une vente après le délai de retour (propriétaire seul)
  'sale.discount.unlimited', // accorder une remise au-delà de la limite des vendeurs
  'credit.repayment', // enregistrer un remboursement de crédit
  'credit.write_off', // effacer une dette qui ne sera jamais payée
  'customers.edit', // créer et modifier les clients
  'cash.session', // ouvrir et fermer la caisse du jour
  'cash.expense', // enregistrer une dépense
  'cash.withdrawal', // retrait du propriétaire, ajout d'argent dans la caisse
  'stock.receive', // recevoir la marchandise, déclarer une perte
  'stock.count', // compter le stock (inventaire « à l'aveugle »)
  'stock.adjust', // voir le stock calculé, valider l'inventaire, ajuster le stock
  'stock.view_costs', // voir les prix d'achat
  'catalog.edit', // créer, modifier et supprimer les produits, unités, rayons (propriétaire seul)
  'prices.edit', // fixer les prix de vente et d'achat (propriétaire seul)
  'expired.force', // forcer la vente d'un produit périmé
  'reports.account', // faire un « compte », voir les archives
  'reports.profit', // voir les bénéfices et le tableau de bord complet
  'team.manage', // gérer l'équipe et les codes PIN
  'settings.manage', // modifier les paramètres de la boutique
  'data.delete', // supprimer un client, un produit, une personne, une vente (propriétaire seul)
  'delivery.create', // créer, modifier, confier ou annuler une livraison
  'delivery.handle', // prendre une livraison, la livrer, encaisser, noter ses dépenses (livreur)
  'delivery.handover', // recevoir à la caisse l'argent encaissé par un livreur
  'delivery.review', // rembourser ou refuser les dépenses des livreurs
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  // Le gérant remplace le propriétaire, sauf les bénéfices, l'équipe, les paramètres
  // l'effacement des dettes, les suppressions, le catalogue avec ses prix, et les
  // modifications de ventes après le délai de retour
  manager: PERMISSIONS.filter(
    (permission) =>
      ![
        'reports.profit',
        'team.manage',
        'settings.manage',
        'credit.write_off',
        'data.delete',
        'catalog.edit',
        'prices.edit',
        'sale.edit_late',
      ].includes(permission)
  ),
  cashier: [
    'sale.create',
    'credit.repayment',
    'customers.edit',
    'cash.session',
    'cash.expense',
    'delivery.create',
    'delivery.handover',
  ],
  seller: ['sale.create', 'credit.repayment', 'customers.edit', 'delivery.create'],
  stock_manager: ['stock.receive', 'stock.count', 'stock.adjust', 'stock.view_costs'],
  stock_counter: ['stock.count'],
  // Livreur : prend et livre les commandes, encaisse à la livraison (remboursement de la dette
  // du client) et note ses dépenses avec la photo du reçu
  delivery: ['credit.repayment', 'delivery.handle'],
};

/** Tous les droits d'une personne : la réunion des droits de ses rôles. */
export function permissionsFor(roles: readonly Role[]): Set<Permission> {
  const result = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      result.add(permission);
    }
  }
  return result;
}

/** Vrai si une personne avec ces rôles a ce droit. */
export function can(roles: readonly Role[], permission: Permission): boolean {
  return permissionsFor(roles).has(permission);
}

/**
 * Voir les clients et leurs dettes : utile pour vendre, encaisser un remboursement
 * ou gérer la boutique — pas pour les rôles du stock seulement (compteur, magasinier).
 */
export function canSeeCustomers(roles: readonly Role[]): boolean {
  const granted = permissionsFor(roles);
  return (
    granted.has('sale.create') ||
    granted.has('customers.edit') ||
    granted.has('credit.repayment') ||
    granted.has('reports.account')
  );
}

/** Voir les livraisons : pour les créer, les livrer, ou suivre l'argent et les dépenses des livreurs. */
export function canSeeDeliveries(roles: readonly Role[]): boolean {
  const granted = permissionsFor(roles);
  return (
    granted.has('delivery.create') ||
    granted.has('delivery.handle') ||
    granted.has('delivery.handover') ||
    granted.has('delivery.review')
  );
}

/**
 * Un livreur « seulement » (sans le droit de vendre) : son premier onglet est « Livraisons »
 * à la place de « Vendre ».
 */
export function isCourierOnly(roles: readonly Role[]): boolean {
  return can(roles, 'delivery.handle') && !can(roles, 'sale.create');
}

/** Vérifie qu'un texte venu de la base est bien un rôle connu. */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * Remise maximale (en %) qu'une personne peut accorder.
 * Sans le droit « remise illimitée » : sa limite personnelle, sinon celle de la boutique.
 */
export function maxDiscountPercent(
  roles: readonly Role[],
  memberLimit: number | null,
  shopLimit: number
): number {
  if (can(roles, 'sale.discount.unlimited')) {
    return 100;
  }
  return memberLimit ?? shopLimit;
}
