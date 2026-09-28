"use client";

import { useMemo, useState } from "react";
import type { Musician } from "@/types/musician";
import { CreditModeToggle } from "@/components/credit-mode-toggle";
import { MusicianCard } from "@/components/musician-card";
import { MusicianSearch } from "@/components/musician-search";
import { RoleFilter } from "@/components/role-filter";
import { SelectedCreditBar } from "@/components/selected-credit-bar";
import { Select } from "./ui/select";
import { roleTags } from "@/lib/roles";
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
  const [category, setCategory] = useState("musician");
  const { creditMode, setCreditMode } = useCreditMode();
  const { selections, isSelected, toggleMusician, clearSelections } =
    useCreditSelections();

  const allRoles = useMemo(() => {
    const set = new Set<string>();
    for (const m of musicians) for (const role of (m.roleTags ?? roleTags(m.roles))) set.add(role);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [musicians]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return musicians.filter((m) => {
      const musician = (m.directoryCategories ?? ["musician"]).includes("musician");
      // Search spans the directory; the initial browsing view focuses on musicians.
      if (!q && !creditMode && category !== "all" && (category === "musician") !== musician) return false;
      if (activeRole !== null && !(m.roleTags ?? roleTags(m.roles)).includes(activeRole)) return false;
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
  }, [musicians, query, activeRole, category, creditMode]);

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
        {!creditMode && !query.trim() ? <Select aria-label="名鑑の活動区分" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="musician">Musician</option><option value="creator/staff">Creator / Staff</option><option value="all">すべて</option>
        </Select> : <p className="text-xs text-muted">Musician・Creator / Staffすべてから検索・選択できます。</p>}
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          該当する人が見つかりませんでした。
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
