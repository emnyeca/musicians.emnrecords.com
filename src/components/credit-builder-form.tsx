"use client";
import { useTranslation } from "@/lib/i18n";

import { useEffect } from "react";
import Link from "next/link";
import { CreditOutputPanel } from "@/components/credit-output-panel";
import { CreditSelectionEditor } from "@/components/credit-selection-editor";
import { Button } from "@/components/ui/button";
import { CreditGuests } from "./credit-guests";
import {
  useCreditSelections,
  useCustomTemplate,
} from "@/lib/credits/use-credit-selections";
import { useMusicians } from "@/lib/data/use-musicians";

/**
 * Credit builder screen: selected people (editable, orderable) on the left,
 * output preview on the right. All edits are temporary output values.
 */
export function CreditBuilderForm() {
  const t = useTranslation();
  const {
    selections,
    loaded,
    move,
    removeMusician,
    patchSelection,
    resetOverrides,
    clearSelections,
    refreshFromDirectory,
  } = useCreditSelections();
  const { template, updateTemplate } = useCustomTemplate();
  const { musicians } = useMusicians();
  useEffect(() => { if (musicians) refreshFromDirectory(musicians); }, [musicians, refreshFromDirectory]);

  if (!loaded) {
    return <p className="py-16 text-center text-sm text-muted">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/musicians?mode=credit" className="text-sm underline">{t("名鑑から追加")}</Link>
      <CreditGuests />
      {selections.length === 0 && <p className="text-sm text-muted">{t("名鑑から選ぶか、ゲストを追加してクレジットを作成してください。")}</p>}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">
            {t("選択中（")}{selections.length}{t("名）")}</h2>
          <Button variant="ghost" size="sm" onClick={clearSelections}>
            {t("すべてクリア")}</Button>
        </div>
        <div className="flex flex-col gap-2">
          {selections.map((selection, index) => (
            <CreditSelectionEditor
              key={selection.musicianId}
              selection={selection}
              index={index}
              total={selections.length}
              onMove={move}
              onRemove={removeMusician}
              onPatch={patchSelection}
              onReset={resetOverrides}
            />
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-muted">
          {t("※ 編集内容はこのブラウザ内に保持されます。 名鑑のデータベースは変更されません。")}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ink">{t("出力")}</h2>
        <CreditOutputPanel
          selections={selections}
          template={template}
          onTemplateChange={updateTemplate}
        />
      </section>
      </div>
    </div>
  );
}
