import type {
  CreditCustomTemplate,
  CreditOutputFormat,
  CreditSelection,
} from "@/types/musician";
import {
  normalizeLinkForOutput,
  renderCustomCreditTemplate,
  type TemplateRenderOptions,
} from "./custom-template";
import { resolveCreditPerson, type ResolvedCreditPerson } from "./selection";

/**
 * Fixed-preset credit rendering + dispatch for all output formats.
 * All formats are pure string generation from resolved selections.
 */

export type RenderCreditResult = {
  output: string;
  warnings: string[];
};

export function renderCredit(
  format: CreditOutputFormat,
  selections: CreditSelection[],
  options: TemplateRenderOptions = {},
  customTemplate?: CreditCustomTemplate,
): RenderCreditResult {
  const ordered = [...selections].sort((a, b) => a.order - b.order);
  const people = ordered.map((s) => resolveCreditPerson(s, options));

  switch (format) {
    case "emn_minimal":
      return { output: renderEmnMinimal(people, options), warnings: [] };
    case "plain_text":
      return { output: renderPlainText(people, options), warnings: [] };
    case "markdown":
      return { output: renderMarkdown(people, options), warnings: [] };
    case "wordpress_html":
      return { output: renderWordPressHtml(people, options), warnings: [] };
    case "discord":
      return { output: renderDiscord(people, options), warnings: [] };
    case "json":
      return { output: renderJson(people), warnings: [] };
    case "custom": {
      if (!customTemplate) {
        return { output: "", warnings: ["Custom template is not set."] };
      }
      const result = renderCustomCreditTemplate(ordered, customTemplate, options);
      return {
        output: result.output,
        warnings: result.unknownPlaceholders.map(
          (name) => `Unknown placeholder: <${name}>`,
        ),
      };
    }
  }
}

/**
 * EMN Minimal Credit (official preset):
 *   <name_jp>
 *   Role: <role>
 *   Link: <link_primary>
 * People separated by a blank line. Empty lines are omitted.
 */
function renderEmnMinimal(
  people: ResolvedCreditPerson[],
  options: TemplateRenderOptions,
): string {
  return people
    .map((p) => {
      const lines = [p.nameJp];
      if (p.role !== "") lines.push(`Role: ${p.role}`);
      const link = normalizeLinkForOutput(p.linkPrimary, options);
      if (link !== "") lines.push(`Link: ${link}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

function renderPlainText(
  people: ResolvedCreditPerson[],
  options: TemplateRenderOptions,
): string {
  return people
    .map((p) => {
      const name =
        p.nameEn !== "" && p.nameEn !== p.displayName
          ? `${p.displayName} (${p.nameEn})`
          : p.displayName;
      const lines = [p.role !== "" ? `${name} — ${p.role}` : name];
      const link = normalizeLinkForOutput(p.linkPrimary, options);
      if (link !== "") lines.push(link);
      return lines.join("\n");
    })
    .join("\n\n");
}

function renderMarkdown(
  people: ResolvedCreditPerson[],
  options: TemplateRenderOptions,
): string {
  return people
    .map((p) => {
      const role = p.role !== "" ? ` — ${p.role}` : "";
      const link =
        p.linkPrimary !== ""
          ? ` — [${normalizeLinkForOutput(p.linkPrimary, options)}](${p.linkPrimary})`
          : "";
      return `- **${p.displayName}**${role}${link}`;
    })
    .join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderWordPressHtml(
  people: ResolvedCreditPerson[],
  options: TemplateRenderOptions,
): string {
  const items = people
    .map((p) => {
      const lines = [`<strong>${escapeHtml(p.nameJp)}</strong>`];
      if (p.role !== "") lines.push(`Role: ${escapeHtml(p.role)}`);
      if (p.linkPrimary !== "") {
        const label = escapeHtml(normalizeLinkForOutput(p.linkPrimary, options));
        lines.push(
          `Link: <a href="${escapeHtml(p.linkPrimary)}" target="_blank" rel="noopener">${label}</a>`,
        );
      }
      return `  <p>${lines.join("<br />\n  ")}</p>`;
    })
    .join("\n");
  return `<div class="emn-credit">\n${items}\n</div>`;
}

function renderDiscord(
  people: ResolvedCreditPerson[],
  options: TemplateRenderOptions,
): string {
  return people
    .map((p) => {
      const lines = [
        p.role !== "" ? `**${p.nameJp}** — ${p.role}` : `**${p.nameJp}**`,
      ];
      if (p.linkPrimary !== "") {
        // <url> form keeps Discord from expanding link embeds.
        const full = options.stripLinkProtocol === false
          ? p.linkPrimary
          : p.linkPrimary.trim();
        lines.push(`<${full}>`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function renderJson(people: ResolvedCreditPerson[]): string {
  return JSON.stringify(
    people.map((p) => ({
      nameJp: p.nameJp,
      nameEn: p.nameEn,
      displayName: p.displayName,
      role: p.role,
      roles: p.roles,
      linkPrimary: p.linkPrimary,
      linkSecondary: p.linkSecondary,
      links: p.publicLinks,
      profileUrl: p.profileUrl,
      iconImageUrl: p.iconImageUrl,
    })),
    null,
    2,
  );
}
