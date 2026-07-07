/**
 * WordPress REST API media upload (server-side only).
 *
 * The Application Password is read from server environment variables and is
 * never sent to the browser. Uploads go:
 *   browser → Next.js route → WordPress REST API → WordPress uploads (ConoHa)
 */

export type WordPressMediaResult = {
  mediaId: number;
  sourceUrl: string;
};

export function isWordPressConfigured(): boolean {
  return Boolean(
    process.env.WORDPRESS_BASE_URL &&
      process.env.WORDPRESS_UPLOAD_USERNAME &&
      process.env.WORDPRESS_APPLICATION_PASSWORD,
  );
}

export async function uploadToWordPressMedia(input: {
  fileBuffer: ArrayBuffer;
  storedFilename: string;
  mimeType: string;
  title: string;
}): Promise<WordPressMediaResult> {
  const baseUrl = process.env.WORDPRESS_BASE_URL?.replace(/\/+$/, "");
  const username = process.env.WORDPRESS_UPLOAD_USERNAME;
  const appPassword = process.env.WORDPRESS_APPLICATION_PASSWORD;
  if (!baseUrl || !username || !appPassword) {
    throw new Error("WordPress upload is not configured.");
  }

  const auth = Buffer.from(`${username}:${appPassword}`).toString("base64");
  const response = await fetch(`${baseUrl}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": input.mimeType,
      "Content-Disposition": `attachment; filename="${input.storedFilename}"`,
    },
    body: input.fileBuffer,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `WordPress media upload failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }

  const json = (await response.json()) as {
    id?: number;
    source_url?: string;
  };
  if (!json.id || !json.source_url) {
    throw new Error("WordPress media upload returned an unexpected response.");
  }

  // Set a readable title on the media item (best effort; failure is non-fatal).
  try {
    await fetch(`${baseUrl}/wp-json/wp/v2/media/${json.id}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: input.title }),
    });
  } catch {
    // ignore
  }

  return { mediaId: json.id, sourceUrl: json.source_url };
}
