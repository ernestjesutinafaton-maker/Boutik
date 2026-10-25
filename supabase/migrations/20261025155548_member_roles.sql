-- =============================================================================
-- Boutik — Plusieurs rôles par personne
-- =============================================================================
-- Une même personne peut avoir plusieurs rôles en même temps
-- (ex. vendeur ET caissier ; ou gérant, vendeur ET caissier).
--
-- C'est une relation « plusieurs à plusieurs » : une personne a plusieurs rôles,
-- et un même rôle est donné à plusieurs personnes. On la représente avec une
-- TABLE DE LIAISON : une ligne = « telle personne a tel rôle ».
-- Les droits d'une personne = la réunion des droits de tous ses rôles.
--
-- Les rôles possibles :
--   owner          Propriétaire           (tous les droits)
--   manager        Gérant                 (remplace le propriétaire, sauf bénéfices et équipe)
--   cashier        Caissier
--   seller         Vendeur
--   stock_manager  Gestionnaire de stock
--   stock_counter  Compteur d'inventaire
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. La table de liaison « personne ↔ rôle »
-- -----------------------------------------------------------------------------

create table public.shop_member_roles (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  member_id uuid not null references public.shop_members (id),
  role text not null check (
    role in ('owner', 'manager', 'cashier', 'seller', 'stock_manager', 'stock_counter')
  ),
  granted_by uuid references public.shop_members (id),   -- qui a donné ce rôle
  granted_at timestamptz not null default now(),
  -- Rôle retiré : la ligne n'est pas supprimée, elle garde l'historique (qui, quand)
  revoked_by uuid references public.shop_members (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.shop_member_roles is
  'Les rôles de chaque personne (une personne peut en avoir plusieurs). Un rôle retiré garde sa ligne (revoked_at).';

create index shop_member_roles_shop_id_idx on public.shop_member_roles (shop_id);
create index shop_member_roles_member_id_idx on public.shop_member_roles (member_id);

-- Les rôles déjà enregistrés passent dans la nouvelle table, puis l'ancienne colonne disparaît
insert into public.shop_member_roles (shop_id, member_id, role)
select shop_id, id, role from public.shop_members;

alter table public.shop_members drop column role;


-- -----------------------------------------------------------------------------
-- 2. Sécurité de la nouvelle table : les membres la voient, seul le propriétaire
--    donne ou retire des rôles. Jamais de suppression.
-- -----------------------------------------------------------------------------

alter table public.shop_member_roles enable row level security;
revoke all on table public.shop_member_roles from anon;
grant select, insert, update on table public.shop_member_roles to authenticated;
revoke delete, truncate on table public.shop_member_roles from authenticated;


-- -----------------------------------------------------------------------------
-- 3. Les fonctions utilitaires tiennent compte des rôles multiples
-- -----------------------------------------------------------------------------

-- Les boutiques où la personne connectée a AU MOINS UN des rôles demandés
create function private.my_shop_ids_with_role(p_roles text[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.shop_id
  from public.shop_members m
  join public.shop_member_roles r on r.member_id = m.id
  where m.user_id = (select auth.uid())
    and m.active
    and r.revoked_at is null
    and r.role = any (p_roles)
$$;

revoke all on function private.my_shop_ids_with_role(text[]) from public;
grant execute on function private.my_shop_ids_with_role(text[]) to authenticated;

-- « Propriétaire » se lit désormais dans la table de liaison.
-- Toutes les règles déjà écrites avec my_owned_shop_ids() en profitent automatiquement.
create or replace function private.my_owned_shop_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.my_shop_ids_with_role(array['owner'])
$$;

create policy "Membres : lecture" on public.shop_member_roles
  for select to authenticated
  using (shop_id in (select private.my_shop_ids()));
create policy "Propriétaire : donner un rôle" on public.shop_member_roles
  for insert to authenticated
  with check (shop_id in (select private.my_owned_shop_ids()));
create policy "Propriétaire : retirer un rôle" on public.shop_member_roles
  for update to authenticated
  using (shop_id in (select private.my_owned_shop_ids()))
  with check (shop_id in (select private.my_owned_shop_ids()));


-- -----------------------------------------------------------------------------
-- 4. Les règles qui changent avec les nouveaux rôles
-- -----------------------------------------------------------------------------

-- Catalogue et prix : propriétaire ET gérant
do $$
declare
  t text;
begin
  foreach t in array array['categories', 'products', 'product_units'] loop
    execute format('drop policy "Propriétaire : ajout" on public.%I', t);
    execute format('drop policy "Propriétaire : modification" on public.%I', t);
    execute format(
      'create policy "Propriétaire et gérant : ajout" on public.%I for insert to authenticated
         with check (shop_id in (select private.my_shop_ids_with_role(array[''owner'', ''manager''])))', t);
    execute format(
      'create policy "Propriétaire et gérant : modification" on public.%I for update to authenticated
         using (shop_id in (select private.my_shop_ids_with_role(array[''owner'', ''manager''])))
         with check (shop_id in (select private.my_shop_ids_with_role(array[''owner'', ''manager''])))', t);
  end loop;
end $$;

-- Inventaire : lancé et validé par propriétaire, gérant ou gestionnaire de stock
drop policy "Propriétaire : ajout" on public.inventory_counts;
drop policy "Propriétaire : modification" on public.inventory_counts;
create policy "Responsables du stock : ajout" on public.inventory_counts
  for insert to authenticated
  with check (shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager', 'stock_manager'])));
create policy "Responsables du stock : modification" on public.inventory_counts
  for update to authenticated
  using (shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager', 'stock_manager'])))
  with check (shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager', 'stock_manager'])));

-- Lignes d'inventaire : le compteur aussi peut saisir ce qu'il a compté
drop policy "Propriétaire : ajout" on public.inventory_lines;
drop policy "Propriétaire : modification" on public.inventory_lines;
create policy "Responsables du stock et compteurs : ajout" on public.inventory_lines
  for insert to authenticated
  with check (shop_id in (select private.my_shop_ids_with_role(
    array['owner', 'manager', 'stock_manager', 'stock_counter'])));
create policy "Responsables du stock et compteurs : modification" on public.inventory_lines
  for update to authenticated
  using (shop_id in (select private.my_shop_ids_with_role(
    array['owner', 'manager', 'stock_manager', 'stock_counter'])))
  with check (shop_id in (select private.my_shop_ids_with_role(
    array['owner', 'manager', 'stock_manager', 'stock_counter'])));

-- Ajustement de stock : propriétaire, gérant ou gestionnaire de stock
drop policy "Membres : ajout (ajustement réservé au propriétaire)" on public.stock_movements;
create policy "Membres : ajout (ajustement réservé aux responsables du stock)" on public.stock_movements
  for insert to authenticated
  with check (
    shop_id in (select private.my_shop_ids())
    and (
      type <> 'adjustment'
      or shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager', 'stock_manager']))
    )
  );

-- Annulation d'une vente : propriétaire ou gérant
drop policy "Propriétaire : modification (annulation)" on public.sales;
create policy "Propriétaire et gérant : modification (annulation)" on public.sales
  for update to authenticated
  using (shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager'])))
  with check (shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager'])));


-- -----------------------------------------------------------------------------
-- 5. create_shop donne le rôle « Propriétaire » à la personne qui crée la boutique
-- -----------------------------------------------------------------------------

create or replace function public.create_shop(
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
  v_member_id uuid;
begin
  if v_user_id is null then
    raise exception 'Il faut être connecté pour créer une boutique.';
  end if;

  insert into public.shops (name, country_code, currency_code)
  values (p_name, p_country_code, p_currency_code)
  returning id into v_shop_id;

  insert into public.shop_members (shop_id, user_id, display_name)
  values (v_shop_id, v_user_id, p_owner_name)
  returning id into v_member_id;

  insert into public.shop_member_roles (shop_id, member_id, role, granted_by)
  values (v_shop_id, v_member_id, 'owner', v_member_id);

  insert into public.payment_methods (shop_id, code, label, kind, sort_order)
  select v_shop_id, pm.code, pm.label, pm.kind, pm.n::integer
  from rows from (
    jsonb_to_recordset(coalesce(p_payment_methods, '[]'::jsonb)) as (code text, label text, kind text)
  ) with ordinality as pm (code, label, kind, n);

  return v_shop_id;
end;
$$;
