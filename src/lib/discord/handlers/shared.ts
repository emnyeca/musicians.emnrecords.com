import type { DiscordConfig } from "../config";
import type { IntakeStore } from "../store";
import type { InteractionResponse } from "../types";

export type HandlerDeps = {
  store: IntakeStore;
  config: DiscordConfig;
  /** 限定監査チャンネルへの通知。失敗してもDB監査は失われない。 */
  notify: (content: string) => Promise<boolean>;
  /** deferred応答後の元メッセージ編集(interaction token使用、15分以内)。 */
  editOriginal: (
    interactionToken: string,
    body: Record<string, unknown>,
  ) => Promise<boolean>;
  /** 公開ページの再検証。route側でrevalidatePathへ接続する。 */
  revalidate: (slug: string) => void;
  now: () => Date;
};

export type HandlerResult = {
  response: InteractionResponse;
  /** 3秒以内の初回応答を返した後に実行する処理(15分以内のfollow-up)。 */
  after?: () => Promise<void>;
};

/** ephemeral previewとsessionの有効期間。interaction tokenの15分に合わせる。 */
export const SESSION_TTL_MS = 15 * 60 * 1000;

export const CONFIRM_ERROR_MESSAGES: Record<string, string> = {
  session_not_found:
    "このpreviewは見つかりませんでした。`/emn-profile edit` からやり直してください。",
  session_owner_mismatch: "このpreviewはあなたの操作ではありません。",
  session_already_consumed:
    "この変更はすでに反映済みか、キャンセルされています。",
  session_expired:
    "previewの有効期限が切れました。`/emn-profile edit` からやり直してください。",
  musician_locked: "このレコードはロック中のため反映できません。",
  version_conflict:
    "他の更新と競合しました。`/emn-profile edit` からやり直してください。",
  not_representative: "代表者としての登録を確認できませんでした。",
  musician_not_found: "対象レコードが見つかりませんでした。",
  db_error: "処理に失敗しました。時間をおいてやり直してください。",
};

export function confirmErrorMessage(errorCode: string): string {
  return CONFIRM_ERROR_MESSAGES[errorCode] ?? CONFIRM_ERROR_MESSAGES.db_error;
}

/**
 * 限定監査チャンネル向けの通知本文。
 * 秘密情報(トークン、鍵、session内容)と不要な個人情報を含めない。
 */
export function auditNotificationText(input: {
  action: string;
  slug: string | null;
  actorId: string;
  actorKind: "self" | "operator" | "system";
  result: "succeeded" | "rejected" | "failed";
  detail?: string;
}): string {
  const target = input.slug ? `\`${input.slug}\`` : "(対象不明)";
  const kind = input.actorKind === "operator" ? "運営者" : "本人";
  const status =
    input.result === "succeeded"
      ? "成功"
      : input.result === "rejected"
        ? "拒否"
        : "失敗";
  const lines = [
    `[${input.action}] ${target} — ${status}`,
    `実行者: ${kind} <@${input.actorId}>`,
  ];
  if (input.detail) lines.push(`詳細: ${input.detail}`);
  return lines.join("\n");
}
