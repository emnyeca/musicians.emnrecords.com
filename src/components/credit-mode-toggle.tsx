"use client";

import { cn } from "@/lib/utils/cn";

/**
 * Switch for credit-building mode. The directory looks like a plain
 * directory until this is turned on.
 */
export function CreditModeToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className="flex shrink-0 items-center gap-2"
    >
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          enabled ? "bg-accent-strong" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-all",
            enabled ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
      <span className={cn("text-xs", enabled ? "text-ink" : "text-muted")}>
        クレジット作成モード
      </span>
    </button>
  );
}
