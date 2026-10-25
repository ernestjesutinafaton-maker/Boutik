-- =============================================================================
-- Boutik — La « publication » pour PowerSync
-- =============================================================================
-- PowerSync suit en direct chaque changement de la base (ajout, modification),
-- puis l'envoie aux appareils concernés. Pour cela, PostgreSQL publie la liste
-- des changements des tables nommées ci-dessous : c'est la « publication ».
--
-- ⚠️ Toute nouvelle table à synchroniser devra être ajoutée ici
-- (alter publication powersync add table …) ET dans powersync/sync-config.yaml.
--
-- Le compte « powersync_role », qui lit ces changements, est créé à la main dans
-- Supabase (son mot de passe ne doit jamais être écrit dans un fichier du projet).
-- =============================================================================

create publication powersync for table
  public.shops,
  public.shop_members,
  public.shop_member_roles,
  public.devices,
  public.customers,
  public.payment_methods,
  public.categories,
  public.products,
  public.product_units,
  public.stock_receipts,
  public.stock_lots,
  public.stock_movements,
  public.inventory_counts,
  public.inventory_lines,
  public.cash_sessions,
  public.sales,
  public.sale_items,
  public.payments,
  public.customer_ledger,
  public.audit_log;
