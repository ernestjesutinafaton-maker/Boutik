-- =============================================================================
-- Boutik — Abonnement sécurisé : justificatif obligatoire, accès provisoire, blocage
-- =============================================================================
-- Décisions d'Ernest (01/11/2026) :
--   • le propriétaire joint la CAPTURE du paiement (SMS Mobile Money), l'heure du paiement
--     et un message ; la capture est gardée dans un stockage PRIVÉ (la boutique et
--     l'administrateur de Boutik seulement) ;
--   • pendant la vérification : ACCÈS PROVISOIRE de 3 jours, une seule fois par 30 jours,
--     et pas dans les 30 jours qui suivent un refus ; il s'arrête si le paiement est refusé ;
--   • après l'essai (15 jours) et le délai de grâce (7 jours) sans paiement : TOUT est bloqué
--     sauf le paiement. Le serveur refuse aussi les données d'une boutique bloquée, avec le
--     code BK001 : l'appareil les garde et réessaie plus tard, rien n'est perdu ;
--   • un numéro de transaction ne sert qu'une fois (sauf si le paiement a été refusé).
-- Les règles de durée sont les mêmes que dans src/domain/subscription.ts.
-- =============================================================================

-- 1. Les nouvelles informations d'un paiement déclaré
alter table public.subscription_payments
  add column paid_at timestamptz,
  add column message text check (message is null or length(message) <= 500),
  add column proof_path text,
  add column provisional_until timestamptz;
comment on column public.subscription_payments.paid_at is 'Heure du transfert Mobile Money indiquée par le client.';
comment on column public.subscription_payments.proof_path is 'Capture du paiement, dans le stockage privé « payment-proofs ».';
comment on column public.subscription_payments.provisional_until is 'Fin de l''accès provisoire accordé à la déclaration (null = aucun).';

create unique index subscription_payments_reference_once
  on public.subscription_payments (operator, upper(reference))
  where status <> 'rejected';
create unique index subscription_payments_proof_once
  on public.subscription_payments (proof_path)
  where proof_path is not null;

-- 2. L'accès provisoire de la boutique (comme paid_until : modifiable seulement par le serveur)
alter table public.shops add column provisional_until timestamptz;
comment on column public.shops.provisional_until is 'Accès provisoire pendant la vérification d''un paiement. Modifiable seulement par le serveur.';

create or replace function private.protect_shop_subscription()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.paid_until is distinct from old.paid_until
          or new.provisional_until is distinct from old.provisional_until
          or new.created_at is distinct from old.created_at) then
    raise exception 'La date d''abonnement ne se modifie que par la validation d''un paiement.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 3. Jusqu'à quand la boutique peut-elle travailler ?
--    La plus tardive de : fin de l'essai + 7 jours de grâce, fin payée + 7 jours de grâce,
--    fin de l'accès provisoire (sans grâce : sinon une fausse déclaration donnerait 10 jours).
create function private.shop_access_until(p_shop_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
           s.created_at + interval '15 days' + interval '7 days',
           coalesce(s.paid_until + interval '7 days', '-infinity'::timestamptz),
           coalesce(s.provisional_until, '-infinity'::timestamptz)
         )
    from public.shops s
   where s.id = p_shop_id
$$;
revoke all on function private.shop_access_until(uuid) from public;
grant execute on function private.shop_access_until(uuid) to authenticated;

create function private.shop_is_blocked(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(now() >= private.shop_access_until(p_shop_id), false)
$$;
revoke all on function private.shop_is_blocked(uuid) from public;
grant execute on function private.shop_is_blocked(uuid) to authenticated;

-- 4. Les captures de paiement : un stockage PRIVÉ (aucune adresse publique)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Envoyer une capture : seulement le propriétaire, dans le dossier de SA boutique
create policy "Justificatifs : ajout par le propriétaire" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] in (select shop_id::text from private.my_owned_shop_ids() as shop_id)
  );

-- Voir une capture : le propriétaire de la boutique, ou l'administrateur de Boutik.
-- Pas de remplacement ni de suppression : une preuve ne se modifie pas.
create policy "Justificatifs : lecture par le propriétaire ou l'administrateur" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[1] in (select shop_id::text from private.my_owned_shop_ids() as shop_id)
      or (select private.is_platform_admin())
    )
  );

-- 5. Déclarer un paiement : capture obligatoire, heure du paiement, message
drop function public.declare_subscription_payment(uuid, integer, text, text, text);

create function public.declare_subscription_payment(
  p_shop_id uuid,
  p_months integer,
  p_operator text,
  p_sender_phone text,
  p_reference text,
  p_paid_at timestamptz,
  p_message text,
  p_proof_path text
)
returns table (payment_id uuid, provisional_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price bigint;
  v_id uuid;
  v_provisional timestamptz;
  v_reference text := upper(trim(coalesce(p_reference, '')));
  v_message text := nullif(trim(coalesce(p_message, '')), '');
begin
  if not (p_shop_id in (select private.my_owned_shop_ids())) then
    raise exception 'Seul le propriétaire peut payer l''abonnement.' using errcode = '42501';
  end if;
  -- La capture doit déjà être dans le dossier de la boutique, et ne servir qu'une fois
  if p_proof_path is null
     or split_part(p_proof_path, '/', 1) <> p_shop_id::text
     or not exists (
       select 1 from storage.objects o where o.bucket_id = 'payment-proofs' and o.name = p_proof_path
     ) then
    raise exception 'Joins la capture du paiement.' using errcode = '22023';
  end if;
  if exists (select 1 from public.subscription_payments sp where sp.proof_path = p_proof_path) then
    raise exception 'Cette capture a déjà été envoyée.' using errcode = '23505';
  end if;
  if p_paid_at is null
     or p_paid_at > now() + interval '10 minutes'
     or p_paid_at < now() - interval '30 days' then
    raise exception 'L''heure du paiement n''est pas valable.' using errcode = '22023';
  end if;
  if v_message is not null and length(v_message) > 500 then
    raise exception 'Le message est trop long (500 caractères au plus).' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.subscription_payments sp
     where sp.operator = p_operator and upper(sp.reference) = v_reference and sp.status <> 'rejected'
  ) then
    raise exception 'Ce numéro de transaction a déjà été déclaré.' using errcode = '23505';
  end if;

  select q.monthly_price into v_price from public.subscription_quote(p_shop_id) q;

  -- Accès provisoire de 3 jours : une fois par 30 jours, et pas juste après un refus
  if not exists (
    select 1 from public.subscription_payments sp
     where sp.shop_id = p_shop_id
       and sp.created_at > now() - interval '30 days'
       and (sp.provisional_until is not null or sp.status = 'rejected')
  ) then
    v_provisional := now() + interval '3 days';
  end if;

  insert into public.subscription_payments
    (shop_id, months, monthly_price, amount, operator, sender_phone, reference,
     paid_at, message, proof_path, provisional_until, declared_by)
  values
    (p_shop_id, p_months, v_price, v_price * p_months, p_operator, trim(p_sender_phone), v_reference,
     p_paid_at, v_message, p_proof_path, v_provisional, auth.uid())
  returning id into v_id;

  if v_provisional is not null then
    update public.shops s
       set provisional_until = greatest(coalesce(s.provisional_until, now()), v_provisional),
           updated_at = now()
     where s.id = p_shop_id;
  end if;

  return query select v_id, v_provisional;
end;
$$;
revoke all on function public.declare_subscription_payment(uuid, integer, text, text, text, timestamptz, text, text) from public;
grant execute on function public.declare_subscription_payment(uuid, integer, text, text, text, timestamptz, text, text) to authenticated;

-- 6. Valider ou refuser (administrateur) : un refus demande une raison et coupe l'accès
--    provisoire ; une validation prolonge à partir de la date la plus tardive entre la fin
--    payée, la fin de l'essai et aujourd'hui (les jours d'essai restants ne sont pas perdus).
create or replace function public.review_subscription_payment(p_payment_id uuid, p_accept boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.subscription_payments;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not private.is_platform_admin() then
    raise exception 'Réservé à l''administrateur de Boutik.' using errcode = '42501';
  end if;
  select * into v_payment from public.subscription_payments where id = p_payment_id for update;
  if not found then
    raise exception 'Paiement introuvable.' using errcode = '22023';
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'Ce paiement a déjà été traité.' using errcode = '22023';
  end if;
  if not p_accept and v_note is null then
    raise exception 'Indique la raison du refus : le client la verra.' using errcode = '22023';
  end if;

  update public.subscription_payments
     set status = case when p_accept then 'validated' else 'rejected' end,
         review_note = v_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_payment_id;

  if p_accept then
    update public.shops s
       set paid_until = greatest(coalesce(s.paid_until, now()), s.created_at + interval '15 days', now())
                        + make_interval(months => v_payment.months),
           provisional_until = null,
           updated_at = now()
     where s.id = v_payment.shop_id;
  elsif v_payment.provisional_until is not null then
    update public.shops s
       set provisional_until = null, updated_at = now()
     where s.id = v_payment.shop_id;
  end if;
end;
$$;

-- 7. La liste de l'administrateur : tout ce qu'il faut pour vérifier auprès de celui qui a reçu
--    l'argent (heure, montant, numéro, capture), et pour joindre la boutique
drop function public.admin_subscription_payments();

create function public.admin_subscription_payments()
returns table (
  id uuid, shop_id uuid, shop_name text, shop_phone text, owner_email text,
  months integer, amount bigint, operator text, sender_phone text, reference text,
  paid_at timestamptz, message text, proof_path text, status text, review_note text,
  provisional_until timestamptz, created_at timestamptz, paid_until timestamptz
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
    select p.id, p.shop_id, s.name, s.phone,
           (select u.email::text
              from public.shop_members m
              join public.shop_member_roles r on r.member_id = m.id
              join auth.users u on u.id = m.user_id
             where m.shop_id = s.id and m.active and r.role = 'owner' and r.revoked_at is null
             limit 1),
           p.months, p.amount, p.operator, p.sender_phone, p.reference,
           p.paid_at, p.message, p.proof_path, p.status, p.review_note,
           p.provisional_until, p.created_at, s.paid_until
      from public.subscription_payments p
      join public.shops s on s.id = p.shop_id
     order by (p.status = 'pending') desc, p.created_at desc
     limit 200;
end;
$$;
revoke all on function public.admin_subscription_payments() from public;
grant execute on function public.admin_subscription_payments() to authenticated;

-- 8. Le tableau de l'administrateur compte les boutiques bloquées avec la même règle
create or replace function public.admin_overview()
returns table (
  shops_total integer,
  shops_trial integer,
  shops_active integer,
  shops_grace integer,
  shops_expired integer,
  shops_new_30_days integer,
  payments_pending integer,
  revenue_this_month bigint,
  revenue_total bigint
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
    with state as (
      select
        s.created_at,
        case
          when s.paid_until is not null and s.paid_until > now() then 'active'
          when now() < s.created_at + interval '15 days' then 'trial'
          when now() < private.shop_access_until(s.id) then 'grace'
          else 'expired'
        end as status
      from public.shops s
    )
    select
      (select count(*)::integer from state),
      (select count(*)::integer from state where status = 'trial'),
      (select count(*)::integer from state where status = 'active'),
      (select count(*)::integer from state where status = 'grace'),
      (select count(*)::integer from state where status = 'expired'),
      (select count(*)::integer from state where created_at > now() - interval '30 days'),
      (select count(*)::integer from public.subscription_payments where status = 'pending'),
      (select coalesce(sum(amount), 0)::bigint from public.subscription_payments
        where status = 'validated' and reviewed_at >= date_trunc('month', now())),
      (select coalesce(sum(amount), 0)::bigint from public.subscription_payments
        where status = 'validated');
end;
$$;

-- 9. Recevoir les modifications des appareils : refusées (code BK001) pour une boutique bloquée.
--    BK001 n'est PAS un refus définitif pour l'appareil : il garde les données et réessaie.
create or replace function public.apply_changes(p_changes jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_change jsonb;
  v_table text;
  v_id uuid;
  v_data jsonb;
  v_columns text[];
  v_count integer;
  v_shop uuid;
  v_checked_shops uuid[] := '{}';
begin
  if jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'Format invalide : une liste de modifications est attendue.'
      using errcode = '22023';
  end if;

  for v_change in select value from jsonb_array_elements(p_changes) loop
    v_table := v_change ->> 'table';
    v_id := (v_change ->> 'id')::uuid;

    -- Seules les tables synchronisées (celles de la publication PowerSync) sont acceptées
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'powersync' and schemaname = 'public' and tablename = v_table
    ) then
      raise exception 'Table inconnue ou non autorisée : %', v_table using errcode = '42501';
    end if;

    v_data := private.prepare_change_data(v_table, coalesce(v_change -> 'data', '{}'::jsonb)) - 'id';

    -- La boutique concernée : la ligne elle-même (shops), la donnée envoyée, ou la ligne existante
    if v_table = 'shops' then
      v_shop := v_id;
    elsif v_data ? 'shop_id' then
      v_shop := (v_data ->> 'shop_id')::uuid;
    else
      execute format('select shop_id from public.%I where id = $1', v_table) into v_shop using v_id;
    end if;
    if v_shop is not null and not (v_shop = any (v_checked_shops)) then
      if private.shop_is_blocked(v_shop) then
        raise exception 'Abonnement expiré : la boutique est en pause jusqu''à la validation du paiement.'
          using errcode = 'BK001';
      end if;
      v_checked_shops := v_checked_shops || v_shop;
    end if;

    -- On ne garde que les colonnes qui existent vraiment dans la table
    select coalesce(array_agg(key), '{}')
    into v_columns
    from jsonb_object_keys(v_data) as key
    where exists (
      select 1
      from pg_catalog.pg_attribute a
      where a.attrelid = format('public.%I', v_table)::regclass
        and a.attname = key
        and a.attnum > 0
        and not a.attisdropped
    );

    case v_change ->> 'op'
      when 'PUT' then
        execute format(
          'insert into public.%1$I (id%2$s) select $1%3$s
             from jsonb_populate_record(null::public.%1$I, $2) as r
             on conflict (id) do nothing',
          v_table,
          (select coalesce(string_agg(format(', %I', c), ''), '') from unnest(v_columns) as c),
          (select coalesce(string_agg(format(', r.%I', c), ''), '') from unnest(v_columns) as c)
        ) using v_id, v_data;

      when 'PATCH' then
        if cardinality(v_columns) > 0 then
          execute format(
            'update public.%1$I as t set %2$s
               from jsonb_populate_record(null::public.%1$I, $2) as r
               where t.id = $1',
            v_table,
            (select string_agg(format('%I = r.%I', c, c), ', ') from unnest(v_columns) as c)
          ) using v_id, v_data;
          get diagnostics v_count = row_count;
          if v_count = 0 then
            raise exception 'Modification refusée ou ligne introuvable (table %, id %).', v_table, v_id
              using errcode = '42501';
          end if;
        end if;

      else
        raise exception 'Suppression refusée : dans Boutik, rien ne se supprime (table %).', v_table
          using errcode = '42501';
    end case;
  end loop;
end;
$$;
