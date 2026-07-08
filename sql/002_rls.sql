-- EMN Records Musician Directory & Credit Builder
-- 002_rls.sql — Row Level Security (apply after 001_init.sql)
--
-- v0.1 model (no Supabase Auth yet):
-- * Anonymous (publishable/anon key): read public data only.
-- * members_only asset READS: the password-gated Next.js server routes use
--   the secret (service_role) key, which bypasses RLS.
-- * standing_assets WRITES: the WordPress custom upload endpoint
--   (wordpress-plugin/emn-musicians-assets) inserts with the Supabase secret
--   key kept on the WordPress server. Browsers never write directly.
-- * v0.2+: replace the "authenticated" template policies below with real
--   per-user ownership once Supabase Auth is introduced.

alter table musicians enable row level security;
alter table musician_links enable row level security;
alter table standing_assets enable row level security;
alter table credit_exports enable row level security;
alter table credit_format_templates enable row level security;

-- musicians: public directory entries are readable by anyone.
drop policy if exists "musicians_public_read" on musicians;
create policy "musicians_public_read" on musicians
  for select
  using (visibility = 'public');

-- musician_links: readable when the link is public and its musician is public.
drop policy if exists "musician_links_public_read" on musician_links;
create policy "musician_links_public_read" on musician_links
  for select
  using (
    is_public
    and exists (
      select 1 from musicians m
      where m.id = musician_links.musician_id
        and m.visibility = 'public'
    )
  );

-- standing_assets: only public+active assets are visible to anonymous
-- clients (used by the public musician detail page). members_only assets are
-- fetched exclusively through server routes using the service_role key after
-- the shared-password check.
drop policy if exists "standing_assets_public_read" on standing_assets;
create policy "standing_assets_public_read" on standing_assets
  for select
  using (visibility = 'public' and is_active);

-- credit_exports: no anonymous access. Server-side (service_role) only in
-- v0.1; per-user policies come with Supabase Auth in v0.2.

-- credit_format_templates: public templates readable by anyone; owners
-- manage their own templates once Supabase Auth exists.
drop policy if exists "credit_format_templates_public_read"
  on credit_format_templates;
create policy "credit_format_templates_public_read" on credit_format_templates
  for select
  using (is_public);

drop policy if exists "credit_format_templates_owner_all"
  on credit_format_templates;
create policy "credit_format_templates_owner_all" on credit_format_templates
  for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
