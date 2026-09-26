"use client";
import { MusicianDirectory } from "./musician-grid";
import { useMusicians } from "@/lib/data/use-musicians";
export function LiveDirectory() {
  const { musicians, error } = useMusicians();
  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!musicians) return <p role="status" className="text-sm text-muted">読み込み中…</p>;
  return <MusicianDirectory musicians={musicians} />;
}
export function MusicianCount() {
  const { musicians } = useMusicians();
  return musicians ? <p className="text-xs text-muted">{musicians.length} musicians listed</p> : null;
}
