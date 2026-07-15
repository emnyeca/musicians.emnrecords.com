-- EMN Records Musician Directory & Credit Builder
-- 001_init.sql — schema (apply first, then 002_rls.sql)
--
-- Notes:
-- * roles text[] is the single "担当" field. There is NO instruments column
--   by design — instruments and roles are not separated in this app.
-- * Credit builder overrides are never written into musicians. They may only
--   be stored as snapshots inside credit_exports.selected_people.

create extension if not exists pgcrypto;

-- updated_at auto-touch -------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- musicians ---------------------------------------------------------------

create table if not exists musicians (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  name_jp text not null,
  name_en text not null,
  canonical_name text,
  sort_name text,
  aliases text[] default '{}',
  roles text[] default '{}',
  primary_sns_url text,
  website_url text,
  icon_image_url text,
  -- external_url | supabase_upload | conoha_url | none
  icon_image_source text default 'none',
  icon_storage_path text,
  vrc_name text,
  discord_name text,
  -- public | draft | hidden
  visibility text not null default 'draft',
  is_verified boolean not null default false,
  version integer not null default 1 check (version > 0),
  is_locked boolean not null default false,
  locked_at timestamptz,
  locked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint musicians_lock_details_check check (
    (is_locked and locked_at is not null)
    or (not is_locked and locked_at is null and locked_reason is null)
  )
);

create index if not exists musicians_visibility_idx on musicians (visibility);
create index if not exists musicians_sort_name_idx on musicians (sort_name);

drop trigger if exists musicians_set_updated_at on musicians;
create trigger musicians_set_updated_at
  before update on musicians
  for each row execute function set_updated_at();

-- musician_links ------------------------------------------------------------

create table if not exists musician_links (
  id uuid primary key default gen_random_uuid(),
  musician_id uuid not null references musicians(id) on delete cascade,
  -- x | youtube | twitch | instagram | soundcloud | booth | website | other
  platform text default 'other',
  label text,
  url text not null,
  display_order integer default 0,
  is_public boolean default true,
  created_at timestamptz default now()
);

create index if not exists musician_links_musician_idx
  on musician_links (musician_id, display_order);

-- Discord Interaction受付 ----------------------------------------------------

create table if not exists musician_representatives (
  id uuid primary key default gen_random_uuid(),
  musician_id uuid not null references musicians(id) on delete cascade,
  discord_user_id text not null,
  discord_username_snapshot text,
  is_active boolean not null default true,
  assigned_by_operator text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 初期運用では、1レコードにつき有効な代表者は1名、1アカウントにつき
-- 有効な代表先は1レコードに限定する。代表者変更時は旧行を無効化する。
create unique index if not exists musician_representatives_one_active_per_musician
  on musician_representatives (musician_id) where is_active;
create unique index if not exists musician_representatives_one_active_per_user
  on musician_representatives (discord_user_id) where is_active;

drop trigger if exists musician_representatives_set_updated_at
  on musician_representatives;
create trigger musician_representatives_set_updated_at
  before update on musician_representatives
  for each row execute function set_updated_at();

create table if not exists profile_update_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid unique not null default gen_random_uuid(),
  discord_interaction_id text unique not null,
  discord_user_id text not null,
  musician_id uuid not null references musicians(id) on delete cascade,
  base_version integer not null check (base_version > 0),
  submitted_payload jsonb not null,
  validated_payload jsonb not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profile_update_sessions_expiry_check check (expires_at > created_at),
  constraint profile_update_sessions_consumed_check check (
    consumed_at is null or consumed_at >= created_at
  )
);

create index if not exists profile_update_sessions_lookup_idx
  on profile_update_sessions (discord_user_id, musician_id, expires_at);

create table if not exists musician_audit_logs (
  id uuid primary key default gen_random_uuid(),
  musician_id uuid references musicians(id) on delete set null,
  actor_discord_user_id text,
  actor_kind text not null check (actor_kind in ('self', 'operator', 'system')),
  action text not null check (
    action in (
      'profile_update', 'profile_update_failed', 'lock', 'unlock',
      'restore', 'representative_set', 'representative_revoked'
    )
  ),
  changed_fields text[] not null default '{}',
  before_snapshot jsonb,
  after_snapshot jsonb,
  interaction_id text unique,
  result text not null check (result in ('succeeded', 'rejected', 'failed')),
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists musician_audit_logs_musician_created_idx
  on musician_audit_logs (musician_id, created_at desc);

-- 監査ログは追記専用。service roleを含む通常接続からの変更・削除も拒否する。
create or replace function prevent_musician_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'musician_audit_logs is append-only';
end;
$$;

drop trigger if exists musician_audit_logs_prevent_update
  on musician_audit_logs;
create trigger musician_audit_logs_prevent_update
  before update or delete on musician_audit_logs
  for each row execute function prevent_musician_audit_log_mutation();

-- credit_exports ---------------------------------------------------------------

-- selected_people stores the credit-builder snapshot (including temporary
-- overrides). It is history only and must never be used to update musicians.
create table if not exists credit_exports (
  id uuid primary key default gen_random_uuid(),
  title text,
  event_name text,
  -- emn_minimal | wordpress_html | markdown | plain_text | discord | json | custom
  output_format text not null,
  output_body text not null,
  selected_people jsonb not null default '[]',
  created_by uuid,
  created_at timestamptz default now()
);

-- credit_format_templates -------------------------------------------------------

create table if not exists credit_format_templates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid,
  name text not null,
  description text,
  header_template text default '',
  person_template text not null,
  separator text default E'\n\n',
  footer_template text default '',
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists credit_format_templates_set_updated_at
  on credit_format_templates;
create trigger credit_format_templates_set_updated_at
  before update on credit_format_templates
  for each row execute function set_updated_at();
