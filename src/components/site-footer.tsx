"use client";
import { useTranslation } from "@/lib/i18n";

export function SiteFooter() {
  const t = useTranslation();
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-8 sm:px-6">
        <p className="text-xs tracking-wide text-muted">
          EMN Records — Musician Directory &amp; Credit Builder
        </p>
        <p className="text-[11px] text-muted/80">
          {t("© EMN Records. 掲載情報は本人と運営者が管理しています。")}</p>
      </div>
    </footer>
  );
}
