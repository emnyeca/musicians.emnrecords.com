"use client";

import { useEffect, useMemo, useState } from "react";
import type { Musician } from "@/types/musician";
import { CreditModeToggle } from "@/components/credit-mode-toggle";
import { MusicianCard } from "@/components/musician-card";
import { MusicianSearch } from "@/components/musician-search";
import { RoleFilter } from "@/components/role-filter";
import { SelectedCreditBar } from "@/components/selected-credit-bar";
import { Select } from "./ui/select";
import { roleTags } from "@/lib/roles";
import { useCreditSelections } from "@/lib/credits/use-credit-selections";

/**
 * Credit mode is not remembered: the directory opens in browsing mode unless the
 * URL says ?mode=credit (Credit Builder's "名鑑から追加"). The toggle rewrites the
 * current history entry so reload and back keep the mode of that visit only.
 */
function initialCreditMode(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "credit";
}
function rememberCreditModeInUrl(on: boolean) {
  const url = new URL(window.location.href);
  if (on) url.searchParams.set("mode", "credit"); else url.searchParams.delete("mode");
  window.history.replaceState(window.history.state, "", url);
}

/**
 * The directory: search, role filter, credit mode and the card grid.
 * Cards are 2 columns on phones, up to 5 on wide screens.
 */
export function MusicianDirectory({ musicians }: { musicians: Musician[] }) {
  const [query, setQuery] = useState("");
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [category, setCategory] = useState("musician");
  // Rendered only after the client fetch, so reading the URL here cannot mismatch hydration.
  const [creditMode, setCreditModeState] = useState(initialCreditMode);
  const setCreditMode = (on: boolean) => { setCreditModeState(on); rememberCreditModeInUrl(on); };
  const { selections, isSelected, toggleMusician, clearSelections, refreshFromDirectory } =
    useCreditSelections();
  useEffect(() => { refreshFromDirectory(musicians); }, [musicians, refreshFromDirectory]);

  // Most-held tags first among the public profiles; ties alphabetical.
  // "All" stays first (RoleFilter) and "Other" always last.
  const allRoles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of musicians) for (const role of new Set(m.roleTags ?? roleTags(m.roles))) counts.set(role, (counts.get(role) ?? 0) + 1);
    return [...counts.keys()].sort((a, b) =>
      Number(a === "Other") - Number(b === "Other") || counts.get(b)! - counts.get(a)! || a.localeCompare(b));
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
