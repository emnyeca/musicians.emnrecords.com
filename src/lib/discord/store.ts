import type { SupabaseClient } from "@supabase/supabase-js";
import type { ValidatedProfilePayload } from "./validation";

/**
 * Interaction受付のデータアクセス境界。
 * 本番実装はservice roleのSupabase clientを使うが、RLSを迂回するため
 * 呼び出し側(handler)がguild、role、代表者、lock、versionを毎回再認可する。
 * テストはこのinterfaceのin-memory fakeを使う。
 */

export type RepresentativeRecord = {
  musicianId: string;
  discordUserId: string;
};

export type MusicianLinkState = {
  platform: string;
  label: string | null;
  url: string;
  displayOrder: number;
};

export type MusicianEditState = {
  id: string;
  slug: string;
  displayName: string;
  nameJp: string;
  nameEn: string;
  roles: string[];
  aliases: string[];
  primarySnsUrl: string | null;
  websiteUrl: string | null;
  iconImageUrl: string | null;
  vrcName: string | null;
  visibility: string;
  version: number;
  isLocked: boolean;
  links: MusicianLinkState[];
};

export type SessionRecord = {
  sessionId: string;
  discordInteractionId: string;
  discordUserId: string;
  musicianId: string;
  baseVersion: number;
  validatedPayload: ValidatedProfilePayload;
  expiresAt: string;
  consumedAt: string | null;
};

export type StoreError = { ok: false; errorCode: string };
export type ConfirmSuccess = {
  ok: true;
  slug: string;
  newVersion: number;
  changedFields: string[];
};
export type MutationSuccess = { ok: true; slug: string };

export type AuditLogSummary = {
  id: string;
  action: string;
  result: string;
  changedFields: string[];
  createdAt: string;
};

export type FailureAuditEntry = {
  musicianId: string | null;
  actorDiscordUserId: string;
  actorKind: "self" | "operator" | "system";
  action:
    | "profile_update_failed"
    | "lock"
    | "unlock"
    | "restore"
    | "representative_set"
    | "visibility_change";
  interactionId: string | null;
  result: "rejected" | "failed";
  errorCode: string;
};

export interface IntakeStore {
  findActiveRepresentative(
    discordUserId: string,
  ): Promise<RepresentativeRecord | null>;
  getMusician(musicianId: string): Promise<MusicianEditState | null>;
  findMusicianBySlugOrId(slugOrId: string): Promise<MusicianEditState | null>;
  createSession(input: {
    discordInteractionId: string;
    discordUserId: string;
    musicianId: string;
    baseVersion: number;
    submittedPayload: unknown;
    validatedPayload: ValidatedProfilePayload;
    expiresAt: string;
  }): Promise<SessionRecord | StoreError>;
  getSession(sessionId: string): Promise<SessionRecord | null>;
  cancelSession(sessionId: string): Promise<void>;
  confirmSession(
    sessionId: string,
    discordUserId: string,
    interactionId: string,
  ): Promise<ConfirmSuccess | StoreError>;
  setLock(input: {
    musicianId: string;
    locked: boolean;
    reason: string | null;
    actorDiscordUserId: string;
    actorKind: "self" | "operator";
    interactionId: string;
  }): Promise<MutationSuccess | StoreError>;
  setRepresentative(input: {
    musicianId: string;
    discordUserId: string;
    discordUsernameSnapshot: string | null;
    operatorDiscordUserId: string;
    interactionId: string;
  }): Promise<MutationSuccess | StoreError>;
  setVisibility(input: {
    musicianId: string;
    visibility: "public" | "draft" | "hidden";
    operatorDiscordUserId: string;
    interactionId: string;
  }): Promise<MutationSuccess | StoreError>;
  restoreFromAudit(input: {
    musicianId: string;
    auditLogId: string;
    state: "before" | "after";
    operatorDiscordUserId: string;
    interactionId: string;
  }): Promise<MutationSuccess | StoreError>;
  listRecentAuditLogs(
    musicianId: string,
    limit: number,
  ): Promise<AuditLogSummary[]>;
  /** 拒否・失敗の監査。ベストエフォートで、失敗しても例外を投げない。 */
  recordFailure(entry: FailureAuditEntry): Promise<void>;
  /** 期限切れsessionの後始末。ベストエフォート。 */
  cleanupExpiredSessions(): Promise<void>;
}

type MusicianRow = {
  id: string;
  slug: string;
  display_name: string;
  name_jp: string;
  name_en: string;
  roles: string[] | null;
  aliases: string[] | null;
  primary_sns_url: string | null;
  website_url: string | null;
  icon_image_url: string | null;
  vrc_name: string | null;
  visibility: string;
  version: number;
  is_locked: boolean;
  musician_links?: LinkRow[];
};

type LinkRow = {
  platform: string | null;
  label: string | null;
  url: string;
  display_order: number | null;
  is_public: boolean | null;
};

type SessionRow = {
  session_id: string;
  discord_interaction_id: string;
  discord_user_id: string;
  musician_id: string;
  base_version: number;
  validated_payload: ValidatedProfilePayload;
  expires_at: string;
  consumed_at: string | null;
};

const MUSICIAN_SELECT =
  "id, slug, display_name, name_jp, name_en, roles, aliases, primary_sns_url, " +
  "website_url, icon_image_url, vrc_name, visibility, version, is_locked, " +
  "musician_links (platform, label, url, display_order, is_public)";

const SESSION_SELECT =
  "session_id, discord_interaction_id, discord_user_id, musician_id, " +
  "base_version, validated_payload, expires_at, consumed_at";

function mapMusician(row: MusicianRow): MusicianEditState {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    nameJp: row.name_jp,
    nameEn: row.name_en,
    roles: row.roles ?? [],
    aliases: row.aliases ?? [],
    primarySnsUrl: row.primary_sns_url,
    websiteUrl: row.website_url,
    iconImageUrl: row.icon_image_url,
    vrcName: row.vrc_name,
    visibility: row.visibility,
    version: row.version,
    isLocked: row.is_locked,
    links: (row.musician_links ?? [])
      .filter((link) => link.is_public !== false)
      .map((link) => ({
        platform: link.platform ?? "other",
        label: link.label,
        url: link.url,
        displayOrder: link.display_order ?? 0,
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder),
  };
}

function mapSession(row: SessionRow): SessionRecord {
  return {
    sessionId: row.session_id,
    discordInteractionId: row.discord_interaction_id,
    discordUserId: row.discord_user_id,
    musicianId: row.musician_id,
    baseVersion: row.base_version,
    validatedPayload: row.validated_payload,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
  };
}

type RpcResult = { ok: boolean; error_code?: string; [key: string]: unknown };

function mapRpc(
  data: unknown,
  error: { message: string } | null,
  toSuccess: (result: RpcResult) => Record<string, unknown>,
): (Record<string, unknown> & { ok: true }) | StoreError {
  if (error) return { ok: false, errorCode: "db_error" };
  const result = data as RpcResult | null;
  if (!result || result.ok !== true) {
    return { ok: false, errorCode: result?.error_code ?? "db_error" };
  }
  return { ok: true, ...toSuccess(result) } as Record<string, unknown> & {
    ok: true;
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createSupabaseIntakeStore(
  client: SupabaseClient,
): IntakeStore {
  return {
    async findActiveRepresentative(discordUserId) {
      const { data } = await client
        .from("musician_representatives")
        .select("musician_id, discord_user_id")
        .eq("discord_user_id", discordUserId)
        .eq("is_active", true)
        .maybeSingle();
      if (!data) return null;
      return {
        musicianId: data.musician_id,
        discordUserId: data.discord_user_id,
      };
    },

    async getMusician(musicianId) {
      const { data } = await client
        .from("musicians")
        .select(MUSICIAN_SELECT)
        .eq("id", musicianId)
        .maybeSingle();
      return data ? mapMusician(data as unknown as MusicianRow) : null;
    },

    async findMusicianBySlugOrId(slugOrId) {
      const column = UUID_PATTERN.test(slugOrId) ? "id" : "slug";
      const { data } = await client
        .from("musicians")
        .select(MUSICIAN_SELECT)
        .eq(column, slugOrId)
        .maybeSingle();
      return data ? mapMusician(data as unknown as MusicianRow) : null;
    },

    async createSession(input) {
      const { data, error } = await client
        .from("profile_update_sessions")
        .insert({
          discord_interaction_id: input.discordInteractionId,
          discord_user_id: input.discordUserId,
          musician_id: input.musicianId,
          base_version: input.baseVersion,
          submitted_payload: input.submittedPayload,
          validated_payload: input.validatedPayload,
          expires_at: input.expiresAt,
        })
        .select(SESSION_SELECT)
        .single();
      if (error || !data) {
        return {
          ok: false,
          errorCode:
            error?.code === "23505" ? "duplicate_interaction" : "db_error",
        };
      }
      return mapSession(data as unknown as SessionRow);
    },

    async getSession(sessionId) {
      if (!UUID_PATTERN.test(sessionId)) return null;
      const { data } = await client
        .from("profile_update_sessions")
        .select(SESSION_SELECT)
        .eq("session_id", sessionId)
        .maybeSingle();
      return data ? mapSession(data as unknown as SessionRow) : null;
    },

    async cancelSession(sessionId) {
      await client
        .from("profile_update_sessions")
        .update({ consumed_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .is("consumed_at", null);
    },

    async confirmSession(sessionId, discordUserId, interactionId) {
      const { data, error } = await client.rpc(
        "confirm_profile_update_session",
        {
          p_session_id: sessionId,
          p_discord_user_id: discordUserId,
          p_interaction_id: interactionId,
        },
      );
      return mapRpc(data, error, (result) => ({
        slug: String(result.slug ?? ""),
        newVersion: Number(result.new_version ?? 0),
        changedFields: Array.isArray(result.changed_fields)
          ? (result.changed_fields as string[])
          : [],
      })) as ConfirmSuccess | StoreError;
    },

    async setLock(input) {
      const { data, error } = await client.rpc("set_musician_lock", {
        p_musician_id: input.musicianId,
        p_locked: input.locked,
        p_reason: input.reason,
        p_actor_discord_user_id: input.actorDiscordUserId,
        p_actor_kind: input.actorKind,
        p_interaction_id: input.interactionId,
      });
      return mapRpc(data, error, (result) => ({
        slug: String(result.slug ?? ""),
      })) as MutationSuccess | StoreError;
    },

    async setRepresentative(input) {
      const { data, error } = await client.rpc("set_musician_representative", {
        p_musician_id: input.musicianId,
        p_discord_user_id: input.discordUserId,
        p_discord_username_snapshot: input.discordUsernameSnapshot,
        p_operator_discord_user_id: input.operatorDiscordUserId,
        p_interaction_id: input.interactionId,
      });
      return mapRpc(data, error, (result) => ({
        slug: String(result.slug ?? ""),
      })) as MutationSuccess | StoreError;
    },

    async setVisibility(input) {
      const { data, error } = await client.rpc("set_musician_visibility", {
        p_musician_id: input.musicianId,
        p_visibility: input.visibility,
        p_operator_discord_user_id: input.operatorDiscordUserId,
        p_interaction_id: input.interactionId,
      });
      return mapRpc(data, error, (result) => ({
        slug: String(result.slug ?? ""),
      })) as MutationSuccess | StoreError;
    },

    async restoreFromAudit(input) {
      const { data, error } = await client.rpc("restore_musician_from_audit", {
        p_musician_id: input.musicianId,
        p_audit_log_id: input.auditLogId,
        p_state: input.state,
        p_operator_discord_user_id: input.operatorDiscordUserId,
        p_interaction_id: input.interactionId,
      });
      return mapRpc(data, error, (result) => ({
        slug: String(result.slug ?? ""),
      })) as MutationSuccess | StoreError;
    },

    async listRecentAuditLogs(musicianId, limit) {
      const { data } = await client
        .from("musician_audit_logs")
        .select("id, action, result, changed_fields, created_at")
        .eq("musician_id", musicianId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []).map((row) => ({
        id: row.id,
        action: row.action,
        result: row.result,
        changedFields: row.changed_fields ?? [],
        createdAt: row.created_at,
      }));
    },

    async recordFailure(entry) {
      try {
        await client.from("musician_audit_logs").insert({
          musician_id: entry.musicianId,
          actor_discord_user_id: entry.actorDiscordUserId,
          actor_kind: entry.actorKind,
          action: entry.action,
          changed_fields: [],
          interaction_id: entry.interactionId,
          result: entry.result,
          error_code: entry.errorCode,
        });
      } catch {
        // 監査の失敗記録はベストエフォート。ここでの失敗で応答を壊さない。
      }
    },

    async cleanupExpiredSessions() {
      try {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await client
          .from("profile_update_sessions")
          .delete()
          .lt("expires_at", cutoff);
      } catch {
        // ベストエフォート。
      }
    },
  };
}
