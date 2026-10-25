-- =============================================================================
-- Boutik — Sécurité : chaque boutique ne voit et ne modifie QUE ses propres données
-- =============================================================================
-- Le principe (RLS = « Row Level Security », sécurité ligne par ligne) :
-- pour chaque ligne demandée, le serveur vérifie que la personne connectée est
-- membre de la boutique de cette ligne. Sinon, la ligne est invisible et toute
-- écriture est refusée, même si quelqu'un essaie de tricher avec l'application.
--
-- Rappel : les vendeurs n'ont pas de compte (profil + code PIN sur l'appareil de la
-- boutique). Les comptes connectés sont donc des propriétaires. Les règles « réservé
-- au propriétaire » ci-dessous protègent déjà la V2 (vendeurs avec leur propre compte).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Fonctions utilitaires (rangées dans « private », un schéma non exposé à l'API)
-- -----------------------------------------------------------------------------

create schema if not exists private;
grant usage on schema private to authenticated;

-- Les boutiques dont la personne connectée est membre actif
create function private.my_shop_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select shop_id
  from public.shop_members
  where user_id = (select auth.uid()) and active
$$;

-- Les boutiques dont la personne connectée est propriétaire
create function private.my_owned_shop_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select shop_id
  from public.shop_members
  where user_id = (select auth.uid()) and active and role = 'owner'
$$;

revoke all on function private.my_shop_ids() from public;
revoke all on function private.my_owned_shop_ids() from public;
grant execute on function private.my_shop_ids() to authenticated;
grant execute on function private.my_owned_shop_ids() to authenticated;


-- -----------------------------------------------------------------------------
-- 2. Activer la sécurité ligne par ligne sur TOUTES les tables
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'shops', 'shop_members', 'devices', 'customers', 'payment_methods',
    'categories', 'products', 'product_units',
    'stock_receipts', 'stock_lots', 'inventory_counts', 'inventory_lines',
    'cash_sessions', 'sales', 'sale_items', 'payments', 'customer_ledger',
    'stock_movements', 'audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Les visiteurs non connectés (« anon ») n'ont accès à rien.
revoke all on all tables in schema public from anon;
-- Les personnes connectées peuvent lire, ajouter et modifier : les règles ci-dessous
-- filtrent ensuite ligne par ligne. Personne ne peut supprimer : on archive ou on annule.
grant select, insert, update on all tables in schema public to authenticated;
revoke delete, truncate on all tables in schema public from authenticated;


-- -----------------------------------------------------------------------------
-- 3. Les règles, table par table
-- -----------------------------------------------------------------------------

-- La boutique : les membres la voient, seul le propriétaire modifie ses réglages.
-- Pas de règle d'ajout : une boutique se crée uniquement avec la fonction create_shop.
create policy "Membres : voir la boutique" on public.shops
  for select to authenticated
  using (id in (select private.my_shop_ids()));
create policy "Propriétaire : modifier la boutique" on public.shops
  for update to authenticated
  using (id in (select private.my_owned_shop_ids()))
  with check (id in (select private.my_owned_shop_ids()));

-- Tables lues par tous les membres, mais écrites seulement par le propriétaire :
-- les personnes et codes PIN, les modes de paiement, le catalogue (prix compris), les inventaires.
do $$
declare
  t text;
begin
  foreach t in array array[
    'shop_members', 'payment_methods', 'categories', 'products', 'product_units',
    'inventory_counts', 'inventory_lines'
  ] loop
    execute format(
      'create policy "Membres : lecture" on public.%I for select to authenticated
         using (shop_id in (select private.my_shop_ids()))', t);
    execute format(
      'create policy "Propriétaire : ajout" on public.%I for insert to authenticated
         with check (shop_id in (select private.my_owned_shop_ids()))', t);
    execute format(
      'create policy "Propriétaire : modification" on public.%I for update to authenticated
         using (shop_id in (select private.my_owned_shop_ids()))
         with check (shop_id in (select private.my_owned_shop_ids()))', t);
  end loop;
end $$;

-- Tables lues, complétées et modifiées par tous les membres :
-- clients (créés à la caisse), lots (date de péremption à corriger), caisse du jour.
do $$
declare
  t text;
begin
  foreach t in array array['customers', 'stock_lots', 'cash_sessions'] loop
    execute format(
      'create policy "Membres : lecture" on public.%I for select to authenticated
         using (shop_id in (select private.my_shop_ids()))', t);
    execute format(
      'create policy "Membres : ajout" on public.%I for insert to authenticated
         with check (shop_id in (select private.my_shop_ids()))', t);
    execute format(
      'create policy "Membres : modification" on public.%I for update to authenticated
         using (shop_id in (select private.my_shop_ids()))
         with check (shop_id in (select private.my_shop_ids()))', t);
  end loop;
end $$;

-- Tables « journal » : on lit et on ajoute, mais on ne modifie JAMAIS une ligne.
-- Une erreur se corrige par une nouvelle ligne (retour, annulation, ajustement…).
do $$
declare
  t text;
begin
  foreach t in array array[
    'stock_receipts', 'sale_items', 'payments', 'customer_ledger', 'audit_log'
  ] loop
    execute format(
      'create policy "Membres : lecture" on public.%I for select to authenticated
         using (shop_id in (select private.my_shop_ids()))', t);
    execute format(
      'create policy "Membres : ajout" on public.%I for insert to authenticated
         with check (shop_id in (select private.my_shop_ids()))', t);
  end loop;
end $$;

-- Les mouvements de stock : journal aussi, et l'ajustement de stock est réservé au propriétaire.
create policy "Membres : lecture" on public.stock_movements
  for select to authenticated
  using (shop_id in (select private.my_shop_ids()));
create policy "Membres : ajout (ajustement réservé au propriétaire)" on public.stock_movements
  for insert to authenticated
  with check (
    shop_id in (select private.my_shop_ids())
    and (type <> 'adjustment' or shop_id in (select private.my_owned_shop_ids()))
  );

-- Les ventes : tout membre vend ; seul le propriétaire modifie une vente (annulation).
create policy "Membres : lecture" on public.sales
  for select to authenticated
  using (shop_id in (select private.my_shop_ids()));
create policy "Membres : ajout" on public.sales
  for insert to authenticated
  with check (shop_id in (select private.my_shop_ids()));
create policy "Propriétaire : modification (annulation)" on public.sales
  for update to authenticated
  using (shop_id in (select private.my_owned_shop_ids()))
  with check (shop_id in (select private.my_owned_shop_ids()));

-- Les appareils : les membres les voient et les mettent à jour (nom, dernière connexion).
-- Pas de règle d'ajout : un appareil s'enregistre uniquement avec la fonction register_device.
create policy "Membres : lecture" on public.devices
  for select to authenticated
  using (shop_id in (select private.my_shop_ids()));
create policy "Membres : modification" on public.devices
  for update to authenticated
  using (shop_id in (select private.my_shop_ids()))
  with check (shop_id in (select private.my_shop_ids()));


-- -----------------------------------------------------------------------------
-- 4. Fonctions appelées par l'application (en ligne seulement)
-- -----------------------------------------------------------------------------

-- Créer une boutique : la personne connectée en devient propriétaire.
-- Tout se fait d'un seul coup : boutique + propriétaire + modes de paiement du pays.
-- p_payment_methods : [{"code": "cash", "label": "Espèces", "kind": "cash"}, …]
create function public.create_shop(
  p_name text,
  p_country_code text,
  p_currency_code text,
  p_owner_name text,
  p_payment_methods jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_shop_id uuid;
begin
  if v_user_id is null then
    raise exception 'Il faut être connecté pour créer une boutique.';
  end if;

  insert into public.shops (name, country_code, currency_code)
  values (p_name, p_country_code, p_currency_code)
  returning id into v_shop_id;

  insert into public.shop_members (shop_id, user_id, display_name, role)
  values (v_shop_id, v_user_id, p_owner_name, 'owner');

  insert into public.payment_methods (shop_id, code, label, kind, sort_order)
  select v_shop_id, pm.code, pm.label, pm.kind, pm.n::integer
  from rows from (
    jsonb_to_recordset(coalesce(p_payment_methods, '[]'::jsonb)) as (code text, label text, kind text)
  ) with ordinality as pm (code, label, kind, n);

  return v_shop_id;
end;
$$;

-- Enregistrer un appareil dans une boutique et lui donner un numéro (1, 2, 3…),
-- utilisé dans les numéros de facture. Si l'appareil est déjà enregistré, on renvoie son numéro.
create function public.register_device(
  p_device_id uuid,
  p_shop_id uuid,
  p_name text,
  p_platform text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number integer;
begin
  if p_shop_id not in (select private.my_shop_ids()) then
    raise exception 'Vous n''êtes pas membre de cette boutique.';
  end if;

  select device_number into v_number
  from public.devices
  where id = p_device_id and shop_id = p_shop_id;

  if found then
    update public.devices set last_seen_at = now() where id = p_device_id;
    return v_number;
  end if;

  -- Un seul enregistrement à la fois par boutique : deux appareils ne reçoivent jamais le même numéro
  perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text, 0));

  select coalesce(max(device_number), 0) + 1 into v_number
  from public.devices
  where shop_id = p_shop_id;

  insert into public.devices (id, shop_id, device_number, name, platform, registered_by, last_seen_at)
  values (p_device_id, p_shop_id, v_number, p_name, p_platform, (select auth.uid()), now());

  return v_number;
end;
$$;

-- Seules les personnes connectées peuvent appeler ces fonctions
revoke all on function public.create_shop(text, text, text, text, jsonb) from public, anon;
revoke all on function public.register_device(uuid, uuid, text, text) from public, anon;
grant execute on function public.create_shop(text, text, text, text, jsonb) to authenticated;
grant execute on function public.register_device(uuid, uuid, text, text) to authenticated;
