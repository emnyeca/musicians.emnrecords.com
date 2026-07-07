"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { CreditSelection } from "@/types/musician";
import { IconImage } from "@/components/icon-image";

/**
 * Fixed bottom bar shown while credit mode is on and people are selected.
 * Kept compact so it never dominates a 390px-wide screen.
 */
export function SelectedCreditBar({
  selections,
  onClear,
}: {
  selections: CreditSelection[];
  onClear: () => void;
}) {
  if (selections.length === 0) return null;
  const shown = selections.slice(0, 6);
  const overflow = selections.length - shown.length;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-accent bg-accent-soft/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex -space-x-2">
            {shown.map((s) => (
              <IconImage
                key={s.musicianId}
                src={
                  s.overrideIconImageUrl ?? s.sourceMusician.iconImageUrl
                }
                name={s.sourceMusician.displayName}
                initialsSource={s.sourceMusician.nameEn}
                className="w-8 rounded-full border-2 border-white"
              />
            ))}
          </div>
          <span className="truncate text-xs text-ink">
            {overflow > 0 ? `+${overflow} ` : ""}
            {selections.length}名を選択中
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-muted hover:text-ink"
        >
          <X className="size-3.5" />
          クリア
        </button>
        <Link
          href="/credit-builder"
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-accent-strong px-4 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          クレジットを作成
        </Link>
      </div>
    </div>
  );
}
