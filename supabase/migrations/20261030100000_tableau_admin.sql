-- Tableau de bord de l'administrateur Boutik : l'état de toutes les boutiques et des paiements.
-- Réservé à l'administrateur de la plateforme (private.is_platform_admin) ; ne renvoie que des
-- chiffres globaux, jamais le détail des ventes d'une boutique.

create function public.admin_overview()
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
  -- Mêmes règles que l'appli : 15 jours d'essai, puis 7 jours de grâce après la fin payée
  return query
    with state as (
      select
        s.created_at,
        case
          when s.paid_until is not null and s.paid_until > now() then 'active'
          when s.paid_until is null and now() < s.created_at + interval '15 days' then 'trial'
          when now() < coalesce(s.paid_until, s.created_at + interval '15 days') + interval '7 days'
            then 'grace'
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
revoke all on function public.admin_overview() from public;
grant execute on function public.admin_overview() to authenticated;
