import type { Metadata } from "next";
import Link from "next/link";
import {
  hasValidAccess,
  isAccessConfigured,
  isUsingDevFallbackPassword,
} from "@/lib/assets/access";
import {
  AccessLogoutButton,
  PasswordGate,
} from "@/components/password-gate";
import { AdminMusicianCreateForm } from "@/components/admin-musician-create-form";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { hasSupabaseServiceRole } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authorized = await hasValidAccess("admin");
  if (!authorized) {
    return (
      <PasswordGate
        endpoint="/api/admin-access"
        title="Admin"
        description="ミュージシャン名鑑DBを編集する管理者用ページです。"
        footer="管理者パスワードは公開メンバー向けパスワードとは別に管理します。"
      />
    );
  }

  const rows: { label: string; ok: boolean; note: string }[] = [
    {
      label: "Supabase",
      ok: isSupabaseConfigured(),
      note: isSupabaseConfigured()
        ? hasSupabaseServiceRole()
          ? "接続設定あり（secret keyあり）"
          : "接続設定あり（secret key未設定 — 管理操作に必要）"
        : "未設定 — mockデータで表示中",
    },
    {
      label: "Admin password",
      ok: isAccessConfigured("admin"),
      note: isUsingDevFallbackPassword("admin")
        ? "開発用フォールバック使用中（本番では必ず設定）"
        : isAccessConfigured("admin")
          ? "設定済み"
          : "未設定",
    },
  ];
  const canCreateMusician = isSupabaseConfigured() && hasSupabaseServiceRole();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-muted">
            ミュージシャン名鑑の正本DBを管理します。
          </p>
        </div>
        <AccessLogoutButton endpoint="/api/admin-access" />
      </div>

      <div className="overflow-hidden rounded-xl border border-line">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between gap-3 px-4 py-3 ${
              i > 0 ? "border-t border-line" : ""
            }`}
          >
            <span className="text-sm text-ink">{row.label}</span>
            <span
              className={`text-right text-xs ${row.ok ? "text-muted" : "text-amber-700"}`}
            >
              {row.note}
            </span>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-ink">Add musician</h2>
          {!canCreateMusician ? (
            <p className="text-xs text-amber-700">
              Supabase service role keyが設定されていないため作成できません。
            </p>
          ) : null}
        </div>
        <AdminMusicianCreateForm disabled={!canCreateMusician} />
      </section>

      <div className="flex flex-wrap gap-3 text-xs">
        <Link
          href="/musicians"
          className="text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Directory
        </Link>
      </div>
    </div>
  );
}
