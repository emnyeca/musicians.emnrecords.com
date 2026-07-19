-- EMN Records Musician Directory & Credit Builder
-- 003_functions.sql — Discord Interaction受付の確定transaction関数
-- (apply after 002_rls.sql)
--
-- これらの関数は署名検証・再認可を済ませた信頼されたserver route
-- (service role) だけが呼び出す。事前チェック違反はerror codeを含む
-- jsonbで返し、書き込み開始後の失敗はraiseで全体をrollbackする。
-- 監査ログinsertの失敗はプロフィール更新・session消費ごとrollbackされる。

-- 本人が編集できる項目のホワイトリスト。API側の列挙と一致させる。
create or replace function musician_self_editable_fields()
returns text[]
language sql
immutable
as $$
  select array[
    'display_name', 'name_jp', 'name_en', 'roles', 'primary_sns_url',
    'website_url', 'icon_image_url', 'vrc_name', 'aliases'
  ];
$$;

-- 監査snapshot用に、本人編集対象の公開プロフィール全体をjsonbで返す。
create or replace function musician_profile_snapshot(p_musician_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'display_name', m.display_name,
    'name_jp', m.name_jp,
    'name_en', m.name_en,
    'roles', to_jsonb(m.roles),
    'aliases', to_jsonb(m.aliases),
    'primary_sns_url', m.primary_sns_url,
    'website_url', m.website_url,
    'icon_image_url', m.icon_image_url,
    'vrc_name', m.vrc_name,
    'visibility', m.visibility,
    'version', m.version,
    'links', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'platform', l.platform,
            'label', l.label,
            'url', l.url,
            'display_order', l.display_order
          )
          order by l.display_order, l.url
        )
        from musician_links l
        where l.musician_id = m.id and l.is_public
      ),
      '[]'::jsonb
    )
  )
  from musicians m
  where m.id = p_musician_id;
$$;

-- 検証済みfields/link_opsをmusiciansとmusician_linksへ適用する内部関数。
-- 呼び出し側で対象行をfor updateで確保してから呼ぶこと。
create or replace function apply_validated_profile_payload(
  p_musician_id uuid,
  p_fields jsonb,
  p_link_ops jsonb
)
returns text[]
language plpgsql
as $$
declare
  v_allowed text[] := musician_self_editable_fields();
  v_key text;
  v_op jsonb;
  v_changed text[] := '{}';
begin
  -- 書き込み前に全項目を検証する。未知項目は全体を拒否する。
  for v_key in select jsonb_object_keys(coalesce(p_fields, '{}'::jsonb)) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'unknown_field:%', v_key using errcode = '22023';
    end if;
    v_changed := array_append(v_changed, v_key);
  end loop;
  for v_op in select * from jsonb_array_elements(coalesce(p_link_ops, '[]'::jsonb)) loop
    if v_op->>'op' not in ('upsert', 'delete') or (v_op->>'url') is null then
      raise exception 'unknown_link_op' using errcode = '22023';
    end if;
  end loop;

  update musicians set
    display_name = case when p_fields ? 'display_name'
      then p_fields->>'display_name' else display_name end,
    name_jp = case when p_fields ? 'name_jp'
      then p_fields->>'name_jp' else name_jp end,
    name_en = case when p_fields ? 'name_en'
      then p_fields->>'name_en' else name_en end,
    roles = case when p_fields ? 'roles'
      then coalesce(
        (select array_agg(x) from jsonb_array_elements_text(p_fields->'roles') x),
        '{}'::text[]
      )
      else roles end,
    aliases = case when p_fields ? 'aliases'
      then coalesce(
        (select array_agg(x) from jsonb_array_elements_text(p_fields->'aliases') x),
        '{}'::text[]
      )
      else aliases end,
    primary_sns_url = case when p_fields ? 'primary_sns_url'
      then nullif(p_fields->>'primary_sns_url', '') else primary_sns_url end,
    website_url = case when p_fields ? 'website_url'
      then nullif(p_fields->>'website_url', '') else website_url end,
    icon_image_url = case when p_fields ? 'icon_image_url'
      then nullif(p_fields->>'icon_image_url', '') else icon_image_url end,
    icon_image_source = case when p_fields ? 'icon_image_url'
      then case when nullif(p_fields->>'icon_image_url', '') is null
        then 'none' else 'external_url' end
      else icon_image_source end,
    vrc_name = case when p_fields ? 'vrc_name'
      then nullif(p_fields->>'vrc_name', '') else vrc_name end,
    version = version + 1
  where id = p_musician_id;

  for v_op in select * from jsonb_array_elements(coalesce(p_link_ops, '[]'::jsonb)) loop
    if v_op->>'op' = 'delete' then
      delete from musician_links
        where musician_id = p_musician_id and url = v_op->>'url' and is_public;
    else
      update musician_links set
        platform = coalesce(v_op->>'platform', 'other'),
        label = nullif(v_op->>'label', ''),
        display_order = coalesce((v_op->>'display_order')::integer, 0),
        is_public = true
      where musician_id = p_musician_id and url = v_op->>'url';
      if not found then
        insert into musician_links
          (musician_id, platform, label, url, display_order, is_public)
        values (
          p_musician_id,
          coalesce(v_op->>'platform', 'other'),
          nullif(v_op->>'label', ''),
          v_op->>'url',
          coalesce((v_op->>'display_order')::integer, 0),
          true
        );
      end if;
    end if;
  end loop;

  if jsonb_array_length(coalesce(p_link_ops, '[]'::jsonb)) > 0 then
    v_changed := array_append(v_changed, 'links');
  end if;
  return v_changed;
end;
$$;

-- previewの[反映する]でのみ呼ばれる確定処理。
-- session消費、version確認、プロフィール更新、監査ログ追加を
-- 同一transaction内で一度だけ行う。二重confirmは最初の1回だけ成功する。
create or replace function confirm_profile_update_session(
  p_session_id uuid,
  p_discord_user_id text,
  p_interaction_id text
)
returns jsonb
language plpgsql
as $$
declare
  v_session profile_update_sessions%rowtype;
  v_musician musicians%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_changed text[];
begin
  select * into v_session
    from profile_update_sessions
    where session_id = p_session_id
    for update;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'session_not_found');
  end if;
  if v_session.discord_user_id <> p_discord_user_id then
    return jsonb_build_object('ok', false, 'error_code', 'session_owner_mismatch');
  end if;
  if v_session.consumed_at is not null then
    return jsonb_build_object('ok', false, 'error_code', 'session_already_consumed');
  end if;
  if v_session.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error_code', 'session_expired');
  end if;

  select * into v_musician
    from musicians
    where id = v_session.musician_id
    for update;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'musician_not_found');
  end if;
  if v_musician.is_locked then
    return jsonb_build_object('ok', false, 'error_code', 'musician_locked');
  end if;
  if v_musician.version <> v_session.base_version then
    return jsonb_build_object('ok', false, 'error_code', 'version_conflict');
  end if;

  -- 確定時にも本人が有効な代表者であることを再確認する。
  if not exists (
    select 1 from musician_representatives r
    where r.musician_id = v_musician.id
      and r.discord_user_id = p_discord_user_id
      and r.is_active
  ) then
    return jsonb_build_object('ok', false, 'error_code', 'not_representative');
  end if;

  v_before := musician_profile_snapshot(v_musician.id);
  v_changed := apply_validated_profile_payload(
    v_musician.id,
    v_session.validated_payload->'fields',
    v_session.validated_payload->'link_ops'
  );
  v_after := musician_profile_snapshot(v_musician.id);

  insert into musician_audit_logs
    (musician_id, actor_discord_user_id, actor_kind, action, changed_fields,
     before_snapshot, after_snapshot, interaction_id, result)
  values
    (v_musician.id, p_discord_user_id, 'self', 'profile_update', v_changed,
     v_before, v_after, p_interaction_id, 'succeeded');

  update profile_update_sessions
    set consumed_at = now()
    where id = v_session.id;

  return jsonb_build_object(
    'ok', true,
    'musician_id', v_musician.id,
    'slug', v_musician.slug,
    'new_version', v_musician.version + 1,
    'changed_fields', to_jsonb(v_changed)
  );
end;
$$;

-- 本人または運営者によるlock、運営者によるunlock。
create or replace function set_musician_lock(
  p_musician_id uuid,
  p_locked boolean,
  p_reason text,
  p_actor_discord_user_id text,
  p_actor_kind text,
  p_interaction_id text
)
returns jsonb
language plpgsql
as $$
declare
  v_musician musicians%rowtype;
begin
  if p_actor_kind not in ('self', 'operator') then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_actor_kind');
  end if;

  select * into v_musician from musicians where id = p_musician_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'musician_not_found');
  end if;
  if p_locked and v_musician.is_locked then
    return jsonb_build_object('ok', false, 'error_code', 'already_locked');
  end if;
  if (not p_locked) and (not v_musician.is_locked) then
    return jsonb_build_object('ok', false, 'error_code', 'not_locked');
  end if;

  if p_locked then
    update musicians
      set is_locked = true, locked_at = now(), locked_reason = nullif(p_reason, '')
      where id = p_musician_id;
  else
    update musicians
      set is_locked = false, locked_at = null, locked_reason = null
      where id = p_musician_id;
  end if;

  insert into musician_audit_logs
    (musician_id, actor_discord_user_id, actor_kind, action, changed_fields,
     before_snapshot, after_snapshot, interaction_id, result)
  values
    (p_musician_id, p_actor_discord_user_id, p_actor_kind,
     case when p_locked then 'lock' else 'unlock' end,
     array['is_locked'],
     jsonb_build_object('is_locked', v_musician.is_locked),
     jsonb_build_object('is_locked', p_locked, 'locked_reason', nullif(p_reason, '')),
     p_interaction_id, 'succeeded');

  return jsonb_build_object('ok', true, 'musician_id', p_musician_id,
    'slug', v_musician.slug, 'locked', p_locked);
end;
$$;

-- 運営者による代表者変更。旧代表者行を無効化して新しい行を追加する。
create or replace function set_musician_representative(
  p_musician_id uuid,
  p_discord_user_id text,
  p_discord_username_snapshot text,
  p_operator_discord_user_id text,
  p_interaction_id text
)
returns jsonb
language plpgsql
as $$
declare
  v_musician musicians%rowtype;
  v_revoked jsonb;
begin
  select * into v_musician from musicians where id = p_musician_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'musician_not_found');
  end if;

  if exists (
    select 1 from musician_representatives
    where musician_id = p_musician_id
      and discord_user_id = p_discord_user_id
      and is_active
  ) then
    return jsonb_build_object('ok', false, 'error_code', 'already_representative');
  end if;

  with revoked as (
    update musician_representatives
      set is_active = false
      where (musician_id = p_musician_id or discord_user_id = p_discord_user_id)
        and is_active
      returning musician_id, discord_user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'musician_id', musician_id, 'discord_user_id', discord_user_id
    )), '[]'::jsonb)
    into v_revoked
    from revoked;

  insert into musician_representatives
    (musician_id, discord_user_id, discord_username_snapshot,
     is_active, assigned_by_operator)
  values
    (p_musician_id, p_discord_user_id, nullif(p_discord_username_snapshot, ''),
     true, p_operator_discord_user_id);

  insert into musician_audit_logs
    (musician_id, actor_discord_user_id, actor_kind, action, changed_fields,
     before_snapshot, after_snapshot, interaction_id, result)
  values
    (p_musician_id, p_operator_discord_user_id, 'operator', 'representative_set',
     array['representative'],
     jsonb_build_object('revoked', v_revoked),
     jsonb_build_object('discord_user_id', p_discord_user_id),
     p_interaction_id, 'succeeded');

  return jsonb_build_object('ok', true, 'musician_id', p_musician_id,
    'slug', v_musician.slug, 'revoked', v_revoked);
end;
$$;

-- 運営者による公開状態の変更(非公開化・公開)。物理削除は提供しない。
create or replace function set_musician_visibility(
  p_musician_id uuid,
  p_visibility text,
  p_operator_discord_user_id text,
  p_interaction_id text
)
returns jsonb
language plpgsql
as $$
declare
  v_musician musicians%rowtype;
begin
  if p_visibility not in ('public', 'draft', 'hidden') then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_visibility');
  end if;

  select * into v_musician from musicians where id = p_musician_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'musician_not_found');
  end if;
  if v_musician.visibility = p_visibility then
    return jsonb_build_object('ok', false, 'error_code', 'visibility_unchanged');
  end if;

  update musicians set visibility = p_visibility where id = p_musician_id;

  insert into musician_audit_logs
    (musician_id, actor_discord_user_id, actor_kind, action, changed_fields,
     before_snapshot, after_snapshot, interaction_id, result)
  values
    (p_musician_id, p_operator_discord_user_id, 'operator', 'visibility_change',
     array['visibility'],
     jsonb_build_object('visibility', v_musician.visibility),
     jsonb_build_object('visibility', p_visibility),
     p_interaction_id, 'succeeded');

  return jsonb_build_object('ok', true, 'musician_id', p_musician_id,
    'slug', v_musician.slug, 'visibility', p_visibility);
end;
$$;

-- 運営者による過去状態への復旧。監査snapshotを新しい変更として反映する。
-- 事故対応ではlockしたまま復旧できるようにし、lock状態自体は変更しない。
create or replace function restore_musician_from_audit(
  p_musician_id uuid,
  p_audit_log_id uuid,
  p_state text, -- 'before' | 'after'
  p_operator_discord_user_id text,
  p_interaction_id text
)
returns jsonb
language plpgsql
as $$
declare
  v_musician musicians%rowtype;
  v_audit musician_audit_logs%rowtype;
  v_snapshot jsonb;
  v_fields jsonb;
  v_link record;
  v_before jsonb;
  v_after jsonb;
  v_changed text[];
begin
  if p_state not in ('before', 'after') then
    return jsonb_build_object('ok', false, 'error_code', 'invalid_state');
  end if;

  select * into v_musician from musicians where id = p_musician_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'musician_not_found');
  end if;

  select * into v_audit
    from musician_audit_logs
    where id = p_audit_log_id and musician_id = p_musician_id;
  if not found then
    return jsonb_build_object('ok', false, 'error_code', 'audit_log_not_found');
  end if;

  v_snapshot := case when p_state = 'before'
    then v_audit.before_snapshot else v_audit.after_snapshot end;
  if v_snapshot is null or v_snapshot->>'display_name' is null then
    -- lockや代表者変更などのsnapshotはプロフィール全体を含まないため復旧対象外。
    return jsonb_build_object('ok', false, 'error_code', 'snapshot_not_restorable');
  end if;

  -- snapshotから本人編集項目だけを取り出す(visibility/versionは復旧しない)。
  select jsonb_object_agg(key, value) into v_fields
    from jsonb_each(v_snapshot)
    where key = any (musician_self_editable_fields());

  v_before := musician_profile_snapshot(p_musician_id);
  v_changed := apply_validated_profile_payload(p_musician_id, v_fields, '[]'::jsonb);

  -- 公開リンクはsnapshotの内容で全置換する。
  delete from musician_links where musician_id = p_musician_id and is_public;
  for v_link in
    select *
    from jsonb_to_recordset(coalesce(v_snapshot->'links', '[]'::jsonb))
      as x(platform text, label text, url text, display_order integer)
  loop
    insert into musician_links
      (musician_id, platform, label, url, display_order, is_public)
    values
      (p_musician_id, coalesce(v_link.platform, 'other'), v_link.label,
       v_link.url, coalesce(v_link.display_order, 0), true);
  end loop;
  v_changed := array_append(v_changed, 'links');

  v_after := musician_profile_snapshot(p_musician_id);

  insert into musician_audit_logs
    (musician_id, actor_discord_user_id, actor_kind, action, changed_fields,
     before_snapshot, after_snapshot, interaction_id, result)
  values
    (p_musician_id, p_operator_discord_user_id, 'operator', 'restore',
     v_changed, v_before, v_after, p_interaction_id, 'succeeded');

  return jsonb_build_object('ok', true, 'musician_id', p_musician_id,
    'slug', v_musician.slug, 'restored_from', p_audit_log_id);
end;
$$;

-- 書き込み関数は、署名検証・再認可済みのNext.js server routeから
-- service roleでだけ実行する。PostgREST経由のclient直接実行を許可しない。
-- apply_validated_profile_payloadも外部公開用RPCではない内部書き込み関数のため閉じる。
revoke execute on function apply_validated_profile_payload(uuid, jsonb, jsonb)
  from public, anon, authenticated;
revoke execute on function confirm_profile_update_session(uuid, text, text)
  from public, anon, authenticated;
revoke execute on function set_musician_lock(uuid, boolean, text, text, text, text)
  from public, anon, authenticated;
revoke execute on function set_musician_representative(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke execute on function set_musician_visibility(uuid, text, text, text)
  from public, anon, authenticated;
revoke execute on function restore_musician_from_audit(uuid, uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function apply_validated_profile_payload(uuid, jsonb, jsonb)
  to service_role;
grant execute on function confirm_profile_update_session(uuid, text, text)
  to service_role;
grant execute on function set_musician_lock(uuid, boolean, text, text, text, text)
  to service_role;
grant execute on function set_musician_representative(uuid, text, text, text, text)
  to service_role;
grant execute on function set_musician_visibility(uuid, text, text, text)
  to service_role;
grant execute on function restore_musician_from_audit(uuid, uuid, text, text, text)
  to service_role;
