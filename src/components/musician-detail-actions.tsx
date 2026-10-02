"use client";
import { useTranslation } from "@/lib/i18n";

import Link from "next/link";
import { Check, Plus } from "lucide-react";
import type { Musician } from "@/types/musician";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { useCreditSelections } from "@/lib/credits/use-credit-selections";
import { musicianProfileUrl } from "@/lib/utils/url";

/** Every public field as labelled lines; empty fields are omitted. */
function fullProfileText(m: Musician, t: (text: string) => string): string {
  const lines: [string, string][] = [
    ["表示名", m.displayName], ["日本語名", m.nameJp], ["英語名", m.nameEn],
    ["担当", m.roles.join(", ")], ["主SNS", m.primarySnsUrl ?? ""], ["Web", m.websiteUrl ?? ""],
    ["VRChat名", m.vrcName ?? ""], ["別名義", m.aliases.join(", ")],
    ["プロフィール", musicianProfileUrl(m.slug)], ["アイコン", m.iconImageUrl ?? ""],
  ];
  const text = lines.filter(([, value]) => value.trim() !== "").map(([label, value]) => `${t(label)}: ${value}`);
  const links = [...m.links].filter((l) => l.isPublic).sort((a, b) => a.displayOrder - b.displayOrder);
  if (links.length) text.push(t("リンク:"), ...links.map((l) => `- ${l.label ? `${l.label}: ` : ""}${l.url}`));
  return text.join("\n");
}

/**
 * Detail page actions: add the musician to the credit selection and copy all
 * public profile information for this person.
 */
export function MusicianDetailActions({ musician }: { musician: Musician }) {
  const t = useTranslation();
  const { isSelected, addMusician, loaded } = useCreditSelections();
  const selected = loaded && isSelected(musician.id);

  const creditInfo = fullProfileText(musician, t);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selected ? (
        <Button variant="outline" size="sm" disabled>
          <Check className="size-3.5" />
          {t("クレジットに追加済み")}</Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => addMusician(musician)}
        >
          <Plus className="size-3.5" />
          {t("この人をクレジットに追加")}</Button>
      )}
      <CopyButton
        text={creditInfo}
        label={t("クレジット用情報をコピー")}
        copiedLabel={t("コピーしました")}
        variant="outline"
        size="sm"
      />
      {selected ? (
        <Link
          href="/credit-builder"
          className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          {t("クレジットビルダーを開く")}</Link>
      ) : null}
    </div>
  );
}
