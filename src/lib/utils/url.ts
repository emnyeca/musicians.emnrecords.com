/**
 * Public app URL handling.
 * The production URL must never be hardcoded — it always comes from
 * NEXT_PUBLIC_APP_URL so the app can later move under emnrecords.com/musicians.
 */
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (url && url.length > 0) return url.replace(/\/+$/, "");
  return "http://localhost:3000";
}

export function musicianProfileUrl(slug: string, baseUrl?: string): string {
  const base = (baseUrl ?? getAppUrl()).replace(/\/+$/, "");
  return `${base}/musicians/${slug}`;
}
