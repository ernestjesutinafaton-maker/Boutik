-- =============================================================================
-- Boutik — Les livraisons (étape 4 : la base de données)
-- =============================================================================
-- Décisions d'Ernest (01/11/2026) :
--   • une livraison se crée depuis une vente, par le vendeur ou ses supérieurs (caissier, gérant,
--     propriétaire). Elle va à UN livreur précis, ou reste ouverte à tous les livreurs ;
--   • le livreur la voit sur son téléphone, la prend (« Je m'en occupe »), la livre puis la marque
--     terminée. Il peut ENCAISSER à la livraison : c'est un remboursement de la dette du client
--     (la partie non payée de la vente est une dette, comme une vente à crédit) ;
--   • l'argent liquide encaissé reste « chez le livreur » jusqu'à sa REMISE à la caisse, notée par
--     le caissier, le gérant ou le propriétaire. Le Mobile Money arrive directement sur le numéro
--     de la boutique : il n'y a rien à remettre ;
--   • le livreur note ses DÉPENSES (carburant, transport…) avec la PHOTO du reçu, gardée dans un
--     stockage privé. Le propriétaire ou le gérant les rembourse à part (ou les refuse, avec une
--     raison) : le remboursement est une dépense de la caisse, comptée dans le « compte ».
-- Premier arrivé, premier servi : si deux livreurs prennent la même livraison hors ligne, le
-- serveur garde le premier et refuse le second (son téléphone reprend alors la version du serveur).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Les livraisons
-- -----------------------------------------------------------------------------

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  sale_id uuid references public.sales (id),            -- la vente à livrer
  customer_id uuid references public.customers (id),    -- obligatoire s'il y a de l'argent à encaisser
  contact_name text check (contact_name is null or length(trim(contact_name)) between 1 and 100),
  contact_phone text check (contact_phone is null or length(contact_phone) <= 30),
  address text not null check (length(trim(address)) between 1 and 300),
  landmark text check (landmark is null or length(landmark) <= 300),   -- repère : « derrière la pharmacie »
  requested_at timestamptz,                             -- date et heure souhaitées (vide : dès que possible)
  amount_to_collect bigint not null default 0 check (amount_to_collect >= 0),
  assigned_to uuid references public.shop_members (id), -- le livreur ; vide = ouverte à tous les livreurs
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'delivered', 'failed', 'cancelled')),
  started_at timestamptz,                               -- « Je m'en occupe »
  delivered_at timestamptz,
  failed_reason text check (failed_reason is null or length(trim(failed_reason)) between 1 and 300),
  cancelled_at timestamptz,
  cancel_reason text check (cancel_reason is null or length(cancel_reason) <= 300),
  note text check (note is null or length(note) <= 500),
  created_by uuid references public.shop_members (id),
  device_id uuid references public.devices (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_to_collect = 0 or customer_id is not null),   -- l'argent encaissé rembourse la dette d'un client
  check (status not in ('in_progress', 'delivered') or assigned_to is not null),
  check ((status = 'delivered') = (delivered_at is not null)),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  check (status <> 'failed' or failed_reason is not null)
);
comment on table public.deliveries is
  'Les livraisons : depuis une vente, pour un livreur précis ou ouvertes à tous les livreurs.';

create index deliveries_shop_id_idx on public.deliveries (shop_id);
create index deliveries_assigned_to_idx on public.deliveries (assigned_to) where assigned_to is not null;
create index deliveries_sale_id_idx on public.deliveries (sale_id) where sale_id is not null;


-- -----------------------------------------------------------------------------
-- 2. Les dépenses des livreurs (avec la photo du reçu)
-- -----------------------------------------------------------------------------

create table public.delivery_expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  courier_id uuid not null references public.shop_members (id),   -- la personne qui a payé
  delivery_id uuid references public.deliveries (id),             -- facultatif : dépense de la journée
  category text not null check (category in ('transport', 'fuel', 'repairs', 'other')),
  amount bigint not null check (amount > 0),
  note text check (note is null or length(note) <= 300),
  -- Photo du reçu, dans le stockage privé « delivery-proofs », dossier du livreur :
  -- <boutique>/<livreur>/<fichier>
  proof_path text not null,
  status text not null default 'pending' check (status in ('pending', 'reimbursed', 'rejected')),
  reviewed_by uuid references public.shop_members (id),
  reviewed_at timestamptz,
  review_note text check (review_note is null or length(trim(review_note)) between 1 and 300),
  occurred_at timestamptz not null default now(),
  created_by uuid references public.shop_members (id),
  device_id uuid references public.devices (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(proof_path) <= 300 and position('..' in proof_path) = 0
         and starts_with(proof_path, shop_id::text || '/' || courier_id::text || '/')),
  check ((status = 'pending') = (reviewed_at is null)),
  check (status <> 'rejected' or review_note is not null)       -- un refus se justifie
);
comment on table public.delivery_expenses is
  'Les dépenses des livreurs, avec la photo du reçu : remboursées (dépense de la caisse) ou refusées.';

create index delivery_expenses_shop_id_idx on public.delivery_expenses (shop_id);
create index delivery_expenses_courier_id_idx on public.delivery_expenses (courier_id);


-- -----------------------------------------------------------------------------
-- 3. L'argent : encaissé à la livraison, remis à la caisse, dépenses remboursées
-- -----------------------------------------------------------------------------

-- Encaissé à la livraison : un remboursement de la dette du client, relié à la livraison.
-- En espèces et sans caisse ouverte sur le téléphone, cet argent est « chez le livreur ».
alter table public.payments add column delivery_id uuid references public.deliveries (id);
alter table public.payments add constraint payments_delivery_is_repayment
  check (delivery_id is null or kind = 'repayment');
create index payments_delivery_id_idx on public.payments (delivery_id) where delivery_id is not null;
comment on column public.payments.delivery_id is
  'Argent encaissé à la livraison (remboursement de la dette du client de la livraison).';

-- La caisse reçoit deux nouvelles sortes de mouvements :
--   handover  la REMISE d'un livreur : l'argent qu'il a encaissé entre dans la caisse ;
--   expense + delivery_expense_id : le REMBOURSEMENT d'une dépense de livreur (une seule fois).
alter table public.cash_movements drop constraint cash_movements_type_check;
alter table public.cash_movements add constraint cash_movements_type_check
  check (type in ('expense', 'stock_purchase', 'withdrawal', 'deposit', 'handover'));
alter table public.cash_movements
  add column courier_id uuid references public.shop_members (id),
  add column delivery_expense_id uuid references public.delivery_expenses (id);
alter table public.cash_movements add constraint cash_movements_handover_courier
  check ((type = 'handover') = (courier_id is not null));
alter table public.cash_movements add constraint cash_movements_reimbursement_is_expense
  check (delivery_expense_id is null or type = 'expense');
create unique index cash_movements_delivery_expense_once
  on public.cash_movements (delivery_expense_id) where delivery_expense_id is not null;
create index cash_movements_courier_id_idx on public.cash_movements (courier_id) where courier_id is not null;
comment on column public.cash_movements.courier_id is 'Remise à la caisse : le livreur qui apporte l''argent.';
comment on column public.cash_movements.delivery_expense_id is 'Remboursement de cette dépense de livreur.';


-- -----------------------------------------------------------------------------
-- 4. Sécurité : qui voit, ajoute et modifie quoi
-- -----------------------------------------------------------------------------

alter table public.deliveries enable row level security;
alter table public.delivery_expenses enable row level security;
revoke all on table public.deliveries, public.delivery_expenses from anon, authenticated;
grant select, insert, update on table public.deliveries, public.delivery_expenses to authenticated;

-- Les livraisons : toute l'équipe les voit ; vendeurs et responsables les créent ;
-- les livreurs les mettent à jour (prendre, livrer) selon les règles de la partie 5.
create policy "Membres : voir les livraisons" on public.deliveries
  for select to authenticated
  using (shop_id in (select private.my_shop_ids()));
create policy "Vendeurs et responsables : créer une livraison" on public.deliveries
  for insert to authenticated
  with check (shop_id in (select private.my_shop_ids_with_role(
    array['owner', 'manager', 'cashier', 'seller'])));
create policy "Vendeurs, responsables et livreurs : mettre à jour une livraison" on public.deliveries
  for update to authenticated
  using (shop_id in (select private.my_shop_ids_with_role(
    array['owner', 'manager', 'cashier', 'seller', 'delivery'])))
  with check (shop_id in (select private.my_shop_ids_with_role(
    array['owner', 'manager', 'cashier', 'seller', 'delivery'])));

-- Les dépenses : chacun voit et déclare LES SIENNES ; le propriétaire et les responsables
-- (niveau « coûts ») les voient toutes ; le propriétaire et le gérant décident.
create policy "Livreur (les siennes) et responsables : voir les dépenses de livraison"
  on public.delivery_expenses
  for select to authenticated
  using (
    courier_id in (select private.my_member_ids())
    or shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager', 'stock_manager']))
  );
create policy "Chacun déclare ses dépenses ; propriétaire et gérant pour un livreur"
  on public.delivery_expenses
  for insert to authenticated
  with check (
    shop_id in (select private.my_shop_ids())
    and (
      courier_id in (select private.my_member_ids())
      or shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager']))
    )
  );
create policy "Propriétaire et gérant : rembourser ou refuser une dépense" on public.delivery_expenses
  for update to authenticated
  using (shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager'])))
  with check (shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager'])));

-- La caisse : en plus des règles d'avant, la remise d'un livreur se note par le caissier,
-- le gérant ou le propriétaire (jamais par le livreur lui-même), et un remboursement de
-- dépense par le propriétaire ou le gérant.
drop policy "Membres : ajout (retraits réservés au propriétaire et au gérant)" on public.cash_movements;
create policy "Membres : ajout (retraits, remises et remboursements réservés)" on public.cash_movements
  for insert to authenticated
  with check (
    shop_id in (select private.my_shop_ids())
    and (
      type not in ('withdrawal', 'deposit')
      or shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager']))
    )
    and (
      type <> 'handover'
      or shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager', 'cashier']))
    )
    and (
      delivery_expense_id is null
      or shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager']))
    )
  );


-- -----------------------------------------------------------------------------
-- 5. Les règles vérifiées par le serveur
-- -----------------------------------------------------------------------------

-- Une livraison : références de la même boutique ; ensuite, ce que chacun peut changer.
create function private.check_delivery_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_mine uuid[];
  -- Ce qu'un livreur peut changer : l'état de la livraison, et à qui elle est
  v_courier_columns text[] := array[
    'assigned_to', 'status', 'started_at', 'delivered_at', 'failed_reason', 'updated_at'
  ];
begin
  if tg_op = 'INSERT' then
    if new.sale_id is not null
       and not exists (select 1 from public.sales s where s.id = new.sale_id and s.shop_id = new.shop_id) then
      raise exception 'Vente inconnue dans cette boutique.' using errcode = '22023';
    end if;
    if new.customer_id is not null
       and not exists (select 1 from public.customers c where c.id = new.customer_id and c.shop_id = new.shop_id) then
      raise exception 'Client inconnu dans cette boutique.' using errcode = '22023';
    end if;
    if new.assigned_to is not null
       and not exists (select 1 from public.shop_members m
                        where m.id = new.assigned_to and m.shop_id = new.shop_id and m.active) then
      raise exception 'Livreur inconnu dans cette boutique.' using errcode = '22023';
    end if;
    if current_user = 'authenticated'
       and (new.status <> 'pending' or new.started_at is not null or new.delivered_at is not null
            or new.cancelled_at is not null) then
      raise exception 'Une nouvelle livraison commence « à faire ».' using errcode = '22023';
    end if;
    return new;
  end if;

  -- Modification : une référence changée doit venir de la même boutique
  if new.sale_id is distinct from old.sale_id and new.sale_id is not null
     and not exists (select 1 from public.sales s where s.id = new.sale_id and s.shop_id = new.shop_id) then
    raise exception 'Vente inconnue dans cette boutique.' using errcode = '22023';
  end if;
  if new.customer_id is distinct from old.customer_id and new.customer_id is not null
     and not exists (select 1 from public.customers c where c.id = new.customer_id and c.shop_id = new.shop_id) then
    raise exception 'Client inconnu dans cette boutique.' using errcode = '22023';
  end if;
  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null
     and not exists (select 1 from public.shop_members m
                      where m.id = new.assigned_to and m.shop_id = new.shop_id and m.active) then
    raise exception 'Livreur inconnu dans cette boutique.' using errcode = '22023';
  end if;

  -- Fonctions du serveur : leurs propres règles s'appliquent déjà
  if current_user <> 'authenticated' then
    return new;
  end if;
  if old.status in ('delivered', 'cancelled') then
    raise exception 'Cette livraison est terminée ou annulée : elle ne se modifie plus.'
      using errcode = '42501';
  end if;
  if new.shop_id <> old.shop_id or new.created_by is distinct from old.created_by
     or new.device_id is distinct from old.device_id or new.created_at <> old.created_at then
    raise exception 'L''origine d''une livraison ne se modifie pas.' using errcode = '42501';
  end if;

  -- Vendeurs, caissiers, gérant, propriétaire : la boutique organise ses livraisons
  if new.shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager', 'cashier', 'seller'])) then
    return new;
  end if;

  -- Un livreur : seulement prendre, rendre ou terminer SES livraisons
  v_mine := array(select private.my_member_ids());
  if (to_jsonb(new) - v_courier_columns) is distinct from (to_jsonb(old) - v_courier_columns) then
    raise exception 'Un livreur ne change que l''état de ses livraisons.' using errcode = '42501';
  end if;
  if old.assigned_to is not null and not (old.assigned_to = any (v_mine)) then
    raise exception 'Cette livraison est déjà prise par un autre livreur.' using errcode = '42501';
  end if;
  if new.status = 'cancelled' then
    raise exception 'Seule la boutique peut annuler une livraison.' using errcode = '42501';
  end if;
  if new.assigned_to is not null and not (new.assigned_to = any (v_mine)) then
    raise exception 'Un livreur ne donne pas une livraison à un autre livreur.' using errcode = '42501';
  end if;
  if new.status <> 'pending' and new.assigned_to is null then
    raise exception 'Une livraison se prend à son nom.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger deliveries_check_write
  before insert or update on public.deliveries
  for each row execute function private.check_delivery_write();

-- L'argent encaissé à une livraison rembourse la dette du client de CETTE livraison.
-- Il est TOUJOURS enregistré, même si la boutique a annulé la livraison entre-temps (hors ligne) :
-- l'argent a bien été reçu, il doit rester visible (et compter « chez le livreur »).
-- Un livreur l'encaisse en SON nom : le serveur l'impose (sinon, en trichant, il pourrait
-- mettre l'argent au nom d'un autre et faire baisser ce qu'il doit remettre à la caisse).
create function private.check_delivery_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_delivery public.deliveries;
begin
  if new.delivery_id is null then
    return new;
  end if;
  select * into v_delivery from public.deliveries d where d.id = new.delivery_id;
  if not found or v_delivery.shop_id <> new.shop_id then
    raise exception 'Livraison inconnue dans cette boutique.' using errcode = '22023';
  end if;
  if v_delivery.customer_id is distinct from new.customer_id then
    raise exception 'L''argent d''une livraison rembourse la dette du client de cette livraison.'
      using errcode = '22023';
  end if;
  if current_user = 'authenticated'
     and not (new.shop_id in (select private.my_shop_ids_with_role(
       array['owner', 'manager', 'cashier', 'seller']))) then
    new.created_by := (
      select m.id from public.shop_members m
       where m.user_id = auth.uid() and m.shop_id = new.shop_id and m.active
       limit 1
    );
  end if;
  return new;
end;
$$;
create trigger payments_check_delivery
  before insert on public.payments
  for each row execute function private.check_delivery_payment();

-- Remise d'un livreur et remboursement d'une dépense : la bonne personne, le bon montant
create function private.check_delivery_cash_movement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_expense public.delivery_expenses;
begin
  if new.courier_id is not null
     and not exists (select 1 from public.shop_members m
                      where m.id = new.courier_id and m.shop_id = new.shop_id) then
    raise exception 'Livreur inconnu dans cette boutique.' using errcode = '22023';
  end if;
  if new.delivery_expense_id is not null then
    select * into v_expense from public.delivery_expenses e where e.id = new.delivery_expense_id;
    if not found or v_expense.shop_id <> new.shop_id then
      raise exception 'Dépense de livraison inconnue dans cette boutique.' using errcode = '22023';
    end if;
    if v_expense.status = 'rejected' then
      raise exception 'Cette dépense a été refusée : elle ne se rembourse pas.' using errcode = '42501';
    end if;
    if new.amount <> v_expense.amount or new.category is distinct from v_expense.category then
      raise exception 'Le remboursement reprend le montant et la catégorie de la dépense.'
        using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
create trigger cash_movements_check_delivery
  before insert on public.cash_movements
  for each row execute function private.check_delivery_cash_movement();

-- Une dépense : déclarée « en attente » ; ensuite seule la décision (une fois) s'enregistre
create function private.check_delivery_expense_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_decision text[] := array['status', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at'];
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.shop_members m
                    where m.id = new.courier_id and m.shop_id = new.shop_id) then
      raise exception 'Livreur inconnu dans cette boutique.' using errcode = '22023';
    end if;
    if new.delivery_id is not null
       and not exists (select 1 from public.deliveries d
                        where d.id = new.delivery_id and d.shop_id = new.shop_id) then
      raise exception 'Livraison inconnue dans cette boutique.' using errcode = '22023';
    end if;
    if current_user = 'authenticated' and (new.status <> 'pending' or new.reviewed_by is not null) then
      raise exception 'Une dépense déclarée attend la décision du propriétaire ou du gérant.'
        using errcode = '22023';
    end if;
    return new;
  end if;

  if current_user <> 'authenticated' then
    return new;
  end if;
  if old.status <> 'pending' then
    raise exception 'Cette dépense a déjà été remboursée ou refusée.' using errcode = '42501';
  end if;
  if new.status = 'pending'
     or (to_jsonb(new) - v_decision) is distinct from (to_jsonb(old) - v_decision) then
    raise exception 'Seule la décision (remboursée ou refusée) s''enregistre sur une dépense.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger delivery_expenses_check_write
  before insert or update on public.delivery_expenses
  for each row execute function private.check_delivery_expense_write();


-- -----------------------------------------------------------------------------
-- 6. Les photos des reçus : un stockage PRIVÉ, un dossier par livreur
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('delivery-proofs', 'delivery-proofs', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Envoyer une photo : dans le dossier de SA boutique, et dans SON dossier
-- (le propriétaire et le gérant peuvent aussi l'envoyer pour un livreur)
create policy "Reçus de livraison : ajout dans son dossier" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'delivery-proofs'
    and (storage.foldername(name))[1] in (select shop_id::text from private.my_shop_ids() as shop_id)
    and (
      (storage.foldername(name))[2] in (select id::text from private.my_member_ids() as id)
      or (storage.foldername(name))[1] in (
        select shop_id::text from private.my_shop_ids_with_role(array['owner', 'manager']) as shop_id)
    )
  );

-- Voir une photo : le livreur (ses reçus), le propriétaire et les responsables.
-- Pas de remplacement ni de suppression : un reçu ne se modifie pas.
create policy "Reçus de livraison : lecture par le livreur et les responsables" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'delivery-proofs'
    and (
      (storage.foldername(name))[2] in (select id::text from private.my_member_ids() as id)
      or (storage.foldername(name))[1] in (
        select shop_id::text
          from private.my_shop_ids_with_role(array['owner', 'manager', 'stock_manager']) as shop_id)
    )
  );


-- -----------------------------------------------------------------------------
-- 7. « Effacer les données de test » efface aussi les livraisons et leurs dépenses
-- -----------------------------------------------------------------------------

create or replace function public.reset_shop_data(p_shop_id uuid, p_confirmation text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created_at timestamptz;
  v_is_admin boolean := private.is_platform_admin();
begin
  if p_confirmation is distinct from 'EFFACER' then
    raise exception 'Confirmation manquante.' using errcode = '22023';
  end if;

  select created_at into v_created_at from public.shops where id = p_shop_id;
  if v_created_at is null then
    raise exception 'Boutique introuvable.' using errcode = 'P0002';
  end if;

  if not v_is_admin then
    if p_shop_id not in (select private.my_owned_shop_ids()) then
      raise exception 'Seul le propriétaire peut effacer les données.' using errcode = '42501';
    end if;
    if now() >= v_created_at + interval '15 days' then
      raise exception 'L''effacement n''est possible que pendant les 15 jours d''essai.'
        using errcode = '42501';
    end if;
  end if;

  -- Dans l'ordre : d'abord ce qui pointe vers les autres tables
  delete from public.audit_log where shop_id = p_shop_id;
  delete from public.reports where shop_id = p_shop_id;
  delete from public.cash_movements where shop_id = p_shop_id;
  delete from public.delivery_expenses where shop_id = p_shop_id;
  delete from public.stock_movements where shop_id = p_shop_id;
  delete from public.customer_ledger where shop_id = p_shop_id;
  delete from public.payments where shop_id = p_shop_id;
  delete from public.deliveries where shop_id = p_shop_id;
  delete from public.sale_items where shop_id = p_shop_id;
  delete from public.sales where shop_id = p_shop_id;
  delete from public.cash_sessions where shop_id = p_shop_id;
  delete from public.inventory_lines where shop_id = p_shop_id;
  delete from public.inventory_counts where shop_id = p_shop_id;
  delete from public.stock_lots where shop_id = p_shop_id;
  delete from public.stock_receipts where shop_id = p_shop_id;
  delete from public.product_units where shop_id = p_shop_id;
  delete from public.products where shop_id = p_shop_id;
  delete from public.categories where shop_id = p_shop_id;
  delete from public.customers where shop_id = p_shop_id;
end;
$$;


-- -----------------------------------------------------------------------------
-- 8. Synchronisation : PowerSync suit aussi les deux nouvelles tables
--    (à ajouter AUSSI dans powersync/sync-config.yaml et dans le tableau de bord PowerSync)
-- -----------------------------------------------------------------------------

alter publication powersync add table public.deliveries, public.delivery_expenses;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'powersync_role') then
    grant select on table public.deliveries, public.delivery_expenses to powersync_role;
  end if;
end $$;
