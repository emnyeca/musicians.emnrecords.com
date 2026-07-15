import type { DiscordConfig } from "./config";

/**
 * Discord REST APIの薄いwrapper。
 * Bot tokenやinteraction tokenをログ・例外・応答へ含めないこと。
 */

const DISCORD_API_BASE = "https://discord.com/api/v10";

async function discordFetch(
  path: string,
  init: RequestInit,
): Promise<boolean> {
  try {
    const response = await fetch(`${DISCORD_API_BASE}${path}`, init);
    if (!response.ok) {
      // tokenを含むURLやheaderは出力しない。
      console.warn(
        `discord api ${init.method ?? "GET"} ${path.split("/").slice(0, 3).join("/")}: status ${response.status}`,
      );
      return false;
    }
    return true;
  } catch {
    console.warn("discord api request failed");
    return false;
  }
}

/**
 * deferred応答後にinteractionの元メッセージを編集する。
 * interaction tokenの有効期限は15分。
 */
export async function editOriginalInteractionResponse(
  config: DiscordConfig,
  interactionToken: string,
  body: Record<string, unknown>,
): Promise<boolean> {
  return discordFetch(
    `/webhooks/${config.applicationId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

/**
 * 限定監査チャンネルへの通知。Bot tokenと監査チャンネルが未設定なら
 * 送らずfalseを返す。通知失敗でDB側の監査記録は失われない
 * (DB commit後にのみ呼ぶこと)。
 */
export async function sendAuditChannelNotification(
  config: DiscordConfig,
  content: string,
): Promise<boolean> {
  if (!config.botToken || !config.auditChannelId) return false;
  return discordFetch(`/channels/${config.auditChannelId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${config.botToken}`,
    },
    body: JSON.stringify({
      content,
      allowed_mentions: { parse: [] },
    }),
  });
}
