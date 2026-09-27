"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DirectoryCategory, Musician, MusicianVisibility } from "@/types/musician";

type AdminMusician = Musician & {
  version: number;
  isLocked: boolean;
  lockedReason: string | null;
  representativeDiscordUserId: string | null;
};

type EditorState = {
  directoryCategories: DirectoryCategory[];
  slug: string;
  displayName: string; nameJp: string; nameEn: string; canonicalName: string;
  sortName: string; aliases: string; roles: string; primarySnsUrl: string;
  websiteUrl: string; iconImageUrl: string; vrcName: string; discordName: string;
  representativeDiscordUserId: string;
  visibility: MusicianVisibility; isVerified: boolean; links: string;
};

function stateFrom(m: AdminMusician): EditorState {
  return {
    directoryCategories:m.directoryCategories ?? ["musician"],
    slug:m.slug,
    displayName:m.displayName, nameJp:m.nameJp, nameEn:m.nameEn,
    canonicalName:m.canonicalName ?? "", sortName:m.sortName ?? "",
    aliases:m.aliases.join(", "), roles:m.roles.join(", "),
    primarySnsUrl:m.primarySnsUrl ?? "", websiteUrl:m.websiteUrl ?? "",
    iconImageUrl:m.iconImageUrl ?? "", vrcName:m.vrcName ?? "",
    discordName:m.discordName ?? "", visibility:m.visibility,
    representativeDiscordUserId:m.representativeDiscordUserId ?? "",
    isVerified:m.isVerified,
    links:m.links.map((link)=>`${link.label ? `${link.label} | ` : ""}${link.url}`).join("\n"),
  };
}

export function AdminMusicianEditor() {
  const [musicians,setMusicians]=useState<AdminMusician[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [form,setForm]=useState<EditorState | null>(null);
  const [query,setQuery]=useState("");
  const [visibility,setVisibility]=useState<"all"|MusicianVisibility>("all");
  const [status,setStatus]=useState("読み込み中…");
  const [saving,setSaving]=useState(false);

  async function load(select?: string) {
    setStatus("読み込み中…");
    try {
      const response=await fetch("/api/admin/musicians",{cache:"no-store"});
      if (!response.ok) throw new Error();
      const data=await response.json() as {musicians:AdminMusician[]};
      setMusicians(data.musicians);
      const id=select ?? selectedId ?? data.musicians[0]?.id ?? "";
      setSelectedId(id);
      const current=data.musicians.find((m)=>m.id===id) ?? data.musicians[0];
      setForm(current?stateFrom(current):null);
      setStatus(`${data.musicians.length}名`);
    } catch { setStatus("一覧を取得できませんでした。"); }
  }
  useEffect(()=>{
    fetch("/api/admin/musicians",{cache:"no-store"}).then(async(response)=>{
      if(!response.ok) throw new Error();
      const data=await response.json() as {musicians:AdminMusician[]};
      setMusicians(data.musicians);
      const current=data.musicians[0];
      if(current){setSelectedId(current.id);setForm(stateFrom(current));}
      setStatus(`${data.musicians.length}名`);
    }).catch(()=>setStatus("一覧を取得できませんでした。"));
  },[]);

  const selected=musicians.find((m)=>m.id===selectedId) ?? null;
  const filtered=useMemo(()=>musicians.filter((m)=>{
    const needle=query.toLowerCase();
    return (visibility==="all" || m.visibility===visibility) &&
      (!needle || [m.displayName,m.nameJp,m.nameEn,m.slug,...m.aliases].join(" ").toLowerCase().includes(needle));
  }),[musicians,query,visibility]);
  function choose(m:AdminMusician){setSelectedId(m.id);setForm(stateFrom(m));setStatus(`${musicians.length}名`);}
  function set<K extends keyof EditorState>(key:K,value:EditorState[K]){setForm((old)=>old?{...old,[key]:value}:old);}

  async function save(event:FormEvent){
    event.preventDefault(); if(!selected || !form) return;
    setSaving(true); setStatus("保存中…");
    try {
      const response=await fetch(`/api/admin/musicians/${selected.id}`,{
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...form,version:selected.version}),
      });
      const body=await response.json() as {ok?:boolean;musician?:AdminMusician;error?:string};
      if(!response.ok || !body.musician) throw new Error(body.error || "保存できませんでした。");
      await load(body.musician.id); setStatus("保存しました。");
    } catch(cause){setStatus(cause instanceof Error?cause.message:"保存できませんでした。");}
    finally{setSaving(false);}
  }

  return <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
    <aside className="flex flex-col gap-3">
      <div className="flex gap-2"><Input aria-label="検索" placeholder="名前・slugで検索" value={query} onChange={(e)=>setQuery(e.target.value)}/>
        <Button type="button" variant="outline" onClick={()=>void load()}>更新</Button></div>
      <Select aria-label="公開状態" value={visibility} onChange={(e)=>setVisibility(e.target.value as typeof visibility)}>
        <option value="all">すべて</option><option value="draft">draft</option><option value="public">public</option><option value="hidden">hidden</option>
      </Select>
      <p className="text-xs text-muted">{status} / 表示 {filtered.length}名</p>
      <div className="max-h-[65vh] overflow-y-auto rounded border border-line">
        {filtered.map((m)=><button key={m.id} type="button" onClick={()=>choose(m)} className={`block w-full border-b border-line px-3 py-2 text-left text-sm last:border-0 ${m.id===selectedId?"bg-accent-soft":"hover:bg-surface"}`}>
          <span className="block font-medium">{m.displayName || "(名称未設定)"}</span>
          <span className="block text-xs text-muted">{m.slug} · {m.visibility}{m.isLocked?" · locked":""}</span>
        </button>)}
      </div>
    </aside>
    {selected && form ? <form onSubmit={save} className="flex min-w-0 flex-col gap-5">
      <div><h3 className="font-semibold">{selected.displayName}</h3><p className="break-all text-xs text-muted">version {selected.version}</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="slug *"><Input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(e)=>set("slug",e.target.value.toLowerCase())}/></Field>
        <Field label="表示名 *"><Input required value={form.displayName} onChange={(e)=>set("displayName",e.target.value)}/></Field>
        <Field label="日本語名 *"><Input required value={form.nameJp} onChange={(e)=>set("nameJp",e.target.value)}/></Field>
        <Field label="英語名 *"><Input required value={form.nameEn} onChange={(e)=>set("nameEn",e.target.value)}/></Field>
        <Field label="正規名"><Input value={form.canonicalName} onChange={(e)=>set("canonicalName",e.target.value)}/></Field>
        <Field label="並び順名"><Input value={form.sortName} onChange={(e)=>set("sortName",e.target.value)}/></Field>
        <Field label="別名（カンマ区切り）"><Input value={form.aliases} onChange={(e)=>set("aliases",e.target.value)}/></Field>
      </div>
      <Field label="担当（カンマ区切り） *"><Textarea required rows={2} value={form.roles} onChange={(e)=>set("roles",e.target.value)}/></Field>
      <Field label="名鑑の活動区分"><Select value={form.directoryCategories.includes("musician") ? "musician" : "creator/staff"} onChange={(e)=>set("directoryCategories",[e.target.value as DirectoryCategory])}>
        <option value="musician">Musician（演奏・歌唱・作曲など）</option><option value="creator/staff">Creator / Staff（Musician以外）</option>
      </Select></Field>
      <p className="text-xs text-muted">兼業の方はMusicianを選び、具体的な活動は担当へ記入してください。外部コラボレーターは名鑑に公開せず、クレジットのゲスト追加を利用します。</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="主SNS URL"><Input type="url" value={form.primarySnsUrl} onChange={(e)=>set("primarySnsUrl",e.target.value)}/></Field>
        <Field label="Web URL"><Input type="url" value={form.websiteUrl} onChange={(e)=>set("websiteUrl",e.target.value)}/></Field>
        <Field label="アイコンURL"><Input type="url" value={form.iconImageUrl} onChange={(e)=>set("iconImageUrl",e.target.value)}/></Field>
        <Field label="VRChat名"><Input value={form.vrcName} onChange={(e)=>set("vrcName",e.target.value)}/></Field>
        <Field label="Discord名"><Input value={form.discordName} onChange={(e)=>set("discordName",e.target.value)}/></Field>
        <Field label="代表者DiscordユーザーID"><Input inputMode="numeric" pattern="[0-9]{17,20}" placeholder="空欄で紐付け解除" value={form.representativeDiscordUserId} onChange={(e)=>set("representativeDiscordUserId",e.target.value.trim())}/></Field>
      </div>
      <Field label="追加リンク（ラベル | URL、1行1件）"><Textarea rows={5} value={form.links} onChange={(e)=>set("links",e.target.value)}/></Field>
      <div className="flex flex-wrap items-center gap-4">
        <Field label="公開状態"><Select value={form.visibility} onChange={(e)=>set("visibility",e.target.value as MusicianVisibility)}><option value="draft">draft</option><option value="public">public</option><option value="hidden">hidden</option></Select></Field>
        <label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isVerified} onChange={(e)=>set("isVerified",e.target.checked)}/> verified</label>
        {selected.isLocked?<span className="mt-6 text-sm text-red-700">ロック中: {selected.lockedReason}</span>:null}
      </div>
      <div><Button type="submit" variant="solid" disabled={saving}>{saving?"保存中…":"変更を保存"}</Button></div>
    </form>:<p>対象を選択してください。</p>}
  </div>;
}

function Field({label,children}:{label:string;children:ReactNode}) { return <div className="flex flex-col gap-1.5"><Label>{label}</Label>{children}</div>; }
