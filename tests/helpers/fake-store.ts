import { randomUUID } from "node:crypto";
import type {
  AuditLogSummary,
  ConfirmSuccess,
  FailureAuditEntry,
  IntakeStore,
  MusicianEditState,
  MutationSuccess,
  SessionRecord,
  StoreError,
} from "@/lib/discord/store";
import type { LinkOp, ValidatedProfilePayload } from "@/lib/discord/validation";

/**
 * sql/003_functions.sqlの確定transactionと同じ意味論を持つin-memory store。
 * SQL関数そのものの検証は検証用DBで行う必要がある。
 */

export type AuditEntry = {
  id: string;
  musicianId: string | null;
  actorDiscordUserId: string;
  actorKind: string;
  action: string;
  changedFields: string[];
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
  interactionId: string | null;
  result: string;
  errorCode: string | null;
  createdAt: string;
};

const SELF_EDITABLE = [
  "display_name",
  "name_jp",
  "name_en",
  "roles",
  "primary_sns_url",
  "website_url",
  "icon_image_url",
  "vrc_name",
  "aliases",
];

export function makeMusician(
  overrides: Partial<MusicianEditState> = {},
): MusicianEditState {
  return {
    id: overrides.id ?? randomUUID(),
    slug: "test-musician",
    displayName: "テスト",
    nameJp: "テスト",
    nameEn: "Test",
    roles: ["Vo"],
    aliases: [],
    primarySnsUrl: null,
    websiteUrl: null,
    iconImageUrl: null,
    vrcName: null,
    visibility: "public",
    version: 1,
    isLocked: false,
    links: [],
    ...overrides,
  };
}

function snapshot(musician: MusicianEditState): Record<string, unknown> {
  return {
    display_name: musician.displayName,
    name_jp: musician.nameJp,
    name_en: musician.nameEn,
    roles: [...musician.roles],
    aliases: [...musician.aliases],
    primary_sns_url: musician.primarySnsUrl,
    website_url: musician.websiteUrl,
    icon_image_url: musician.iconImageUrl,
    vrc_name: musician.vrcName,
    visibility: musician.visibility,
    version: musician.version,
    links: musician.links.map((link) => ({
      platform: link.platform,
      label: link.label,
      url: link.url,
      display_order: link.displayOrder,
    })),
  };
}

function applyPayload(
  musician: MusicianEditState,
  fields: Record<string, unknown>,
  linkOps: LinkOp[],
): string[] {
  const changed: string[] = [];
  for (const key of Object.keys(fields)) {
    if (!SELF_EDITABLE.includes(key)) throw new Error(`unknown_field:${key}`);
    changed.push(key);
  }
  const text = (key: string): string | null => {
    const value = String(fields[key] ?? "");
    return value === "" ? null : value;
  };
  if ("display_name" in fields) musician.displayName = String(fields.display_name);
  if ("name_jp" in fields) musician.nameJp = String(fields.name_jp);
  if ("name_en" in fields) musician.nameEn = String(fields.name_en);
  if ("roles" in fields) musician.roles = [...(fields.roles as string[])];
  if ("aliases" in fields) musician.aliases = [...(fields.aliases as string[])];
  if ("primary_sns_url" in fields) musician.primarySnsUrl = text("primary_sns_url");
  if ("website_url" in fields) musician.websiteUrl = text("website_url");
  if ("icon_image_url" in fields) musician.iconImageUrl = text("icon_image_url");
  if ("vrc_name" in fields) musician.vrcName = text("vrc_name");

  for (const op of linkOps) {
    musician.links = musician.links.filter((link) => link.url !== op.url);
    if (op.op === "upsert") {
      musician.links.push({
        platform: op.platform ?? "other",
        label: op.label ?? null,
        url: op.url,
        displayOrder: op.display_order ?? 0,
      });
    }
  }
  if (linkOps.length > 0) changed.push("links");
  musician.version += 1;
  return changed;
}

export class FakeIntakeStore implements IntakeStore {
  musicians = new Map<string, MusicianEditState>();
  representatives: Array<{
    musicianId: string;
    discordUserId: string;
    isActive: boolean;
  }> = [];
  sessions = new Map<string, SessionRecord>();
  sessionInteractionIds = new Set<string>();
  auditLogs: AuditEntry[] = [];
  /** 監査ログinsert失敗(=transaction全体のrollback)を再現する。 */
  failAuditInsert = false;
  now: () => Date = () => new Date();

  addMusician(musician: MusicianEditState): MusicianEditState {
    this.musicians.set(musician.id, musician);
    return musician;
  }

  addRepresentative(musicianId: string, discordUserId: string): void {
    this.representatives.push({ musicianId, discordUserId, isActive: true });
  }

  private pushAudit(entry: Omit<AuditEntry, "id" | "createdAt">): void {
    if (this.failAuditInsert) throw new Error("audit insert failed");
    if (
      entry.interactionId &&
      this.auditLogs.some((log) => log.interactionId === entry.interactionId)
    ) {
      throw new Error("duplicate interaction_id");
    }
    this.auditLogs.push({
      ...entry,
      id: randomUUID(),
      createdAt: this.now().toISOString(),
    });
  }

  async findActiveRepresentative(discordUserId: string) {
    const found = this.representatives.find(
      (rep) => rep.isActive && rep.discordUserId === discordUserId,
    );
    return found
      ? { musicianId: found.musicianId, discordUserId: found.discordUserId }
      : null;
  }

  async getMusician(musicianId: string) {
    const musician = this.musicians.get(musicianId);
    return musician ? structuredClone(musician) : null;
  }

  async findMusicianBySlugOrId(slugOrId: string) {
    const byId = this.musicians.get(slugOrId);
    if (byId) return structuredClone(byId);
    for (const musician of this.musicians.values()) {
      if (musician.slug === slugOrId) return structuredClone(musician);
    }
    return null;
  }

  async createSession(input: {
    discordInteractionId: string;
    discordUserId: string;
    musicianId: string;
    baseVersion: number;
    submittedPayload: unknown;
    validatedPayload: ValidatedProfilePayload;
    expiresAt: string;
  }): Promise<SessionRecord | StoreError> {
    if (this.sessionInteractionIds.has(input.discordInteractionId)) {
      return { ok: false, errorCode: "duplicate_interaction" };
    }
    this.sessionInteractionIds.add(input.discordInteractionId);
    const session: SessionRecord = {
      sessionId: randomUUID(),
      discordInteractionId: input.discordInteractionId,
      discordUserId: input.discordUserId,
      musicianId: input.musicianId,
      baseVersion: input.baseVersion,
      validatedPayload: structuredClone(input.validatedPayload),
      expiresAt: input.expiresAt,
      consumedAt: null,
    };
    this.sessions.set(session.sessionId, session);
    return structuredClone(session);
  }

  async getSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    return session ? structuredClone(session) : null;
  }

  async cancelSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session && !session.consumedAt) {
      session.consumedAt = this.now().toISOString();
    }
  }

  async confirmSession(
    sessionId: string,
    discordUserId: string,
    interactionId: string,
  ): Promise<ConfirmSuccess | StoreError> {
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: false, errorCode: "session_not_found" };
    if (session.discordUserId !== discordUserId) {
      return { ok: false, errorCode: "session_owner_mismatch" };
    }
    if (session.consumedAt) {
      return { ok: false, errorCode: "session_already_consumed" };
    }
    if (new Date(session.expiresAt).getTime() <= this.now().getTime()) {
      return { ok: false, errorCode: "session_expired" };
    }
    const musician = this.musicians.get(session.musicianId);
    if (!musician) return { ok: false, errorCode: "musician_not_found" };
    if (musician.isLocked) return { ok: false, errorCode: "musician_locked" };
    if (musician.version !== session.baseVersion) {
      return { ok: false, errorCode: "version_conflict" };
    }
    if (
      !this.representatives.some(
        (rep) =>
          rep.isActive &&
          rep.musicianId === musician.id &&
          rep.discordUserId === discordUserId,
      )
    ) {
      return { ok: false, errorCode: "not_representative" };
    }

    // SQL関数と同様に、監査insert失敗で全変更をrollbackする。
    const working = structuredClone(musician);
    let changed: string[];
    try {
      changed = applyPayload(
        working,
        session.validatedPayload.fields as Record<string, unknown>,
        session.validatedPayload.link_ops,
      );
      this.pushAudit({
        musicianId: musician.id,
        actorDiscordUserId: discordUserId,
        actorKind: "self",
        action: "profile_update",
        changedFields: changed,
        beforeSnapshot: snapshot(musician),
        afterSnapshot: snapshot(working),
        interactionId,
        result: "succeeded",
        errorCode: null,
      });
    } catch {
      return { ok: false, errorCode: "db_error" };
    }
    this.musicians.set(musician.id, working);
    session.consumedAt = this.now().toISOString();
    return {
      ok: true,
      slug: working.slug,
      newVersion: working.version,
      changedFields: changed,
    };
  }

  async setLock(input: {
    musicianId: string;
    locked: boolean;
    reason: string | null;
    actorDiscordUserId: string;
    actorKind: "self" | "operator";
    interactionId: string;
  }): Promise<MutationSuccess | StoreError> {
    const musician = this.musicians.get(input.musicianId);
    if (!musician) return { ok: false, errorCode: "musician_not_found" };
    if (input.locked && musician.isLocked) {
      return { ok: false, errorCode: "already_locked" };
    }
    if (!input.locked && !musician.isLocked) {
      return { ok: false, errorCode: "not_locked" };
    }
    try {
      this.pushAudit({
        musicianId: musician.id,
        actorDiscordUserId: input.actorDiscordUserId,
        actorKind: input.actorKind,
        action: input.locked ? "lock" : "unlock",
        changedFields: ["is_locked"],
        beforeSnapshot: { is_locked: musician.isLocked },
        afterSnapshot: { is_locked: input.locked },
        interactionId: input.interactionId,
        result: "succeeded",
        errorCode: null,
      });
    } catch {
      return { ok: false, errorCode: "db_error" };
    }
    musician.isLocked = input.locked;
    return { ok: true, slug: musician.slug };
  }

  async setRepresentative(input: {
    musicianId: string;
    discordUserId: string;
    discordUsernameSnapshot: string | null;
    operatorDiscordUserId: string;
    interactionId: string;
  }): Promise<MutationSuccess | StoreError> {
    const musician = this.musicians.get(input.musicianId);
    if (!musician) return { ok: false, errorCode: "musician_not_found" };
    if (
      this.representatives.some(
        (rep) =>
          rep.isActive &&
          rep.musicianId === input.musicianId &&
          rep.discordUserId === input.discordUserId,
      )
    ) {
      return { ok: false, errorCode: "already_representative" };
    }
    try {
      this.pushAudit({
        musicianId: musician.id,
        actorDiscordUserId: input.operatorDiscordUserId,
        actorKind: "operator",
        action: "representative_set",
        changedFields: ["representative"],
        beforeSnapshot: null,
        afterSnapshot: { discord_user_id: input.discordUserId },
        interactionId: input.interactionId,
        result: "succeeded",
        errorCode: null,
      });
    } catch {
      return { ok: false, errorCode: "db_error" };
    }
    for (const rep of this.representatives) {
      if (
        rep.isActive &&
        (rep.musicianId === input.musicianId ||
          rep.discordUserId === input.discordUserId)
      ) {
        rep.isActive = false;
      }
    }
    this.representatives.push({
      musicianId: input.musicianId,
      discordUserId: input.discordUserId,
      isActive: true,
    });
    return { ok: true, slug: musician.slug };
  }

  async setVisibility(input: {
    musicianId: string;
    visibility: "public" | "draft" | "hidden";
    operatorDiscordUserId: string;
    interactionId: string;
  }): Promise<MutationSuccess | StoreError> {
    const musician = this.musicians.get(input.musicianId);
    if (!musician) return { ok: false, errorCode: "musician_not_found" };
    if (musician.visibility === input.visibility) {
      return { ok: false, errorCode: "visibility_unchanged" };
    }
    try {
      this.pushAudit({
        musicianId: musician.id,
        actorDiscordUserId: input.operatorDiscordUserId,
        actorKind: "operator",
        action: "visibility_change",
        changedFields: ["visibility"],
        beforeSnapshot: { visibility: musician.visibility },
        afterSnapshot: { visibility: input.visibility },
        interactionId: input.interactionId,
        result: "succeeded",
        errorCode: null,
      });
    } catch {
      return { ok: false, errorCode: "db_error" };
    }
    musician.visibility = input.visibility;
    return { ok: true, slug: musician.slug };
  }

  async restoreFromAudit(input: {
    musicianId: string;
    auditLogId: string;
    state: "before" | "after";
    operatorDiscordUserId: string;
    interactionId: string;
  }): Promise<MutationSuccess | StoreError> {
    const musician = this.musicians.get(input.musicianId);
    if (!musician) return { ok: false, errorCode: "musician_not_found" };
    const auditLog = this.auditLogs.find(
      (log) => log.id === input.auditLogId && log.musicianId === input.musicianId,
    );
    if (!auditLog) return { ok: false, errorCode: "audit_log_not_found" };
    const source = (
      input.state === "before" ? auditLog.beforeSnapshot : auditLog.afterSnapshot
    ) as Record<string, unknown> | null;
    if (!source || typeof source.display_name !== "string") {
      return { ok: false, errorCode: "snapshot_not_restorable" };
    }

    const working = structuredClone(musician);
    const fields: Record<string, unknown> = {};
    for (const key of SELF_EDITABLE) {
      if (key in source) fields[key] = source[key];
    }
    try {
      const changed = applyPayload(working, fields, []);
      working.links = ((source.links as Array<Record<string, unknown>>) ?? []).map(
        (link) => ({
          platform: String(link.platform ?? "other"),
          label: (link.label as string | null) ?? null,
          url: String(link.url),
          displayOrder: Number(link.display_order ?? 0),
        }),
      );
      this.pushAudit({
        musicianId: musician.id,
        actorDiscordUserId: input.operatorDiscordUserId,
        actorKind: "operator",
        action: "restore",
        changedFields: [...changed, "links"],
        beforeSnapshot: snapshot(musician),
        afterSnapshot: snapshot(working),
        interactionId: input.interactionId,
        result: "succeeded",
        errorCode: null,
      });
    } catch {
      return { ok: false, errorCode: "db_error" };
    }
    this.musicians.set(musician.id, working);
    return { ok: true, slug: working.slug };
  }

  async listRecentAuditLogs(
    musicianId: string,
    limit: number,
  ): Promise<AuditLogSummary[]> {
    return this.auditLogs
      .filter((log) => log.musicianId === musicianId)
      .slice(-limit)
      .reverse()
      .map((log) => ({
        id: log.id,
        action: log.action,
        result: log.result,
        changedFields: log.changedFields,
        createdAt: log.createdAt,
      }));
  }

  async recordFailure(entry: FailureAuditEntry): Promise<void> {
    try {
      this.pushAudit({
        musicianId: entry.musicianId,
        actorDiscordUserId: entry.actorDiscordUserId,
        actorKind: entry.actorKind,
        action: entry.action,
        changedFields: [],
        beforeSnapshot: null,
        afterSnapshot: null,
        interactionId: entry.interactionId,
        result: entry.result,
        errorCode: entry.errorCode,
      });
    } catch {
      // ベストエフォート。
    }
  }

  async cleanupExpiredSessions(): Promise<void> {}
}
