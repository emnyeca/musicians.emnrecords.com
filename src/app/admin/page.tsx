import type { Metadata } from "next";
import Link from "next/link";
import { isAccessConfigured, isUsingDevFallbackPassword } from "@/lib/assets/access";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { hasSupabaseServiceRole } from "@/lib/supabase/server";
import { isWordPressConfigured } from "@/lib/wordpress/media-upload";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * v0.1 admin: a configuration status board only (no data management yet).
 * Musician data is managed via SQL / Supabase dashboard / import script.
 */
export default function AdminPage() {
  const rows: { label: string; ok: boolean; note: string }[] = [
    {
      label: "Supabase",
      ok: isSupabaseConfigured(),
      note: isSupabaseConfigured()
        ? hasSupabaseServiceRole()
          ? "接続設定あり（secret keyあり）"
          : "接続設定あり（secret key未設定 — members_only素材の取得に必要）"
        : "未設定 — mockデータで表示中",
    },
    {
      label: "WordPress upload",
      ok: isWordPressConfigured(),
      note: isWordPressConfigured()
        ? "設定済み"
        : "未設定 — 開発中はアップロードをシミュレートします",
    },
    {
      label: "Download password",
      ok: isAccessConfigured("member-download"),
      note: isUsingDevFallbackPassword("member-download")
        ? "開発用フォールバック使用中（本番では必ず設定）"
        : isAccessConfigured("member-download")
          ? "設定済み"
          : "未設定",
    },
    {
      label: "Upload password",
      ok: isAccessConfigured("asset-upload"),
      note: isUsingDevFallbackPassword("asset-upload")
        ? "開発用フォールバック使用中（本番では必ず設定）"
        : isAccessConfigured("asset-upload")
          ? "設定済み"
          : "未設定",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted">
          v0.1では設定状況の確認のみ。データ管理はSupabase dashboardと
          importスクリプトで行います。
        </p>
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

      <div className="flex flex-wrap gap-3 text-xs">
        <Link href="/member/standing-assets" className="text-muted underline-offset-2 hover:text-ink hover:underline">
          Standing assets (download)
        </Link>
        <Link href="/member/upload-standing-asset" className="text-muted underline-offset-2 hover:text-ink hover:underline">
          Standing assets (upload)
        </Link>
        <Link href="/musicians" className="text-muted underline-offset-2 hover:text-ink hover:underline">
          Directory
        </Link>
      </div>
    </div>
  );
}
