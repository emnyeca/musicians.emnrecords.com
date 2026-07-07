"use client";

import Link from "next/link";
import type { Musician } from "@/types/musician";
import { IconImage } from "@/components/icon-image";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils/cn";
import { displayUrl } from "@/lib/utils/sns";

/**
 * Directory card. In normal mode it links to the musician detail page.
 * In credit mode the whole card becomes a selection toggle with a checkbox
 * (pink accent is limited to selection UI by design).
 */
export function MusicianCard({
  musician,
  creditMode,
  selected,
  onToggle,
}: {
  musician: Musician;
  creditMode: boolean;
  selected: boolean;
  onToggle: (musician: Musician) => void;
}) {
  const roleText = musician.roles.join(" / ");
  const primaryLink = musician.primarySnsUrl;

  const body = (
    <>
      <div className="relative">
        <IconImage
          src={musician.iconImageUrl}
          name={musician.displayName}
          initialsSource={musician.nameEn}
        />
        {creditMode ? (
          <span className="absolute right-2 top-2 rounded bg-white/90 p-1 shadow-sm">
            <Checkbox checked={selected} readOnly tabIndex={-1} />
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5 px-0.5 pt-2.5 text-left">
        <span className="truncate text-sm font-medium text-ink">
          {musician.displayName}
        </span>
        <span className="min-h-4 truncate text-xs text-muted">{roleText}</span>
        {primaryLink ? (
          creditMode ? (
            <span className="truncate text-[11px] text-muted/80">
              {displayUrl(primaryLink)}
            </span>
          ) : (
            <a
              href={primaryLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="truncate text-[11px] text-muted/80 hover:text-accent-strong hover:underline"
            >
              {displayUrl(primaryLink)}
            </a>
          )
        ) : (
          <span className="min-h-4" />
        )}
      </div>
    </>
  );

  const cardClass = cn(
    "block w-full rounded-xl border bg-background p-2.5 transition-colors",
    selected && creditMode
      ? "border-accent-strong bg-accent-soft"
      : "border-line hover:border-muted/40",
  );

  if (creditMode) {
    return (
      <button
        type="button"
        onClick={() => onToggle(musician)}
        aria-pressed={selected}
        className={cn(cardClass, "cursor-pointer text-left")}
      >
        {body}
      </button>
    );
  }

  return (
    <Link href={`/musicians/${musician.slug}`} className={cardClass}>
      {body}
    </Link>
  );
}
