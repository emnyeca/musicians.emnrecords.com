import type { CreditCustomTemplate, CreditOutputFormat } from "@/types/musician";

export type CreditFormatOption = {
  value: CreditOutputFormat;
  label: string;
  fileExtension: string;
  description: string;
  group: "japanese" | "english" | "publishing" | "custom";
  template?: CreditCustomTemplate;
};

export const CREDIT_FORMAT_OPTIONS: CreditFormatOption[] = [
  {
    value: "custom", label: "Custom Format", group: "custom", fileExtension: "txt",
    description: "person templateを自由に指定",
  },
  {
    value: "emn_minimal",
    label: "EMN Minimal Credit",
    fileExtension: "txt",
    description: "公式プリセット: 名前（日）/ Role / Link",
    group: "japanese",
  },
  {
    value: "english_minimal", label: "名前（英）・主担当・リンク", group: "english", fileExtension: "txt",
    description: "英語名 / 主担当 / 主リンク",
    template: { name: "English minimal", personTemplate: "<name_en>\nRole: <role>\nLink: <link_primary>", separator: "\n\n" },
  },
  {
    value: "english_names", label: "名前（英）のみ", group: "english", fileExtension: "txt",
    description: "出演者名を1行ずつ",
    template: { name: "English names", personTemplate: "<name_en>", separator: "\n" },
  },
  {
    value: "english_roles", label: "名前（英）・すべての担当", group: "english", fileExtension: "txt",
    description: "英語名と担当一覧をコンパクトに",
    template: { name: "English roles", personTemplate: "<name_en> — <roles_csv>", separator: "\n" },
  },
  {
    value: "english_links", label: "名前（英）・担当・リンク2件", group: "english", fileExtension: "txt",
    description: "英語名 / 主担当 / 主リンク / 追加リンク",
    template: { name: "English links", personTemplate: "<name_en>\nRole: <role>\nLink: <link_primary>\nWebsite: <link_secondary>", separator: "\n\n" },
  },
  {
    value: "english_full", label: "名前（英）・すべての担当とリンク", group: "english", fileExtension: "txt",
    description: "英語名 / 担当一覧 / 公開リンク一覧 / 本人ページ",
    template: { name: "English full", personTemplate: "<name_en>\nRoles: <roles_csv>\nLinks: <links_lines>\nProfile: <profile_url>", separator: "\n\n" },
  },
  {
    value: "english_markdown", label: "Markdown — 名前（英）", group: "english", fileExtension: "md",
    description: "リスト形式のMarkdown",
  },
  {
    value: "english_discord", label: "Discord — 名前（英）", group: "english", fileExtension: "txt",
    description: "Discord向け（embed抑制リンク）",
  },
  {
    value: "english_html", label: "WordPress HTML — 名前（英）", group: "english", fileExtension: "html",
    description: "WordPress投稿に貼れるHTML",
  },
  {
    value: "japanese_names", label: "名前（日）のみ", group: "japanese", fileExtension: "txt",
    description: "出演者名を1行ずつ",
    template: { name: "Japanese names", personTemplate: "<name_jp>", separator: "\n" },
  },
  {
    value: "japanese_roles", label: "名前（日）・すべての担当", group: "japanese", fileExtension: "txt",
    description: "日本語名と担当一覧をコンパクトに",
    template: { name: "Japanese roles", personTemplate: "<name_jp> — <roles_csv>", separator: "\n" },
  },
  {
    value: "bilingual", label: "日英併記・担当・リンク", group: "japanese", fileExtension: "txt",
    description: "日本語名 / 英語名 / 主担当 / 主リンク",
    template: { name: "Bilingual", personTemplate: "<name_jp> / <name_en>\nRole: <role>\nLink: <link_primary>", separator: "\n\n" },
  },
  {
    value: "plain_text",
    label: "Plain Text",
    fileExtension: "txt",
    description: "シンプルなテキスト",
    group: "publishing",
  },
  {
    value: "markdown",
    label: "Markdown",
    fileExtension: "md",
    description: "リスト形式のMarkdown",
    group: "publishing",
  },
  {
    value: "wordpress_html",
    label: "WordPress HTML",
    fileExtension: "html",
    description: "WordPress投稿に貼れるHTML",
    group: "publishing",
  },
  {
    value: "discord",
    label: "Discord",
    fileExtension: "txt",
    description: "Discord向け（embed抑制リンク）",
    group: "publishing",
  },
  {
    value: "json",
    label: "JSON",
    fileExtension: "json",
    description: "構造化データ",
    group: "publishing",
  },
];

export const DEFAULT_CUSTOM_TEMPLATE: CreditCustomTemplate = {
  name: "My Custom Format",
  headerTemplate: "",
  personTemplate: "<name_jp>\nRole: <role>\nLink: <link_primary>",
  separator: "\n\n",
  footerTemplate: "",
};

export function fileExtensionFor(format: CreditOutputFormat): string {
  return (
    CREDIT_FORMAT_OPTIONS.find((o) => o.value === format)?.fileExtension ?? "txt"
  );
}
