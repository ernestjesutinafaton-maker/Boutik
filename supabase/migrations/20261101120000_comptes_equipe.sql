-- =============================================================================
-- Boutik — Un compte personnel pour chaque membre de l'équipe (étape 1 : serveur)
-- =============================================================================
-- Décisions d'Ernest (01/11/2026) :
--   • le propriétaire crée le membre et choisit ses RÔLES ; Boutik prépare un LIEN personnel
--     (une seule fois, 7 jours). Le membre y choisit son e-mail, son mot de passe, son code PIN
--     et peut écrire son nom — jamais ses rôles ;
--   • sur le téléphone d'un membre « équipe » (vendeur, caissier, compteur, livreur) : ni prix
--     d'achat, ni coûts, ni comptes, ni journal, ni codes PIN des autres. Le gérant et le
--     responsable du stock reçoivent les coûts, pas les codes PIN. Le propriétaire reçoit tout.
--     → chaque membre a un NIVEAU D'ACCÈS calculé par le serveur, utilisé par la synchronisation
--       (powersync/sync-config.yaml) ;
--   • le coût des sorties de stock d'un membre « équipe » est calculé ICI (il n'a pas les coûts) ;
--   • nouveau rôle « livreur » (delivery).
-- Corrections de sécurité :
--   • un vendeur ou un caissier peut annuler SA vente pour la corriger (dans le délai choisi par
--     le propriétaire), et rien d'autre ;
--   • un membre « équipe » ne peut corriger que la date de péremption d'un lot, pas son coût.
-- =============================================================================

-- 1. Le rôle « livreur »
alter table public.shop_member_roles drop constraint shop_member_roles_role_check;
alter table public.shop_member_roles add constraint shop_member_roles_role_check check (
  role in ('owner', 'manager', 'cashier', 'seller', 'stock_manager', 'stock_counter', 'delivery')
);

-- 2. Le niveau d'accès de chaque membre (ce que reçoit son téléphone)
alter table public.shop_members add column access_level text not null default 'team'
  check (access_level in ('owner', 'costs', 'team'));
comment on column public.shop_members.access_level is
  'Calculé par le serveur à partir des rôles : owner = tout ; costs = les coûts, sans les codes PIN ; team = ni coûts, ni comptes, ni journal, ni codes PIN.';

create function private.compute_access_level(p_member_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when coalesce(bool_or(r.role = 'owner'), false) then 'owner'
           when coalesce(bool_or(r.role in ('manager', 'stock_manager')), false) then 'costs'
           else 'team'
         end
    from public.shop_member_roles r
   where r.member_id = p_member_id and r.revoked_at is null
$$;
revoke all on function private.compute_access_level(uuid) from public;

-- Toujours recalculé par le serveur : une valeur envoyée par un appareil est ignorée
create function private.set_member_access_level()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.access_level := private.compute_access_level(new.id);
  return new;
end;
$$;
create trigger shop_members_access_level
  before insert or update on public.shop_members
  for each row execute function private.set_member_access_level();

-- Un rôle donné ou retiré : le niveau de la personne suit
create function private.refresh_member_access_level()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.shop_members m
     set access_level = private.compute_access_level(m.id),
         updated_at = now()
   where m.id = new.member_id
     and m.access_level is distinct from private.compute_access_level(m.id);
  return null;
end;
$$;
create trigger shop_member_roles_access_level
  after insert or update on public.shop_member_roles
  for each row execute function private.refresh_member_access_level();

update public.shop_members m set access_level = private.compute_access_level(m.id);

-- Les profils de la personne connectée (un par boutique dont elle est membre active)
create function private.my_member_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.shop_members where user_id = (select auth.uid()) and active
$$;
revoke all on function private.my_member_ids() from public;
grant execute on function private.my_member_ids() to authenticated;

-- 3. Le coût des sorties de stock d'un membre « équipe » est calculé par le serveur
--    Même règle que l'appli (src/domain/quantity.ts, mulDiv) : au plus proche, demis vers le haut.
create function private.cost_for_quantity(p_cost_price bigint, p_cost_quantity bigint, p_quantity bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select (sign(p_cost_price::numeric * p_quantity)
          * floor((abs(p_cost_price::numeric * p_quantity) * 2 + p_cost_quantity) / (2 * p_cost_quantity)))::bigint
$$;

create function private.fill_team_movement_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_level text;
  v_price bigint;
  v_quantity bigint;
begin
  select m.access_level into v_level
    from public.shop_members m
   where m.shop_id = new.shop_id and m.user_id = auth.uid() and m.active;
  if v_level is distinct from 'team' then
    return new; -- propriétaire et responsables : le coût calculé par leur appareil est gardé
  end if;
  if new.lot_id is not null then
    select l.cost_price, l.cost_quantity into v_price, v_quantity
      from public.stock_lots l
     where l.id = new.lot_id;
  end if;
  if v_price is null then
    -- Sortie « sans lot » : au coût du dernier achat connu du produit (comme l'appli)
    select l.cost_price, l.cost_quantity into v_price, v_quantity
      from public.stock_lots l
     where l.product_id = new.product_id
     order by l.received_at desc, l.id desc
     limit 1;
  end if;
  new.cost_amount := case
    when v_price is null then 0
    else private.cost_for_quantity(v_price, v_quantity, new.quantity)
  end;
  return new;
end;
$$;
create trigger stock_movements_team_cost
  before insert on public.stock_movements
  for each row execute function private.fill_team_movement_cost();

-- 3 bis. Une clôture de caisse faite par un membre « équipe » : son téléphone n'a pas les coûts,
--        donc tout ce qui en découle (bénéfices, valeur du stock, achats) est retiré de la fiche
--        — sinon le propriétaire y verrait des bénéfices faux.
create function private.strip_team_report_costs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_level text;
begin
  select m.access_level into v_level
    from public.shop_members m
   where m.shop_id = new.shop_id and m.user_id = auth.uid() and m.active;
  if v_level = 'team' then
    new.data := (new.data - array['costOfGoods', 'grossProfit', 'netProfit', 'losses', 'adjustments', 'stock'])
                #- '{cash,stockPurchases}';
  end if;
  return new;
end;
$$;
create trigger reports_strip_team_costs
  before insert on public.reports
  for each row execute function private.strip_team_report_costs();

-- 4. Un vendeur ou un caissier corrige SA vente : il peut seulement l'annuler, dans le délai
create policy "Vendeur : annuler sa propre vente pour la corriger" on public.sales
  for update to authenticated
  using (seller_id in (select private.my_member_ids()))
  with check (seller_id in (select private.my_member_ids()));

create function private.check_sale_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_window integer;
  v_kept text[] := array['status', 'cancelled_at', 'cancelled_by', 'cancel_reason', 'updated_at'];
begin
  -- Fonctions du serveur, propriétaire et gérant : leurs propres règles s'appliquent déjà
  if current_user <> 'authenticated'
     or new.shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager'])) then
    return new;
  end if;
  if old.status <> 'completed' or new.status <> 'cancelled'
     or (to_jsonb(new) - v_kept) is distinct from (to_jsonb(old) - v_kept) then
    raise exception 'Seule l''annulation de sa propre vente, pour la corriger, est permise.'
      using errcode = '42501';
  end if;
  select s.return_window_hours into v_window from public.shops s where s.id = old.shop_id;
  if coalesce(new.cancelled_at, now()) > old.occurred_at + make_interval(hours => coalesce(v_window, 24)) then
    raise exception 'Le délai de modification de cette vente est passé.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger sales_check_update
  before update on public.sales
  for each row execute function private.check_sale_update();

-- 5. Un lot : seuls les responsables du stock changent autre chose que la date de péremption
create function private.check_lot_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kept text[] := array['expiry_date', 'updated_at'];
begin
  if current_user <> 'authenticated'
     or new.shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager', 'stock_manager'])) then
    return new;
  end if;
  if (to_jsonb(new) - v_kept) is distinct from (to_jsonb(old) - v_kept) then
    raise exception 'Seule la date de péremption d''un lot peut être corrigée.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger stock_lots_check_update
  before update on public.stock_lots
  for each row execute function private.check_lot_update();

-- 6. Les invitations : un lien personnel par membre (une seule fois, 7 jours)
--    Le code lui-même n'est jamais gardé : seulement son empreinte (sha256).
create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  member_id uuid not null references public.shop_members (id),
  code_hash text not null unique,
  email text check (email is null or length(email) <= 254),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users (id),
  revoked_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
comment on table public.team_invites is 'Les liens d''invitation des membres de l''équipe (empreinte du code seulement).';
create index team_invites_member_idx on public.team_invites (member_id);

alter table public.team_invites enable row level security;
revoke all on table public.team_invites from anon, authenticated;
grant select on table public.team_invites to authenticated;
create policy "Propriétaire : voir les invitations" on public.team_invites
  for select to authenticated
  using (shop_id in (select private.my_owned_shop_ids()));

create function private.invite_code_hash(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(coalesce(p_code, ''), 'UTF8')), 'hex')
$$;

-- Prépare un nouveau lien pour un membre (les anciens liens encore valables sont annulés)
create function private.issue_team_invite(p_shop_id uuid, p_member_id uuid, p_email text)
returns table (invite_code text, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_expires timestamptz := now() + interval '7 days';
begin
  update public.team_invites t
     set revoked_at = now()
   where t.member_id = p_member_id and t.used_at is null and t.revoked_at is null;
  insert into public.team_invites (shop_id, member_id, code_hash, email, expires_at, created_by)
  values (p_shop_id, p_member_id, private.invite_code_hash(v_code),
          nullif(lower(trim(coalesce(p_email, ''))), ''), v_expires, auth.uid());
  return query select v_code, v_expires;
end;
$$;
revoke all on function private.issue_team_invite(uuid, uuid, text) from public;

-- Le propriétaire invite un nouveau membre : rôles choisis, nom et e-mail facultatifs
create function public.invite_team_member(
  p_shop_id uuid,
  p_display_name text,
  p_roles text[],
  p_email text
)
returns table (member_id uuid, invite_code text, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid;
  v_owner_member uuid;
  v_role text;
  v_name text := left(nullif(trim(coalesce(p_display_name, '')), ''), 60);
begin
  if not (p_shop_id in (select private.my_owned_shop_ids())) then
    raise exception 'Seul le propriétaire invite des membres.' using errcode = '42501';
  end if;
  if p_roles is null or cardinality(p_roles) = 0 then
    raise exception 'Choisis au moins un rôle.' using errcode = '22023';
  end if;
  foreach v_role in array p_roles loop
    if v_role is null or v_role not in ('manager', 'cashier', 'seller', 'stock_manager', 'stock_counter', 'delivery') then
      raise exception 'Rôle non permis pour une invitation : %', v_role using errcode = '22023';
    end if;
  end loop;

  select m.id into v_owner_member
    from public.shop_members m
   where m.shop_id = p_shop_id and m.user_id = auth.uid() and m.active
   limit 1;
  insert into public.shop_members (shop_id, display_name, active)
  values (p_shop_id, coalesce(v_name, 'Nouveau membre'), true)
  returning id into v_member;
  insert into public.shop_member_roles (shop_id, member_id, role, granted_by)
  select p_shop_id, v_member, chosen.role, v_owner_member
    from (select distinct unnest(p_roles) as role) as chosen;

  return query
    select v_member, issued.invite_code, issued.invite_expires_at
      from private.issue_team_invite(p_shop_id, v_member, p_email) as issued;
end;
$$;
revoke all on function public.invite_team_member(uuid, text, text[], text) from public;
grant execute on function public.invite_team_member(uuid, text, text[], text) to authenticated;

-- Un nouveau lien pour un membre qui n'a pas encore de compte (ex. profil à code PIN)
create function public.create_team_invite(p_member_id uuid, p_email text)
returns table (invite_code text, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.shop_members;
begin
  select * into v_member from public.shop_members m where m.id = p_member_id;
  if not found or not (v_member.shop_id in (select private.my_owned_shop_ids())) then
    raise exception 'Seul le propriétaire invite des membres.' using errcode = '42501';
  end if;
  if v_member.user_id is not null then
    raise exception 'Cette personne a déjà son compte.' using errcode = '22023';
  end if;
  if not v_member.active then
    raise exception 'Cette personne a été retirée de l''équipe.' using errcode = '22023';
  end if;
  return query select * from private.issue_team_invite(v_member.shop_id, v_member.id, p_email);
end;
$$;
revoke all on function public.create_team_invite(uuid, text) from public;
grant execute on function public.create_team_invite(uuid, text) to authenticated;

-- Annuler le lien d'un membre (propriétaire)
create function public.revoke_team_invite(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.shop_members m
     where m.id = p_member_id and m.shop_id in (select private.my_owned_shop_ids())
  ) then
    raise exception 'Seul le propriétaire gère les invitations.' using errcode = '42501';
  end if;
  update public.team_invites t
     set revoked_at = now()
   where t.member_id = p_member_id and t.used_at is null and t.revoked_at is null;
end;
$$;
revoke all on function public.revoke_team_invite(uuid) from public;
grant execute on function public.revoke_team_invite(uuid) to authenticated;

-- Ce que montre la page du lien (accessible sans être connecté) : jamais d'autre donnée
create function public.get_team_invite(p_code text)
returns table (invite_status text, shop_name text, member_name text, member_roles text[], suggested_email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_invite public.team_invites;
begin
  select * into v_invite from public.team_invites t where t.code_hash = private.invite_code_hash(p_code);
  if not found then
    return query select 'unknown'::text, null::text, null::text, null::text[], null::text;
    return;
  end if;
  return query
    select case
             when v_invite.used_at is not null then 'used'
             when v_invite.revoked_at is not null then 'revoked'
             when v_invite.expires_at <= now() then 'expired'
             else 'valid'
           end,
           s.name,
           m.display_name,
           array(
             select r.role from public.shop_member_roles r
              where r.member_id = m.id and r.revoked_at is null
              order by r.role
           ),
           v_invite.email
      from public.shops s
      join public.shop_members m on m.id = v_invite.member_id
     where s.id = v_invite.shop_id;
end;
$$;
revoke all on function public.get_team_invite(text) from public;
grant execute on function public.get_team_invite(text) to anon, authenticated;

-- Le membre accepte : son compte est relié à son profil (rôles déjà fixés par le propriétaire)
create function public.accept_team_invite(
  p_code text,
  p_display_name text,
  p_pin_hash text,
  p_pin_salt text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.team_invites;
  v_name text := left(nullif(trim(coalesce(p_display_name, '')), ''), 60);
begin
  if auth.uid() is null then
    raise exception 'Connecte-toi d''abord.' using errcode = '42501';
  end if;
  select * into v_invite from public.team_invites t
   where t.code_hash = private.invite_code_hash(p_code)
   for update;
  if not found or v_invite.revoked_at is not null then
    raise exception 'Ce lien n''est pas valable.' using errcode = '22023';
  end if;
  if v_invite.used_at is not null then
    raise exception 'Ce lien a déjà servi.' using errcode = '22023';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'Ce lien a expiré : demande un nouveau lien au propriétaire.' using errcode = '22023';
  end if;
  -- Un compte = une seule boutique
  if exists (select 1 from public.shop_members m where m.user_id = auth.uid() and m.active) then
    raise exception 'Ce compte appartient déjà à une boutique.' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.shop_members m where m.user_id = auth.uid() and m.shop_id = v_invite.shop_id
  ) then
    raise exception 'Ce compte a déjà été membre de cette boutique : demande au propriétaire de te réactiver.'
      using errcode = '23505';
  end if;
  -- Code PIN : l'empreinte et le sel ensemble, au format de l'appli (src/domain/pin.ts)
  if (p_pin_hash is null) <> (p_pin_salt is null)
     or (p_pin_hash is not null
         and (p_pin_hash !~ '^[0-9a-f]{64}$' or p_pin_salt !~ '^[0-9a-f]{32}$')) then
    raise exception 'Code PIN invalide.' using errcode = '22023';
  end if;

  update public.shop_members m
     set user_id = auth.uid(),
         display_name = coalesce(v_name, m.display_name),
         pin_hash = coalesce(p_pin_hash, m.pin_hash),
         pin_salt = coalesce(p_pin_salt, m.pin_salt),
         updated_at = now()
   where m.id = v_invite.member_id and m.active and m.user_id is null;
  if not found then
    raise exception 'Ce lien n''est plus valable.' using errcode = '22023';
  end if;
  update public.team_invites t set used_at = now(), used_by = auth.uid() where t.id = v_invite.id;
  return v_invite.shop_id;
end;
$$;
revoke all on function public.accept_team_invite(text, text, text, text) from public;
grant execute on function public.accept_team_invite(text, text, text, text) to authenticated;

-- Le membre change son nom ou son code PIN (jamais ses rôles, ni son niveau d'accès)
create function public.update_my_member_profile(p_display_name text, p_pin_hash text, p_pin_salt text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(nullif(trim(coalesce(p_display_name, '')), ''), 60);
begin
  if (p_pin_hash is null) <> (p_pin_salt is null)
     or (p_pin_hash is not null
         and (p_pin_hash !~ '^[0-9a-f]{64}$' or p_pin_salt !~ '^[0-9a-f]{32}$')) then
    raise exception 'Code PIN invalide.' using errcode = '22023';
  end if;
  update public.shop_members m
     set display_name = coalesce(v_name, m.display_name),
         pin_hash = coalesce(p_pin_hash, m.pin_hash),
         pin_salt = coalesce(p_pin_salt, m.pin_salt),
         updated_at = now()
   where m.user_id = auth.uid() and m.active;
  if not found then
    raise exception 'Aucune boutique pour ce compte.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.update_my_member_profile(text, text, text) from public;
grant execute on function public.update_my_member_profile(text, text, text) to authenticated;

-- Pour l'appli : la personne a-t-elle une boutique, ou en a-t-elle été retirée ?
create function public.my_membership_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when exists (select 1 from public.shop_members m where m.user_id = auth.uid() and m.active)
             then 'active'
           when exists (select 1 from public.shop_members m where m.user_id = auth.uid())
             then 'removed'
           else 'none'
         end
$$;
revoke all on function public.my_membership_status() from public;
grant execute on function public.my_membership_status() to authenticated;
