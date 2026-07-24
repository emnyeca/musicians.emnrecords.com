import { generateKeyPairSync, sign } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimiter } from "@/lib/discord/rate-limit";
import { POST } from "@/app/api/discord/interactions/route";

const SECRET_SENTINEL = "sb_secret_ROUTE_SENTINEL";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicKeyHex = publicKey
  .export({ format: "der", type: "spki" })
  .subarray(-32)
  .toString("hex");

function signedRequest(body: string, options: { valid?: boolean } = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = sign(
    null,
    Buffer.from(timestamp + body, "utf8"),
    privateKey,
  ).toString("hex");
  return new Request("https://example.com/api/discord/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Signature-Ed25519":
        options.valid === false ? "0".repeat(128) : signature,
      "X-Signature-Timestamp": timestamp,
    },
    body,
  });
}

beforeEach(() => {
  resetRateLimiter();
  process.env.DISCORD_APPLICATION_ID = "app-id";
  process.env.DISCORD_PUBLIC_KEY = publicKeyHex;
  process.env.DISCORD_GUILD_ID = "guild-1";
  process.env.DISCORD_MEMBER_ROLE_ID = "role-member";
  process.env.DISCORD_OPERATOR_ROLE_ID = "role-operator";
  process.env.SUPABASE_SECRET_KEY = SECRET_SENTINEL;
  // handler本体のテストはfake storeで行うため、ここではSupabase未設定経路を使う。
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

describe("POST /api/discord/interactions", () => {
  it("署名headerがないrequestを401で拒否する", async () => {
    const response = await POST(
      new Request("https://example.com/api/discord/interactions", {
        method: "POST",
        body: JSON.stringify({ type: 1 }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("不正な署名を401で拒否する", async () => {
    const response = await POST(
      signedRequest(JSON.stringify({ type: 1 }), { valid: false }),
    );
    expect(response.status).toBe(401);
  });

  it("正しく署名されたPINGへPONGを返す", async () => {
    const response = await POST(signedRequest(JSON.stringify({ type: 1 })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ type: 1 });
  });

  it("署名済みでもbodyが壊れていれば400を返す", async () => {
    const response = await POST(signedRequest("{not-json"));
    expect(response.status).toBe(400);
  });

  it("Supabase未設定ならcommandに503を返す(不明応答でDiscord検証を通さない)", async () => {
    const response = await POST(
      signedRequest(
        JSON.stringify({
          type: 2,
          id: "i-1",
          token: "t",
          application_id: "app-id",
          guild_id: "guild-1",
          member: { user: { id: "u1" }, roles: ["role-member"] },
          data: { name: "emn-profile" },
        }),
      ),
    );
    expect(response.status).toBe(503);
  });

  it("応答bodyへSUPABASE_SECRET_KEYを露出しない", async () => {
    const ping = await POST(signedRequest(JSON.stringify({ type: 1 })));
    const command = await POST(
      signedRequest(
        JSON.stringify({
          type: 2,
          id: "i-2",
          token: "t",
          application_id: "app-id",
          guild_id: "wrong-guild",
          member: { user: { id: "u1" }, roles: [] },
          data: { name: "emn-profile" },
        }),
      ),
    );
    expect(await ping.text()).not.toContain(SECRET_SENTINEL);
    expect(await command.text()).not.toContain(SECRET_SENTINEL);
  });

  it("Discord設定が未完了なら503を返す", async () => {
    delete process.env.DISCORD_PUBLIC_KEY;
    const response = await POST(signedRequest(JSON.stringify({ type: 1 })));
    expect(response.status).toBe(503);
  });
});
