import {
  authorizeInteraction,
  requireMember,
  type AuthorizedActor,
} from "../authorize";
import {
  buildBasicProfileModal,
  buildLinkModal,
  buildOptionalFieldsModal,
  buildPreviewMessageData,
  CustomIds,
  ephemeralMessage,
  formatProfileView,
  mergedPreviewState,
  parseCustomId,
  updateMessage,
} from "../components";
import type { MusicianEditState, SessionRecord } from "../store";
import {
  collectTextInputValues,
  InteractionResponseType,
  MessageFlags,
  resolveSubcommand,
  type Interaction,
} from "../types";
import {
  mergeValidatedPayloads,
  validateBasicProfileInputs,
  validateLinkInputs,
  validateOptionalProfileInputs,
  type ValidationResult,
} from "../validation";
import {
  auditNotificationText,
  confirmErrorMessage,
  SESSION_TTL_MS,
  type HandlerDeps,
  type HandlerResult,
} from "./shared";

/**
 * 本人プロフィール受付: /emn-profile command、Modal submit、preview button。
 *
 * Modal submitでは正本DBを更新せず短命sessionだけを作る。
 * 更新はpreviewの[反映する]でのみ、DB側の確定transactionを通して行う。
 */

function isSessionExpired(session: SessionRecord, now: Date): boolean {
  return new Date(session.expiresAt).getTime() <= now.getTime();
}

async function requireOwnMusician(
  authz: AuthorizedActor,
  deps: HandlerDeps,
): Promise<
  | { ok: true; musician: MusicianEditState }
  | { ok: false; response: HandlerResult }
> {
  const representative = await deps.store.findActiveRepresentative(
    authz.userId,
  );
  if (!representative) {
    return {
      ok: false,
      response: {
        response: ephemeralMessage(
          "あなたに紐づいたミュージシャンレコードがありません。運営者に代表者登録を依頼してください。",
        ),
      },
    };
  }
  const musician = await deps.store.getMusician(representative.musicianId);
  if (!musician) {
    return {
      ok: false,
      response: {
        response: ephemeralMessage("対象レコードが見つかりませんでした。"),
      },
    };
  }
  return { ok: true, musician };
}

export async function handleProfileCommand(
  interaction: Interaction,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const authz = authorizeInteraction(interaction, deps.config);
  if (!requireMember(authz)) {
    return {
      response: ephemeralMessage(
        authz.ok ? "この操作に必要なロールがありません。" : authz.message,
      ),
    };
  }
  const subcommand = resolveSubcommand(interaction.data);
  switch (subcommand.name) {
    case "edit":
      return startProfileEdit(authz, deps);
    case "view":
      return viewProfile(authz, deps);
    case "lock":
      return lockOwnProfile(interaction, authz, subcommand.options, deps);
    default:
      return { response: ephemeralMessage("不明なサブコマンドです。") };
  }
}

async function startProfileEdit(
  authz: AuthorizedActor,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const target = await requireOwnMusician(authz, deps);
  if (!target.ok) return target.response;
  if (target.musician.isLocked) {
    return {
      response: ephemeralMessage(
        "このレコードはロック中のため編集を開始できません。運営者に連絡してください。",
      ),
    };
  }
  return {
    response: buildBasicProfileModal(CustomIds.basicModalNew, target.musician),
  };
}

async function viewProfile(
  authz: AuthorizedActor,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const target = await requireOwnMusician(authz, deps);
  if (!target.ok) return target.response;
  return { response: ephemeralMessage(formatProfileView(target.musician)) };
}

async function lockOwnProfile(
  interaction: Interaction,
  authz: AuthorizedActor,
  options: Record<string, string | number | boolean>,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const target = await requireOwnMusician(authz, deps);
  if (!target.ok) return target.response;
  const reason =
    typeof options.reason === "string" && options.reason.trim()
      ? options.reason.trim().slice(0, 200)
      : "本人によるロック申請";
  const result = await deps.store.setLock({
    musicianId: target.musician.id,
    locked: true,
    reason,
    actorDiscordUserId: authz.userId,
    actorKind: "self",
    interactionId: interaction.id,
  });
  if (!result.ok) {
    if (result.errorCode === "already_locked") {
      return {
        response: ephemeralMessage("このレコードはすでにロックされています。"),
      };
    }
    await deps.store.recordFailure({
      musicianId: target.musician.id,
      actorDiscordUserId: authz.userId,
      actorKind: "self",
      action: "lock",
      interactionId: interaction.id,
      result: "failed",
      errorCode: result.errorCode,
    });
    return { response: ephemeralMessage(confirmErrorMessage(result.errorCode)) };
  }
  return {
    response: ephemeralMessage(
      "レコードをロックしました。解除は運営者のみ行えます。",
    ),
    after: async () => {
      await deps.notify(
        auditNotificationText({
          action: "lock",
          slug: result.slug,
          actorId: authz.userId,
          actorKind: "self",
          result: "succeeded",
        }),
      );
    },
  };
}

export async function handleProfileModalSubmit(
  interaction: Interaction,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const authz = authorizeInteraction(interaction, deps.config);
  if (!requireMember(authz)) {
    return {
      response: ephemeralMessage(
        authz.ok ? "この操作に必要なロールがありません。" : authz.message,
      ),
    };
  }
  const parsed = parseCustomId(interaction.data?.custom_id);
  const inputs = collectTextInputValues(interaction.data?.components);

  if (parsed.kind === "basic-modal-new") {
    return submitNewBasicProfile(interaction, authz, inputs, deps);
  }
  if (
    parsed.kind === "basic-modal-revise" ||
    parsed.kind === "optional-modal" ||
    parsed.kind === "link-modal"
  ) {
    return submitSessionRevision(
      interaction,
      authz,
      parsed.kind,
      parsed.sessionId,
      inputs,
      deps,
    );
  }
  return { response: ephemeralMessage("不明なフォームです。") };
}

async function rejectSubmission(
  interaction: Interaction,
  authz: AuthorizedActor,
  musicianId: string | null,
  validation: Extract<ValidationResult, { ok: false }>,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  await deps.store.recordFailure({
    musicianId,
    actorDiscordUserId: authz.userId,
    actorKind: "self",
    action: "profile_update_failed",
    interactionId: interaction.id,
    result: "rejected",
    errorCode: validation.errorCode,
  });
  return { response: ephemeralMessage(validation.message) };
}

async function submitNewBasicProfile(
  interaction: Interaction,
  authz: AuthorizedActor,
  inputs: Record<string, string>,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  // Modal表示後に状況が変わっている可能性があるため、submit時にも再認可する。
  const target = await requireOwnMusician(authz, deps);
  if (!target.ok) return target.response;
  if (target.musician.isLocked) {
    await deps.store.recordFailure({
      musicianId: target.musician.id,
      actorDiscordUserId: authz.userId,
      actorKind: "self",
      action: "profile_update_failed",
      interactionId: interaction.id,
      result: "rejected",
      errorCode: "musician_locked",
    });
    return {
      response: ephemeralMessage("このレコードはロック中のため受け付けられません。"),
    };
  }

  const validation = validateBasicProfileInputs(inputs);
  if (!validation.ok) {
    return rejectSubmission(
      interaction,
      authz,
      target.musician.id,
      validation,
      deps,
    );
  }

  const session = await deps.store.createSession({
    discordInteractionId: interaction.id,
    discordUserId: authz.userId,
    musicianId: target.musician.id,
    baseVersion: target.musician.version,
    submittedPayload: inputs,
    validatedPayload: validation.payload,
    expiresAt: new Date(deps.now().getTime() + SESSION_TTL_MS).toISOString(),
  });
  if ("errorCode" in session) {
    if (session.errorCode === "duplicate_interaction") {
      return {
        response: ephemeralMessage("この操作はすでに処理されています。"),
      };
    }
    return { response: ephemeralMessage(confirmErrorMessage(session.errorCode)) };
  }

  return {
    response: {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: buildPreviewMessageData(session, target.musician),
    },
  };
}

async function submitSessionRevision(
  interaction: Interaction,
  authz: AuthorizedActor,
  kind: "basic-modal-revise" | "optional-modal" | "link-modal",
  sessionId: string,
  inputs: Record<string, string>,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const session = await deps.store.getSession(sessionId);
  if (!session || session.discordUserId !== authz.userId) {
    return {
      response: ephemeralMessage(confirmErrorMessage("session_not_found")),
    };
  }
  if (session.consumedAt) {
    return {
      response: ephemeralMessage(confirmErrorMessage("session_already_consumed")),
    };
  }
  if (isSessionExpired(session, deps.now())) {
    return { response: ephemeralMessage(confirmErrorMessage("session_expired")) };
  }
  const musician = await deps.store.getMusician(session.musicianId);
  if (!musician) {
    return { response: ephemeralMessage(confirmErrorMessage("musician_not_found")) };
  }
  if (musician.isLocked) {
    return { response: ephemeralMessage(confirmErrorMessage("musician_locked")) };
  }
  if (musician.version !== session.baseVersion) {
    await deps.store.cancelSession(session.sessionId);
    return { response: ephemeralMessage(confirmErrorMessage("version_conflict")) };
  }

  const validation =
    kind === "basic-modal-revise"
      ? validateBasicProfileInputs(inputs)
      : kind === "optional-modal"
        ? validateOptionalProfileInputs(inputs)
        : validateLinkInputs(inputs);
  if (!validation.ok) {
    // sessionは生かしたまま、エラーだけをephemeralで返す。
    return rejectSubmission(interaction, authz, musician.id, validation, deps);
  }

  const merged = mergeValidatedPayloads(
    session.validatedPayload,
    validation.payload,
  );
  const newSession = await deps.store.createSession({
    discordInteractionId: interaction.id,
    discordUserId: authz.userId,
    musicianId: session.musicianId,
    baseVersion: session.baseVersion,
    submittedPayload: inputs,
    validatedPayload: merged,
    expiresAt: new Date(deps.now().getTime() + SESSION_TTL_MS).toISOString(),
  });
  if ("errorCode" in newSession) {
    if (newSession.errorCode === "duplicate_interaction") {
      return {
        response: ephemeralMessage("この操作はすでに処理されています。"),
      };
    }
    return {
      response: ephemeralMessage(confirmErrorMessage(newSession.errorCode)),
    };
  }
  await deps.store.cancelSession(session.sessionId);

  // このModalはbutton interactionへの応答として開いたため、
  // preview messageをUPDATE_MESSAGEで差し替えられる。
  return {
    response: updateMessage(buildPreviewMessageData(newSession, musician)),
  };
}

export async function handlePreviewButton(
  interaction: Interaction,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const authz = authorizeInteraction(interaction, deps.config);
  if (!requireMember(authz)) {
    return {
      response: ephemeralMessage(
        authz.ok ? "この操作に必要なロールがありません。" : authz.message,
      ),
    };
  }
  const parsed = parseCustomId(interaction.data?.custom_id);
  if (parsed.kind !== "preview-button") {
    return { response: ephemeralMessage("不明な操作です。") };
  }

  const session = await deps.store.getSession(parsed.sessionId);
  if (!session) {
    return {
      response: updateMessage({
        content: confirmErrorMessage("session_not_found"),
        components: [],
      }),
    };
  }
  if (session.discordUserId !== authz.userId) {
    return {
      response: ephemeralMessage(confirmErrorMessage("session_owner_mismatch")),
    };
  }

  if (parsed.action === "cancel") {
    await deps.store.cancelSession(session.sessionId);
    return {
      response: updateMessage({
        content: "キャンセルしました。変更は反映されていません。",
        components: [],
      }),
    };
  }

  if (session.consumedAt) {
    return {
      response: updateMessage({
        content: confirmErrorMessage("session_already_consumed"),
        components: [],
      }),
    };
  }
  if (isSessionExpired(session, deps.now())) {
    return {
      response: updateMessage({
        content: confirmErrorMessage("session_expired"),
        components: [],
      }),
    };
  }

  if (parsed.action === "confirm") {
    return confirmSessionDeferred(interaction, authz, session, deps);
  }

  // 修正・任意項目・リンク: button interactionへの応答としてModalを開く。
  const musician = await deps.store.getMusician(session.musicianId);
  if (!musician) {
    return {
      response: updateMessage({
        content: confirmErrorMessage("musician_not_found"),
        components: [],
      }),
    };
  }
  const merged = mergedPreviewState(musician, session.validatedPayload);
  if (parsed.action === "revise") {
    return {
      response: buildBasicProfileModal(
        CustomIds.basicModalRevise(session.sessionId),
        merged,
      ),
    };
  }
  if (parsed.action === "opt") {
    return { response: buildOptionalFieldsModal(session.sessionId, merged) };
  }
  return { response: buildLinkModal(session.sessionId) };
}

function confirmSessionDeferred(
  interaction: Interaction,
  authz: AuthorizedActor,
  session: SessionRecord,
  deps: HandlerDeps,
): HandlerResult {
  return {
    // 確定処理が3秒を超える可能性があるため、まずdeferしてから
    // interaction tokenで元メッセージを編集する(15分以内)。
    response: { type: InteractionResponseType.DeferredUpdateMessage },
    after: async () => {
      const result = await deps.store.confirmSession(
        session.sessionId,
        authz.userId,
        interaction.id,
      );
      if (result.ok) {
        await deps.editOriginal(interaction.token, {
          content: `反映しました(version ${result.newVersion})。公開名鑑に反映されます。`,
          components: [],
          flags: MessageFlags.Ephemeral,
        });
        deps.revalidate(result.slug);
        await deps.notify(
          auditNotificationText({
            action: "profile_update",
            slug: result.slug,
            actorId: authz.userId,
            actorKind: "self",
            result: "succeeded",
            detail: `変更項目: ${result.changedFields.join(", ") || "(なし)"}`,
          }),
        );
        await deps.store.cleanupExpiredSessions();
        return;
      }

      const benign =
        result.errorCode === "session_already_consumed" ||
        result.errorCode === "session_not_found";
      if (!benign) {
        await deps.store.recordFailure({
          musicianId: session.musicianId,
          actorDiscordUserId: authz.userId,
          actorKind: "self",
          action: "profile_update_failed",
          interactionId: interaction.id,
          result: result.errorCode === "db_error" ? "failed" : "rejected",
          errorCode: result.errorCode,
        });
        await deps.notify(
          auditNotificationText({
            action: "profile_update",
            slug: null,
            actorId: authz.userId,
            actorKind: "self",
            result: result.errorCode === "db_error" ? "failed" : "rejected",
            detail: result.errorCode,
          }),
        );
      }
      await deps.editOriginal(interaction.token, {
        content: confirmErrorMessage(result.errorCode),
        components: [],
        flags: MessageFlags.Ephemeral,
      });
    },
  };
}
