import type { Href } from 'expo-router';

import type { IconName } from '@/components/icon-name';

type NavItem = {
  /** Identifiant de l'onglet */
  name: string;
  /** Adresse de l'écran (fichier dans src/app/(tabs)/) */
  href: Href;
  icon: IconName;
  /** Texte du menu sur le côté (grand écran) */
  labelKey: `nav.${string}`;
  /** Texte plus court pour la barre du bas (petit écran) */
  shortLabelKey: `nav.${string}`;
};

/** Les grandes rubriques de l'application, dans l'ordre d'affichage. */
export const NAV_ITEMS = [
  {
    name: 'sell',
    href: '/',
    icon: 'cash-register',
    labelKey: 'nav.sell',
    shortLabelKey: 'nav.sell',
  },
  {
    // À la place de « Caisse » pour le livreur seul (voir visibleNavItems)
    name: 'deliveries',
    href: '/deliveries',
    icon: 'moped',
    labelKey: 'nav.deliveries',
    shortLabelKey: 'nav.deliveries',
  },
  {
    name: 'products',
    href: '/products',
    icon: 'package-variant-closed',
    labelKey: 'nav.products',
    shortLabelKey: 'nav.products',
  },
  {
    name: 'customers',
    href: '/customers',
    icon: 'account-group',
    labelKey: 'nav.customers',
    shortLabelKey: 'nav.customers',
  },
  {
    name: 'dashboard',
    href: '/dashboard',
    icon: 'view-dashboard',
    labelKey: 'nav.dashboard',
    shortLabelKey: 'nav.dashboardShort',
  },
  {
    name: 'more',
    href: '/more',
    icon: 'dots-horizontal',
    labelKey: 'nav.more',
    shortLabelKey: 'nav.more',
  },
] as const satisfies readonly NavItem[];

/**
 * Les rubriques affichées : tout le monde a « Caisse », sauf le livreur seul (sans le droit de
 * vendre), qui a « Livraisons » à la place.
 */
export function visibleNavItems(courierOnly: boolean) {
  return NAV_ITEMS.filter((item) =>
    item.name === 'sell' ? !courierOnly : item.name === 'deliveries' ? courierOnly : true
  );
}
