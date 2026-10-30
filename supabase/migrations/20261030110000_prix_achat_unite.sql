-- Le prix d'achat chez le fournisseur, pour chaque unité d'un produit (sac, kg, carton…).
-- Sert à afficher la marge et à pré-remplir la réception. Le bénéfice réel, lui, reste
-- calculé avec le prix payé à chaque réception (les lots), moins les dépenses.
-- Écrit seulement par le propriétaire : la table product_units l'est déjà (règles existantes).
alter table public.product_units
  add column purchase_price bigint check (purchase_price is null or purchase_price >= 0);
comment on column public.product_units.purchase_price is
  'Prix d''achat de CETTE unité chez le fournisseur (null = inconnu, déduit d''une autre unité).';
