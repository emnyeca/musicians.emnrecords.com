export type SnsPlatform =
  | "x"
  | "youtube"
  | "twitch"
  | "instagram"
  | "soundcloud"
  | "booth"
  | "website"
  | "other";

export function detectPlatform(url: string): SnsPlatform {
  let host = "";
  try {
    host = new URL(normalizeUrlInput(url)).hostname.toLowerCase();
  } catch {
    return "other";
  }
  if (host === "x.com" || host === "twitter.com" || host.endsWith(".x.com")) {
    return "x";
  }
  if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
  if (host.includes("twitch.tv")) return "twitch";
  if (host.includes("instagram.com")) return "instagram";
  if (host.includes("soundcloud.com")) return "soundcloud";
  if (host.includes("booth.pm")) return "booth";
  return "website";
}

/** Adds https:// when the scheme is missing so URL parsing works. */
export function normalizeUrlInput(url: string): string {
  const trimmed = url.trim();
  if (trimmed === "") return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Display form: strips protocol and trailing slash (e.g. "x.com/emnyeca"). */
export function displayUrl(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}
