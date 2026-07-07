"use client";

import { useMemo, useState } from "react";
import type { Musician } from "@/types/musician";
import { CreditModeToggle } from "@/components/credit-mode-toggle";
import { MusicianCard } from "@/components/musician-card";
import { MusicianSearch } from "@/components/musician-search";
import { RoleFilter } from "@/components/role-filter";
import { SelectedCreditBar } from "@/components/selected-credit-bar";
import {
  useCreditMode,
  useCreditSelections,
} from "@/lib/credits/use-credit-selections";

/**
 * The directory: search, role filter, credit mode and the card grid.
 * Cards are 2 columns on phones, up to 5 on wide screens.
 */
export function MusicianDirectory({ musicians }: { musicians: Musician[] }) {
  const [query, setQuery] = useState("");
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const { creditMode, setCreditMode } = useCreditMode();
  const { selections, isSelected, toggleMusician, clearSelections } =
    useCreditSelections();

  const allRoles = useMemo(() => {
    const set = new Set<string>();
    for (const m of musicians) for (const role of m.roles) set.add(role);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [musicians]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return musicians.filter((m) => {
      if (activeRole !== null && !m.roles.includes(activeRole)) return false;
      if (q === "") return true;
      const haystack = [
        m.displayName,
        m.nameJp,
        m.nameEn,
        m.vrcName ?? "",
        ...m.aliases,
        ...m.roles,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [musicians, query, activeRole]);

  const showBar = creditMode && selections.length > 0;

  return (
    <div className={showBar ? "pb-24" : undefined}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <MusicianSearch value={query} onChange={setQuery} />
          <CreditModeToggle enabled={creditMode} onChange={setCreditMode} />
        </div>
        <RoleFilter
          roles={allRoles}
          active={activeRole}
          onChange={setActiveRole}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          No musicians found.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((musician) => (
            <MusicianCard
              key={musician.id}
              musician={musician}
              creditMode={creditMode}
              selected={isSelected(musician.id)}
              onToggle={toggleMusician}
            />
          ))}
        </div>
      )}

      {creditMode ? (
        <SelectedCreditBar selections={selections} onClear={clearSelections} />
      ) : null}
    </div>
  );
}
