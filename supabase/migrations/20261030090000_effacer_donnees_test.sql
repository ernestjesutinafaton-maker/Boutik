-- « Effacer toutes les données de test » d'une boutique.
--
-- Efface pour de bon : produits, rayons, clients, ventes, paiements, stock, inventaires,
-- caisse, comptes et journal. Garde : la boutique, l'équipe (et ses codes), les appareils,
-- les moyens de paiement et l'abonnement.
--
-- Qui peut le faire ?
--   • le propriétaire de CETTE boutique, seulement pendant les 15 jours d'essai gratuit
--     (le prix de l'abonnement dépend des ventes : effacer plus tard permettrait de tricher) ;
--   • l'administrateur Boutik, à tout moment (à la demande d'un client).
-- Sécurité : le mot « EFFACER » doit être envoyé, pour éviter un appel par erreur.

create function public.reset_shop_data(p_shop_id uuid, p_confirmation text)
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
  delete from public.stock_movements where shop_id = p_shop_id;
  delete from public.customer_ledger where shop_id = p_shop_id;
  delete from public.payments where shop_id = p_shop_id;
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

revoke all on function public.reset_shop_data(uuid, text) from public;
grant execute on function public.reset_shop_data(uuid, text) to authenticated;
