"use client";
import { useTranslation } from "@/lib/i18n";

import { cn } from "@/lib/utils/cn";

/**
 * Tag chips. Tags toggle independently and combine with AND; "All" is exclusive and
 * clears them. Tags in `empty` would leave no profile, so they are muted but selectable.
 */
export function RoleFilter({
  roles,
  active,
  empty,
  onChange,
}: {
  roles: string[];
  active: string[];
  empty: Set<string>;
  onChange: (roles: string[]) => void;
}) {
  if (roles.length === 0) return null;
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max items-center gap-1.5 pb-1">
        <FilterChip
          label="All"
          active={active.length === 0}
          onClick={() => onChange([])}
        />
        {roles.map((role) => (
          <FilterChip
            key={role}
            label={role}
            active={active.includes(role)}
            empty={empty.has(role)}
            onClick={() => onChange(active.includes(role) ? active.filter((r) => r !== role) : [...active, role])}
          />
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  empty = false,
  onClick,
}: {
  label: string;
  active: boolean;
  empty?: boolean;
  onClick: () => void;
}) {
  const t = useTranslation();
  return (
    <button
      type="button"
      aria-pressed={active}
      title={empty ? t("該当するプロフィールがありません") : undefined}
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : empty
            ? "border-dashed border-line bg-surface text-muted/50 hover:text-muted"
            : "border-line bg-background text-muted hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
