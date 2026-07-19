import { authorizeInteraction, requireOperator } from "../authorize";
import { ephemeralMessage } from "../components";
import type { MutationSuccess, StoreError } from "../store";
import { resolveSubcommand, type Interaction } from "../types";
import {
  auditNotificationText,
  confirmErrorMessage,
  type HandlerDeps,
  type HandlerResult,
} from "./shared";

/**
 * 運営者専用: /emn-admin representative-set / profile-lock / profile-unlock /
 * profile-hide / profile-show / profile-restore / audit-list。
 * Discord側のcommand permissionは補助であり、operator roleをここで再確認する。
 */

const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  already_locked: "このレコードはすでにロックされています。",
  not_locked: "このレコードはロックされていません。",
  already_representative: "指定ユーザーはすでにこのレコードの代表者です。",
  visibility_unchanged: "公開状態はすでにその値です。",
  audit_log_not_found: "指定した監査ログが見つかりませんでした。",
  snapshot_not_restorable:
    "この監査ログはプロフィール全体のsnapshotを含まないため復旧に使えません。",
  invalid_state: "stateは before / after のどちらかにしてください。",
};

function adminErrorMessage(errorCode: string): string {
  return ADMIN_ERROR_MESSAGES[errorCode] ?? confirmErrorMessage(errorCode);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminAction =
  | "lock"
  | "unlock"
  | "restore"
  | "representative_set"
  | "visibility_change";

export async function handleAdminCommand(
  interaction: Interaction,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const authz = authorizeInteraction(interaction, deps.config);
  const subcommand = resolveSubcommand(interaction.data);
  if (!requireOperator(authz)) {
    // 権限外の運営操作の試行は可能な範囲で監査する。
    const actorId = interaction.member?.user?.id;
    if (actorId) {
      await deps.store.recordFailure({
        musicianId: null,
        actorDiscordUserId: actorId,
        actorKind: "operator",
        action: subcommandToAuditAction(subcommand.name) ?? "profile_update_failed",
        interactionId: interaction.id,
        result: "rejected",
        errorCode: "missing_operator_role",
      });
    }
    return {
      response: ephemeralMessage("この操作には運営者ロールが必要です。"),
    };
  }

  const options = subcommand.options;
  const musicianKey =
    typeof options.musician === "string" ? options.musician.trim() : "";

  switch (subcommand.name) {
    case "representative-set":
      return representativeSet(interaction, authz.userId, musicianKey, options, deps);
    case "profile-lock":
      return lockUnlock(interaction, authz.userId, musicianKey, options, true, deps);
    case "profile-unlock":
      return lockUnlock(interaction, authz.userId, musicianKey, options, false, deps);
    case "profile-hide":
      return setVisibility(interaction, authz.userId, musicianKey, "hidden", deps);
    case "profile-show":
      return setVisibility(interaction, authz.userId, musicianKey, "public", deps);
    case "profile-restore":
      return restore(interaction, authz.userId, musicianKey, options, deps);
    case "audit-list":
      return auditList(musicianKey, deps);
    default:
      return { response: ephemeralMessage("不明なサブコマンドです。") };
  }
}

function subcommandToAuditAction(name: string | null): AdminAction | null {
  switch (name) {
    case "representative-set":
      return "representative_set";
    case "profile-lock":
      return "lock";
    case "profile-unlock":
      return "unlock";
    case "profile-hide":
    case "profile-show":
      return "visibility_change";
    case "profile-restore":
      return "restore";
    default:
      return null;
  }
}

async function findMusician(musicianKey: string, deps: HandlerDeps) {
  if (!musicianKey) return null;
  return deps.store.findMusicianBySlugOrId(musicianKey);
}

async function reportResult(
  interaction: Interaction,
  operatorId: string,
  action: AdminAction,
  musicianId: string | null,
  result: MutationSuccess | StoreError,
  successMessage: (slug: string) => string,
  deps: HandlerDeps,
  detail?: string,
): Promise<HandlerResult> {
  if (!result.ok) {
    await deps.store.recordFailure({
      musicianId,
      actorDiscordUserId: operatorId,
      actorKind: "operator",
      action,
      interactionId: interaction.id,
      result: result.errorCode === "db_error" ? "failed" : "rejected",
      errorCode: result.errorCode,
    });
    return { response: ephemeralMessage(adminErrorMessage(result.errorCode)) };
  }
  return {
    response: ephemeralMessage(successMessage(result.slug)),
    after: async () => {
      await deps.notify(
        auditNotificationText({
          action,
          slug: result.slug,
          actorId: operatorId,
          actorKind: "operator",
          result: "succeeded",
          detail,
        }),
      );
      deps.revalidate(result.slug);
    },
  };
}

async function representativeSet(
  interaction: Interaction,
  operatorId: string,
  musicianKey: string,
  options: Record<string, string | number | boolean>,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const targetUserId = typeof options.user === "string" ? options.user : "";
  if (!targetUserId || !musicianKey) {
    return {
      response: ephemeralMessage("user と musician(slugまたはID)を指定してください。"),
    };
  }
  const musician = await findMusician(musicianKey, deps);
  if (!musician) {
    return { response: ephemeralMessage("対象レコードが見つかりませんでした。") };
  }
  const resolved = interaction.data?.resolved as
    | { users?: Record<string, { username?: string }> }
    | undefined;
  const usernameSnapshot = resolved?.users?.[targetUserId]?.username ?? null;
  const result = await deps.store.setRepresentative({
    musicianId: musician.id,
    discordUserId: targetUserId,
    discordUsernameSnapshot: usernameSnapshot,
    operatorDiscordUserId: operatorId,
    interactionId: interaction.id,
  });
  return reportResult(
    interaction,
    operatorId,
    "representative_set",
    musician.id,
    result,
    (slug) => `\`${slug}\` の代表者を <@${targetUserId}> に設定しました。`,
    deps,
    `新代表者: <@${targetUserId}>`,
  );
}

async function lockUnlock(
  interaction: Interaction,
  operatorId: string,
  musicianKey: string,
  options: Record<string, string | number | boolean>,
  locked: boolean,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const musician = await findMusician(musicianKey, deps);
  if (!musician) {
    return { response: ephemeralMessage("対象レコードが見つかりませんでした。") };
  }
  const reason =
    typeof options.reason === "string" && options.reason.trim()
      ? options.reason.trim().slice(0, 200)
      : locked
        ? "運営者によるロック"
        : null;
  const result = await deps.store.setLock({
    musicianId: musician.id,
    locked,
    reason,
    actorDiscordUserId: operatorId,
    actorKind: "operator",
    interactionId: interaction.id,
  });
  return reportResult(
    interaction,
    operatorId,
    locked ? "lock" : "unlock",
    musician.id,
    result,
    (slug) =>
      locked ? `\`${slug}\` をロックしました。` : `\`${slug}\` のロックを解除しました。`,
    deps,
  );
}

async function setVisibility(
  interaction: Interaction,
  operatorId: string,
  musicianKey: string,
  visibility: "public" | "hidden",
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const musician = await findMusician(musicianKey, deps);
  if (!musician) {
    return { response: ephemeralMessage("対象レコードが見つかりませんでした。") };
  }
  const result = await deps.store.setVisibility({
    musicianId: musician.id,
    visibility,
    operatorDiscordUserId: operatorId,
    interactionId: interaction.id,
  });
  return reportResult(
    interaction,
    operatorId,
    "visibility_change",
    musician.id,
    result,
    (slug) => `\`${slug}\` の公開状態を ${visibility} にしました。`,
    deps,
    `新しい公開状態: ${visibility}`,
  );
}

async function restore(
  interaction: Interaction,
  operatorId: string,
  musicianKey: string,
  options: Record<string, string | number | boolean>,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const auditLogId =
    typeof options.audit_log === "string" ? options.audit_log.trim() : "";
  if (!UUID_PATTERN.test(auditLogId)) {
    return {
      response: ephemeralMessage(
        "audit_log には `/emn-admin audit-list` で確認した監査ログIDを指定してください。",
      ),
    };
  }
  const state = options.state === "before" ? "before" : "after";
  const musician = await findMusician(musicianKey, deps);
  if (!musician) {
    return { response: ephemeralMessage("対象レコードが見つかりませんでした。") };
  }
  const result = await deps.store.restoreFromAudit({
    musicianId: musician.id,
    auditLogId,
    state,
    operatorDiscordUserId: operatorId,
    interactionId: interaction.id,
  });
  return reportResult(
    interaction,
    operatorId,
    "restore",
    musician.id,
    result,
    (slug) => `\`${slug}\` を監査ログの${state === "before" ? "変更前" : "変更後"}の状態へ復旧しました。`,
    deps,
    `復旧元監査ログ: ${auditLogId} (${state})`,
  );
}

async function auditList(
  musicianKey: string,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const musician = await findMusician(musicianKey, deps);
  if (!musician) {
    return { response: ephemeralMessage("対象レコードが見つかりませんでした。") };
  }
  const logs = await deps.store.listRecentAuditLogs(musician.id, 10);
  if (logs.length === 0) {
    return { response: ephemeralMessage("監査ログがまだありません。") };
  }
  const lines = logs.map(
    (log) =>
      `\`${log.id}\` ${log.createdAt} ${log.action} (${log.result})` +
      (log.changedFields.length > 0 ? ` [${log.changedFields.join(", ")}]` : ""),
  );
  return {
    response: ephemeralMessage(
      [`\`${musician.slug}\` の直近の監査ログ:`, ...lines].join("\n"),
    ),
  };
}
