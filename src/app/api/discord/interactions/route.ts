import { revalidatePath } from "next/cache";
import { after, NextResponse } from "next/server";
import { getDiscordConfig } from "@/lib/discord/config";
import { handleInteraction } from "@/lib/discord/handlers";
import { isRateLimited } from "@/lib/discord/rate-limit";
import {
  editOriginalInteractionResponse,
  sendAuditChannelNotification,
} from "@/lib/discord/rest";
import { createSupabaseIntakeStore } from "@/lib/discord/store";
import { verifyDiscordSignature } from "@/lib/discord/verify";
import {
  InteractionResponseType,
  InteractionType,
  MessageFlags,
  type Interaction,
} from "@/lib/discord/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getSupabaseServerClient,
  hasSupabaseServiceRole,
} from "@/lib/supabase/server";

/**
 * Discord HTTP Interactions Endpoint。
 *
 * - すべてのrequestでraw bodyに対する`X-Signature-Ed25519`と
 *   `X-Signature-Timestamp`を検証し、失敗は401で拒否する。
 * - PINGへはPONGを返し、他のinteractionは3秒以内に初回応答する。
 * - 時間のかかる確定処理はdeferし、`after()`で15分以内にfollow-upする。
 * - `SUPABASE_SECRET_KEY`はこのserver境界の外(応答、通知、ログ)へ出さない。
 */

export const runtime = "nodejs";

function serviceUnavailable(): NextResponse {
  // Discordには200で内容不明のephemeralエラーを返すより、設定不備を
  // 5xxで返してDeveloper Portal側の検証を失敗させる方が安全である。
  return NextResponse.json({ error: "not configured" }, { status: 503 });
}

export async function POST(request: Request) {
  const config = getDiscordConfig();
  if (!config) return serviceUnavailable();

  const rawBody = await request.text();
  const verified = verifyDiscordSignature({
    publicKeyHex: config.publicKey,
    signatureHex: request.headers.get("x-signature-ed25519"),
    timestamp: request.headers.get("x-signature-timestamp"),
    rawBody,
  });
  if (!verified) {
    return NextResponse.json({ error: "invalid request signature" }, {
      status: 401,
    });
  }

  let interaction: Interaction;
  try {
    interaction = JSON.parse(rawBody) as Interaction;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (interaction.type === InteractionType.Ping) {
    return NextResponse.json({ type: InteractionResponseType.Pong });
  }

  const actorId = interaction.member?.user?.id ?? interaction.user?.id;
  if (actorId && isRateLimited(actorId)) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "操作が連続しています。しばらく待ってからやり直してください。",
        flags: MessageFlags.Ephemeral,
      },
    });
  }

  if (!isSupabaseConfigured() || !hasSupabaseServiceRole()) {
    return serviceUnavailable();
  }
  const supabase = getSupabaseServerClient();
  if (!supabase) return serviceUnavailable();

  const result = await handleInteraction(interaction, {
    store: createSupabaseIntakeStore(supabase),
    config,
    notify: (content) => sendAuditChannelNotification(config, content),
    editOriginal: (token, body) =>
      editOriginalInteractionResponse(config, token, body),
    revalidate: (slug) => {
      try {
        revalidatePath("/musicians");
        if (slug) revalidatePath(`/musicians/${slug}`);
      } catch {
        // 再検証失敗は反映自体を妨げない。
      }
    },
    now: () => new Date(),
  });

  if (result.after) {
    const followUp = result.after;
    after(async () => {
      try {
        await followUp();
      } catch {
        // follow-up失敗時もtokenや秘密情報をログへ出さない。
        console.warn("discord interaction follow-up failed");
      }
    });
  }

  return NextResponse.json(result.response);
}
