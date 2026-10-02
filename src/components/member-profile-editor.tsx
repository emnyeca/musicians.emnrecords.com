"use client";
import { useTranslation } from "@/lib/i18n";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { IconImage } from "@/components/icon-image";
import { RolePicker, roleSelection } from "./role-picker";
import type { Musician, MusicianVisibility } from "@/types/musician";

type OwnProfile = Musician & { version: number; isLocked: boolean };
type Session = { musician: OwnProfile | null; csrf: string; expiresAt: number; defaults?: { roles: string[]; directoryCategories: string[] } };
type Fields = {
  displayName: string; nameJp: string; nameEn: string; roles: string[]; otherRole: string;
  primarySnsUrl: string; websiteUrl: string; iconImageUrl: string;
  vrcName: string; aliases: string; slug: string; visibility: MusicianVisibility;
  directoryCategories: string[]; links: { label: string; url: string }[];
};

function fieldsFrom(m: OwnProfile | null): Fields {
  return {
    displayName: m?.displayName ?? "", nameJp: m?.nameJp ?? "", nameEn: m?.nameEn ?? "",
    ...(m?.roleChoices ? {roles: m.roleChoices, otherRole: m.otherRole ?? ""} : roleSelection(m?.roles ?? [])), aliases: m?.aliases.join(", ") ?? "",
    primarySnsUrl: m?.primarySnsUrl ?? "", websiteUrl: m?.websiteUrl ?? "",
    iconImageUrl: m?.iconImageUrl ?? "", vrcName: m?.vrcName ?? "", slug: m?.slug ?? "",
    visibility: m?.visibility ?? "draft",
    directoryCategories: m?.directoryCategories ?? ["musician"],
    links: m?.links.map(({ label, url }) => ({ label: label ?? "", url })) ?? [],
  };
}

/** 401 means the edit session expired or was replaced by a newer Discord link. */
class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Server clock minus browser clock, so the expiry timer does not depend on the PC clock. */
let serverClockOffset = 0;

async function api<T>(path: string, method = "GET", body?: unknown, csrf?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/member/${path}`, {
      method, credentials: "same-origin", cache: "no-store",
      headers: { ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
      ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });
  } catch { throw new ApiError("通信できませんでした。インターネット接続を確認して、もう一度お試しください。", 0); }
  const serverDate = Date.parse(response.headers.get("Date") ?? "");
  if (!Number.isNaN(serverDate)) serverClockOffset = serverDate - Date.now();
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(data?.error ?? "時間をおいてもう一度お試しください。", response.status);
  return data;
}

type ActionPlace = "icon" | "save" | "erase";

const definitions: { key: Exclude<keyof Fields, "directoryCategories" | "links" | "slug" | "roles" | "otherRole" | "visibility">; label: string; required?: boolean; url?: boolean; max: number; hint?: string }[] = [
  { key: "displayName", label: "表示名", required: true, max: 80 },
  { key: "nameJp", label: "日本語名", max: 80, hint: "日本語名がない場合は空欄にできます。クレジットには表示名を使います。" },
  { key: "nameEn", label: "英語名", required: true, max: 80 },
  { key: "primarySnsUrl", label: "主なSNSのURL", url: true, max: 300 },
  { key: "websiteUrl", label: "WebサイトのURL", url: true, max: 300 },
  { key: "iconImageUrl", label: "アイコン画像のURL", url: true, max: 300 },
  { key: "vrcName", label: "VRChat名", max: 80 },
  { key: "aliases", label: "別名義", max: 808, hint: "複数ある場合は半角カンマで区切ってください。" },
];

export function MemberProfileEditor() {
  const t = useTranslation();
  const opening = useRef<Promise<Session> | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [fields, setFields] = useState<Fields>(fieldsFrom(null));
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [finishedProfile, setFinishedProfile] = useState<OwnProfile | null>(null);
  const [slugCheck, setSlugCheck] = useState<{ value: string; text: string; available: boolean } | null>(null);
  const [expired, setExpired] = useState(false);
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [actionError, setActionError] = useState<{ place: ActionPlace; text: string; lead?: string } | null>(null);
  const actionErrorRef = useRef<HTMLDivElement>(null);

  // Switch to the expired view on time instead of waiting for a failed save.
  useEffect(() => {
    if (!session) return;
    const remaining = session.expiresAt * 1000 - (Date.now() + serverClockOffset);
    if (!Number.isFinite(remaining)) return;
    const warn = setTimeout(() => setExpiringSoon(true), Math.max(0, remaining - 5 * 60 * 1000));
    const end = setTimeout(() => setExpired(true), Math.max(0, remaining));
    return () => { clearTimeout(warn); clearTimeout(end); };
  }, [session]);

  useEffect(() => {
    if (actionError) actionErrorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [actionError]);

  function fail(place: ActionPlace, e: unknown, lead: string) {
    if (e instanceof ApiError && e.status === 401) { setExpired(true); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setActionError({ place, lead, text: e instanceof Error ? e.message : "" });
  }
  const actionAlert = (place: ActionPlace) => actionError?.place === place &&
    <div ref={actionErrorRef} role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{t(actionError.lead ?? "")}{t(actionError.text)}</div>;

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
      if (!data.musician && data.defaults) Object.assign(values, data.defaults);
      setSession(data); setFields(values); setBaseline(JSON.stringify(values));
    }).catch((e: Error) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!session || !fields.slug || fields.slug === session.musician?.slug) return;
    let active = true;
    const timer = setTimeout(() => {
      api<{ valid: boolean; available: boolean }>(`slug?value=${encodeURIComponent(fields.slug)}`).then((result) => {
        if (active) setSlugCheck({ value: fields.slug, available: result.available, text: !result.valid ? "半角英小文字・数字・ハイフンで入力してください。" : result.available ? "この識別名は使用できます。" : "この識別名は使用されています。" });
      }).catch(() => { if (active) setSlugCheck({ value: fields.slug, available: true, text: "重複を確認できませんでした。保存時に再確認します。" }); });
    }, 600);
    return () => { active = false; clearTimeout(timer); };
  }, [fields.slug, session]);

  const dirty = JSON.stringify(fields) !== baseline;
  const profile = session?.musician;
  function change<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((old) => ({ ...old, [key]: value })); setNotice("");
  }
  async function save(confirm: boolean) {
    if (!session || expired) return;
    setBusy(true); setError(""); setNotice(""); setActionError(null);
    try {
      const split = (s: string) => s.split(/[,、\n]/).map((v) => v.trim()).filter(Boolean);
      const body = confirm ? { version: profile?.version } : {
        ...fields, aliases: split(fields.aliases),
        ...(profile ? { version: profile.version } : {}),
      };
      const result = await api<{ musician: OwnProfile }>(confirm ? "confirm" : "profile", "POST", body, session.csrf);
      const updated = fieldsFrom(result.musician);
      setSession({ ...session, musician: result.musician }); setFields(updated); setBaseline(JSON.stringify(updated));
      setFinishedProfile(result.musician);
      setNotice(confirm ? "現在の内容を確認済みとして記録しました。" :
        result.musician.visibility === "public" ? "保存しました。公開プロフィールに反映されました。" : "保存しました。現在は名鑑に掲載されていません。");
    } catch (e) {
      fail("save", e, confirm ? "確認済みにできませんでした。" : profile ? "変更は保存されていません。入力内容はこの画面に残っています。" : "登録できていません。入力内容はこの画面に残っています。");
    }
    finally { setBusy(false); }
  }
  async function erase() {
    if (!session || !profile || expired) return;
    if (window.prompt(t("プロフィール・アップロードした画像・変更履歴をすべて削除します。元に戻せません。\n削除する場合は「削除」と入力してください。")) !== t("削除")) return;
    setBusy(true); setError(""); setNotice(""); setActionError(null);
    try {
      await api("delete", "POST", { version: profile.version }, session.csrf);
      setSession(null); setFields(fieldsFrom(null)); setFinishedProfile(null);
      setNotice("プロフィールをデータベースから削除しました。もう一度登録する場合は、Discordのボタンから新規作成できます。");
    } catch (e) { fail("erase", e, "削除できていません。プロフィールはそのまま残っています。"); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
    <p className="text-sm text-muted">{t("EMN Records · メンバー専用")}</p>
    <h1 className="mt-2 text-2xl font-bold">{session && !profile ? t("プロフィールを新規作成") : t("自分のプロフィール")}</h1>
    {loading && <p className="mt-6" role="status">{t("プロフィールを読み込んでいます…")}</p>}
    {error && <div role="alert" className="my-5 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">{t(error)}</div>}
    {session && expired && <div role="alert" className="my-5 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
      <p className="font-semibold">{t("編集の有効期限が切れました")}</p>
      <p className="mt-2 text-sm">{dirty ? t("まだ保存していない変更は、名鑑に反映されていません。") : t("この画面からは保存できません。")}{t("リンクを開いてから30分たったか、Discordで新しいリンクが発行されたため、この画面は使えなくなりました。")}</p>
      <p className="mt-2 text-sm">{t("Discordの専用チャンネルで「自分のプロフィールを確認・編集」を押し、新しいリンクから開き直してください。入力した内容はこの下に残っているので、必要ならメモしてから開き直してください。")}</p>
    </div>}
    {!loading && !session && <p className="mt-4 text-muted">{t("Discordの専用チャンネルで「自分のプロフィールを確認・編集」を押し、本人専用のリンクから開いてください。")}</p>}
    {notice && <p role="status" className="my-5 rounded-lg border border-line bg-surface p-4">{t(notice)}</p>}
    {finishedProfile && <div className="my-4 text-sm">
      <a className="underline" href={`/musicians/${encodeURIComponent(finishedProfile.slug)}`} target="_blank" rel="noopener noreferrer">{t("本人ページを開く")}</a>
      {finishedProfile.visibility !== "public" && <p className="mt-1 text-muted">{t("現在は非公開のため、公開後にこのリンクから閲覧できます。")}</p>}
    </div>}
    {session && <>
      <p className="mt-4 text-sm text-muted">{profile ? `${t("公開状態")}: ${({ public: t("公開中"), draft: t("下書き（非公開）"), hidden: t("非公開") })[profile.visibility]}` : t("あなたのDiscordアカウントに紐付けて登録します。")}</p>
      <p className="mt-2 text-sm text-muted">{t("保存する内容は名鑑に掲載するプロフィールです。編集できる時間はリンクを開いてから30分間です。")}</p>
      {profile?.isLocked && <p role="alert" className="mt-4">{t("このプロフィールは運営により編集がロックされています。運営にお問い合わせください。")}</p>}
      <form className="mt-6" onSubmit={(event) => { event.preventDefault(); void save(false); }}>
        <fieldset disabled={busy || profile?.isLocked} className="space-y-5 disabled:opacity-60">
          <div className="flex items-center gap-4">
            <IconImage key={fields.iconImageUrl} src={/^https?:\/\//i.test(fields.iconImageUrl) ? (fields.iconImageUrl.startsWith(windowOrigin() + "/api/icons/") ? fields.iconImageUrl.replace("/api/icons/", "/api/member/icon/") : fields.iconImageUrl) : null} name={fields.displayName || t("プロフィール")} className="!w-20 shrink-0" />
            <p className="text-sm text-muted">{fields.displayName || t("あなたの表示名")}<br />{fields.roles.join(", ") || t("あなたの担当")}</p>
          </div>
          <label className="block text-sm">{t("アイコン画像をアップロード")}<input type="file" disabled={expired} accept="image/jpeg,image/png,image/webp" className="mt-2 mb-2 block w-full cursor-pointer rounded-md text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-accent-soft file:px-4 file:py-2 file:font-medium file:text-[#843c59] hover:file:bg-[#f5e4eb] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#843c59]" onChange={async (event) => {
              const file = event.target.files?.[0]; event.target.value = "";
              if (!file) return;
              setActionError(null);
              if (file.size > 5 * 1024 * 1024) { setActionError({ place: "icon", text: "画像は5MB以下にしてください。" }); return; }
              setBusy(true); setError("");
              try { const body = new FormData(); body.append("image", file); const result = await api<{ url: string }>("icon", "POST", body, session.csrf); change("iconImageUrl", result.url); setNotice("画像を読み込みました。「変更を保存」または「登録する」で確定してください。"); }
              catch (e) { fail("icon", e, "画像を読み込めませんでした。"); }
              finally { setBusy(false); }
            }} />
            <span className="text-xs text-muted">{t("JPEG・PNG・WebP、5MB以下。中央を正方形に切り抜き、最大512pxに整えます。")}</span>
          </label>
          {actionAlert("icon")}
          <div className="grid gap-5 sm:grid-cols-2">
            {definitions.map(({ key, label, required, url, max, hint }) => <div key={key} className="text-sm">
              <label htmlFor={`member-${key}`} className="mb-1 block font-medium">{t(label)}{required ? t("（必須）") : t("（任意）")}</label>
              <Input id={`member-${key}`} aria-describedby={hint ? `hint-${key}` : undefined} type={url ? "url" : "text"} value={fields[key]} required={required} maxLength={max} onChange={(e) => change(key, e.target.value)} />
              {hint && <p id={`hint-${key}`} className="mt-1 text-xs text-muted">{t(hint)}</p>}
            </div>)}
          </div>
          <RolePicker roles={fields.roles} otherRole={fields.otherRole} onChange={(roles, otherRole) => { setFields((old) => ({ ...old, roles, otherRole })); setNotice(""); }} />
          <div><p className="mb-2 text-sm font-medium">{t("活動区分（1つ以上）")}</p>
            <div className="flex flex-wrap gap-5">{[["musician", "Musician"], ["creator/staff", "Creator / Staff"]].map(([value, label]) => <label key={value} className="flex gap-2 text-sm">
              <input type="checkbox" checked={fields.directoryCategories.includes(value)} onChange={(e) => change("directoryCategories", e.target.checked ? [...fields.directoryCategories, value] : fields.directoryCategories.filter((v) => v !== value))} />{label}
            </label>)}</div>
          </div>
          <div className="text-sm"><label htmlFor="member-slug">{t("プロフィールURLの識別名（slug）")}</label>
            <Input id="member-slug" className="mt-1" required={!!profile} value={fields.slug} maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder={t("例：emnyeca")} onChange={(e) => change("slug", e.target.value)} />
            <p className="mt-1 text-xs text-muted">{t("半角英小文字・数字・ハイフン。変更すると本人ページのURLも変わり、古いURLは利用できなくなります。新規登録時の空欄は自動作成です。")}</p>
            {fields.slug && fields.slug !== profile?.slug && <p role="status" className="mt-1 text-xs">{slugCheck?.value === fields.slug ? t(slugCheck.text) : t("重複を確認中…")}</p>}
          </div>
          <div className="text-sm"><label htmlFor="member-visibility" className="mb-1 block font-medium">{t("公開状態")}</label>
            <Select id="member-visibility" aria-describedby="hint-visibility" value={fields.visibility} onChange={(e) => change("visibility", e.target.value as MusicianVisibility)}>
              <option value="public">{t("公開（名鑑に掲載する）")}</option>
              <option value="draft">{t("下書き（準備中・掲載しない）")}</option>
              <option value="hidden">{t("非公開（掲載しない）")}</option>
            </Select>
            <p id="hint-visibility" className="mt-1 text-xs text-muted">{t("掲載を辞退する場合は「非公開」を選んで保存してください。あとから公開に戻せます。")}</p>
          </div>
          <div className="space-y-3"><p className="text-sm font-medium">{t("追加リンク（任意・10件まで）")}</p>
            {fields.links.map((link, index) => <div key={index} className="flex flex-wrap gap-2 rounded-md border border-line p-3">
              <label className="min-w-0 flex-1 text-xs">{t("リンク名")}<Input value={link.label} maxLength={80} onChange={(e) => change("links", fields.links.map((v, i) => i === index ? { ...v, label: e.target.value } : v))} /></label>
              <label className="min-w-0 flex-[2] text-xs">URL<Input type="url" required value={link.url} maxLength={300} onChange={(e) => change("links", fields.links.map((v, i) => i === index ? { ...v, url: e.target.value } : v))} /></label>
              <Button type="button" aria-label={`${t("削除")}: ${t("追加リンク")} ${index + 1}`} onClick={() => change("links", fields.links.filter((_, i) => i !== index))}>{t("削除")}</Button>
            </div>)}
            <Button type="button" disabled={fields.links.length >= 10} onClick={() => change("links", [...fields.links, { label: "", url: "" }])}>{t("リンクを追加")}</Button>
          </div>
          <div className="space-y-3 border-t border-line pt-5">
            {expired && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{t("編集の有効期限が切れたため、保存できません。")}{dirty && t("変更は保存されていません。")}{t("ページ上部の案内をご覧ください。")}</p>}
            {!expired && expiringSoon && <p role="status" className="rounded-lg border border-line bg-surface p-3 text-sm">{t("まもなく編集の有効期限が切れます。変更がある場合は早めに保存してください。")}</p>}
            {actionAlert("save")}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="accent" disabled={expired || !fields.roles.length || !fields.directoryCategories.length || (!!profile && !dirty) || (slugCheck?.value === fields.slug && !slugCheck.available)}>{busy ? t("処理中…") : profile ? t("変更を保存") : t("登録する")}</Button>
            {profile && <Button type="button" disabled={expired || dirty} onClick={() => void save(true)}>{t("変更せずに確認済みにする")}</Button>}
          </div>
        </fieldset>
      </form>
      <Button className="mt-6" variant="ghost" disabled={busy} onClick={async () => {
        if (dirty && !window.confirm(t("未保存の変更を破棄して終了しますか？"))) return;
        setBusy(true); setError("");
        try { await api("session", "DELETE"); setFinishedProfile(profile ?? null); setSession(null); setFields(fieldsFrom(null)); setNotice("編集を終了しました。"); }
        catch (e) { setError(e instanceof Error ? e.message : "終了できませんでした。"); }
        finally { setBusy(false); }
      }}>{t("編集を終了")}</Button>
      {profile && <section className="mt-10 rounded-lg border border-red-300 p-4">
        <h2 className="font-semibold text-red-900">{t("データベースから削除")}</h2>
        <p className="mt-1 text-sm text-muted">{t("プロフィール、アップロードした画像、変更履歴をすべて削除します。元に戻せません。掲載をやめるだけなら、公開状態を「非公開」にして保存してください。")}</p>
        <div className="mt-3">{actionAlert("erase")}</div>
        <Button className="mt-3 border-red-300 text-red-900" disabled={busy || expired || profile.isLocked} onClick={() => void erase()}>{t("データベースから削除")}</Button>
      </section>}
    </>}
  </main>;
}

function windowOrigin() { return typeof window === "undefined" ? "" : window.location.origin; }
