"use client";
import { useTranslation } from "@/lib/i18n";
import { MusicianDirectory } from "./musician-grid";
import { useMusicians } from "@/lib/data/use-musicians";
export function LiveDirectory() {
  const t = useTranslation();
  const { musicians, error } = useMusicians();
  if (error) return <p role="alert" className="text-sm text-red-600">{t(error)}</p>;
  if (!musicians) return <p role="status" className="text-sm text-muted">{t("読み込み中…")}</p>;
  return <MusicianDirectory musicians={musicians} />;
}
export function MusicianCount() {
  const { musicians } = useMusicians();
  return musicians ? <p className="text-xs text-muted">{musicians.filter((m)=>(m.directoryCategories ?? ["musician"]).includes("musician")).length} musicians / {musicians.length} profiles</p> : null;
}
