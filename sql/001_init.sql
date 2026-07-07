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
  visibility text default 'draft',
  is_verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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

-- standing_assets -------------------------------------------------------------

-- v0.1 constraint: file_url points to WordPress uploads on ConoHa, which is a
-- normal public URL. members_only means "limited sharing via the gated page",
-- NOT strictly private storage. No per-asset download password by design —
-- the member page is protected by one shared password.
create table if not exists standing_assets (
  id uuid primary key default gen_random_uuid(),
  musician_id uuid references musicians(id) on delete cascade,

  title text not null,
  description text,
  file_url text not null,
  -- wordpress_media | supabase_storage | external
  storage_backend text default 'wordpress_media',
  wp_media_id integer,
  original_filename text,
  stored_filename text,
  mime_type text,
  file_size_bytes bigint,

  -- public | members_only
  visibility text default 'members_only',
  access_note text,

  allow_credit_use boolean default true,
  allow_thumbnail_use boolean default true,
  allow_cropping boolean default true,
  allow_color_adjustment boolean default false,
  require_credit boolean default false,
  credit_text text,
  usage_terms text,

  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists standing_assets_musician_idx
  on standing_assets (musician_id);
create index if not exists standing_assets_visibility_idx
  on standing_assets (visibility, is_active);

drop trigger if exists standing_assets_set_updated_at on standing_assets;
create trigger standing_assets_set_updated_at
  before update on standing_assets
  for each row execute function set_updated_at();

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
