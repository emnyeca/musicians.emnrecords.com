"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Square icon image with initials fallback.
 *
 * Icon URLs are arbitrary external URLs (X profile icons, ConoHa/WordPress,
 * Supabase Storage, ...), so a plain <img> is used instead of next/image to
 * avoid remotePatterns maintenance. object-fit: cover keeps non-square
 * images inside a square frame; onError falls back to initials.
 */

export function IconImage({
  src,
  name,
  initialsSource,
  className,
}: {
  src: string | null;
  /** Used for alt text. */
  name: string;
  /** Name used to derive fallback initials (defaults to `name`). */
  initialsSource?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = src !== null && src.trim() !== "" && !failed;

  return (
    <div
      className={cn(
        "relative aspect-square w-full select-none overflow-hidden rounded-lg border border-line bg-surface",
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-medium tracking-wide text-muted">
            {initialsFrom(initialsSource ?? name)}
          </span>
        </div>
      )}
    </div>
  );
}

function initialsFrom(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") return "?";
  const ascii = trimmed.match(/[A-Za-z0-9]+/g)?.join("") ?? "";
  if (ascii.length >= 2) return ascii.slice(0, 2).toUpperCase();
  if (ascii.length === 1) return ascii.toUpperCase();
  return trimmed.slice(0, 1);
}
