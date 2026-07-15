import type { DiscordConfig } from "./config";
import type { Interaction } from "./types";

/**
 * API側の再認可。Discord側のcommand permissionやrole設定は操作ミスを
 * 減らす補助にすぎず、ここで毎回guild、member、roleを確認する。
 * roles配列はDiscordが署名済みpayloadに含めるサーバー側情報である。
 */

export type AuthorizedActor = {
  ok: true;
  userId: string;
  username: string;
  isMember: boolean;
  isOperator: boolean;
};

export type AuthorizationFailure = {
  ok: false;
  errorCode: "wrong_guild" | "not_guild_member" | "missing_role";
  message: string;
};

export type AuthorizationResult = AuthorizedActor | AuthorizationFailure;

export function authorizeInteraction(
  interaction: Interaction,
  config: DiscordConfig,
): AuthorizationResult {
  if (!interaction.guild_id || interaction.guild_id !== config.guildId) {
    return {
      ok: false,
      errorCode: "wrong_guild",
      message: "このコマンドはEMN Recordsサーバー内でのみ使えます。",
    };
  }
  const member = interaction.member;
  const userId = member?.user?.id;
  if (!member || !userId) {
    return {
      ok: false,
      errorCode: "not_guild_member",
      message: "サーバーメンバー情報を確認できませんでした。",
    };
  }
  const roles = Array.isArray(member.roles) ? member.roles : [];
  const isMember = roles.includes(config.memberRoleId);
  const isOperator = roles.includes(config.operatorRoleId);
  if (!isMember && !isOperator) {
    return {
      ok: false,
      errorCode: "missing_role",
      message: "この操作に必要なロールがありません。",
    };
  }
  return {
    ok: true,
    userId,
    username:
      member.user?.global_name || member.user?.username || "(unknown)",
    isMember,
    isOperator,
  };
}

/** 本人向け操作: memberロール(または運営者ロール)が必要。 */
export function requireMember(
  result: AuthorizationResult,
): result is AuthorizedActor {
  return result.ok && (result.isMember || result.isOperator);
}

/** 運営者向け操作: operatorロールを操作時点で再確認する。 */
export function requireOperator(
  result: AuthorizationResult,
): result is AuthorizedActor {
  return result.ok && result.isOperator;
}
