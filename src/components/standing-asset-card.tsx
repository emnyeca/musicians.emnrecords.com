"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import type { StandingAsset } from "@/types/musician";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils/cn";
import { formatFileSize } from "@/lib/utils/file";

/**
 * One standing asset on the member download page.
 * The download button stays disabled until the usage terms are confirmed.
 */
export function StandingAssetCard({ asset }: { asset: StandingAsset }) {
  const [agreed, setAgreed] = useState(false);

  const permissions: { label: string; allowed: boolean }[] = [
    { label: "クレジット使用", allowed: asset.allowCreditUse },
    { label: "サムネイル使用", allowed: asset.allowThumbnailUse },
    { label: "トリミング", allowed: asset.allowCropping },
    { label: "色調整", allowed: asset.allowColorAdjustment },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-ink">{asset.title}</h3>
          {asset.description ? (
            <p className="mt-0.5 text-xs text-muted">{asset.description}</p>
          ) : null}
        </div>
        <Badge
          className={cn(
            asset.visibility === "members_only" &&
              "border-accent bg-accent-soft text-accent-strong",
          )}
        >
          {asset.visibility === "members_only" ? "Members only" : "Public"}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <span>{asset.mimeType ?? "unknown type"}</span>
        <span>{formatFileSize(asset.fileSizeBytes)}</span>
        {asset.requireCredit ? (
          <span className="text-accent-strong">クレジット表記必須</span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {permissions.map((p) => (
          <span
            key={p.label}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px]",
              p.allowed
                ? "border-line bg-surface text-ink"
                : "border-line bg-background text-muted/60 line-through",
            )}
          >
            {p.label}
          </span>
        ))}
      </div>

      {asset.usageTerms ? (
        <div className="rounded-md border border-line bg-surface p-3">
          <p className="text-[11px] font-medium text-muted">利用条件</p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink">
            {asset.usageTerms}
          </p>
        </div>
      ) : null}

      {asset.requireCredit && asset.creditText ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
          <p className="min-w-0 truncate font-mono text-[11px] text-ink">
            {asset.creditText}
          </p>
          <CopyButton
            text={asset.creditText}
            label="コピー"
            copiedLabel="OK"
            variant="ghost"
            size="sm"
          />
        </div>
      ) : null}

      {asset.accessNote ? (
        <p className="text-[11px] text-muted">{asset.accessNote}</p>
      ) : null}

      {asset.visibility === "members_only" ? (
        <p className="text-[11px] text-accent-strong">
          For EMN Records verified Discord members only.
          このページのURLとファイルは外部に共有しないでください。
        </p>
      ) : null}

      <label className="flex cursor-pointer items-start gap-2">
        <Checkbox
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-xs leading-relaxed text-ink">
          I have read and agree to the usage terms.
          （利用条件を読み、同意しました）
        </span>
      </label>

      {agreed ? (
        <a
          href={`/api/standing-asset-download?id=${encodeURIComponent(asset.id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-md bg-ink px-4 text-xs font-medium text-white transition-opacity hover:opacity-85"
        >
          <Download className="size-3.5" />
          Download
        </a>
      ) : (
        <span className="inline-flex h-9 w-fit cursor-not-allowed items-center gap-1.5 rounded-md bg-ink/40 px-4 text-xs font-medium text-white">
          <Download className="size-3.5" />
          Download
        </span>
      )}
    </div>
  );
}
