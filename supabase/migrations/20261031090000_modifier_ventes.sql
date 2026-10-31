-- Modifier une vente déjà faite (le client revient changer des articles, ou erreur de saisie).
--   1. Le délai pendant lequel une vente peut être modifiée, choisi par le propriétaire
--      (24 h par défaut). Ensuite, la vente est archivée : seul le propriétaire peut encore
--      la modifier (contrôlé dans l'application, comme les autres rôles).
--   2. Le lien entre la vente corrigée et la vente qu'elle remplace : l'ancienne passe
--      « annulée » (marchandise rendue au stock, argent reporté), rien n'est effacé.

alter table public.shops
  add column return_window_hours integer not null default 24
    check (return_window_hours between 0 and 8760);
comment on column public.shops.return_window_hours is
  'Délai (en heures) pendant lequel une vente peut être modifiée ; ensuite seul le propriétaire le peut.';

alter table public.sales
  add column replaces_sale_id uuid references public.sales (id);
create index sales_replaces_sale_id_idx on public.sales (replaces_sale_id)
  where replaces_sale_id is not null;
comment on column public.sales.replaces_sale_id is
  'La vente modifiée que celle-ci remplace (l''ancienne est passée « annulée »).';
