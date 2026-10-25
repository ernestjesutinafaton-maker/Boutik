-- =============================================================================
-- Boutik — Dépenses et sorties de caisse, rapports de clôture et « comptes »
-- =============================================================================
-- 1. cash_movements : l'argent qui sort de la caisse (ou y entre) en dehors des ventes :
--      expense        dépense (livraison, carburant, fournitures…) → diminue le bénéfice
--      stock_purchase achat de marchandise payé avec l'argent de la caisse
--                     (ce n'est PAS une dépense : la marchandise entre en stock)
--      withdrawal     retrait du propriétaire
--      deposit        argent ajouté dans la caisse (monnaie, fond…)
-- 2. reports : les fiches de rapport ARCHIVÉES, figées au moment où on les fait :
--      day_close  « Clôturer la journée » (caissier, gérant, propriétaire)
--      account    « Faire un compte » depuis le compte précédent (propriétaire et gérant)
--
-- Comme les autres « journaux », ces lignes ne se modifient jamais et ne se suppriment pas.
-- =============================================================================

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  cash_session_id uuid references public.cash_sessions (id),
  type text not null check (type in ('expense', 'stock_purchase', 'withdrawal', 'deposit')),
  -- Catégorie des dépenses : transport, fuel, supplies, utilities, rent, salary, repairs, other
  category text check (category in ('transport', 'fuel', 'supplies', 'utilities', 'rent', 'salary', 'repairs', 'other')),
  payment_method_id uuid not null references public.payment_methods (id),
  amount bigint not null check (amount > 0),
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid references public.shop_members (id),
  device_id uuid references public.devices (id),
  created_at timestamptz not null default now(),
  check ((type = 'expense') = (category is not null))   -- une dépense a toujours une catégorie
);
comment on table public.cash_movements is 'Dépenses, achats payés par la caisse, retraits et ajouts d''argent.';

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id),
  kind text not null check (kind in ('day_close', 'account')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  data jsonb not null,                  -- la fiche complète (ventes, paiements, dépenses, stock…)
  notes text,
  created_by uuid references public.shop_members (id),
  device_id uuid references public.devices (id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);
comment on table public.reports is 'Les rapports archivés : clôtures de journée et comptes.';

create index cash_movements_shop_id_idx on public.cash_movements (shop_id);
create index cash_movements_session_idx on public.cash_movements (cash_session_id);
create index reports_shop_id_idx on public.reports (shop_id);


-- -----------------------------------------------------------------------------
-- Sécurité : chaque boutique ne voit que ses lignes ; on ajoute, on ne modifie jamais
-- -----------------------------------------------------------------------------

alter table public.cash_movements enable row level security;
alter table public.reports enable row level security;

revoke all on table public.cash_movements, public.reports from anon;
revoke all on table public.cash_movements, public.reports from authenticated;
grant select, insert on table public.cash_movements, public.reports to authenticated;

create policy "Membres : lecture" on public.cash_movements
  for select to authenticated
  using (shop_id in (select private.my_shop_ids()));

-- Dépenses : tous les membres (la caisse vérifie le droit) ; retraits et ajouts : propriétaire et gérant
create policy "Membres : ajout (retraits réservés au propriétaire et au gérant)" on public.cash_movements
  for insert to authenticated
  with check (
    shop_id in (select private.my_shop_ids())
    and (
      type not in ('withdrawal', 'deposit')
      or shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager']))
    )
  );

create policy "Membres : lecture" on public.reports
  for select to authenticated
  using (shop_id in (select private.my_shop_ids()));

-- Clôture de journée : tous les membres ; « compte » : propriétaire et gérant
create policy "Membres : ajout (comptes réservés au propriétaire et au gérant)" on public.reports
  for insert to authenticated
  with check (
    shop_id in (select private.my_shop_ids())
    and (
      kind = 'day_close'
      or shop_id in (select private.my_shop_ids_with_role(array['owner', 'manager']))
    )
  );


-- -----------------------------------------------------------------------------
-- Synchronisation : PowerSync suit aussi ces deux tables
-- (à ajouter AUSSI dans powersync/sync-config.yaml et dans le tableau de bord PowerSync)
-- -----------------------------------------------------------------------------

alter publication powersync add table public.cash_movements, public.reports;

-- Le compte de lecture de PowerSync (créé à la main) doit pouvoir lire les nouvelles tables
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'powersync_role') then
    grant select on table public.cash_movements, public.reports to powersync_role;
  end if;
end $$;
