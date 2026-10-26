import { addDays } from './dates';
import { toBaseQuantity } from './quantity';

/**
 * La boutique de démonstration : 30 produits courants, 30 jours de ventes, des clients
 * à crédit, des dépenses. Tout est calculé à partir d'une « graine » (seed) : avec la même
 * graine, on obtient exactement la même boutique (utile pour les tests et les démonstrations).
 *
 * Ce fichier ne fait que PRÉPARER la liste des opérations ; elles sont ensuite enregistrées
 * avec les vraies fonctions de l'appli (src/demo/load-demo.ts).
 */

export type DemoUnit = { name: string; factor: number; price: number | null };

export type DemoProduct = {
  key: string;
  name: string;
  category: string;
  baseUnit: string;
  allowDecimal: boolean;
  trackExpiry: boolean;
  /** Seuil de stock bas, en unités de base */
  lowStock: number | null;
  /** Unités : la première est l'unité de base (factor 1) ; factor = nombre d'unités de base */
  units: DemoUnit[];
  /** Achat : index de l'unité achetée, son prix, combien d'unités par réception */
  purchase: { unitIndex: number; cost: number; quantity: number };
  /** Popularité (0 = produit qui « dort ») */
  weight: number;
};

const u = (name: string, factor: number, price: number | null): DemoUnit => ({
  name,
  factor,
  price,
});

/** Le catalogue de démonstration (prix en FCFA). */
export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    key: 'riz',
    name: 'Riz parfumé',
    category: 'Alimentation',
    baseUnit: 'kg',
    allowDecimal: true,
    trackExpiry: false,
    lowStock: 40,
    units: [u('kg', 1, 700), u('Sac 25 kg', 25, 16_500), u('Sac 50 kg', 50, 32_000)],
    purchase: { unitIndex: 2, cost: 28_000, quantity: 4 },
    weight: 10,
  },
  {
    key: 'sucre',
    name: 'Sucre en poudre',
    category: 'Alimentation',
    baseUnit: 'kg',
    allowDecimal: true,
    trackExpiry: false,
    lowStock: 20,
    units: [u('kg', 1, 800), u('Sac 50 kg', 50, 37_500)],
    purchase: { unitIndex: 1, cost: 34_000, quantity: 2 },
    weight: 8,
  },
  {
    key: 'huile',
    name: 'Huile végétale',
    category: 'Alimentation',
    baseUnit: 'litre',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: 10,
    units: [u('litre', 1, 1300), u('Bidon 5 L', 5, 6000), u('Bidon 25 L', 25, 28_000)],
    purchase: { unitIndex: 2, cost: 25_000, quantity: 3 },
    weight: 7,
  },
  {
    key: 'farine',
    name: 'Farine de blé',
    category: 'Alimentation',
    baseUnit: 'kg',
    allowDecimal: true,
    trackExpiry: false,
    lowStock: 15,
    units: [u('kg', 1, 600), u('Sac 50 kg', 50, 26_000)],
    purchase: { unitIndex: 1, cost: 23_000, quantity: 2 },
    weight: 4,
  },
  {
    key: 'spaghetti',
    name: 'Spaghetti 500 g',
    category: 'Alimentation',
    baseUnit: 'paquet',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: 20,
    units: [u('paquet', 1, 350), u('Carton 20', 20, 6500)],
    purchase: { unitIndex: 1, cost: 6000, quantity: 6 },
    weight: 6,
  },
  {
    key: 'tomate',
    name: 'Tomate concentrée 70 g',
    category: 'Alimentation',
    baseUnit: 'boîte',
    allowDecimal: false,
    trackExpiry: true,
    lowStock: 30,
    units: [u('boîte', 1, 150), u('Carton 50', 50, 6800)],
    purchase: { unitIndex: 1, cost: 6200, quantity: 4 },
    weight: 8,
  },
  {
    key: 'sardines',
    name: 'Sardines à l’huile',
    category: 'Alimentation',
    baseUnit: 'boîte',
    allowDecimal: false,
    trackExpiry: true,
    lowStock: 20,
    units: [u('boîte', 1, 400), u('Carton 50', 50, 18_000)],
    purchase: { unitIndex: 1, cost: 16_500, quantity: 2 },
    weight: 5,
  },
  {
    key: 'lait',
    name: 'Lait concentré sucré',
    category: 'Alimentation',
    baseUnit: 'boîte',
    allowDecimal: false,
    trackExpiry: true,
    lowStock: 24,
    units: [u('boîte', 1, 500), u('Carton 48', 48, 21_500)],
    purchase: { unitIndex: 1, cost: 19_800, quantity: 2 },
    weight: 6,
  },
  {
    key: 'lait-poudre',
    name: 'Lait en poudre 400 g',
    category: 'Alimentation',
    baseUnit: 'sachet',
    allowDecimal: false,
    trackExpiry: true,
    lowStock: 6,
    units: [u('sachet', 1, 1500), u('Carton 24', 24, 33_000)],
    purchase: { unitIndex: 1, cost: 30_000, quantity: 1 },
    weight: 3,
  },
  {
    key: 'cube',
    name: 'Cube d’assaisonnement',
    category: 'Alimentation',
    baseUnit: 'pièce',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: 200,
    units: [u('pièce', 1, 25), u('Paquet 100', 100, 2200)],
    purchase: { unitIndex: 1, cost: 2000, quantity: 25 },
    weight: 9,
  },
  {
    key: 'sel',
    name: 'Sel iodé 1 kg',
    category: 'Alimentation',
    baseUnit: 'sachet',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: 10,
    units: [u('sachet', 1, 200), u('Ballot 25', 25, 4500)],
    purchase: { unitIndex: 1, cost: 4000, quantity: 2 },
    weight: 4,
  },
  {
    key: 'cafe',
    name: 'Café soluble 50 g',
    category: 'Alimentation',
    baseUnit: 'boîte',
    allowDecimal: false,
    trackExpiry: true,
    lowStock: null,
    units: [u('boîte', 1, 1000), u('Carton 12', 12, 11_000)],
    purchase: { unitIndex: 1, cost: 10_000, quantity: 1 },
    weight: 0,
  },
  {
    key: 'the',
    name: 'Thé vert',
    category: 'Alimentation',
    baseUnit: 'paquet',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: null,
    units: [u('paquet', 1, 300), u('Carton 40', 40, 11_000)],
    purchase: { unitIndex: 1, cost: 10_000, quantity: 1 },
    weight: 2,
  },
  {
    key: 'biscuits',
    name: 'Biscuits',
    category: 'Alimentation',
    baseUnit: 'paquet',
    allowDecimal: false,
    trackExpiry: true,
    lowStock: 24,
    units: [u('paquet', 1, 100), u('Carton 48', 48, 4300)],
    purchase: { unitIndex: 1, cost: 3900, quantity: 4 },
    weight: 5,
  },
  {
    key: 'gari',
    name: 'Gari',
    category: 'Alimentation',
    baseUnit: 'kg',
    allowDecimal: true,
    trackExpiry: false,
    lowStock: 15,
    units: [u('kg', 1, 500), u('Sac 50 kg', 50, 22_000)],
    purchase: { unitIndex: 1, cost: 19_000, quantity: 2 },
    weight: 5,
  },
  {
    key: 'haricots',
    name: 'Haricots',
    category: 'Alimentation',
    baseUnit: 'kg',
    allowDecimal: true,
    trackExpiry: false,
    lowStock: 15,
    units: [u('kg', 1, 900), u('Sac 50 kg', 50, 42_000)],
    purchase: { unitIndex: 1, cost: 38_000, quantity: 1 },
    weight: 4,
  },
  {
    key: 'mais',
    name: 'Maïs',
    category: 'Alimentation',
    baseUnit: 'kg',
    allowDecimal: true,
    trackExpiry: false,
    lowStock: 20,
    units: [u('kg', 1, 350), u('Sac 100 kg', 100, 31_000)],
    purchase: { unitIndex: 1, cost: 28_000, quantity: 1 },
    weight: 3,
  },
  {
    key: 'eau',
    name: 'Eau minérale 1,5 L',
    category: 'Boissons',
    baseUnit: 'bouteille',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: 24,
    units: [u('bouteille', 1, 400), u('Pack 6', 6, 2200)],
    purchase: { unitIndex: 1, cost: 1900, quantity: 20 },
    weight: 8,
  },
  {
    key: 'jus',
    name: 'Jus de fruits 1 L',
    category: 'Boissons',
    baseUnit: 'bouteille',
    allowDecimal: false,
    trackExpiry: true,
    lowStock: 12,
    units: [u('bouteille', 1, 1000), u('Carton 12', 12, 11_000)],
    purchase: { unitIndex: 1, cost: 10_000, quantity: 2 },
    weight: 3,
  },
  {
    key: 'soda',
    name: 'Boisson gazeuse 33 cl',
    category: 'Boissons',
    baseUnit: 'canette',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: 24,
    units: [u('canette', 1, 400), u('Pack 24', 24, 8500)],
    purchase: { unitIndex: 1, cost: 7800, quantity: 4 },
    weight: 6,
  },
  {
    key: 'savon-menage',
    name: 'Savon de ménage',
    category: 'Hygiène et entretien',
    baseUnit: 'morceau',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: 24,
    units: [u('morceau', 1, 250), u('Carton 72', 72, 16_000)],
    purchase: { unitIndex: 1, cost: 15_000, quantity: 1 },
    weight: 6,
  },
  {
    key: 'savon-toilette',
    name: 'Savon de toilette',
    category: 'Hygiène et entretien',
    baseUnit: 'pièce',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: 12,
    units: [u('pièce', 1, 300), u('Carton 48', 48, 13_000)],
    purchase: { unitIndex: 1, cost: 12_000, quantity: 1 },
    weight: 4,
  },
  {
    key: 'detergent',
    name: 'Détergent en poudre 500 g',
    category: 'Hygiène et entretien',
    baseUnit: 'sachet',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: 12,
    units: [u('sachet', 1, 600), u('Carton 24', 24, 13_000)],
    purchase: { unitIndex: 1, cost: 12_000, quantity: 1 },
    weight: 4,
  },
  {
    key: 'javel',
    name: 'Eau de Javel 1 L',
    category: 'Hygiène et entretien',
    baseUnit: 'bouteille',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: 6,
    units: [u('bouteille', 1, 500), u('Carton 12', 12, 5400)],
    purchase: { unitIndex: 1, cost: 5000, quantity: 1 },
    weight: 3,
  },
  {
    key: 'dentifrice',
    name: 'Dentifrice',
    category: 'Hygiène et entretien',
    baseUnit: 'tube',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: 6,
    units: [u('tube', 1, 700), u('Carton 36', 36, 22_000)],
    purchase: { unitIndex: 1, cost: 20_000, quantity: 1 },
    weight: 3,
  },
  {
    key: 'papier',
    name: 'Papier toilette',
    category: 'Hygiène et entretien',
    baseUnit: 'rouleau',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: 12,
    units: [u('rouleau', 1, 250), u('Ballot 24', 24, 5300)],
    purchase: { unitIndex: 1, cost: 4800, quantity: 1 },
    weight: 3,
  },
  {
    key: 'allumettes',
    name: 'Allumettes',
    category: 'Divers',
    baseUnit: 'boîte',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: 20,
    units: [u('boîte', 1, 25), u('Paquet 10', 10, 220)],
    purchase: { unitIndex: 1, cost: 200, quantity: 20 },
    weight: 4,
  },
  {
    key: 'bougies',
    name: 'Bougies',
    category: 'Divers',
    baseUnit: 'pièce',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: 16,
    units: [u('pièce', 1, 100), u('Paquet 8', 8, 750)],
    purchase: { unitIndex: 1, cost: 650, quantity: 5 },
    weight: 2,
  },
  {
    key: 'piles',
    name: 'Piles AA',
    category: 'Divers',
    baseUnit: 'pièce',
    allowDecimal: false,
    trackExpiry: false,
    lowStock: null,
    units: [u('pièce', 1, 150), u('Boîte 40', 40, 5200)],
    purchase: { unitIndex: 1, cost: 4800, quantity: 1 },
    weight: 0,
  },
  {
    key: 'petrole',
    name: 'Pétrole lampant',
    category: 'Divers',
    baseUnit: 'litre',
    allowDecimal: true,
    trackExpiry: false,
    lowStock: 10,
    units: [u('litre', 1, 650), u('Bidon 20 L', 20, 12_000)],
    purchase: { unitIndex: 1, cost: 11_000, quantity: 1 },
    weight: 2,
  },
];

export const DEMO_CUSTOMERS = [
  { key: 'awa', name: 'Awa Houngbo', phone: '+2290197000001', creditLimit: 50_000 },
  { key: 'koffi', name: 'Koffi Mensah', phone: '+2290197000002', creditLimit: 30_000 },
  { key: 'fatou', name: 'Fatou Diallo', phone: '+2290197000003', creditLimit: null },
  { key: 'rodrigue', name: 'Rodrigue Agossou', phone: '+2290197000004', creditLimit: 20_000 },
  { key: 'mariam', name: 'Mariam Sanni', phone: '+2290197000005', creditLimit: 40_000 },
  { key: 'pelagie', name: 'Pélagie Dossou', phone: '+2290197000006', creditLimit: null },
  { key: 'ibrahim', name: 'Ibrahim Moussa', phone: null, creditLimit: 15_000 },
  { key: 'chantal', name: 'Chantal Ahouandjinou', phone: '+2290197000008', creditLimit: 25_000 },
] as const;

export type DemoEvent =
  | {
      kind: 'receipt';
      at: string;
      productKey: string;
      unitIndex: number;
      /** Nombre d'unités d'achat */
      quantity: number;
      unitCost: number;
      expiryDate: string | null;
    }
  | {
      kind: 'sale';
      at: string;
      lines: { productKey: string; unitIndex: number; quantity: number }[];
      /** cash = espèces (avec monnaie), momo = Mobile Money, credit = paiement partiel */
      payment: 'cash' | 'momo' | 'credit';
      /** Part payée tout de suite pour une vente à crédit (en %) */
      paidPercent: number;
      customerKey: string | null;
    }
  | { kind: 'repayment'; at: string; customerKey: string; percent: number }
  | { kind: 'expense'; at: string; category: string; amount: number; note: string };

/** Générateur de nombres « au hasard » mais reproductible (même graine → même suite). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Un moment (heure locale) d'un jour donné : « 2026-10-12 » à 9 h 30. */
function at(day: string, hour: number, minute: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, hour, minute).toISOString();
}

/**
 * Prépare 30 jours d'activité, jusqu'à hier. Le stock est suivi pendant la préparation :
 * une réception est ajoutée avant qu'un produit manque, donc aucune vente sans stock.
 */
export function buildDemoPlan(today: string, seed = 2026, days = 30): DemoEvent[] {
  const random = seededRandom(seed);
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const events: DemoEvent[] = [];
  // Stock « frais » de chaque produit, en millièmes d'unité de base
  const stock = new Map<string, number>();
  const start = addDays(today, -days);

  const receive = (
    product: DemoProduct,
    when: string,
    expiryDay: string | null,
    quantity?: number
  ) => {
    const purchaseUnit = product.units[product.purchase.unitIndex];
    const count = quantity ?? product.purchase.quantity;
    events.push({
      kind: 'receipt',
      at: when,
      productKey: product.key,
      unitIndex: product.purchase.unitIndex,
      quantity: count,
      unitCost: product.purchase.cost,
      expiryDate: product.trackExpiry ? expiryDay : null,
    });
    const base = toBaseQuantity(count * 1000, purchaseUnit.factor * 1000);
    stock.set(product.key, (stock.get(product.key) ?? 0) + base);
  };

  // Jour 1, à l'ouverture : tout le stock de départ
  for (const product of DEMO_PRODUCTS) {
    receive(product, at(start, 7, 30), addDays(today, 120 + Math.floor(random() * 120)));
  }

  const weighted = DEMO_PRODUCTS.flatMap((product) =>
    Array<DemoProduct>(product.weight).fill(product)
  );
  const debtors = new Set<string>();

  for (let offset = 0; offset < days; offset++) {
    const day = addDays(start, offset);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    const saleCount =
      6 + Math.floor(random() * 6) + (weekday === 6 ? 5 : 0) - (weekday === 0 ? 4 : 0);

    for (let index = 0; index < saleCount; index++) {
      const minute = Math.floor(random() * 60);
      const hour = 8 + Math.floor((index / saleCount) * 11);
      const when = at(day, hour, minute);
      const lines: { productKey: string; unitIndex: number; quantity: number }[] = [];
      const lineCount = 1 + Math.floor(random() * 3);
      for (let l = 0; l < lineCount; l++) {
        const product = pick(weighted);
        if (lines.some((line) => line.productKey === product.key)) continue;
        // Le plus souvent à l'unité de base ; parfois un conditionnement (sac, carton…)
        const usePackaging = random() < 0.08 && product.units.length > 1;
        const unitIndex = usePackaging ? 1 : 0;
        const quantity = usePackaging
          ? 1000
          : product.allowDecimal && random() < 0.4
            ? 500 + Math.floor(random() * 5) * 500 // 0,5 à 2,5
            : (1 + Math.floor(random() * 4)) * 1000;
        const base = toBaseQuantity(quantity, product.units[unitIndex].factor * 1000);
        if ((stock.get(product.key) ?? 0) < base) {
          // Réapprovisionnement le matin même, avant la vente
          receive(product, at(day, 7, 0), addDays(today, 90 + Math.floor(random() * 120)));
        }
        stock.set(product.key, (stock.get(product.key) ?? 0) - base);
        lines.push({ productKey: product.key, unitIndex, quantity });
      }
      if (lines.length === 0) continue;

      const roll = random();
      if (roll < 0.14) {
        const customer = pick(DEMO_CUSTOMERS);
        debtors.add(customer.key);
        events.push({
          kind: 'sale',
          at: when,
          lines,
          payment: 'credit',
          paidPercent: pick([0, 0, 25, 50]),
          customerKey: customer.key,
        });
      } else {
        events.push({
          kind: 'sale',
          at: when,
          lines,
          payment: roll < 0.32 ? 'momo' : 'cash',
          paidPercent: 100,
          customerKey: null,
        });
      }
    }

    // Quelques remboursements de crédit, en fin de journée
    if (offset > 3 && random() < 0.35 && debtors.size > 0) {
      events.push({
        kind: 'repayment',
        at: at(day, 18, 30),
        customerKey: pick([...debtors].sort()),
        percent: pick([30, 50, 100]),
      });
    }
    // Les dépenses du jour
    if (random() < 0.5) {
      events.push({
        kind: 'expense',
        at: at(day, 12, 15),
        category: 'transport',
        amount: pick([500, 1000, 1500]),
        note: 'Livraison au marché',
      });
    }
    if (offset % 7 === 2) {
      events.push({
        kind: 'expense',
        at: at(day, 10, 0),
        category: 'fuel',
        amount: 3000,
        note: 'Essence de la moto',
      });
    }
    if (offset === 5) {
      events.push({
        kind: 'expense',
        at: at(day, 9, 0),
        category: 'rent',
        amount: 40_000,
        note: 'Loyer du mois',
      });
    }
    if (offset === 12) {
      events.push({
        kind: 'expense',
        at: at(day, 9, 30),
        category: 'utilities',
        amount: 7500,
        note: 'Électricité',
      });
    }
  }

  // Un petit lot de lait en poudre périmé (reçu avant la période) : il apparaît dans les alertes
  const powder = DEMO_PRODUCTS.find((product) => product.key === 'lait-poudre');
  if (powder) {
    events.push({
      kind: 'receipt',
      at: at(addDays(start, -40), 8, 0),
      productKey: powder.key,
      unitIndex: 0,
      quantity: 3,
      unitCost: 1250,
      expiryDate: addDays(today, -3),
    });
  }
  // Un lot de biscuits qui périme dans 5 jours : alerte « bientôt périmé »
  const biscuits = DEMO_PRODUCTS.find((product) => product.key === 'biscuits');
  if (biscuits) {
    receive(biscuits, at(addDays(today, -1), 7, 15), addDays(today, 5), 1);
  }

  return events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
