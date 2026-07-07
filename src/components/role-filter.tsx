"use client";

import { cn } from "@/lib/utils/cn";

export function RoleFilter({
  roles,
  active,
  onChange,
}: {
  roles: string[];
  active: string | null;
  onChange: (role: string | null) => void;
}) {
  if (roles.length === 0) return null;
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max items-center gap-1.5 pb-1">
        <FilterChip
          label="All"
          active={active === null}
          onClick={() => onChange(null)}
        />
        {roles.map((role) => (
          <FilterChip
            key={role}
            label={role}
            active={active === role}
            onClick={() => onChange(active === role ? null : role)}
          />
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-background text-muted hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
