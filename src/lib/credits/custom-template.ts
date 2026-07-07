import type { CreditCustomTemplate, CreditSelection } from "@/types/musician";
import { displayUrl } from "@/lib/utils/sns";
import {
  resolveCreditPerson,
  type ResolveOptions,
  type ResolvedCreditPerson,
} from "./selection";

/**
 * Custom Format rendering: SAFE STRING SUBSTITUTION ONLY.
 *
 * No eval, no Function constructor, no template-engine evaluation. Templates
 * are plain text where <placeholder> tokens are replaced with resolved values.
 * Unknown placeholders are left as-is and reported as warnings.
 */

export const allowedPlaceholders: ReadonlySet<string> = new Set([
  "name",
  "name_jp",
  "name_en",
  "display_name",
  "canonical_name",
  "role",
  "roles_csv",
  "instrument", // compatibility alias of <role>
  "link_primary",
  "link_secondary",
  "links_csv",
  "links_lines",
  "x_url",
  "youtube_url",
  "website_url",
  "profile_url",
  "image_url",
  "icon_image_url",
  "credit_html",
]);

const PLACEHOLDER_PATTERN = /<([a-zA-Z0-9_]+)>/g;

export type TemplateRenderOptions = ResolveOptions & {
  /** Strip "https://" from link placeholders for display (default true). */
  stripLinkProtocol?: boolean;
};

export function extractPlaceholders(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
    found.add(match[1]);
  }
  return [...found];
}

export function findUnknownPlaceholders(template: string): string[] {
  return extractPlaceholders(template).filter(
    (name) => !allowedPlaceholders.has(name),
  );
}

export function normalizeLinkForOutput(
  url: string,
  options: TemplateRenderOptions = {},
): string {
  if (url.trim() === "") return "";
  const strip = options.stripLinkProtocol ?? true;
  return strip ? displayUrl(url) : url.trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** HTML fragment for <credit_html>: the display name linked to link_primary. */
export function buildCreditHtml(person: ResolvedCreditPerson): string {
  const name = escapeHtml(person.displayName);
  if (person.linkPrimary.trim() === "") return name;
  return `<a href="${escapeHtml(person.linkPrimary)}">${name}</a>`;
}

export function resolveCreditField(
  selectionItem: CreditSelection,
  placeholder: string,
  options: TemplateRenderOptions = {},
): string {
  const person = resolveCreditPerson(selectionItem, options);
  return resolveFieldFromPerson(person, placeholder, options);
}

function resolveFieldFromPerson(
  person: ResolvedCreditPerson,
  placeholder: string,
  options: TemplateRenderOptions,
): string {
  switch (placeholder) {
    case "name":
    case "display_name":
      return person.displayName;
    case "name_jp":
      return person.nameJp;
    case "name_en":
      return person.nameEn;
    case "canonical_name":
      return person.canonicalName;
    case "role":
    case "instrument":
      return person.role;
    case "roles_csv":
      return person.roles.join(", ");
    case "link_primary":
      return normalizeLinkForOutput(person.linkPrimary, options);
    case "link_secondary":
      return normalizeLinkForOutput(person.linkSecondary, options);
    case "links_csv":
      return person.publicLinks
        .map((u) => normalizeLinkForOutput(u, options))
        .join(", ");
    case "links_lines":
      return person.publicLinks
        .map((u) => normalizeLinkForOutput(u, options))
        .join("\n");
    case "x_url":
      return normalizeLinkForOutput(person.xUrl, options);
    case "youtube_url":
      return normalizeLinkForOutput(person.youtubeUrl, options);
    case "website_url":
      return normalizeLinkForOutput(person.websiteUrl, options);
    case "profile_url":
      return person.profileUrl;
    case "image_url":
    case "icon_image_url":
      return person.iconImageUrl;
    case "credit_html":
      return buildCreditHtml(person);
    default:
      // Unknown placeholders are not substituted (reported separately).
      return "";
  }
}

export function renderPersonTemplate(
  selectionItem: CreditSelection,
  template: string,
  options: TemplateRenderOptions = {},
): string {
  const person = resolveCreditPerson(selectionItem, options);
  return template.replace(PLACEHOLDER_PATTERN, (whole, name: string) => {
    if (!allowedPlaceholders.has(name)) return whole;
    return resolveFieldFromPerson(person, name, options);
  });
}

export type CustomTemplateResult = {
  output: string;
  unknownPlaceholders: string[];
};

export function renderCustomCreditTemplate(
  selection: CreditSelection[],
  template: CreditCustomTemplate,
  options: TemplateRenderOptions = {},
): CustomTemplateResult {
  const ordered = [...selection].sort((a, b) => a.order - b.order);
  const bodies = ordered.map((item) =>
    renderPersonTemplate(item, template.personTemplate, options),
  );
  const parts: string[] = [];
  if (template.headerTemplate && template.headerTemplate.length > 0) {
    parts.push(template.headerTemplate);
  }
  parts.push(bodies.join(template.separator));
  if (template.footerTemplate && template.footerTemplate.length > 0) {
    parts.push(template.footerTemplate);
  }
  const unknownPlaceholders = [
    ...new Set(
      [
        template.headerTemplate ?? "",
        template.personTemplate,
        template.footerTemplate ?? "",
      ].flatMap(findUnknownPlaceholders),
    ),
  ];
  return { output: parts.join("\n"), unknownPlaceholders };
}
