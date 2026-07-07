"use client";

import type { CreditCustomTemplate } from "@/types/musician";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { allowedPlaceholders } from "@/lib/credits/custom-template";

/**
 * Custom Format editor. person_template is repeated per selected person and
 * joined with the separator. Substitution is plain string replacement —
 * placeholders like <name_jp> are the only dynamic part.
 */
export function CustomFormatEditor({
  template,
  onChange,
}: {
  template: CreditCustomTemplate;
  onChange: (patch: Partial<CreditCustomTemplate>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="custom-person-template">
          Person template（1人分の出力）
        </Label>
        <Textarea
          id="custom-person-template"
          rows={4}
          value={template.personTemplate}
          onChange={(e) => onChange({ personTemplate: e.target.value })}
          className="font-mono text-xs"
          placeholder={"<name_jp>(<name_en>)\nSNS Link: <link_primary>, <link_secondary>"}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="custom-separator">
            Separator（人と人の区切り、\n = 改行）
          </Label>
          <Input
            id="custom-separator"
            value={escapeSeparator(template.separator)}
            onChange={(e) =>
              onChange({ separator: unescapeSeparator(e.target.value) })
            }
            className="font-mono text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="custom-header">Header（先頭に1回）</Label>
          <Input
            id="custom-header"
            value={template.headerTemplate ?? ""}
            onChange={(e) => onChange({ headerTemplate: e.target.value })}
            className="font-mono text-xs"
            placeholder="Credit"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="custom-footer">Footer（末尾に1回）</Label>
        <Input
          id="custom-footer"
          value={template.footerTemplate ?? ""}
          onChange={(e) => onChange({ footerTemplate: e.target.value })}
          className="font-mono text-xs"
          placeholder="Presented by EMN Records"
        />
      </div>

      <details className="rounded-md border border-line bg-surface p-3">
        <summary className="cursor-pointer text-xs font-medium text-muted">
          使用できるプレースホルダー
        </summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[...allowedPlaceholders].map((name) => (
            <code
              key={name}
              className="rounded border border-line bg-background px-1.5 py-0.5 text-[11px] text-ink"
            >
              &lt;{name}&gt;
            </code>
          ))}
        </div>
      </details>
    </div>
  );
}

function escapeSeparator(value: string): string {
  return value.replaceAll("\n", "\\n");
}

function unescapeSeparator(value: string): string {
  return value.replaceAll("\\n", "\n");
}
