"use client";
import { useEffect, useState } from "react";
import { PasswordGate, AccessLogoutButton } from "./password-gate";
import { AdminMusicianCreateForm } from "./admin-musician-create-form";
import { AdminMusicianEditor } from "./admin-musician-editor";
export function AdminPanel() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/api/admin-access", { cache: "no-store" }).then(async (r) => {
      if (!r.ok) throw new Error();
      setAuthorized((await r.json()).authorized);
    }).catch(() => setError(true));
  }, []);
  if (error) return <p role="alert">管理APIへ接続できませんでした。</p>;
  if (authorized === null) return <p role="status">読み込み中…</p>;
  if (!authorized) return <PasswordGate endpoint="/api/admin-access" title="Admin"
    description="ミュージシャン名鑑を管理するページです。" footer="運営者用のパスワードでログインしてください。" />;
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
    <div className="flex justify-between"><h1 className="text-xl font-semibold">Admin</h1>
      <AccessLogoutButton endpoint="/api/admin-access" /></div>
    <section className="flex flex-col gap-4"><h2 className="text-lg font-semibold">登録内容の確認・修正</h2><AdminMusicianEditor /></section>
    <details className="rounded border border-line p-4"><summary className="cursor-pointer font-medium">新しいミュージシャンを追加</summary><div className="mt-5"><AdminMusicianCreateForm disabled={false} /></div></details>
  </div>;
}
