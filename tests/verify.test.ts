import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyDiscordSignature } from "@/lib/discord/verify";

function makeKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyHex = publicKey
    .export({ format: "der", type: "spki" })
    .subarray(-32)
    .toString("hex");
  return { publicKeyHex, privateKey };
}

describe("verifyDiscordSignature", () => {
  const { publicKeyHex, privateKey } = makeKeyPair();
  const body = JSON.stringify({ type: 1 });
  const timestamp = "1700000000";
  const signatureHex = sign(
    null,
    Buffer.from(timestamp + body, "utf8"),
    privateKey,
  ).toString("hex");

  it("正しい署名を受理する", () => {
    expect(
      verifyDiscordSignature({
        publicKeyHex,
        signatureHex,
        timestamp,
        rawBody: body,
      }),
    ).toBe(true);
  });

  it("bodyが改ざんされた署名を拒否する", () => {
    expect(
      verifyDiscordSignature({
        publicKeyHex,
        signatureHex,
        timestamp,
        rawBody: body + " ",
      }),
    ).toBe(false);
  });

  it("timestampが改ざんされた署名を拒否する", () => {
    expect(
      verifyDiscordSignature({
        publicKeyHex,
        signatureHex,
        timestamp: "1700000001",
        rawBody: body,
      }),
    ).toBe(false);
  });

  it("別の鍵の署名を拒否する", () => {
    const other = makeKeyPair();
    expect(
      verifyDiscordSignature({
        publicKeyHex: other.publicKeyHex,
        signatureHex,
        timestamp,
        rawBody: body,
      }),
    ).toBe(false);
  });

  it("header欠落・不正hexを拒否する", () => {
    expect(
      verifyDiscordSignature({
        publicKeyHex,
        signatureHex: null,
        timestamp,
        rawBody: body,
      }),
    ).toBe(false);
    expect(
      verifyDiscordSignature({
        publicKeyHex,
        signatureHex,
        timestamp: null,
        rawBody: body,
      }),
    ).toBe(false);
    expect(
      verifyDiscordSignature({
        publicKeyHex,
        signatureHex: "zz".repeat(64),
        timestamp,
        rawBody: body,
      }),
    ).toBe(false);
    expect(
      verifyDiscordSignature({
        publicKeyHex: "short",
        signatureHex,
        timestamp,
        rawBody: body,
      }),
    ).toBe(false);
  });
});
