/**
 * ASCII slugify. Non-ASCII characters (e.g. Japanese) are dropped, so callers
 * should provide a romanized fallback when the result may become empty.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function slugifyWithFallback(input: string, fallback: string): string {
  const slug = slugify(input);
  return slug.length > 0 ? slug : slugify(fallback);
}
