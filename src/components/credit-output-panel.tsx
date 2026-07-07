"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import type {
  CreditCustomTemplate,
  CreditSelection,
} from "@/types/musician";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { CopyButton } from "@/components/copy-button";
import { CustomFormatEditor } from "@/components/custom-format-editor";
import { CREDIT_FORMAT_OPTIONS, fileExtensionFor } from "@/lib/credits/formats";
import { renderCredit } from "@/lib/credits/render-credit";
import { useCreditFormat } from "@/lib/credits/use-credit-selections";

/**
 * Live preview + copy/download for the generated credit text.
 */
export function CreditOutputPanel({
  selections,
  template,
  onTemplateChange,
}: {
  selections: CreditSelection[];
  template: CreditCustomTemplate;
  onTemplateChange: (patch: Partial<CreditCustomTemplate>) => void;
}) {
  const { format, setFormat } = useCreditFormat();

  const result = useMemo(
    () => renderCredit(format, selections, {}, template),
    [format, selections, template],
  );

  function downloadOutput() {
    const extension = fileExtensionFor(format);
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([result.output], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `emn-credits-${date}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeOption = CREDIT_FORMAT_OPTIONS.find((o) => o.value === format);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="credit-format"
          className="text-xs font-medium text-muted"
        >
          出力形式
        </label>
        <Select
          id="credit-format"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          {CREDIT_FORMAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {activeOption ? (
          <p className="text-[11px] text-muted">{activeOption.description}</p>
        ) : null}
      </div>

      {format === "custom" ? (
        <CustomFormatEditor template={template} onChange={onTemplateChange} />
      ) : null}

      {result.warnings.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          {result.warnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-700">
              ⚠ {warning}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted">Preview</p>
        <pre className="max-h-96 min-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface p-3 font-mono text-xs leading-relaxed text-ink">
          {result.output === "" ? " " : result.output}
        </pre>
      </div>

      <div className="flex flex-wrap gap-2">
        <CopyButton
          text={result.output}
          label="コピー"
          copiedLabel="コピーしました"
          variant="solid"
          disabled={selections.length === 0}
        />
        <Button
          variant="outline"
          onClick={downloadOutput}
          disabled={selections.length === 0}
        >
          <Download className="size-3.5" />
          ダウンロード
        </Button>
      </div>
    </div>
  );
}
