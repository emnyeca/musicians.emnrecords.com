import type { CreditCustomTemplate, CreditOutputFormat } from "@/types/musician";

export type CreditFormatOption = {
  value: CreditOutputFormat;
  label: string;
  fileExtension: string;
  description: string;
};

export const CREDIT_FORMAT_OPTIONS: CreditFormatOption[] = [
  {
    value: "emn_minimal",
    label: "EMN Minimal Credit",
    fileExtension: "txt",
    description: "公式プリセット: 名前（日）/ Role / Link",
  },
  {
    value: "custom",
    label: "Custom Format",
    fileExtension: "txt",
    description: "person templateを自由に指定",
  },
  {
    value: "plain_text",
    label: "Plain Text",
    fileExtension: "txt",
    description: "シンプルなテキスト",
  },
  {
    value: "markdown",
    label: "Markdown",
    fileExtension: "md",
    description: "リスト形式のMarkdown",
  },
  {
    value: "wordpress_html",
    label: "WordPress HTML",
    fileExtension: "html",
    description: "WordPress投稿に貼れるHTML",
  },
  {
    value: "discord",
    label: "Discord",
    fileExtension: "txt",
    description: "Discord向け（embed抑制リンク）",
  },
  {
    value: "json",
    label: "JSON",
    fileExtension: "json",
    description: "構造化データ",
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
