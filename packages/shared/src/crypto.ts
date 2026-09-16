import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const PREFIX = "v1";

export class SecretKeyError extends Error {}
export class DecryptError extends Error {}

/**
 * Reads the master key used for node passwords. Accepts base64 or hex so the
 * operator can paste whatever their generator produced.
 */
export function loadSecretKey(raw: string | undefined): Buffer {
  if (!raw) {
    throw new SecretKeyError(
      "ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32",
    );
  }
  const candidates = [
    /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : null,
    Buffer.from(raw, "base64"),
  ].filter((b): b is Buffer => b !== null && b.length === KEY_BYTES);

  const key = candidates[0];
  if (!key) {
    throw new SecretKeyError(
      `ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (base64 or hex).`,
    );
  }
  return key;
}

export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ct.toString("base64url"),
  ].join(".");
}

export function decryptSecret(payload: string, key: Buffer): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new DecryptError("ciphertext is not in the v1 format");
  }
  const [, ivPart, tagPart, ctPart] = parts as [string, string, string, string];
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ctPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // A wrong key and a tampered payload both land here, and the caller must
    // not be able to tell them apart from the message.
    throw new DecryptError("could not decrypt: wrong key or altered payload");
  }
}

/** Constant-time compare for short shared secrets (internal API tokens). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
