/**
 * Discord Interaction受付のserver専用設定。
 *
 * すべてserver-only環境変数から読む。値をinteraction response、通知、
 * ログ、browserへ出力しないこと。SUPABASE_SECRET_KEYはここでは扱わない。
 */
export type DiscordConfig = {
  applicationId: string;
  publicKey: string;
  guildId: string;
  memberRoleId: string;
  operatorRoleId: string;
  botToken: string | null;
  auditChannelId: string | null;
};

export function getDiscordConfig(): DiscordConfig | null {
  const applicationId = process.env.DISCORD_APPLICATION_ID?.trim();
  const publicKey = process.env.DISCORD_PUBLIC_KEY?.trim();
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  const memberRoleId = process.env.DISCORD_MEMBER_ROLE_ID?.trim();
  const operatorRoleId = process.env.DISCORD_OPERATOR_ROLE_ID?.trim();
  if (
    !applicationId ||
    !publicKey ||
    !guildId ||
    !memberRoleId ||
    !operatorRoleId
  ) {
    return null;
  }
  return {
    applicationId,
    publicKey,
    guildId,
    memberRoleId,
    operatorRoleId,
    botToken: process.env.DISCORD_BOT_TOKEN?.trim() || null,
    auditChannelId: process.env.DISCORD_AUDIT_CHANNEL_ID?.trim() || null,
  };
}
