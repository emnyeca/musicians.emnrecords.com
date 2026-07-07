"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Shared-password gate for member pages. The password is sent to a server
 * route for verification; on success the server sets an httpOnly cookie and
 * the page is refreshed.
 */
export function PasswordGate({
  endpoint,
  title,
  description,
}: {
  endpoint: string;
  title: string;
  description: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (body.ok) {
        router.refresh();
        return;
      }
      setError(body.error ?? "認証に失敗しました。");
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5 py-16">
      <div className="flex size-11 items-center justify-center rounded-full border border-line bg-surface">
        <Lock className="size-4 text-muted" />
      </div>
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="text-xs leading-relaxed text-muted">{description}</p>
      </div>
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="共通パスワード"
          autoFocus
          autoComplete="current-password"
        />
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <Button
          type="submit"
          variant="solid"
          disabled={submitting || password === ""}
        >
          {submitting ? "確認中…" : "開く"}
        </Button>
      </form>
      <p className="text-center text-[11px] leading-relaxed text-muted">
        パスワードはEMN Recordsの確認済みメンバー向けDiscordチャンネルで
        共有されています。
      </p>
    </div>
  );
}

/** Clears the access cookie for the given endpoint and refreshes the page. */
export function AccessLogoutButton({ endpoint }: { endpoint: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch(endpoint, { method: "DELETE" });
    } finally {
      router.refresh();
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={logout} disabled={busy}>
      <LogOut className="size-3.5" />
      アクセスを終了
    </Button>
  );
}
