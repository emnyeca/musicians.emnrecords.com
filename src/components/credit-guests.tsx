"use client";

import { useState, type FormEvent } from "react";
import type { CreditGuest } from "@/types/musician";
import { useCreditSelections, useSavedGuests } from "@/lib/credits/use-credit-selections";
import { validateGuest } from "@/lib/credits/guests";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const emptyGuest: CreditGuest = { id: "", displayName: "", nameJp: "", nameEn: "", role: "", linkPrimary: "", linkSecondary: "", iconImageUrl: "" };
const fields = [
  ["displayName", "表示名 *"], ["nameJp", "日本語名（任意）"], ["nameEn", "英語名（任意）"],
  ["role", "担当（例：PA、KP、執筆）"], ["linkPrimary", "SNS・Web URL"],
  ["linkSecondary", "追加リンクURL"], ["iconImageUrl", "アイコンURL（任意）"],
] as const;

export function CreditGuests() {
  const { guests, saveGuest, deleteGuest } = useSavedGuests();
  const { addGuest, isSelected } = useCreditSelections();
  const [form, setForm] = useState<CreditGuest>(emptyGuest);
  const [open, setOpen] = useState(false);
  const [save, setSave] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const guest = validateGuest({ ...form, id: form.id || `guest-${crypto.randomUUID()}` });
      const persisted = !save || saveGuest(guest);
      if (!form.id) addGuest(guest);
      setStatus(!persisted ? "端末に保存できませんでした。ブラウザの保存設定や空き容量を確認してください。この画面では利用できます。"
        : form.id ? "保存済みゲストを更新しました。選択中のクレジットは変更していません。"
        : save ? "クレジットに追加し、この端末に保存しました。" : "今回のクレジットに追加しました。");
      setForm(emptyGuest); setOpen(false); setSave(false);
    } catch (error) { setStatus(error instanceof Error ? error.message : "入力を確認してください。"); }
  }

  return <section className="flex flex-col gap-3 rounded-xl border border-line p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-medium">ゲスト・保存済みの人</h2>
      <Button onClick={() => { setForm(emptyGuest); setSave(false); setOpen(true); setStatus(""); }}>ゲストを追加</Button>
    </div>
    <p className="text-xs text-muted">保存した人は、この端末の同じブラウザで再利用できます。ブラウザのサイトデータを消すと削除されます。名鑑には掲載されません。</p>
    {open && <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">{fields.map(([key, label]) =>
        <label key={key} className="flex flex-col gap-1 text-sm">{label}
          <Input required={key === "displayName"} type={key.includes("Url") || key.startsWith("link") ? "url" : "text"}
            maxLength={key.includes("Url") || key.startsWith("link") ? 1200 : 200} value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
        </label>)}</div>
      {!form.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />この端末に保存する</label>}
      <div className="flex gap-2"><Button variant="solid" type="submit">{form.id ? "保存済みの情報を更新" : "クレジットに追加"}</Button>
        <Button type="button" onClick={() => setOpen(false)}>キャンセル</Button></div>
    </form>}
    <p role="status" className="text-sm">{status}</p>
    {guests.length > 0 && <>
      <Input aria-label="保存済みゲストを検索" placeholder="保存済みの名前・担当を検索" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul className="max-h-72 overflow-auto">{guests.filter((guest) => [guest.displayName, guest.nameJp, guest.nameEn, guest.role].join(" ").toLowerCase().includes(query.toLowerCase())).map((guest) =>
        <li key={guest.id} className="flex flex-wrap items-center gap-2 border-b border-line py-2">
          <span className="min-w-0 flex-1 text-sm">{guest.displayName}<span className="block text-xs text-muted">{guest.role}</span></span>
          <Button size="sm" disabled={isSelected(guest.id)} onClick={() => addGuest(guest)}>{isSelected(guest.id) ? "追加済み" : "追加"}</Button>
          <Button size="sm" onClick={() => { setForm(guest); setSave(true); setOpen(true); }}>編集</Button>
          <Button size="sm" onClick={() => { if (window.confirm(`${guest.displayName} を端末の保存済み一覧から削除しますか？ 今回のクレジットには残ります。`)) {
            const persisted = deleteGuest(guest.id);
            if (form.id === guest.id) { setForm(emptyGuest); setOpen(false); }
            setStatus(persisted ? "保存済み一覧から削除しました。" : "端末の保存データを更新できませんでした。再読み込みすると戻る場合があります。");
          } }}>削除</Button>
        </li>)}</ul>
    </>}
  </section>;
}
