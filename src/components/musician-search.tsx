"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function MusicianSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted/70" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="名前・担当で検索"
        aria-label="Search musicians"
        className="pl-9"
      />
    </div>
  );
}
