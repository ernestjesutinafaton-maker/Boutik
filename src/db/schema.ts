import { column, Schema, Table } from '@powersync/common';

/**
 * Le schéma de la base LOCALE (dans l'appareil), tenue à jour par PowerSync.
 *
 * Il reprend les tables du serveur (supabase/migrations), avec seulement 3 types :
 *   text    : textes, identifiants (UUID), dates (« 2026-10-25T14:30:00Z »), JSON
 *   integer : nombres entiers (montants, quantités en millièmes) et oui/non (1 / 0)
 *   real    : nombres à virgule (inutilisé : règle d'or des nombres entiers)
 * La colonne « id » est ajoutée automatiquement par PowerSync.
 *
 * ⚠️ Une colonne ou une table ajoutée sur le serveur doit aussi être ajoutée ici.
 */

// Colonnes présentes dans presque toutes les tables
const tracking = {
  created_by: column.text, // la personne (profil de la boutique) qui a fait l'action
  device_id: column.text, // l'appareil utilisé
  created_at: column.text,
};

// --- 1. La boutique et les personnes ---

const shops = new Table({
  name: column.text,
  country_code: column.text,
  currency_code: column.text,
  phone: column.text,
  address: column.text,
  logo_path: column.text,
  invoice_footer: column.text,
  expiry_alert_days_first: column.integer,
  expiry_alert_days_second: column.integer,
  seller_max_discount_percent: column.integer,
  allow_sale_without_stock: column.integer,
  paid_until: column.text, // fin de l'abonnement payé (modifiée seulement par le serveur)
  created_at: column.text,
  updated_at: column.text,
});

const shop_members = new Table({
  shop_id: column.text,
  user_id: column.text,
  display_name: column.text,
  pin_hash: column.text,
  pin_salt: column.text,
  max_discount_percent: column.integer,
  active: column.integer,
  created_at: column.text,
  updated_at: column.text,
});

const shop_member_roles = new Table(
  {
    shop_id: column.text,
    member_id: column.text,
    role: column.text,
    granted_by: column.text,
    granted_at: column.text,
    revoked_by: column.text,
    revoked_at: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { member: ['member_id'] } }
);

const devices = new Table({
  shop_id: column.text,
  device_number: column.integer,
  name: column.text,
  platform: column.text,
  registered_by: column.text,
  last_seen_at: column.text,
  created_at: column.text,
});

const customers = new Table({
  shop_id: column.text,
  name: column.text,
  phone: column.text,
  credit_limit: column.integer,
  notes: column.text,
  archived_at: column.text,
  ...tracking,
  updated_at: column.text,
});

const payment_methods = new Table({
  shop_id: column.text,
  code: column.text,
  label: column.text,
  kind: column.text,
  sort_order: column.integer,
  active: column.integer,
  created_at: column.text,
  updated_at: column.text,
});

// --- 2. Les produits ---

const categories = new Table({
  shop_id: column.text,
  name: column.text,
  sort_order: column.integer,
  archived_at: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const products = new Table(
  {
    shop_id: column.text,
    category_id: column.text,
    name: column.text,
    barcode: column.text,
    base_unit: column.text,
    allow_decimal: column.integer,
    low_stock_threshold: column.integer,
    track_expiry: column.integer,
    photo_path: column.text,
    archived_at: column.text,
    ...tracking,
    updated_at: column.text,
  },
  { indexes: { barcode: ['barcode'], name: ['name'] } }
);

const product_units = new Table(
  {
    shop_id: column.text,
    product_id: column.text,
    name: column.text,
    factor: column.integer,
    sale_price: column.integer,
    barcode: column.text,
    is_default: column.integer,
    sort_order: column.integer,
    archived_at: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { product: ['product_id'], barcode: ['barcode'] } }
);

// --- 3. Le stock ---

const stock_receipts = new Table({
  shop_id: column.text,
  supplier_name: column.text,
  reference: column.text,
  notes: column.text,
  received_at: column.text,
  ...tracking,
});

const stock_lots = new Table(
  {
    shop_id: column.text,
    product_id: column.text,
    receipt_id: column.text,
    expiry_date: column.text,
    cost_price: column.integer,
    cost_quantity: column.integer,
    initial_quantity: column.integer,
    supplier_name: column.text,
    received_at: column.text,
    ...tracking,
    updated_at: column.text,
  },
  { indexes: { product: ['product_id'] } }
);

const stock_movements = new Table(
  {
    shop_id: column.text,
    product_id: column.text,
    lot_id: column.text,
    type: column.text,
    quantity: column.integer,
    cost_amount: column.integer,
    loss_reason: column.text,
    receipt_id: column.text,
    sale_id: column.text,
    sale_item_id: column.text,
    inventory_count_id: column.text,
    note: column.text,
    occurred_at: column.text,
    ...tracking,
  },
  { indexes: { product: ['product_id'], lot: ['lot_id'], sale: ['sale_id'] } }
);

const inventory_counts = new Table({
  shop_id: column.text,
  status: column.text,
  notes: column.text,
  started_at: column.text,
  validated_at: column.text,
  validated_by: column.text,
  ...tracking,
  updated_at: column.text,
});

const inventory_lines = new Table(
  {
    shop_id: column.text,
    inventory_count_id: column.text,
    product_id: column.text,
    expected_quantity: column.integer,
    counted_quantity: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { count: ['inventory_count_id'] } }
);

// --- 4. Les ventes et l'argent ---

const cash_sessions = new Table({
  shop_id: column.text,
  device_id: column.text,
  status: column.text,
  opening_float: column.integer,
  opened_by: column.text,
  opened_at: column.text,
  expected_amounts: column.text,
  counted_amounts: column.text,
  difference_amount: column.integer,
  closed_by: column.text,
  closed_at: column.text,
  notes: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const sales = new Table(
  {
    shop_id: column.text,
    device_id: column.text,
    invoice_number: column.text,
    invoice_seq: column.integer,
    customer_id: column.text,
    seller_id: column.text,
    cash_session_id: column.text,
    status: column.text,
    subtotal: column.integer,
    discount_amount: column.integer,
    total: column.integer,
    paid_amount: column.integer,
    due_amount: column.integer,
    note: column.text,
    occurred_at: column.text,
    cancelled_at: column.text,
    cancelled_by: column.text,
    cancel_reason: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { customer: ['customer_id'], occurred: ['occurred_at'] } }
);

const sale_items = new Table(
  {
    shop_id: column.text,
    sale_id: column.text,
    product_id: column.text,
    product_unit_id: column.text,
    product_name: column.text,
    unit_name: column.text,
    unit_factor: column.integer,
    quantity: column.integer,
    base_quantity: column.integer,
    unit_price: column.integer,
    line_total: column.integer,
    created_at: column.text,
  },
  { indexes: { sale: ['sale_id'], product: ['product_id'] } }
);

const payments = new Table(
  {
    shop_id: column.text,
    kind: column.text,
    sale_id: column.text,
    customer_id: column.text,
    payment_method_id: column.text,
    amount: column.integer,
    cash_received: column.integer,
    change_given: column.integer,
    cash_session_id: column.text,
    occurred_at: column.text,
    ...tracking,
  },
  { indexes: { sale: ['sale_id'], customer: ['customer_id'] } }
);

const customer_ledger = new Table(
  {
    shop_id: column.text,
    customer_id: column.text,
    type: column.text,
    amount: column.integer,
    sale_id: column.text,
    payment_id: column.text,
    note: column.text,
    occurred_at: column.text,
    ...tracking,
  },
  { indexes: { customer: ['customer_id'] } }
);

/** Dépenses, achats payés par la caisse, retraits et ajouts d'argent (étape 15). */
const cash_movements = new Table(
  {
    shop_id: column.text,
    cash_session_id: column.text,
    type: column.text,
    category: column.text,
    payment_method_id: column.text,
    amount: column.integer,
    note: column.text,
    occurred_at: column.text,
    ...tracking,
  },
  { indexes: { session: ['cash_session_id'] } }
);

/** Les rapports archivés : clôtures de journée et comptes (étape 15). */
const reports = new Table({
  shop_id: column.text,
  kind: column.text,
  period_start: column.text,
  period_end: column.text,
  data: column.text, // la fiche complète, en JSON
  notes: column.text,
  ...tracking,
});

// --- 5. La traçabilité ---

const audit_log = new Table({
  shop_id: column.text,
  action: column.text,
  entity_type: column.text,
  entity_id: column.text,
  details: column.text,
  member_id: column.text,
  device_id: column.text,
  occurred_at: column.text,
  created_at: column.text,
});

// --- Tables qui restent DANS L'APPAREIL (jamais envoyées au serveur) ---

/** Modifications refusées par le serveur : gardées ici pour pouvoir les examiner. */
const local_rejected_changes = new Table(
  {
    table_name: column.text,
    row_id: column.text,
    operation: column.text,
    data: column.text,
    error_code: column.text,
    error_message: column.text,
    rejected_at: column.text,
  },
  { localOnly: true }
);

/** Photos de produits prises sur cet appareil, en attente d'envoi vers le stockage Supabase. */
const local_photo_uploads = new Table(
  {
    shop_id: column.text,
    product_id: column.text,
    data: column.text, // l'image JPEG en base64
    created_at: column.text,
  },
  { localOnly: true }
);

/** La file « À envoyer » : factures et reçus à envoyer plus tard par WhatsApp. */
const local_outbox = new Table(
  {
    shop_id: column.text,
    kind: column.text, // invoice (facture), receipt (reçu), reminder (relance)
    sale_id: column.text,
    customer_id: column.text,
    payment_id: column.text,
    label: column.text,
    created_at: column.text,
  },
  { localOnly: true }
);

export const AppSchema = new Schema({
  shops,
  shop_members,
  shop_member_roles,
  devices,
  customers,
  payment_methods,
  categories,
  products,
  product_units,
  stock_receipts,
  stock_lots,
  stock_movements,
  inventory_counts,
  inventory_lines,
  cash_sessions,
  sales,
  sale_items,
  payments,
  customer_ledger,
  cash_movements,
  reports,
  audit_log,
  local_rejected_changes,
  local_photo_uploads,
  local_outbox,
});

/** Le type des lignes de chaque table, pour TypeScript (ex. LocalDatabase['customers']). */
export type LocalDatabase = (typeof AppSchema)['types'];
