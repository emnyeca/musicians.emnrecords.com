/**
 * Server-side upload validation for standing assets.
 *
 * Allowlist-only: anything not explicitly allowed is rejected
 * (svg / html / zip / pdf / psd / clip / executables / unknown types).
 */

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_ASSETS_PER_MUSICIAN = 5;

export const ALLOWED_MIME_TYPES = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);

export type UploadFileValidation =
  | { ok: true; extension: string }
  | { ok: false; reason: string };

export function validateUploadFile(input: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): UploadFileValidation {
  if (input.sizeBytes <= 0) {
    return { ok: false, reason: "File is empty." };
  }
  if (input.sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      reason: `File is too large (max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB).`,
    };
  }
  const extension = ALLOWED_MIME_TYPES.get(input.mimeType.toLowerCase());
  if (!extension) {
    return {
      ok: false,
      reason: "File type not allowed. Only PNG / JPEG / WebP are accepted.",
    };
  }
  const nameExt = input.filename.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(nameExt)) {
    return {
      ok: false,
      reason: "File extension not allowed. Only .png / .jpg / .jpeg / .webp are accepted.",
    };
  }
  return { ok: true, extension };
}
