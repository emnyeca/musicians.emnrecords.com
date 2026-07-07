"use client";

import Link from "next/link";
import { Check, Plus } from "lucide-react";
import type { Musician } from "@/types/musician";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { renderCredit } from "@/lib/credits/render-credit";
import { makeSelectionFromMusician } from "@/lib/credits/selection";
import { useCreditSelections } from "@/lib/credits/use-credit-selections";

/**
 * Detail page actions: add the musician to the credit selection and copy an
 * EMN Minimal Credit block for this single person.
 */
export function MusicianDetailActions({ musician }: { musician: Musician }) {
  const { isSelected, addMusician, loaded } = useCreditSelections();
  const selected = loaded && isSelected(musician.id);

  const creditInfo = renderCredit("emn_minimal", [
    makeSelectionFromMusician(musician, 0),
  ]).output;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selected ? (
        <Button variant="outline" size="sm" disabled>
          <Check className="size-3.5" />
          クレジットに追加済み
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => addMusician(musician)}
        >
          <Plus className="size-3.5" />
          この人をクレジットに追加
        </Button>
      )}
      <CopyButton
        text={creditInfo}
        label="クレジット用情報をコピー"
        copiedLabel="コピーしました"
        variant="outline"
        size="sm"
      />
      {selected ? (
        <Link
          href="/credit-builder"
          className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          クレジットビルダーを開く
        </Link>
      ) : null}
    </div>
  );
}
