import type { MusicianEditState, SessionRecord } from "./store";
import type { LinkOp, ValidatedProfilePayload } from "./validation";
import {
  ButtonStyle,
  ComponentType,
  InteractionResponseType,
  MessageFlags,
  TextInputStyle,
  type InteractionResponse,
} from "./types";

/**
 * Modal・preview messageのビルダー。
 * Discord公式Component Referenceの制約:
 * - Modal titleは45文字以内、custom_idは1〜100文字。
 * - 1つのModalに置く入力componentは1〜5個。
 * - Text InputはLabel component内へ配置する。
 */

// custom_id scheme (すべて100文字以内):
//   pm:basic:new            コマンドから開く基本Modal
//   pm:basic:s:<sessionId>  previewの[修正する]から開く基本Modal
//   pm:opt:s:<sessionId>    任意項目Modal
//   pm:link:s:<sessionId>   追加リンクModal
//   pv:confirm:<sessionId>  [反映する]
//   pv:revise:<sessionId>   [修正する]
//   pv:opt:<sessionId>      [任意項目]
//   pv:link:<sessionId>     [リンク]
//   pv:cancel:<sessionId>   [キャンセル]
export const CustomIds = {
  basicModalNew: "pm:basic:new",
  basicModalRevise: (sessionId: string) => `pm:basic:s:${sessionId}`,
  optionalModal: (sessionId: string) => `pm:opt:s:${sessionId}`,
  linkModal: (sessionId: string) => `pm:link:s:${sessionId}`,
  confirmButton: (sessionId: string) => `pv:confirm:${sessionId}`,
  reviseButton: (sessionId: string) => `pv:revise:${sessionId}`,
  optionalButton: (sessionId: string) => `pv:opt:${sessionId}`,
  linkButton: (sessionId: string) => `pv:link:${sessionId}`,
  cancelButton: (sessionId: string) => `pv:cancel:${sessionId}`,
} as const;

export type ParsedCustomId =
  | { kind: "basic-modal-new" }
  | { kind: "basic-modal-revise"; sessionId: string }
  | { kind: "optional-modal"; sessionId: string }
  | { kind: "link-modal"; sessionId: string }
  | {
      kind: "preview-button";
      action: "confirm" | "revise" | "opt" | "link" | "cancel";
      sessionId: string;
    }
  | { kind: "unknown" };

export function parseCustomId(customId: string | undefined): ParsedCustomId {
  if (!customId) return { kind: "unknown" };
  if (customId === CustomIds.basicModalNew) return { kind: "basic-modal-new" };
  const modalMatch = customId.match(/^pm:(basic|opt|link):s:(.+)$/);
  if (modalMatch) {
    const [, form, sessionId] = modalMatch;
    if (form === "basic") return { kind: "basic-modal-revise", sessionId };
    if (form === "opt") return { kind: "optional-modal", sessionId };
    return { kind: "link-modal", sessionId };
  }
  const buttonMatch = customId.match(/^pv:(confirm|revise|opt|link|cancel):(.+)$/);
  if (buttonMatch) {
    const [, action, sessionId] = buttonMatch;
    return {
      kind: "preview-button",
      action: action as "confirm" | "revise" | "opt" | "link" | "cancel",
      sessionId,
    };
  }
  return { kind: "unknown" };
}

type TextInputSpec = {
  customId: string;
  label: string;
  description?: string;
  style?: number;
  required?: boolean;
  maxLength?: number;
  value?: string | null;
  placeholder?: string;
};

function labelledTextInput(spec: TextInputSpec) {
  return {
    type: ComponentType.Label,
    label: spec.label,
    description: spec.description,
    component: {
      type: ComponentType.TextInput,
      custom_id: spec.customId,
      style: spec.style ?? TextInputStyle.Short,
      required: spec.required ?? false,
      max_length: spec.maxLength ?? 80,
      value: spec.value || undefined,
      placeholder: spec.placeholder,
    },
  };
}

function modalResponse(
  customId: string,
  title: string,
  inputs: ReturnType<typeof labelledTextInput>[],
): InteractionResponse {
  if (inputs.length < 1 || inputs.length > 5) {
    throw new Error("a modal must contain 1-5 input components");
  }
  if (title.length > 45 || customId.length < 1 || customId.length > 100) {
    throw new Error("modal title/custom_id out of Discord limits");
  }
  return {
    type: InteractionResponseType.Modal,
    data: { custom_id: customId, title, components: inputs },
  };
}

/** sessionの検証済み値を現在のプロフィールへ重ねた「preview表示用の状態」。 */
export function mergedPreviewState(
  musician: MusicianEditState,
  payload: ValidatedProfilePayload,
): MusicianEditState {
  const fields = payload.fields as Record<string, unknown>;
  const text = (key: string, current: string | null): string | null => {
    if (!(key in fields)) return current;
    const value = String(fields[key] ?? "");
    return value === "" ? null : value;
  };
  const list = (key: string, current: string[]): string[] =>
    key in fields && Array.isArray(fields[key])
      ? (fields[key] as string[])
      : current;

  let links = musician.links.map((link) => ({ ...link }));
  for (const op of payload.link_ops) {
    links = links.filter((link) => link.url !== op.url);
    if (op.op === "upsert") {
      links.push({
        platform: op.platform ?? "other",
        label: op.label ?? null,
        url: op.url,
        displayOrder: op.display_order ?? 0,
      });
    }
  }
  links.sort((a, b) => a.displayOrder - b.displayOrder);

  return {
    ...musician,
    displayName: text("display_name", musician.displayName) ?? "",
    nameJp: text("name_jp", musician.nameJp) ?? "",
    nameEn: text("name_en", musician.nameEn) ?? "",
    roles: list("roles", musician.roles),
    aliases: list("aliases", musician.aliases),
    primarySnsUrl: text("primary_sns_url", musician.primarySnsUrl),
    websiteUrl: text("website_url", musician.websiteUrl),
    iconImageUrl: text("icon_image_url", musician.iconImageUrl),
    vrcName: text("vrc_name", musician.vrcName),
    links,
  };
}

export function buildBasicProfileModal(
  customId: string,
  state: MusicianEditState,
): InteractionResponse {
  return modalResponse(customId, "公開プロフィールの編集", [
    labelledTextInput({
      customId: "display_name",
      label: "表示名",
      required: true,
      value: state.displayName,
    }),
    labelledTextInput({
      customId: "name_jp",
      label: "日本語名",
      required: true,
      value: state.nameJp,
    }),
    labelledTextInput({
      customId: "name_en",
      label: "英語名",
      required: true,
      value: state.nameEn,
    }),
    labelledTextInput({
      customId: "roles",
      label: "担当(カンマ区切り)",
      description: "例: Vo, Gt, 作編曲",
      required: true,
      maxLength: 400,
      value: state.roles.join(", "),
    }),
    labelledTextInput({
      customId: "primary_sns_url",
      label: "主SNS URL(空欄で削除)",
      maxLength: 300,
      value: state.primarySnsUrl,
    }),
  ]);
}

export function buildOptionalFieldsModal(
  sessionId: string,
  state: MusicianEditState,
): InteractionResponse {
  return modalResponse(CustomIds.optionalModal(sessionId), "任意項目の編集", [
    labelledTextInput({
      customId: "website_url",
      label: "Web URL(空欄で削除)",
      maxLength: 300,
      value: state.websiteUrl,
    }),
    labelledTextInput({
      customId: "icon_image_url",
      label: "アイコン画像URL(空欄で削除)",
      maxLength: 300,
      value: state.iconImageUrl,
    }),
    labelledTextInput({
      customId: "vrc_name",
      label: "VRChat名(空欄で削除)",
      value: state.vrcName,
    }),
    labelledTextInput({
      customId: "aliases",
      label: "別名義(カンマ区切り)",
      maxLength: 400,
      value: state.aliases.join(", "),
    }),
  ]);
}

export function buildLinkModal(sessionId: string): InteractionResponse {
  return modalResponse(CustomIds.linkModal(sessionId), "公開リンクの追加・更新・削除", [
    labelledTextInput({
      customId: "url",
      label: "リンクURL",
      required: true,
      maxLength: 300,
      placeholder: "https://…",
    }),
    labelledTextInput({
      customId: "platform",
      label: "platform(空欄で自動判定)",
      description: "x / youtube / twitch / instagram / soundcloud / booth / website / other",
      maxLength: 20,
    }),
    labelledTextInput({
      customId: "label",
      label: "表示ラベル(任意)",
    }),
    labelledTextInput({
      customId: "display_order",
      label: "表示順(0〜999、任意)",
      maxLength: 3,
    }),
    labelledTextInput({
      customId: "delete",
      label: "このURLを削除する場合「削除」と入力",
      maxLength: 10,
    }),
  ]);
}

function formatPreviewLines(
  state: MusicianEditState,
  linkOps: LinkOp[],
): string {
  const value = (input: string | null) => (input ? input : "(未設定)");
  const lines = [
    "**更新previewを確認してください。反映されるまで正本DBは変更されません。**",
    `表示名: ${value(state.displayName)}`,
    `日本語名: ${value(state.nameJp)}`,
    `英語名: ${value(state.nameEn)}`,
    `担当: ${state.roles.length > 0 ? state.roles.join(", ") : "(未設定)"}`,
    `主SNS: ${value(state.primarySnsUrl)}`,
    `Web: ${value(state.websiteUrl)}`,
    `アイコンURL: ${value(state.iconImageUrl)}`,
    `VRChat名: ${value(state.vrcName)}`,
    `別名義: ${state.aliases.length > 0 ? state.aliases.join(", ") : "(未設定)"}`,
  ];
  if (state.links.length > 0) {
    lines.push(
      `公開リンク: ${state.links
        .map((link) => `${link.label ?? link.platform}: ${link.url}`)
        .join(" / ")}`,
    );
  } else {
    lines.push("公開リンク: (なし)");
  }
  if (linkOps.length > 0) {
    lines.push(
      `リンク変更: ${linkOps
        .map((op) => (op.op === "delete" ? `削除 ${op.url}` : `追加/更新 ${op.url}`))
        .join(" / ")}`,
    );
  }
  lines.push("[反映する]を押すと即時に公開名鑑へ反映されます。");
  return lines.join("\n");
}

export function buildPreviewMessageData(
  session: SessionRecord,
  musician: MusicianEditState,
): Record<string, unknown> {
  const merged = mergedPreviewState(musician, session.validatedPayload);
  return {
    content: formatPreviewLines(merged, session.validatedPayload.link_ops),
    flags: MessageFlags.Ephemeral,
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            style: ButtonStyle.Success,
            label: "反映する",
            custom_id: CustomIds.confirmButton(session.sessionId),
          },
          {
            type: ComponentType.Button,
            style: ButtonStyle.Primary,
            label: "修正する",
            custom_id: CustomIds.reviseButton(session.sessionId),
          },
          {
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            label: "任意項目",
            custom_id: CustomIds.optionalButton(session.sessionId),
          },
          {
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            label: "リンク",
            custom_id: CustomIds.linkButton(session.sessionId),
          },
          {
            type: ComponentType.Button,
            style: ButtonStyle.Danger,
            label: "キャンセル",
            custom_id: CustomIds.cancelButton(session.sessionId),
          },
        ],
      },
    ],
  };
}

export function ephemeralMessage(content: string): InteractionResponse {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: { content, flags: MessageFlags.Ephemeral },
  };
}

export function updateMessage(
  data: Record<string, unknown>,
): InteractionResponse {
  return { type: InteractionResponseType.UpdateMessage, data };
}

export function formatProfileView(state: MusicianEditState): string {
  const value = (input: string | null) => (input ? input : "(未設定)");
  const lines = [
    `**現在の登録内容** (version ${state.version}${state.isLocked ? " / ロック中" : ""})`,
    `表示名: ${value(state.displayName)}`,
    `日本語名: ${value(state.nameJp)}`,
    `英語名: ${value(state.nameEn)}`,
    `担当: ${state.roles.length > 0 ? state.roles.join(", ") : "(未設定)"}`,
    `主SNS: ${value(state.primarySnsUrl)}`,
    `Web: ${value(state.websiteUrl)}`,
    `アイコンURL: ${value(state.iconImageUrl)}`,
    `VRChat名: ${value(state.vrcName)}`,
    `別名義: ${state.aliases.length > 0 ? state.aliases.join(", ") : "(未設定)"}`,
    `公開状態: ${state.visibility}`,
  ];
  if (state.links.length > 0) {
    lines.push(
      `公開リンク: ${state.links
        .map((link) => `${link.label ?? link.platform}: ${link.url}`)
        .join(" / ")}`,
    );
  }
  return lines.join("\n");
}
