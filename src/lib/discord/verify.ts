import { createPublicKey, verify as cryptoVerify } from "node:crypto";

// Ed25519 raw public key (32 bytes) をSPKI DERへ包むための固定ヘッダ。
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/**
 * Discord HTTP Interactionsのrequest署名を検証する。
 * `X-Signature-Ed25519` と `X-Signature-Timestamp` を、パース前の
 * raw request bodyに対して検証しなければならない。
 */
export function verifyDiscordSignature(input: {
  publicKeyHex: string;
  signatureHex: string | null;
  timestamp: string | null;
  rawBody: string;
}): boolean {
  const { publicKeyHex, signatureHex, timestamp, rawBody } = input;
  if (!signatureHex || !timestamp) return false;
  if (!/^[0-9a-fA-F]{64}$/.test(publicKeyHex)) return false;
  if (!/^[0-9a-fA-F]{128}$/.test(signatureHex)) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, "hex")]),
      format: "der",
      type: "spki",
    });
    return cryptoVerify(
      null,
      Buffer.from(timestamp + rawBody, "utf8"),
      key,
      Buffer.from(signatureHex, "hex"),
    );
  } catch {
    return false;
  }
}
