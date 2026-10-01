"use client";
import { LanguageToggle, useTranslation } from "@/lib/i18n";

import Link from "next/link";

export function SiteHeader() {
  const t = useTranslation();
  return (
    <header className="border-b border-line bg-background">
      <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-[0.18em] text-ink">
            EMN RECORDS
          </span>
          <span className="hidden text-xs tracking-wide text-muted sm:inline">
            Musician Directory
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm sm:gap-5">
          <Link href="/credit-builder" className="text-muted transition-colors hover:text-ink">{t("クレジット作成")}</Link>
          <Link href="/musicians" className="text-muted transition-colors hover:text-ink">
            Musicians
          </Link>
          <LanguageToggle />
        </nav>
      </div>
    </header>
  );
}
