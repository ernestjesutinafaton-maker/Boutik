-- =============================================================================
-- Boutik — Les photos des produits (stockage Supabase « Storage »)
-- =============================================================================
-- Un « bucket » (dossier de stockage) pour toutes les photos de produits.
-- Chaque boutique a son propre sous-dossier, nommé avec son identifiant :
--   product-photos/<id de la boutique>/<id du produit>/<id de la photo>.jpg
--
-- • Ajouter ou remplacer une photo : seulement dans le dossier de SA boutique.
-- • Afficher une photo : le bucket est « public » en lecture, pour que l'application
--   puisse afficher et garder en cache les images sans se reconnecter. Les adresses
--   contiennent des identifiants impossibles à deviner, et une photo de produit
--   n'a rien de confidentiel.
-- • Taille limitée à 1 Mo par photo (l'application les réduit à environ 100 Ko).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Le premier dossier du chemin doit être une boutique dont la personne est membre
create policy "Photos produits : ajout dans le dossier de sa boutique" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] in (select shop_id::text from private.my_shop_ids() as shop_id)
  );

create policy "Photos produits : lecture du dossier de sa boutique" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] in (select shop_id::text from private.my_shop_ids() as shop_id)
  );

create policy "Photos produits : remplacement dans le dossier de sa boutique" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] in (select shop_id::text from private.my_shop_ids() as shop_id)
  )
  with check (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] in (select shop_id::text from private.my_shop_ids() as shop_id)
  );
