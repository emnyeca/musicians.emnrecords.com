-- EMN Records Musician Directory & Credit Builder
-- 002_rls.sql — Row Level Security (apply after 001_init.sql)
--
-- 初期モデル（Supabase Authは使用しない）:
-- * Anonymous (publishable/anon key): read public data only.
-- * Discord受付・運営操作: Next.jsの信頼されたserver routeだけがservice roleで実行。
-- * 代表者、更新session、監査ログを匿名・authenticated clientへ公開しない。

alter table musicians enable row level security;
alter table musician_links enable row level security;
alter table musician_representatives enable row level security;
alter table profile_update_sessions enable row level security;
alter table musician_audit_logs enable row level security;
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

-- credit_format_templates: 公開templateだけを匿名で読み取れる。
drop policy if exists "credit_format_templates_public_read"
  on credit_format_templates;
create policy "credit_format_templates_public_read" on credit_format_templates
  for select
  using (is_public);

-- musician_representatives / profile_update_sessions / musician_audit_logsには
-- client向けpolicyを作らない。Discord側のroleやcommand permissionだけを信用せず、
-- server routeがguild、role、代表者、lock、versionを再確認して操作する。
