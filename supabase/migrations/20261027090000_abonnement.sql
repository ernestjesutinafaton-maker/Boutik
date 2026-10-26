-- =============================================================================
-- Boutik — L'abonnement (Bénin, FCFA)
-- =============================================================================
-- Comme pour ÉcoPay : le propriétaire envoie la somme par Mobile Money au numéro de
-- Boutik, puis DÉCLARE son paiement (opérateur, numéro d'envoi, numéro de transaction).
-- L'administrateur de la plateforme vérifie la réception et VALIDE : la date de fin
-- d'abonnement de la boutique avance alors du nombre de mois payés.
--
-- Prix (le même calcul que src/domain/subscription.ts) :
--   mois 1 à 3 de la boutique : 10 000 F / mois ;
--   ensuite, selon la moyenne mensuelle des ventes du trimestre précédent :
--     < 1 500 000 F → 10 000 F ; < 5 000 000 F → 15 000 F ; sinon 25 000 F.
-- Le prix est TOUJOURS calculé ici, côté serveur, jamais par l'appareil.
-- =============================================================================

alter table public.shops add column paid_until timestamptz;
comment on column public.shops.paid_until is 'Fin de l''abonnement payé (null = jamais payé). Modifiable seulement par l''administrateur.';

-- Les administrateurs de la plateforme Boutik (ajoutés à la main dans Supabase)
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from anon, authenticated;

create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
$$;
revoke all on function private.is_platform_admin() from public;
grant execute on function private.is_platform_admin() to authenticated;

-- Personne (sauf les fonctions du serveur) ne peut changer la fin d'abonnement ou la date de création
create function private.protect_shop_subscription()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.paid_until is distinct from old.paid_until or new.created_at is distinct from old.created_at) then
    raise exception 'La date d''abonnement ne se modifie que par la validation d''un paiement.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger shops_protect_subscription
  before update on public.shops
  for each row execute function private.protect_shop_subscription();

-- Les paiements déclarés
create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  months integer not null check (months in (1, 3, 6)),
  monthly_price bigint not null check (monthly_price > 0),
  amount bigint not null check (amount > 0),
  operator text not null check (operator in ('mtn', 'moov', 'celtiis', 'other')),
  sender_phone text not null check (length(trim(sender_phone)) between 6 and 20),
  reference text not null check (length(trim(reference)) between 3 and 60),
  status text not null default 'pending' check (status in ('pending', 'validated', 'rejected')),
  review_note text,
  declared_by uuid references auth.users (id),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.subscription_payments is 'Paiements d''abonnement déclarés par les boutiques, validés par l''administrateur.';
create index subscription_payments_shop_idx on public.subscription_payments (shop_id);

alter table public.subscription_payments enable row level security;
revoke all on table public.subscription_payments from anon, authenticated;
grant select on table public.subscription_payments to authenticated;
create policy "Propriétaire ou administrateur : lecture" on public.subscription_payments
  for select to authenticated
  using (shop_id in (select private.my_owned_shop_ids()) or (select private.is_platform_admin()));

-- Le prix mensuel d'une boutique aujourd'hui
create function public.subscription_quote(p_shop_id uuid)
returns table (monthly_price bigint, reason text, average_revenue bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_created timestamptz;
  v_age interval;
  v_months integer;
  v_quarter integer;
  v_start timestamptz;
  v_revenue bigint;
  v_average bigint;
begin
  if not (p_shop_id in (select private.my_owned_shop_ids()) or private.is_platform_admin()) then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;
  select s.created_at into v_created from public.shops s where s.id = p_shop_id;
  v_age := age(now(), v_created);
  v_months := (extract(year from v_age) * 12 + extract(month from v_age))::integer;
  if v_months < 3 then
    return query select 10000::bigint, 'welcome'::text, 0::bigint;
    return;
  end if;
  v_quarter := v_months / 3;
  v_start := v_created + make_interval(months => (v_quarter - 1) * 3);
  select coalesce(sum(total), 0) into v_revenue
    from public.sales
   where shop_id = p_shop_id and status = 'completed'
     and occurred_at >= v_start and occurred_at < v_start + interval '3 months';
  v_average := v_revenue / 3;
  return query select
    (case when v_average < 1500000 then 10000 when v_average < 5000000 then 15000 else 25000 end)::bigint,
    'tier'::text,
    v_average;
end;
$$;
revoke all on function public.subscription_quote(uuid) from public;
grant execute on function public.subscription_quote(uuid) to authenticated;

-- Le propriétaire déclare un paiement (le montant est recalculé ici)
create function public.declare_subscription_payment(
  p_shop_id uuid,
  p_months integer,
  p_operator text,
  p_sender_phone text,
  p_reference text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price bigint;
  v_id uuid;
begin
  if not (p_shop_id in (select private.my_owned_shop_ids())) then
    raise exception 'Seul le propriétaire peut payer l''abonnement.' using errcode = '42501';
  end if;
  select q.monthly_price into v_price from public.subscription_quote(p_shop_id) q;
  insert into public.subscription_payments
    (shop_id, months, monthly_price, amount, operator, sender_phone, reference, declared_by)
  values
    (p_shop_id, p_months, v_price, v_price * p_months, p_operator, trim(p_sender_phone), trim(p_reference), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.declare_subscription_payment(uuid, integer, text, text, text) from public;
grant execute on function public.declare_subscription_payment(uuid, integer, text, text, text) to authenticated;

-- L'administrateur valide (ou refuse) un paiement reçu
create function public.review_subscription_payment(p_payment_id uuid, p_accept boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.subscription_payments;
begin
  if not private.is_platform_admin() then
    raise exception 'Réservé à l''administrateur de Boutik.' using errcode = '42501';
  end if;
  select * into v_payment from public.subscription_payments where id = p_payment_id for update;
  if v_payment.status <> 'pending' then
    raise exception 'Ce paiement a déjà été traité.';
  end if;
  update public.subscription_payments
     set status = case when p_accept then 'validated' else 'rejected' end,
         review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_payment_id;
  if p_accept then
    update public.shops
       set paid_until = greatest(coalesce(paid_until, now()), now()) + make_interval(months => v_payment.months),
           updated_at = now()
     where id = v_payment.shop_id;
  end if;
end;
$$;
revoke all on function public.review_subscription_payment(uuid, boolean, text) from public;
grant execute on function public.review_subscription_payment(uuid, boolean, text) to authenticated;

-- Liste pour l'administrateur : paiements en attente, avec le nom de la boutique
create function public.admin_subscription_payments()
returns table (
  id uuid, shop_id uuid, shop_name text, months integer, amount bigint, operator text,
  sender_phone text, reference text, status text, created_at timestamptz, paid_until timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Réservé à l''administrateur de Boutik.' using errcode = '42501';
  end if;
  return query
    select p.id, p.shop_id, s.name, p.months, p.amount, p.operator, p.sender_phone, p.reference,
           p.status, p.created_at, s.paid_until
      from public.subscription_payments p
      join public.shops s on s.id = p.shop_id
     order by (p.status = 'pending') desc, p.created_at desc
     limit 200;
end;
$$;
revoke all on function public.admin_subscription_payments() from public;
grant execute on function public.admin_subscription_payments() to authenticated;

-- L'appli doit pouvoir savoir si la personne est administrateur (pour afficher l'écran)
create function public.am_i_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
$$;
revoke all on function public.am_i_platform_admin() from public;
grant execute on function public.am_i_platform_admin() to authenticated;
