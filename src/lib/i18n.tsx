"use client";

import { useEffect, useSyncExternalStore } from "react";
import messages from "./messages.en.json";

export type Language = "ja" | "en";
export type Translator = (text: string) => string;
const translations: Record<string, string> = messages;
const storageKey = "emn.language";
let language: Language | undefined;
const listeners = new Set<() => void>();

function readLanguage(): Language {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "ja" || saved === "en") return saved;
  } catch { /* Language switching also works without browser storage. */ }
  return navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const sync = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      language = readLanguage();
      listeners.forEach((notify) => notify());
    }
  };
  window.addEventListener("storage", sync);
  return () => { listeners.delete(listener); window.removeEventListener("storage", sync); };
}

const japanese: Translator = (text) => text;
const english: Translator = (text) => translations[text] ?? text;
const getSnapshot = () => language ??= readLanguage();
const getServerSnapshot = () => "ja" as Language;

function changeLanguage(next: Language) {
  language = next;
  try { localStorage.setItem(storageKey, next); } catch { /* Keep the in-memory preference. */ }
  listeners.forEach((notify) => notify());
}

export function useTranslation() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return locale === "en" ? english : japanese;
}

export function LanguageToggle() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return <div className="flex shrink-0 rounded-full border border-line p-0.5 text-xs" role="group" aria-label={locale === "ja" ? "表示言語" : "Display language"}>
    {(["ja", "en"] as const).map((value) => <button key={value} type="button" lang={value} aria-pressed={locale === value}
      className={`rounded-full px-2.5 py-1.5 ${locale === value ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
      onClick={() => changeLanguage(value)}>{value === "ja" ? "日本語" : "EN"}</button>)}
  </div>;
}

/** Static server-rendered page copy can subscribe without making the page a client component. */
export function TranslatedText({ text }: { text: string }) {
  const t = useTranslation();
  return t(text);
}
