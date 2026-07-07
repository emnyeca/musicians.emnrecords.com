"use client";

import Link from "next/link";
import { CreditOutputPanel } from "@/components/credit-output-panel";
import { CreditSelectionEditor } from "@/components/credit-selection-editor";
import { Button } from "@/components/ui/button";
import {
  useCreditSelections,
  useCustomTemplate,
} from "@/lib/credits/use-credit-selections";

/**
 * Credit builder screen: selected people (editable, orderable) on the left,
 * output preview on the right. All edits are temporary output values.
 */
export function CreditBuilderForm() {
  const {
    selections,
    loaded,
    move,
    removeMusician,
    patchSelection,
    resetOverrides,
    clearSelections,
  } = useCreditSelections();
  const { template, updateTemplate } = useCustomTemplate();

  if (!loaded) {
    return <p className="py-16 text-center text-sm text-muted">Loading…</p>;
  }

  if (selections.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-muted">
          まだ誰も選択されていません。名鑑でクレジット作成モードをONにして、
          出演者を選択してください。
        </p>
        <Link
          href="/musicians"
          className="inline-flex h-10 items-center rounded-md bg-ink px-5 text-sm font-medium text-white transition-opacity hover:opacity-85"
        >
          名鑑へ
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">
            選択中（{selections.length}名）
          </h2>
          <Button variant="ghost" size="sm" onClick={clearSelections}>
            すべてクリア
          </Button>
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
          ※ 編集内容はブラウザ内（localStorage）にのみ保存されます。
          名鑑のデータベースは変更されません。
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ink">出力</h2>
        <CreditOutputPanel
          selections={selections}
          template={template}
          onTemplateChange={updateTemplate}
        />
      </section>
    </div>
  );
}
