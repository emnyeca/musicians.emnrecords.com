-- EMN Records Musician Directory & Credit Builder
-- 002_rls.sql — Row Level Security (apply after 001_init.sql)
--
-- v0.1 model (no Supabase Auth yet):
-- * Anonymous (publishable/anon key): read public data only.
-- * v0.2+: replace the "authenticated" template policies below with real
--   per-user ownership once Supabase Auth is introduced.

alter table musicians enable row level security;
alter table musician_links enable row level security;
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
