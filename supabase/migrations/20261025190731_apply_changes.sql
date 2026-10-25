-- =============================================================================
-- Boutik — Recevoir les modifications des appareils, « tout ou rien »
-- =============================================================================
-- Quand un appareil retrouve internet, il envoie ses modifications en attente.
-- Chaque opération faite dans l'appareil (ex. une vente complète : la vente, ses lignes,
-- ses paiements, ses mouvements de stock) arrive ici en UN SEUL envoi, appliqué
-- entièrement ou pas du tout : jamais de vente à moitié enregistrée si le réseau coupe.
--
-- La fonction s'exécute avec les droits de la personne connectée (« security invoker ») :
-- toutes les règles de sécurité (RLS) s'appliquent exactement comme d'habitude.
--
-- Format reçu : [{"op": "PUT" | "PATCH", "table": "products", "id": "<uuid>", "data": {…}}, …]
--   PUT   = création d'une ligne (si elle existe déjà, envoi répété : on l'ignore)
--   PATCH = modification de certaines colonnes d'une ligne
--   Rien ne se supprime dans Boutik : toute suppression est refusée.
-- =============================================================================


-- Les colonnes JSON (jsonb) arrivent de l'appareil sous forme de texte : on les retransforme en JSON.
create function private.prepare_change_data(p_table text, p_data jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_column text;
  v_result jsonb := p_data;
begin
  for v_column in
    select a.attname
    from pg_catalog.pg_attribute a
    where a.attrelid = format('public.%I', p_table)::regclass
      and a.atttypid = 'jsonb'::regtype
      and a.attnum > 0
      and not a.attisdropped
  loop
    if jsonb_typeof(v_result -> v_column) = 'string' then
      v_result := jsonb_set(v_result, array[v_column], (v_result ->> v_column)::jsonb);
    end if;
  end loop;
  return v_result;
end;
$$;

revoke all on function private.prepare_change_data(text, jsonb) from public;
grant execute on function private.prepare_change_data(text, jsonb) to authenticated;


create function public.apply_changes(p_changes jsonb)
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

revoke all on function public.apply_changes(jsonb) from public, anon;
grant execute on function public.apply_changes(jsonb) to authenticated;
