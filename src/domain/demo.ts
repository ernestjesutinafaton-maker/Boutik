import { addDays } from './dates';
import { toBaseQuantity } from './quantity';

/**
 * La boutique de démonstration : 30 produits, 30 jours de ventes, des clients
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

/** Un produit de démonstration (forme courte, pour garder la liste lisible). */
const p = (
  key: string,
  name: string,
  category: string,
  baseUnit: string,
  allowDecimal: boolean,
  trackExpiry: boolean,
  lowStock: number | null,
  units: DemoUnit[],
  purchase: DemoProduct['purchase'],
  weight: number
): DemoProduct => ({
  key,
  name,
  category,
  baseUnit,
  allowDecimal,
  trackExpiry,
  lowStock,
  units,
  purchase,
  weight,
});

/**
 * Le catalogue de démonstration (prix en FCFA) : une quincaillerie, pour montrer la vente au
 * détail (au mètre, au kilo, à la barre) d'articles achetés en gros (rouleau, carton, botte).
 */
export const DEMO_PRODUCTS: DemoProduct[] = [
  p(
    'ciment',
    'Ciment CPJ 45',
    'Construction',
    'sac',
    false,
    false,
    20,
    [u('sac 50 kg', 1, 5500), u('Palette 40 sacs', 40, 212_000)],
    { unitIndex: 1, cost: 196_000, quantity: 2 },
    10
  ),
  p(
    'fer-8',
    'Fer à béton 8 mm',
    'Construction',
    'barre',
    false,
    false,
    30,
    [u('barre 12 m', 1, 2600), u('Botte 20 barres', 20, 50_000)],
    { unitIndex: 1, cost: 46_000, quantity: 4 },
    7
  ),
  p(
    'fer-10',
    'Fer à béton 10 mm',
    'Construction',
    'barre',
    false,
    false,
    20,
    [u('barre 12 m', 1, 4100), u('Botte 10 barres', 10, 40_000)],
    { unitIndex: 1, cost: 37_000, quantity: 4 },
    5
  ),
  p(
    'fil-attache',
    'Fil d’attache',
    'Construction',
    'kg',
    true,
    false,
    10,
    [u('kg', 1, 1200), u('Rouleau 25 kg', 25, 27_500)],
    { unitIndex: 1, cost: 25_000, quantity: 2 },
    4
  ),
  p(
    'clous-70',
    'Pointes 70 mm',
    'Quincaillerie',
    'kg',
    true,
    false,
    10,
    [u('kg', 1, 1000), u('Carton 25 kg', 25, 23_000)],
    { unitIndex: 1, cost: 21_000, quantity: 2 },
    8
  ),
  p(
    'vis-bois',
    'Vis à bois 4 × 40',
    'Quincaillerie',
    'pièce',
    false,
    false,
    200,
    [u('pièce', 1, 15), u('Boîte 200', 200, 2500)],
    { unitIndex: 1, cost: 2000, quantity: 10 },
    6
  ),
  p(
    'cheville',
    'Chevilles 8 mm',
    'Quincaillerie',
    'pièce',
    false,
    false,
    100,
    [u('pièce', 1, 25), u('Sachet 100', 100, 2000)],
    { unitIndex: 1, cost: 1500, quantity: 10 },
    5
  ),
  p(
    'cadenas',
    'Cadenas 40 mm',
    'Quincaillerie',
    'pièce',
    false,
    false,
    6,
    [u('pièce', 1, 2500), u('Boîte 12', 12, 27_000)],
    { unitIndex: 1, cost: 24_000, quantity: 2 },
    3
  ),
  p(
    'charniere',
    'Charnière 100 mm',
    'Quincaillerie',
    'pièce',
    false,
    false,
    20,
    [u('pièce', 1, 500), u('Boîte 50', 50, 22_000)],
    { unitIndex: 1, cost: 19_000, quantity: 1 },
    3
  ),
  p(
    'tole',
    'Tôle ondulée bac',
    'Toiture',
    'feuille',
    false,
    false,
    20,
    [u('feuille', 1, 4500), u('Paquet 25', 25, 105_000)],
    { unitIndex: 1, cost: 98_000, quantity: 2 },
    5
  ),
  p(
    'pointe-tole',
    'Pointes à tôle',
    'Toiture',
    'kg',
    true,
    false,
    5,
    [u('kg', 1, 1500), u('Carton 20 kg', 20, 27_000)],
    { unitIndex: 1, cost: 24_000, quantity: 1 },
    3
  ),
  p(
    'tuyau-pvc',
    'Tuyau PVC 32 mm',
    'Plomberie',
    'barre',
    false,
    false,
    15,
    [u('barre 4 m', 1, 2000), u('Botte 25', 25, 45_000)],
    { unitIndex: 1, cost: 40_000, quantity: 2 },
    5
  ),
  p(
    'coude-pvc',
    'Coude PVC 32 mm',
    'Plomberie',
    'pièce',
    false,
    false,
    30,
    [u('pièce', 1, 200), u('Sachet 50', 50, 8000)],
    { unitIndex: 1, cost: 6500, quantity: 3 },
    5
  ),
  p(
    'robinet',
    'Robinet laiton 1/2',
    'Plomberie',
    'pièce',
    false,
    false,
    5,
    [u('pièce', 1, 3500), u('Carton 10', 10, 30_000)],
    { unitIndex: 1, cost: 27_000, quantity: 2 },
    3
  ),
  p(
    'colle-pvc',
    'Colle PVC 250 ml',
    'Plomberie',
    'pot',
    false,
    true,
    6,
    [u('pot', 1, 1500), u('Carton 24', 24, 30_000)],
    { unitIndex: 1, cost: 27_000, quantity: 1 },
    3
  ),
  p(
    'teflon',
    'Ruban téflon',
    'Plomberie',
    'rouleau',
    false,
    false,
    20,
    [u('rouleau', 1, 200), u('Boîte 10', 10, 1700)],
    { unitIndex: 1, cost: 1300, quantity: 10 },
    4
  ),
  p(
    'cable-2-5',
    'Câble électrique 2,5 mm²',
    'Électricité',
    'mètre',
    true,
    false,
    50,
    [u('mètre', 1, 350), u('Rouleau 100 m', 100, 30_000)],
    { unitIndex: 1, cost: 26_000, quantity: 3 },
    6
  ),
  p(
    'ampoule',
    'Ampoule LED 9 W',
    'Électricité',
    'pièce',
    false,
    false,
    10,
    [u('pièce', 1, 1000), u('Carton 50', 50, 42_000)],
    { unitIndex: 1, cost: 37_000, quantity: 1 },
    4
  ),
  p(
    'prise',
    'Prise murale',
    'Électricité',
    'pièce',
    false,
    false,
    10,
    [u('pièce', 1, 800), u('Boîte 20', 20, 14_000)],
    { unitIndex: 1, cost: 12_000, quantity: 2 },
    3
  ),
  p(
    'interrupteur',
    'Interrupteur simple',
    'Électricité',
    'pièce',
    false,
    false,
    10,
    [u('pièce', 1, 700), u('Boîte 20', 20, 12_000)],
    { unitIndex: 1, cost: 10_500, quantity: 2 },
    3
  ),
  p(
    'scotch',
    'Ruban isolant',
    'Électricité',
    'rouleau',
    false,
    false,
    20,
    [u('rouleau', 1, 300), u('Boîte 10', 10, 2500)],
    { unitIndex: 1, cost: 2000, quantity: 5 },
    4
  ),
  p(
    'peinture',
    'Peinture à eau blanche',
    'Peinture',
    'litre',
    true,
    true,
    10,
    [u('litre', 1, 1800), u('Seau 20 L', 20, 32_000)],
    { unitIndex: 1, cost: 28_000, quantity: 3 },
    4
  ),
  p(
    'peinture-huile',
    'Peinture à huile 1 L',
    'Peinture',
    'pot',
    false,
    true,
    6,
    [u('pot', 1, 3500), u('Carton 6', 6, 19_500)],
    { unitIndex: 1, cost: 17_000, quantity: 2 },
    2
  ),
  p(
    'diluant',
    'Diluant 1 L',
    'Peinture',
    'bidon',
    false,
    false,
    6,
    [u('bidon', 1, 1500), u('Carton 12', 12, 16_000)],
    { unitIndex: 1, cost: 14_000, quantity: 1 },
    2
  ),
  p(
    'pinceau',
    'Pinceau 50 mm',
    'Peinture',
    'pièce',
    false,
    false,
    10,
    [u('pièce', 1, 600), u('Paquet 12', 12, 6000)],
    { unitIndex: 1, cost: 5000, quantity: 2 },
    3
  ),
  p(
    'mastic',
    'Mastic de vitrier',
    'Peinture',
    'pot',
    false,
    true,
    4,
    [u('pot', 1, 1200), u('Carton 12', 12, 12_500)],
    { unitIndex: 1, cost: 11_000, quantity: 1 },
    2
  ),
  p(
    'marteau',
    'Marteau 500 g',
    'Outillage',
    'pièce',
    false,
    false,
    3,
    [u('pièce', 1, 3000), u('Carton 6', 6, 16_000)],
    { unitIndex: 1, cost: 14_000, quantity: 1 },
    2
  ),
  p(
    'truelle',
    'Truelle de maçon',
    'Outillage',
    'pièce',
    false,
    false,
    3,
    [u('pièce', 1, 2000), u('Carton 12', 12, 21_000)],
    { unitIndex: 1, cost: 18_000, quantity: 1 },
    2
  ),
  p(
    'brouette',
    'Brouette',
    'Outillage',
    'pièce',
    false,
    false,
    2,
    [u('pièce', 1, 25_000)],
    { unitIndex: 0, cost: 21_000, quantity: 3 },
    1
  ),
  p(
    'niveau',
    'Niveau à bulle 60 cm',
    'Outillage',
    'pièce',
    false,
    false,
    null,
    [u('pièce', 1, 4000), u('Carton 10', 10, 35_000)],
    { unitIndex: 1, cost: 32_000, quantity: 1 },
    0
  ),
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
        while ((stock.get(product.key) ?? 0) < base) {
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
        note: 'Livraison chez un client',
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

  // Un petit lot de colle périmée (reçu avant la période) : il apparaît dans les alertes
  const powder = DEMO_PRODUCTS.find((product) => product.key === 'colle-pvc');
  if (powder) {
    events.push({
      kind: 'receipt',
      at: at(addDays(start, -40), 8, 0),
      productKey: powder.key,
      unitIndex: 0,
      quantity: 3,
      unitCost: 1100,
      expiryDate: addDays(today, -3),
    });
  }
  // Un lot de mastic qui périme dans 5 jours : alerte « bientôt périmé »
  const biscuits = DEMO_PRODUCTS.find((product) => product.key === 'mastic');
  if (biscuits) {
    receive(biscuits, at(addDays(today, -1), 7, 15), addDays(today, 5), 1);
  }

  return events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
