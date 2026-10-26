-- Ernest est l'administrateur de la plateforme Boutik (validation des paiements d'abonnement).
-- (Dans les tests, la table des comptes n'a pas d'e-mail : rien n'est fait.)
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'auth' and table_name = 'users' and column_name = 'email'
  ) then
    execute $sql$
      insert into public.platform_admins (user_id)
      select id from auth.users where lower(email) = 'ernestjesutinafaton@gmail.com'
      on conflict do nothing
    $sql$;
  end if;
end $$;
