-- =============================================================================
-- Boutik — Les tables de la base de données
-- =============================================================================
-- Règles suivies partout :
--   • Chaque table a un « id » (UUID) que l'appareil peut créer lui-même, même hors ligne.
--   • Chaque ligne appartient à une boutique (« shop_id ») : une boutique ne voit jamais
--     les données d'une autre (voir le fichier « security »).
--   • Montants : nombres ENTIERS, dans la plus petite unité de la monnaie (32 000 FCFA → 32000).
--   • Quantités : nombres ENTIERS, en MILLIÈMES de l'unité de base du produit
--     (2,5 kg → 2500 ; 1 boîte → 1000). Jamais de nombre à virgule.
--   • Rien n'est supprimé : on archive (« archived_at ») ou on annule (statut + trace).
--   • Aucune contrainte « unique » que deux appareils hors ligne pourraient enfreindre
--     en même temps (sinon leur synchronisation resterait bloquée).
--   • « created_by » = la personne (profil de la boutique) qui a fait l'action ;
--     « device_id » = l'appareil utilisé ; « occurred_at » = le moment réel de l'action
--     (donné par l'appareil, même si la synchronisation a lieu plus tard).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. La boutique et les personnes
-- -----------------------------------------------------------------------------

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  country_code text not null default 'BJ' check (country_code ~ '^[A-Z]{2}$'),
  currency_code text not null default 'XOF' check (currency_code ~ '^[A-Z]{3}$'),
  phone text,
  address text,
  logo_path text,                       -- emplacement du logo dans le stockage Supabase
  invoice_footer text,                  -- mentions imprimées en bas des factures
  expiry_alert_days_first integer not null default 30 check (expiry_alert_days_first between 0 and 365),
  expiry_alert_days_second integer not null default 7 check (expiry_alert_days_second between 0 and 365),
  seller_max_discount_percent integer not null default 0 check (seller_max_discount_percent between 0 and 100),
  allow_sale_without_stock boolean not null default true,  -- vendre même si le stock affiché est à 0 (avec avertissement)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.shops is 'La boutique et ses réglages.';

create table public.shop_members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  user_id uuid references auth.users (id) on delete set null,  -- compte de connexion ; vide = profil avec code PIN seulement
  display_name text not null check (length(trim(display_name)) between 1 and 60),
  role text not null check (role in ('owner', 'seller')),      -- propriétaire ou vendeur
  pin_hash text,                        -- code PIN protégé (jamais enregistré en clair)
  pin_salt text,
  max_discount_percent integer check (max_discount_percent between 0 and 100),  -- vide = limite de la boutique
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, user_id)
);
comment on table public.shop_members is 'Les personnes de la boutique (propriétaire, vendeurs).';

create table public.devices (
  id uuid primary key,                  -- créé par l'appareil lui-même
  shop_id uuid not null references public.shops (id),
  device_number integer not null check (device_number > 0),   -- attribué par le serveur (fonction register_device)
  name text not null,
  platform text not null check (platform in ('android', 'ios', 'web', 'windows')),
  registered_by uuid references auth.users (id) on delete set null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shop_id, device_number)
);
comment on table public.devices is 'Les appareils de la boutique. Leur numéro sert aux numéros de facture (F2-… = appareil n° 2).';

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  name text not null check (length(trim(name)) between 1 and 100),
  phone text,                           -- format international, ex. +22997000000
  credit_limit bigint check (credit_limit >= 0),   -- plafond de crédit ; vide = pas de plafond
  notes text,
  archived_at timestamptz,
  created_by uuid references public.shop_members (id),
  device_id uuid references public.devices (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.customers is 'Les clients (obligatoires pour une vente à crédit).';

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  code text not null,                   -- ex. cash, mtn_momo (sert aux rapports)
  label text not null,                  -- nom affiché : Espèces, MTN MoMo…
  kind text not null check (kind in ('cash', 'mobile_money', 'card', 'other')),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.payment_methods is 'Les modes de paiement de la boutique. Le crédit n''en est pas un : c''est le reste non payé.';


-- -----------------------------------------------------------------------------
-- 2. Les produits
-- -----------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  name text not null check (length(trim(name)) between 1 and 60),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.categories is 'Les rayons : Alimentation, Boissons, Quincaillerie…';

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  category_id uuid references public.categories (id),
  name text not null check (length(trim(name)) between 1 and 120),
  barcode text,
  base_unit text not null check (length(trim(base_unit)) between 1 and 20),  -- unité de comptage du stock : kg, pièce, boîte…
  allow_decimal boolean not null default false,   -- quantités à virgule permises (2,5 kg) ?
  low_stock_threshold bigint check (low_stock_threshold >= 0),   -- seuil d'alerte, en millièmes d'unité de base
  track_expiry boolean not null default false,    -- suivre les dates de péremption ?
  photo_path text,
  archived_at timestamptz,
  created_by uuid references public.shop_members (id),
  device_id uuid references public.devices (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.products is 'Les produits. Le stock est toujours compté dans l''unité de base.';

create table public.product_units (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  product_id uuid not null references public.products (id),
  name text not null check (length(trim(name)) between 1 and 40),   -- Sac 50 kg, Kilo, Tine, Carton…
  factor bigint not null check (factor > 0),     -- contenu en millièmes d'unité de base (Sac 50 kg → 50000)
  sale_price bigint check (sale_price >= 0),     -- prix de vente de CETTE unité ; vide = pas vendue dans cette unité
  barcode text,                         -- un carton peut avoir son propre code-barres
  is_default boolean not null default false,     -- unité proposée en premier à la caisse
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.product_units is 'Les façons de vendre ou d''acheter un produit, chacune avec son facteur et son prix.';


-- -----------------------------------------------------------------------------
-- 3. Le stock
-- -----------------------------------------------------------------------------

create table public.stock_receipts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  supplier_name text,                   -- fournisseur (simple texte en attendant la V2)
  reference text,                       -- numéro du bon de livraison du fournisseur
  notes text,
  received_at timestamptz not null default now(),
  created_by uuid references public.shop_members (id),
  device_id uuid references public.devices (id),
  created_at timestamptz not null default now()
);
comment on table public.stock_receipts is 'Les réceptions de marchandise (bons d''entrée).';

create table public.stock_lots (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  product_id uuid not null references public.products (id),
  receipt_id uuid references public.stock_receipts (id),
  expiry_date date,                     -- date de péremption (vide si non suivie)
  -- Prix d'achat TEL QUE SAISI : « cost_price » pour « cost_quantity » millièmes.
  -- Ex. sac de 50 kg acheté 28 000 F → cost_price = 28000, cost_quantity = 50000.
  -- Le coût d'une quantité vendue se calcule par une règle de trois, arrondie une seule fois.
  cost_price bigint not null check (cost_price >= 0),
  cost_quantity bigint not null check (cost_quantity > 0),
  initial_quantity bigint not null check (initial_quantity > 0),  -- quantité reçue (le stock réel vient des mouvements)
  supplier_name text,
  received_at timestamptz not null default now(),
  created_by uuid references public.shop_members (id),
  device_id uuid references public.devices (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.stock_lots is 'Les lots : chaque entrée de stock crée un lot avec son prix d''achat et sa date de péremption.';

create table public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  status text not null default 'draft' check (status in ('draft', 'validated', 'cancelled')),
  notes text,
  started_at timestamptz not null default now(),
  validated_at timestamptz,
  validated_by uuid references public.shop_members (id),
  created_by uuid references public.shop_members (id),
  device_id uuid references public.devices (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.inventory_counts is 'Les inventaires (comptage du stock réel).';

create table public.inventory_lines (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  inventory_count_id uuid not null references public.inventory_counts (id),
  product_id uuid not null references public.products (id),
  expected_quantity bigint not null,    -- stock calculé au moment du comptage (millièmes)
  counted_quantity bigint not null check (counted_quantity >= 0),   -- stock réellement compté (millièmes)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.inventory_lines is 'Une ligne d''inventaire par produit compté : stock calculé et stock compté.';


-- -----------------------------------------------------------------------------
-- 4. Les ventes et l'argent
-- -----------------------------------------------------------------------------

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  device_id uuid not null references public.devices (id),
  status text not null default 'open' check (status in ('open', 'closed')),
  opening_float bigint not null default 0 check (opening_float >= 0),   -- fond de caisse
  opened_by uuid not null references public.shop_members (id),
  opened_at timestamptz not null default now(),
  -- À la clôture : montants attendus et comptés par mode de paiement, figés pour l'historique
  -- (ex. {"<id du mode Espèces>": 125000, "<id du mode MoMo>": 40000})
  expected_amounts jsonb,
  counted_amounts jsonb,
  difference_amount bigint,             -- écart total : compté − attendu
  closed_by uuid references public.shop_members (id),
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'open') = (closed_at is null))
);
comment on table public.cash_sessions is 'La caisse du jour (une par appareil qui encaisse) : ouverture, clôture, écarts.';

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  device_id uuid not null references public.devices (id),
  -- Numéro de facture unique même hors ligne : numéro d'appareil + compteur de l'appareil
  -- (ex. F2-000123 = appareil n° 2, 123e facture de cet appareil)
  invoice_number text not null,
  invoice_seq integer not null check (invoice_seq > 0),
  customer_id uuid references public.customers (id),
  seller_id uuid not null references public.shop_members (id),
  cash_session_id uuid references public.cash_sessions (id),
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  subtotal bigint not null check (subtotal >= 0),               -- total des lignes
  discount_amount bigint not null default 0 check (discount_amount >= 0),
  total bigint not null check (total >= 0),                     -- à payer = sous-total − remise
  paid_amount bigint not null check (paid_amount >= 0),         -- payé au moment de la vente
  due_amount bigint not null check (due_amount >= 0),           -- reste dû : passe en crédit
  note text,
  occurred_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.shop_members (id),
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, invoice_seq),
  check (total = subtotal - discount_amount),
  check (due_amount = total - paid_amount),
  check (due_amount = 0 or customer_id is not null),           -- vente à crédit : client obligatoire
  check ((status = 'cancelled') = (cancelled_at is not null))
);
comment on table public.sales is 'Les ventes : une vente = une facture.';

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  sale_id uuid not null references public.sales (id),
  product_id uuid not null references public.products (id),
  product_unit_id uuid not null references public.product_units (id),
  -- Copies au moment de la vente : la facture ne change pas si le produit est renommé plus tard
  product_name text not null,
  unit_name text not null,
  unit_factor bigint not null check (unit_factor > 0),
  quantity bigint not null check (quantity > 0),                -- en millièmes de l'unité de vente (1,5 kilo → 1500)
  base_quantity bigint not null check (base_quantity > 0),      -- la même quantité en millièmes d'unité de base
  unit_price bigint not null check (unit_price >= 0),           -- prix d'UNE unité de vente
  line_total bigint not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
comment on table public.sale_items is 'Les lignes d''une vente : produit, unité, quantité, prix.';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  kind text not null check (kind in ('sale', 'repayment', 'refund')),   -- vente, remboursement de crédit, rendu au client
  sale_id uuid references public.sales (id),
  customer_id uuid references public.customers (id),
  payment_method_id uuid not null references public.payment_methods (id),
  amount bigint not null check (amount <> 0),                   -- négatif quand on rend de l'argent au client
  cash_received bigint check (cash_received >= 0),              -- espèces données par le client
  change_given bigint check (change_given >= 0),                -- monnaie rendue
  cash_session_id uuid references public.cash_sessions (id),
  occurred_at timestamptz not null default now(),
  created_by uuid references public.shop_members (id),
  device_id uuid references public.devices (id),
  created_at timestamptz not null default now(),
  check (kind <> 'sale' or (sale_id is not null and amount > 0)),
  check (kind <> 'repayment' or (customer_id is not null and amount > 0)),
  check (kind <> 'refund' or amount < 0)
);
comment on table public.payments is 'L''argent reçu (ou rendu), mode par mode.';

create table public.customer_ledger (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  customer_id uuid not null references public.customers (id),
  type text not null check (type in ('debt', 'repayment', 'cancellation', 'write_off', 'adjustment')),
  amount bigint not null check (amount <> 0),                   -- + augmente la dette ; − la diminue
  sale_id uuid references public.sales (id),
  payment_id uuid references public.payments (id),
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid references public.shop_members (id),
  device_id uuid references public.devices (id),
  created_at timestamptz not null default now(),
  check (type <> 'debt' or amount > 0),
  check (type not in ('repayment', 'cancellation', 'write_off') or amount < 0),
  check (type <> 'repayment' or payment_id is not null)
);
comment on table public.customer_ledger is 'Le carnet de dettes : la dette d''un client = la somme de ses lignes.';

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  product_id uuid not null references public.products (id),
  lot_id uuid references public.stock_lots (id),
  type text not null check (type in ('receipt', 'sale', 'return', 'loss', 'adjustment', 'transfer_in', 'transfer_out')),
  quantity bigint not null check (quantity <> 0),               -- millièmes d'unité de base : + entrée, − sortie
  cost_amount bigint not null default 0,                        -- valeur au prix d'achat (même signe que la quantité)
  loss_reason text check (loss_reason in ('expired', 'broken', 'stolen', 'other')),
  receipt_id uuid references public.stock_receipts (id),
  sale_id uuid references public.sales (id),
  sale_item_id uuid references public.sale_items (id),
  inventory_count_id uuid references public.inventory_counts (id),
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid references public.shop_members (id),
  device_id uuid references public.devices (id),
  created_at timestamptz not null default now(),
  check (type not in ('receipt', 'return', 'transfer_in') or quantity > 0),
  check (type not in ('sale', 'loss', 'transfer_out') or quantity < 0),
  check (cost_amount = 0 or sign(cost_amount) = sign(quantity)),
  check ((type = 'loss') = (loss_reason is not null)),
  check (type not in ('sale', 'return') or sale_id is not null)
);
comment on table public.stock_movements is 'Chaque entrée ou sortie de stock. Le stock = la somme des mouvements.';


-- -----------------------------------------------------------------------------
-- 5. La traçabilité
-- -----------------------------------------------------------------------------

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  action text not null,                 -- ex. sale.cancel, product.price_change, stock.adjust
  entity_type text,                     -- ex. sale, product
  entity_id uuid,
  details jsonb,                        -- avant / après, montant, raison…
  member_id uuid references public.shop_members (id),   -- QUI
  device_id uuid references public.devices (id),        -- sur quel APPAREIL
  occurred_at timestamptz not null default now(),       -- QUAND
  created_at timestamptz not null default now()
);
comment on table public.audit_log is 'Le journal des actions sensibles : qui, quoi, quand, sur quel appareil.';


-- -----------------------------------------------------------------------------
-- 6. Index : pour retrouver vite les lignes d'une boutique
-- -----------------------------------------------------------------------------

create index shop_members_shop_id_idx on public.shop_members (shop_id);
create index shop_members_user_id_idx on public.shop_members (user_id);
create index devices_shop_id_idx on public.devices (shop_id);
create index customers_shop_id_idx on public.customers (shop_id);
create index payment_methods_shop_id_idx on public.payment_methods (shop_id);
create index categories_shop_id_idx on public.categories (shop_id);
create index products_shop_id_idx on public.products (shop_id);
create index product_units_shop_id_idx on public.product_units (shop_id);
create index product_units_product_id_idx on public.product_units (product_id);
create index stock_receipts_shop_id_idx on public.stock_receipts (shop_id);
create index stock_lots_shop_id_idx on public.stock_lots (shop_id);
create index stock_lots_product_id_idx on public.stock_lots (product_id);
create index inventory_counts_shop_id_idx on public.inventory_counts (shop_id);
create index inventory_lines_shop_id_idx on public.inventory_lines (shop_id);
create index cash_sessions_shop_id_idx on public.cash_sessions (shop_id);
create index sales_shop_id_idx on public.sales (shop_id);
create index sale_items_shop_id_idx on public.sale_items (shop_id);
create index sale_items_sale_id_idx on public.sale_items (sale_id);
create index payments_shop_id_idx on public.payments (shop_id);
create index customer_ledger_shop_id_idx on public.customer_ledger (shop_id);
create index customer_ledger_customer_id_idx on public.customer_ledger (customer_id);
create index stock_movements_shop_id_idx on public.stock_movements (shop_id);
create index stock_movements_product_id_idx on public.stock_movements (product_id);
create index audit_log_shop_id_idx on public.audit_log (shop_id);
