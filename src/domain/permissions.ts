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
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'sale.create', // vendre et encaisser
  'sale.cancel', // annuler une vente, faire un retour
  'sale.discount.unlimited', // accorder une remise au-delà de la limite des vendeurs
  'credit.repayment', // enregistrer un remboursement de crédit
  'customers.edit', // créer et modifier les clients
  'cash.session', // ouvrir et fermer la caisse du jour
  'cash.expense', // enregistrer une dépense
  'cash.withdrawal', // retrait du propriétaire, ajout d'argent dans la caisse
  'stock.receive', // recevoir la marchandise, déclarer une perte
  'stock.count', // compter le stock (inventaire « à l'aveugle »)
  'stock.adjust', // voir le stock calculé, valider l'inventaire, ajuster le stock
  'stock.view_costs', // voir les prix d'achat
  'catalog.edit', // créer et modifier les produits, unités, catégories
  'prices.edit', // modifier les prix de vente
  'expired.force', // forcer la vente d'un produit périmé
  'reports.account', // faire un « compte », voir les archives
  'reports.profit', // voir les bénéfices et le tableau de bord complet
  'team.manage', // gérer l'équipe et les codes PIN
  'settings.manage', // modifier les paramètres de la boutique
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  // Le gérant remplace le propriétaire, sauf les bénéfices, l'équipe et les paramètres
  manager: PERMISSIONS.filter(
    (permission) => !['reports.profit', 'team.manage', 'settings.manage'].includes(permission)
  ),
  cashier: ['sale.create', 'credit.repayment', 'customers.edit', 'cash.session', 'cash.expense'],
  seller: ['sale.create', 'credit.repayment', 'customers.edit'],
  stock_manager: [
    'stock.receive',
    'stock.count',
    'stock.adjust',
    'stock.view_costs',
    'catalog.edit',
  ],
  stock_counter: ['stock.count'],
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
