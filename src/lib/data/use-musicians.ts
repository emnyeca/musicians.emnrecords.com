"use client";
import { useEffect, useState } from "react";
import type { Musician } from "@/types/musician";
export function useMusicians(slug?: string) {
  const [musicians, setMusicians] = useState<Musician[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/musicians${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("名鑑を読み込めませんでした。時間をおいて再度お試しください。");
        return response.json() as Promise<{ musicians: Musician[] }>;
      }).then((data) => setMusicians(data.musicians)).catch((cause) => {
        if (!controller.signal.aborted) setError(cause.message);
      });
    return () => controller.abort();
  }, [slug]);
  return { musicians, error };
}
