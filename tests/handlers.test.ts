import { beforeEach, describe, expect, it } from "vitest";
import { CustomIds } from "@/lib/discord/components";
import { handleInteraction } from "@/lib/discord/handlers";
import { InteractionResponseType } from "@/lib/discord/types";
import { makeMusician } from "./helpers/fake-store";
import {
  buttonInteraction,
  commandInteraction,
  makeDeps,
  modalSubmitInteraction,
  TEST_CONFIG,
  VALID_BASIC_INPUTS,
  type CapturedDeps,
} from "./helpers/fixtures";

const SECRET_SENTINEL = "sb_secret_TEST_SENTINEL_DO_NOT_LEAK";

let deps: CapturedDeps;

beforeEach(() => {
  process.env.SUPABASE_SECRET_KEY = SECRET_SENTINEL;
  deps = makeDeps();
});

function setupRepresentative(userId = "user-1") {
  const musician = deps.store.addMusician(makeMusician());
  deps.store.addRepresentative(musician.id, userId);
  return musician;
}

async function submitBasicProfile(userId = "user-1") {
  const musician = setupRepresentative(userId);
  const result = await handleInteraction(
    modalSubmitInteraction({
      customId: CustomIds.basicModalNew,
      values: VALID_BASIC_INPUTS,
      userId,
    }),
    deps,
  );
  const row = (
    result.response.data?.components as Array<{
      components: Array<{ custom_id: string }>;
    }>
  )?.[0];
  const confirmId = row?.components.find((button) =>
    button.custom_id.startsWith("pv:confirm:"),
  )?.custom_id;
  const sessionId = confirmId?.slice("pv:confirm:".length) ?? "";
  return { musician, result, sessionId };
}

function messageContent(result: { response: { data?: Record<string, unknown> } }) {
  return String(result.response.data?.content ?? "");
}

describe("再認可(guild / role / 代表者 / lock)", () => {
  it("対象外guildからのcommandを拒否する", async () => {
    const result = await handleInteraction(
      commandInteraction({
        command: "emn-profile",
        subcommand: "edit",
        guildId: "other-guild",
      }),
      deps,
    );
    expect(messageContent(result)).toContain("EMN Records");
  });

  it("member roleのないユーザーを拒否する", async () => {
    const result = await handleInteraction(
      commandInteraction({
        command: "emn-profile",
        subcommand: "edit",
        roles: ["unrelated-role"],
      }),
      deps,
    );
    expect(messageContent(result)).toContain("ロール");
  });

  it("代表者未登録のユーザーを拒否する", async () => {
    const result = await handleInteraction(
      commandInteraction({ command: "emn-profile", subcommand: "edit" }),
      deps,
    );
    expect(messageContent(result)).toContain("代表者");
  });

  it("locked recordの編集開始を拒否する", async () => {
    const musician = setupRepresentative();
    musician.isLocked = true;
    const result = await handleInteraction(
      commandInteraction({ command: "emn-profile", subcommand: "edit" }),
      deps,
    );
    expect(messageContent(result)).toContain("ロック中");
  });

  it("代表者にはModalを開く", async () => {
    setupRepresentative();
    const result = await handleInteraction(
      commandInteraction({ command: "emn-profile", subcommand: "edit" }),
      deps,
    );
    expect(result.response.type).toBe(InteractionResponseType.Modal);
  });
});

describe("Modal submit(sessionのみ作成、正本DB非更新)", () => {
  it("検証済みpayloadを短命sessionへ保存し、musiciansを更新しない", async () => {
    const { musician, result, sessionId } = await submitBasicProfile();
    expect(result.response.type).toBe(
      InteractionResponseType.ChannelMessageWithSource,
    );
    expect(result.response.data?.flags).toBe(64);
    expect(sessionId).not.toBe("");

    const unchanged = await deps.store.getMusician(musician.id);
    expect(unchanged?.displayName).toBe("テスト");
    expect(unchanged?.version).toBe(1);

    const session = await deps.store.getSession(sessionId);
    expect(session?.validatedPayload.fields.display_name).toBe("新しい名前");
    expect(session?.consumedAt).toBeNull();
  });

  it("未知項目を含むsubmitを拒否して監査する", async () => {
    setupRepresentative();
    const result = await handleInteraction(
      modalSubmitInteraction({
        customId: CustomIds.basicModalNew,
        values: { ...VALID_BASIC_INPUTS, visibility: "public" },
      }),
      deps,
    );
    expect(messageContent(result)).toContain("不明な項目");
    expect(deps.store.sessions.size).toBe(0);
    expect(
      deps.store.auditLogs.some(
        (log) =>
          log.action === "profile_update_failed" && log.result === "rejected",
      ),
    ).toBe(true);
  });

  it("不正URLを拒否する", async () => {
    setupRepresentative();
    const result = await handleInteraction(
      modalSubmitInteraction({
        customId: CustomIds.basicModalNew,
        values: { ...VALID_BASIC_INPUTS, primary_sns_url: "javascript:alert(1)" },
      }),
      deps,
    );
    expect(messageContent(result)).toContain("URL");
    expect(deps.store.sessions.size).toBe(0);
  });

  it("locked record宛のsubmitを拒否する", async () => {
    const musician = setupRepresentative();
    musician.isLocked = true;
    const result = await handleInteraction(
      modalSubmitInteraction({
        customId: CustomIds.basicModalNew,
        values: VALID_BASIC_INPUTS,
      }),
      deps,
    );
    expect(messageContent(result)).toContain("ロック中");
    expect(deps.store.sessions.size).toBe(0);
  });

  it("同じinteraction idの再送でsessionを二重作成しない", async () => {
    setupRepresentative();
    const interaction = modalSubmitInteraction({
      customId: CustomIds.basicModalNew,
      values: VALID_BASIC_INPUTS,
    });
    await handleInteraction(interaction, deps);
    const replay = await handleInteraction(interaction, deps);
    expect(messageContent(replay)).toContain("すでに処理");
    expect(deps.store.sessions.size).toBe(1);
  });
});

describe("preview button(confirm限定更新)", () => {
  it("[反映する]でのみDBを更新し、監査・通知・再検証する", async () => {
    const { musician, sessionId } = await submitBasicProfile();
    const confirm = await handleInteraction(
      buttonInteraction({ customId: CustomIds.confirmButton(sessionId) }),
      deps,
    );
    expect(confirm.response.type).toBe(
      InteractionResponseType.DeferredUpdateMessage,
    );
    expect(confirm.after).toBeDefined();
    await confirm.after?.();

    const updated = await deps.store.getMusician(musician.id);
    expect(updated?.displayName).toBe("新しい名前");
    expect(updated?.version).toBe(2);
    expect(
      deps.store.auditLogs.filter(
        (log) => log.action === "profile_update" && log.result === "succeeded",
      ),
    ).toHaveLength(1);
    expect(deps.edits).toHaveLength(1);
    expect(String(deps.edits[0].body.content)).toContain("反映しました");
    expect(deps.notifications).toHaveLength(1);
    expect(deps.revalidated).toContain("test-musician");

    const session = await deps.store.getSession(sessionId);
    expect(session?.consumedAt).not.toBeNull();
  });

  it("二重confirmは最初の1回だけ成功する", async () => {
    const { musician, sessionId } = await submitBasicProfile();
    const first = await handleInteraction(
      buttonInteraction({ customId: CustomIds.confirmButton(sessionId) }),
      deps,
    );
    await first.after?.();
    const second = await handleInteraction(
      buttonInteraction({ customId: CustomIds.confirmButton(sessionId) }),
      deps,
    );
    // 2回目は初回応答の時点で消費済みを検出してbuttonを畳む。
    expect(second.response.type).toBe(InteractionResponseType.UpdateMessage);
    expect(messageContent(second)).toContain("反映済み");
    const updated = await deps.store.getMusician(musician.id);
    expect(updated?.version).toBe(2);
  });

  it("古いbase_versionのsessionを拒否する", async () => {
    const { musician, sessionId } = await submitBasicProfile();
    // previewの後に別経路で更新が入った状況を再現する。
    deps.store.musicians.get(musician.id)!.version = 5;
    const confirm = await handleInteraction(
      buttonInteraction({ customId: CustomIds.confirmButton(sessionId) }),
      deps,
    );
    await confirm.after?.();
    expect(String(deps.edits[0].body.content)).toContain("競合");
    expect(deps.store.musicians.get(musician.id)!.displayName).toBe("テスト");
    expect(
      deps.store.auditLogs.some(
        (log) => log.action === "profile_update_failed" && log.errorCode === "version_conflict",
      ),
    ).toBe(true);
  });

  it("confirm前にロックされたら反映しない(更新との競合)", async () => {
    const { musician, sessionId } = await submitBasicProfile();
    deps.store.musicians.get(musician.id)!.isLocked = true;
    const confirm = await handleInteraction(
      buttonInteraction({ customId: CustomIds.confirmButton(sessionId) }),
      deps,
    );
    await confirm.after?.();
    expect(String(deps.edits[0].body.content)).toContain("ロック中");
    expect(deps.store.musicians.get(musician.id)!.displayName).toBe("テスト");
  });

  it("監査ログ追加に失敗した場合は更新もsession消費もrollbackする", async () => {
    const { musician, sessionId } = await submitBasicProfile();
    deps.store.failAuditInsert = true;
    const confirm = await handleInteraction(
      buttonInteraction({ customId: CustomIds.confirmButton(sessionId) }),
      deps,
    );
    await confirm.after?.();
    const unchanged = deps.store.musicians.get(musician.id)!;
    expect(unchanged.displayName).toBe("テスト");
    expect(unchanged.version).toBe(1);
    const session = await deps.store.getSession(sessionId);
    expect(session?.consumedAt).toBeNull();
    expect(String(deps.edits[0].body.content)).toContain("失敗");
  });

  it("session所有者以外のconfirmを拒否する", async () => {
    const { musician, sessionId } = await submitBasicProfile();
    deps.store.addRepresentative("other-musician", "user-2");
    const confirm = await handleInteraction(
      buttonInteraction({
        customId: CustomIds.confirmButton(sessionId),
        userId: "user-2",
      }),
      deps,
    );
    expect(messageContent(confirm)).toContain("あなたの操作ではありません");
    expect(deps.store.musicians.get(musician.id)!.version).toBe(1);
  });

  it("[キャンセル]でsessionを失効させ、反映しない", async () => {
    const { musician, sessionId } = await submitBasicProfile();
    const cancel = await handleInteraction(
      buttonInteraction({ customId: CustomIds.cancelButton(sessionId) }),
      deps,
    );
    expect(cancel.response.type).toBe(InteractionResponseType.UpdateMessage);
    expect(messageContent(cancel)).toContain("キャンセル");
    const session = await deps.store.getSession(sessionId);
    expect(session?.consumedAt).not.toBeNull();
    expect(deps.store.musicians.get(musician.id)!.version).toBe(1);
  });

  it("[修正する]はbutton interactionへの応答としてModalを開く", async () => {
    const { sessionId } = await submitBasicProfile();
    const revise = await handleInteraction(
      buttonInteraction({ customId: CustomIds.reviseButton(sessionId) }),
      deps,
    );
    expect(revise.response.type).toBe(InteractionResponseType.Modal);
    expect(revise.response.data?.custom_id).toBe(
      CustomIds.basicModalRevise(sessionId),
    );
  });

  it("修正Modal submitでsessionを引き継ぎ、旧sessionを失効させる", async () => {
    const { sessionId } = await submitBasicProfile();
    const revision = await handleInteraction(
      modalSubmitInteraction({
        customId: CustomIds.basicModalRevise(sessionId),
        values: { ...VALID_BASIC_INPUTS, display_name: "再修正した名前" },
      }),
      deps,
    );
    expect(revision.response.type).toBe(InteractionResponseType.UpdateMessage);
    const oldSession = await deps.store.getSession(sessionId);
    expect(oldSession?.consumedAt).not.toBeNull();
    const sessions = [...deps.store.sessions.values()];
    const active = sessions.find((session) => !session.consumedAt);
    expect(active?.validatedPayload.fields.display_name).toBe("再修正した名前");
  });

  it("期限切れsessionのconfirmを拒否する", async () => {
    const { sessionId } = await submitBasicProfile();
    deps.now = () => new Date(Date.now() + 16 * 60 * 1000);
    const confirm = await handleInteraction(
      buttonInteraction({ customId: CustomIds.confirmButton(sessionId) }),
      deps,
    );
    expect(confirm.response.type).toBe(InteractionResponseType.UpdateMessage);
    expect(messageContent(confirm)).toContain("有効期限");
  });
});

describe("通知(限定監査チャンネル)", () => {
  it("通知失敗でもDB更新と監査記録は失われない", async () => {
    deps = makeDeps({
      notify: async () => {
        throw new Error("notification failed");
      },
    });
    const { musician, sessionId } = await submitBasicProfile();
    const confirm = await handleInteraction(
      buttonInteraction({ customId: CustomIds.confirmButton(sessionId) }),
      deps,
    );
    // routeと同様に、follow-up内の通知失敗は握りつぶされる。
    await confirm.after?.().catch(() => {});
    expect(deps.store.musicians.get(musician.id)!.version).toBe(2);
    expect(
      deps.store.auditLogs.some((log) => log.action === "profile_update"),
    ).toBe(true);
    // DB反映と監査が先、通知は後なので、本人向けの結果編集も行われている。
    expect(deps.edits).toHaveLength(1);
  });

  it("通知に秘密情報・生の入力内容を含めない", async () => {
    const { sessionId } = await submitBasicProfile();
    const confirm = await handleInteraction(
      buttonInteraction({ customId: CustomIds.confirmButton(sessionId) }),
      deps,
    );
    await confirm.after?.();
    for (const notification of deps.notifications) {
      expect(notification).not.toContain(SECRET_SENTINEL);
      expect(notification).not.toContain("https://x.com/example");
    }
  });
});

describe("運営者コマンド(operator再認可)", () => {
  it("operator roleのないユーザーの/emn-adminを拒否し監査する", async () => {
    const musician = deps.store.addMusician(makeMusician());
    const result = await handleInteraction(
      commandInteraction({
        command: "emn-admin",
        subcommand: "profile-lock",
        options: { musician: musician.slug },
        roles: [TEST_CONFIG.memberRoleId],
      }),
      deps,
    );
    expect(messageContent(result)).toContain("運営者ロール");
    expect(deps.store.musicians.get(musician.id)!.isLocked).toBe(false);
    expect(
      deps.store.auditLogs.some(
        (log) => log.result === "rejected" && log.errorCode === "missing_operator_role",
      ),
    ).toBe(true);
  });

  it("lock→unlockが動作し、重複lockを拒否する", async () => {
    const musician = deps.store.addMusician(makeMusician());
    const operator = {
      roles: [TEST_CONFIG.operatorRoleId],
      userId: "operator-1",
    };
    const lock = await handleInteraction(
      commandInteraction({
        command: "emn-admin",
        subcommand: "profile-lock",
        options: { musician: musician.slug, reason: "調査" },
        ...operator,
      }),
      deps,
    );
    await lock.after?.();
    expect(deps.store.musicians.get(musician.id)!.isLocked).toBe(true);

    const duplicate = await handleInteraction(
      commandInteraction({
        command: "emn-admin",
        subcommand: "profile-lock",
        options: { musician: musician.slug },
        ...operator,
      }),
      deps,
    );
    expect(messageContent(duplicate)).toContain("すでにロック");

    const unlock = await handleInteraction(
      commandInteraction({
        command: "emn-admin",
        subcommand: "profile-unlock",
        options: { musician: musician.slug },
        ...operator,
      }),
      deps,
    );
    await unlock.after?.();
    expect(deps.store.musicians.get(musician.id)!.isLocked).toBe(false);
    expect(deps.notifications.length).toBeGreaterThanOrEqual(2);
  });

  it("代表者変更で旧代表者を無効化する", async () => {
    const musician = deps.store.addMusician(makeMusician());
    deps.store.addRepresentative(musician.id, "user-old");
    const result = await handleInteraction(
      commandInteraction({
        command: "emn-admin",
        subcommand: "representative-set",
        options: { user: "user-new", musician: musician.slug },
        roles: [TEST_CONFIG.operatorRoleId],
        userId: "operator-1",
      }),
      deps,
    );
    await result.after?.();
    expect(messageContent(result)).toContain("代表者");
    expect(await deps.store.findActiveRepresentative("user-old")).toBeNull();
    expect(
      (await deps.store.findActiveRepresentative("user-new"))?.musicianId,
    ).toBe(musician.id);
  });

  it("非公開化と復旧が新しい監査記録として残る", async () => {
    const operator = {
      roles: [TEST_CONFIG.operatorRoleId],
      userId: "operator-1",
    };
    // 本人更新を1件作って監査snapshotを用意する。
    const { musician, sessionId } = await submitBasicProfile();
    const confirm = await handleInteraction(
      buttonInteraction({ customId: CustomIds.confirmButton(sessionId) }),
      deps,
    );
    await confirm.after?.();

    const hide = await handleInteraction(
      commandInteraction({
        command: "emn-admin",
        subcommand: "profile-hide",
        options: { musician: musician.slug },
        ...operator,
      }),
      deps,
    );
    await hide.after?.();
    expect(deps.store.musicians.get(musician.id)!.visibility).toBe("hidden");

    const lock = await handleInteraction(
      commandInteraction({
        command: "emn-admin",
        subcommand: "profile-lock",
        options: { musician: musician.slug, reason: "復旧作業中" },
        ...operator,
      }),
      deps,
    );
    await lock.after?.();
    expect(deps.store.musicians.get(musician.id)!.isLocked).toBe(true);

    const updateLog = deps.store.auditLogs.find(
      (log) => log.action === "profile_update",
    )!;
    const restore = await handleInteraction(
      commandInteraction({
        command: "emn-admin",
        subcommand: "profile-restore",
        options: {
          musician: musician.slug,
          audit_log: updateLog.id,
          state: "before",
        },
        ...operator,
      }),
      deps,
    );
    await restore.after?.();
    const restored = deps.store.musicians.get(musician.id)!;
    expect(restored.displayName).toBe("テスト");
    // 復旧は新しい変更としてversionを進め、監査に残る。
    expect(restored.version).toBe(3);
    expect(
      deps.store.auditLogs.some((log) => log.action === "restore"),
    ).toBe(true);
    // 非公開化はrestoreで巻き戻らない。
    expect(restored.visibility).toBe("hidden");
    // 運営者restoreはlock中も許可するが、lock解除は別操作にする。
    expect(restored.isLocked).toBe(true);
  });

  it("本人による/emn-profile lockは自分のレコードだけを対象にする", async () => {
    const musician = setupRepresentative();
    const other = deps.store.addMusician(
      makeMusician({ slug: "other-musician" }),
    );
    const result = await handleInteraction(
      commandInteraction({ command: "emn-profile", subcommand: "lock" }),
      deps,
    );
    await result.after?.();
    expect(deps.store.musicians.get(musician.id)!.isLocked).toBe(true);
    expect(deps.store.musicians.get(other.id)!.isLocked).toBe(false);
  });
});

describe("秘密情報の非露出", () => {
  it("interaction response・通知・メッセージ編集にSUPABASE_SECRET_KEYが現れない", async () => {
    const { sessionId } = await submitBasicProfile();
    const responses: unknown[] = [];
    const view = await handleInteraction(
      commandInteraction({ command: "emn-profile", subcommand: "view" }),
      deps,
    );
    responses.push(view.response);
    const confirm = await handleInteraction(
      buttonInteraction({ customId: CustomIds.confirmButton(sessionId) }),
      deps,
    );
    responses.push(confirm.response);
    await confirm.after?.();

    const serialized = JSON.stringify({
      responses,
      notifications: deps.notifications,
      edits: deps.edits,
    });
    expect(serialized).not.toContain(SECRET_SENTINEL);
  });
});
