"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import type { CreditSelection } from "@/types/musician";
import { IconImage } from "@/components/icon-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import {
  hasOverrides,
  resolveCreditPerson,
} from "@/lib/credits/selection";

/**
 * Per-person editor in the credit builder.
 *
 * Edits are TEMPORARY overrides for this credit output only — they are kept
 * in localStorage and never written back to the musicians table.
 */

type OverrideKey =
  | "overrideNameJp"
  | "overrideNameEn"
  | "overrideDisplayName"
  | "overrideRole"
  | "overrideLinkPrimary"
  | "overrideLinkSecondary"
  | "overrideIconImageUrl";

export function CreditSelectionEditor({
  selection,
  index,
  total,
  onMove,
  onRemove,
  onPatch,
  onReset,
}: {
  selection: CreditSelection;
  index: number;
  total: number;
  onMove: (musicianId: string, direction: -1 | 1) => void;
  onRemove: (musicianId: string) => void;
  onPatch: (musicianId: string, patch: Partial<CreditSelection>) => void;
  onReset: (musicianId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const edited = hasOverrides(selection);

  // Baseline = directory values resolved without any override.
  const baseline = useMemo(
    () =>
      resolveCreditPerson({
        musicianId: selection.musicianId,
        slug: selection.slug,
        sourceMusician: selection.sourceMusician,
        order: selection.order,
      }),
    [selection.musicianId, selection.slug, selection.sourceMusician, selection.order],
  );

  const fields: {
    key: OverrideKey;
    label: string;
    baseValue: string;
  }[] = [
    { key: "overrideNameJp", label: "名前（日） / name_jp", baseValue: baseline.nameJp },
    { key: "overrideNameEn", label: "名前（英） / name_en", baseValue: baseline.nameEn },
    { key: "overrideDisplayName", label: "表示名 / display_name", baseValue: baseline.displayName },
    { key: "overrideRole", label: "担当 / role", baseValue: baseline.role },
    { key: "overrideLinkPrimary", label: "リンク1 / link_primary", baseValue: baseline.linkPrimary },
    { key: "overrideLinkSecondary", label: "リンク2 / link_secondary", baseValue: baseline.linkSecondary },
    { key: "overrideIconImageUrl", label: "アイコンURL / icon_image_url", baseValue: baseline.iconImageUrl },
  ];

  const effective = resolveCreditPerson(selection);

  function handleFieldChange(key: OverrideKey, baseValue: string, value: string) {
    onPatch(selection.musicianId, {
      [key]: value === baseValue ? undefined : value,
    });
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-background",
        edited ? "border-accent" : "border-line",
      )}
    >
      <div className="flex items-center gap-3 p-3">
        <span className="w-5 text-center text-xs text-muted">{index + 1}</span>
        <IconImage
          src={effective.iconImageUrl === "" ? null : effective.iconImageUrl}
          name={effective.displayName}
          initialsSource={effective.nameEn}
          className="w-10 rounded-md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {effective.displayName}
            {edited ? (
              <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] text-accent-strong">
                一時編集あり
              </span>
            ) : null}
          </p>
          <p className="truncate text-xs text-muted">{effective.role}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => onMove(selection.musicianId, -1)}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            aria-label="Move down"
            disabled={index === total - 1}
            onClick={() => onMove(selection.musicianId, 1)}
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            aria-label="Edit"
            onClick={() => setOpen((v) => !v)}
          >
            <Pencil className={cn("size-4", open && "text-accent-strong")} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            aria-label="Remove"
            onClick={() => onRemove(selection.musicianId)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-line p-3">
          <p className="mb-3 text-[11px] leading-relaxed text-muted">
            ここでの編集は今回のクレジット出力だけに使われる一時的な値です。
            名鑑（ミュージシャンDB）は変更されません。
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((field) => {
              const overrideValue = selection[field.key];
              const value = overrideValue ?? field.baseValue;
              return (
                <div key={field.key} className="flex flex-col gap-1">
                  <Label htmlFor={`${selection.musicianId}-${field.key}`}>
                    {field.label}
                    {overrideValue !== undefined ? (
                      <span className="ml-1 text-accent-strong">*</span>
                    ) : null}
                  </Label>
                  <Input
                    id={`${selection.musicianId}-${field.key}`}
                    value={value}
                    onChange={(e) =>
                      handleFieldChange(field.key, field.baseValue, e.target.value)
                    }
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              disabled={!edited}
              onClick={() => onReset(selection.musicianId)}
            >
              Reset to directory data
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
