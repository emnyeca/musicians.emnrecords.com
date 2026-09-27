"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconImage } from "@/components/icon-image";
import type { Musician } from "@/types/musician";

type OwnProfile = Musician & { version: number; isLocked: boolean };
type Session = { musician: OwnProfile | null; csrf: string; expiresAt: number };
type Fields = {
  displayName: string; nameJp: string; nameEn: string; roles: string;
  primarySnsUrl: string; websiteUrl: string; iconImageUrl: string;
  vrcName: string; aliases: string; slug: string;
  directoryCategories: string[]; links: { label: string; url: string }[];
};

function fieldsFrom(m: OwnProfile | null): Fields {
  return {
    displayName: m?.displayName ?? "", nameJp: m?.nameJp ?? "", nameEn: m?.nameEn ?? "",
    roles: m?.roles.join(", ") ?? "", aliases: m?.aliases.join(", ") ?? "",
    primarySnsUrl: m?.primarySnsUrl ?? "", websiteUrl: m?.websiteUrl ?? "",
    iconImageUrl: m?.iconImageUrl ?? "", vrcName: m?.vrcName ?? "", slug: m?.slug ?? "",
    directoryCategories: m?.directoryCategories ?? ["musician"],
    links: m?.links.map(({ label, url }) => ({ label: label ?? "", url })) ?? [],
  };
}

async function api<T>(path: string, method = "GET", body?: unknown, csrf?: string): Promise<T> {
  const response = await fetch(`/api/member/${path}`, {
    method, credentials: "same-origin", cache: "no-store",
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? "読み込み・保存に失敗しました。時間をおいてもう一度お試しください。");
  return data;
}

const definitions: { key: Exclude<keyof Fields, "directoryCategories" | "links" | "slug">; label: string; required?: boolean; url?: boolean; max: number; hint?: string }[] = [
  { key: "displayName", label: "表示名", required: true, max: 80 },
  { key: "nameJp", label: "日本語名", required: true, max: 80, hint: "日本語表記がない場合は表示名と同じで構いません。" },
  { key: "nameEn", label: "英語名", required: true, max: 80 },
  { key: "roles", label: "担当", required: true, max: 408, hint: "Guitar, Producer, Engineer など、半角カンマで区切ってください。" },
  { key: "primarySnsUrl", label: "主なSNSのURL", url: true, max: 300 },
  { key: "websiteUrl", label: "WebサイトのURL", url: true, max: 300 },
  { key: "iconImageUrl", label: "アイコン画像のURL", url: true, max: 300 },
  { key: "vrcName", label: "VRChat名", max: 80 },
  { key: "aliases", label: "別名義", max: 808, hint: "複数ある場合は半角カンマで区切ってください。" },
];

export function MemberProfileEditor() {
  const opening = useRef<Promise<Session> | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [fields, setFields] = useState<Fields>(fieldsFrom(null));
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    if (!opening.current) {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
      window.history.replaceState(null, "", window.location.pathname);
      opening.current = (async () => {
        if (token) await api("session", "POST", { token });
        return api<Session>("profile");
      })();
    }
    opening.current.then((data) => {
      if (!active) return;
      const values = fieldsFrom(data.musician);
      setSession(data); setFields(values); setBaseline(JSON.stringify(values));
    }).catch((e: Error) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const dirty = JSON.stringify(fields) !== baseline;
  const profile = session?.musician;
  function change<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((old) => ({ ...old, [key]: value })); setNotice("");
  }
  async function save(confirm: boolean) {
    if (!session) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { slug, ...values } = fields;
      const split = (s: string) => s.split(/[,、\n]/).map((v) => v.trim()).filter(Boolean);
      const body = confirm ? { version: profile?.version } : {
        ...values, roles: split(fields.roles), aliases: split(fields.aliases),
        ...(profile ? { version: profile.version } : { slug }),
      };
      const result = await api<{ musician: OwnProfile }>(confirm ? "confirm" : "profile", "POST", body, session.csrf);
      const updated = fieldsFrom(result.musician);
      setSession({ ...session, musician: result.musician }); setFields(updated); setBaseline(JSON.stringify(updated));
      setNotice(confirm ? "現在の内容を確認済みとして記録しました。" :
        result.musician.visibility === "public" ? "保存しました。公開プロフィールに反映されました。" : "保存しました。現在は非公開です。公開は運営が行います。");
    } catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした。入力内容はこの画面に残っています。"); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
    <p className="text-sm text-muted">EMN Records · メンバー専用</p>
    <h1 className="mt-2 text-2xl font-bold">{session && !profile ? "プロフィールを新規作成" : "自分のプロフィール"}</h1>
    {loading && <p className="mt-6" role="status">プロフィールを読み込んでいます…</p>}
    {error && <div role="alert" className="my-5 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">{error}</div>}
    {!loading && !session && <p className="mt-4 text-muted">Discordの専用チャンネルで「自分のプロフィールを確認・編集」を押し、本人専用のリンクから開いてください。</p>}
    {notice && <p role="status" className="my-5 rounded-lg border border-line bg-surface p-4">{notice}</p>}
    {session && <>
      <p className="mt-4 text-sm text-muted">{profile ? `公開状態：${({ public: "公開中", draft: "下書き（非公開）", hidden: "非公開" })[profile.visibility]}` : "あなたのDiscordアカウントに紐付けて、下書きとして登録します。"}</p>
      <p className="mt-2 text-sm text-muted">保存する内容は名鑑に掲載するプロフィールです。編集できる時間はリンクを開いてから30分間です。</p>
      {profile?.isLocked && <p role="alert" className="mt-4">このプロフィールは運営により編集がロックされています。運営にお問い合わせください。</p>}
      <form className="mt-6" onSubmit={(event) => { event.preventDefault(); void save(false); }}>
        <fieldset disabled={busy || profile?.isLocked} className="space-y-5 disabled:opacity-60">
          <div className="flex items-center gap-4">
            <IconImage key={fields.iconImageUrl} src={/^https?:\/\//i.test(fields.iconImageUrl) ? fields.iconImageUrl : null} name={fields.displayName || "プロフィール"} className="!w-20 shrink-0" />
            <p className="text-sm text-muted">{fields.displayName || "あなたの表示名"}<br />{fields.roles || "あなたの担当"}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {definitions.map(({ key, label, required, url, max, hint }) => <div key={key} className="text-sm">
              <label htmlFor={`member-${key}`} className="mb-1 block font-medium">{label}{required ? "（必須）" : "（任意）"}</label>
              <Input id={`member-${key}`} aria-describedby={hint ? `hint-${key}` : undefined} type={url ? "url" : "text"} value={fields[key]} required={required} maxLength={max} onChange={(e) => change(key, e.target.value)} />
              {hint && <p id={`hint-${key}`} className="mt-1 text-xs text-muted">{hint}</p>}
            </div>)}
          </div>
          <div><p className="mb-2 text-sm font-medium">活動区分（1つ以上）</p>
            <div className="flex flex-wrap gap-5">{[["musician", "Musician"], ["creator/staff", "Creator / Staff"]].map(([value, label]) => <label key={value} className="flex gap-2 text-sm">
              <input type="checkbox" checked={fields.directoryCategories.includes(value)} onChange={(e) => change("directoryCategories", e.target.checked ? [...fields.directoryCategories, value] : fields.directoryCategories.filter((v) => v !== value))} />{label}
            </label>)}</div>
          </div>
          {!profile ? <label className="block text-sm">プロフィールURLの識別名（任意）
            <Input className="mt-1" value={fields.slug} maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="例：emnyeca" onChange={(e) => change("slug", e.target.value)} />
            <span className="text-xs text-muted">半角英小文字・数字・ハイフン。空欄なら自動で作成します。</span>
          </label> : <p className="text-sm text-muted">プロフィールの識別名：{profile.slug}</p>}
          <div className="space-y-3"><p className="text-sm font-medium">追加リンク（任意・10件まで）</p>
            {fields.links.map((link, index) => <div key={index} className="flex flex-wrap gap-2 rounded-md border border-line p-3">
              <label className="min-w-0 flex-1 text-xs">リンク名<Input value={link.label} maxLength={80} onChange={(e) => change("links", fields.links.map((v, i) => i === index ? { ...v, label: e.target.value } : v))} /></label>
              <label className="min-w-0 flex-[2] text-xs">URL<Input type="url" required value={link.url} maxLength={300} onChange={(e) => change("links", fields.links.map((v, i) => i === index ? { ...v, url: e.target.value } : v))} /></label>
              <Button type="button" aria-label={`追加リンク${index + 1}を削除`} onClick={() => change("links", fields.links.filter((_, i) => i !== index))}>削除</Button>
            </div>)}
            <Button type="button" disabled={fields.links.length >= 10} onClick={() => change("links", [...fields.links, { label: "", url: "" }])}>リンクを追加</Button>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-line pt-5">
            <Button type="submit" variant="accent" disabled={!fields.directoryCategories.length || (!!profile && !dirty)}>{busy ? "処理中…" : profile ? "変更を保存" : "下書きとして登録"}</Button>
            {profile && <Button type="button" disabled={dirty} onClick={() => void save(true)}>変更せずに確認済みにする</Button>}
          </div>
        </fieldset>
      </form>
      <Button className="mt-6" variant="ghost" disabled={busy} onClick={async () => {
        if (dirty && !window.confirm("未保存の変更を破棄して終了しますか？")) return;
        setBusy(true); setError("");
        try { await api("session", "DELETE"); setSession(null); setFields(fieldsFrom(null)); setNotice("編集を終了しました。"); }
        catch (e) { setError(e instanceof Error ? e.message : "終了できませんでした。"); }
        finally { setBusy(false); }
      }}>編集を終了</Button>
    </>}
  </main>;
}
