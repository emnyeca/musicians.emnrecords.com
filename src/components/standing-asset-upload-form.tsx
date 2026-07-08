"use client";

import { useRef, useState, type FormEvent } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/assets/validation";
import { formatFileSize } from "@/lib/utils/file";

export type UploadMusicianOption = {
  id: string;
  slug: string;
  displayName: string;
};

type UploadResult = {
  ok: boolean;
  error?: string;
  asset_id?: string | null;
  file_url?: string;
  simulated?: boolean;
  warnings?: string[];
};

/** Shape of WordPress core's own REST error responses (not this plugin's). */
type WordPressRestError = {
  code?: string;
  message?: string;
};

/**
 * Turns a failed-to-parse-as-JSON response into a diagnosis.
 *
 * A 404 that isn't JSON usually means the request never reached WordPress's
 * REST dispatcher at all (Apache/WAF/security-plugin serving its own 404
 * page for /wp-json/*), which is a server/hosting problem, not a plugin bug.
 */
function describeNonJsonFailure(status: number): string {
  if (status === 404) {
    return (
      "WordPress endpointが404です。WordPress REST APIのroot（/wp-json/）自体が" +
      "無効になっている可能性があります。プラグインの問題ではなく、パーマリンク設定・" +
      ".htaccess・セキュリティプラグイン・WAFを確認してください（README「WordPress " +
      "REST API疎通確認」を参照）。"
    );
  }
  return `サーバーから予期しない応答が返りました（HTTP ${status}）。WordPress側のエラーログを確認してください。`;
}

/**
 * WordPress answered with valid JSON but not this plugin's { ok, ... }
 * contract — typically its own "no matching route" error, meaning REST API
 * itself works but the plugin's route isn't registered (not active /
 * namespace blocked / needs a permalink resave).
 */
function describeWordPressRestError(wpError: WordPressRestError): string {
  if (wpError.code === "rest_no_route") {
    return (
      "WordPress REST APIには到達していますが、endpoint " +
      "（emn-musicians/v1/standing-assets/upload）が見つかりません。" +
      "プラグインが有効化されていないか、route登録が読み込まれていない可能性があります" +
      "（README「WordPress REST API疎通確認」を参照。/wp-json/emn-musicians/v1/health " +
      "が開けるか確認してください）。"
    );
  }
  return wpError.message ?? "WordPressから予期しないエラー応答がありました。";
}

/**
 * Standing asset upload form.
 *
 * The file is POSTed directly from the browser to the WordPress custom
 * endpoint on ConoHa (NEXT_PUBLIC_WORDPRESS_ASSET_UPLOAD_ENDPOINT) so that
 * 20MB uploads never pass through Vercel. The endpoint verifies the shared
 * upload password server-side; Supabase secrets stay on the WordPress server.
 *
 * When the endpoint env var is not set (local development), the form falls
 * back to the legacy simulation route /api/upload-standing-asset.
 */

const WORDPRESS_UPLOAD_ENDPOINT =
  process.env.NEXT_PUBLIC_WORDPRESS_ASSET_UPLOAD_ENDPOINT;

const LEGACY_DEV_FALLBACK_ENDPOINT = "/api/upload-standing-asset";

/**
 * The dev simulation fallback must never silently stand in for a missing
 * production config — show an explicit admin-facing error instead.
 */
const MISSING_ENDPOINT_IN_PRODUCTION =
  !WORDPRESS_UPLOAD_ENDPOINT && process.env.NODE_ENV === "production";

export function StandingAssetUploadForm({
  musicians,
}: {
  musicians: UploadMusicianOption[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [requireCredit, setRequireCredit] = useState(false);
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const usingFallback = !WORDPRESS_UPLOAD_ENDPOINT;
  const endpoint = WORDPRESS_UPLOAD_ENDPOINT ?? LEGACY_DEV_FALLBACK_ENDPOINT;

  function handleFileChange(selected: File | null) {
    setClientError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!ALLOWED_MIME_TYPES.has(selected.type)) {
      setClientError(
        "この形式はアップロードできません（PNG / JPEG / WebPのみ）。",
      );
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setClientError(
        `ファイルが大きすぎます（最大 ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB）。`,
      );
      setFile(null);
      return;
    }
    setFile(selected);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || !consented || MISSING_ENDPOINT_IN_PRODUCTION) return;
    setSubmitting(true);
    setResult(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("file", file);
    data.set("consent", consented ? "true" : "false");

    // musician select carries "<id>::<slug>" — split for the endpoint.
    const musicianRef = data.get("musician_ref");
    data.delete("musician_ref");
    const [musicianId = "", musicianSlug = ""] =
      typeof musicianRef === "string" ? musicianRef.split("::") : [];
    data.set("musician_id", musicianId);
    data.set("musician_slug", musicianSlug);

    // Checkboxes as explicit "true"/"false" strings for the server.
    for (const key of [
      "allow_credit_use",
      "allow_thumbnail_use",
      "allow_cropping",
      "allow_color_adjustment",
      "require_credit",
    ]) {
      const el = form.elements.namedItem(key);
      const checked = el instanceof HTMLInputElement ? el.checked : false;
      data.set(key, checked ? "true" : "false");
    }

    try {
      const response = await fetch(endpoint, { method: "POST", body: data });
      const rawText = await response.text();
      let body: UploadResult;
      try {
        const parsed = JSON.parse(rawText) as UploadResult | WordPressRestError;
        body =
          typeof (parsed as UploadResult).ok === "boolean"
            ? (parsed as UploadResult)
            : {
                ok: false,
                error: describeWordPressRestError(parsed as WordPressRestError),
              };
      } catch {
        body = { ok: false, error: describeNonJsonFailure(response.status) };
      }
      setResult(body);
      if (body.ok) {
        formRef.current?.reset();
        setFile(null);
        setConsented(false);
        setRequireCredit(false);
      }
    } catch {
      setResult({
        ok: false,
        error:
          "通信に失敗しました（ネットワークエラーまたはCORS）。WordPress endpointの" +
          "URLとCORS設定（許可origin）を確認してください。",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex w-full max-w-2xl flex-col gap-5"
    >
      <div className="rounded-md border border-accent bg-accent-soft p-3">
        <p className="text-xs leading-relaxed text-ink">
          アップロードされた立ち絵素材のダウンロードページURLと共通パスワードは、
          EMN Recordsの確認済みDiscordメンバー向けチャンネル内で共有されます。
          登録する素材は、その範囲で共有・利用されることを許可できるものに
          してください。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="upload-musician">ミュージシャン *</Label>
          <Select
            id="upload-musician"
            name="musician_ref"
            required
            defaultValue=""
          >
            <option value="" disabled>
              選択してください
            </option>
            {musicians.map((m) => (
              <option key={m.id} value={`${m.id}::${m.slug}`}>
                {m.displayName}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="upload-title">素材タイトル *</Label>
          <Input
            id="upload-title"
            name="title"
            required
            maxLength={120}
            placeholder="例: 立ち絵（正面・ギター）"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="upload-file">
          ファイル *（PNG / JPEG / WebP、最大20MB）
        </Label>
        <input
          id="upload-file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          className="block w-full cursor-pointer rounded-md border border-line bg-background text-sm text-muted file:mr-3 file:h-10 file:cursor-pointer file:border-0 file:bg-surface file:px-4 file:text-xs file:font-medium file:text-ink"
        />
        {file ? (
          <p className="text-[11px] text-muted">
            {file.name}（{formatFileSize(file.size)}）
          </p>
        ) : null}
        {clientError ? (
          <p className="text-xs text-red-600">{clientError}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="upload-visibility">公開範囲</Label>
          <Select
            id="upload-visibility"
            name="visibility"
            defaultValue="members_only"
          >
            <option value="members_only">Members only（メンバー限定）</option>
            <option value="public">Public（公開）</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="upload-access-note">アクセスに関する注記</Label>
          <Input
            id="upload-access-note"
            name="access_note"
            maxLength={300}
            placeholder="例: 使用前にDiscordで一声かけてください"
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2 rounded-md border border-line p-3">
        <legend className="px-1 text-xs font-medium text-muted">
          利用許可の設定
        </legend>
        <CheckRow name="allow_credit_use" label="クレジットでの使用を許可" defaultChecked />
        <CheckRow name="allow_thumbnail_use" label="サムネイルでの使用を許可" defaultChecked />
        <CheckRow name="allow_cropping" label="トリミングを許可" defaultChecked />
        <CheckRow name="allow_color_adjustment" label="色調整を許可" />
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox
            name="require_credit"
            checked={requireCredit}
            onChange={(e) => setRequireCredit(e.target.checked)}
          />
          <span className="text-xs text-ink">クレジット表記を必須にする</span>
        </label>
        {requireCredit ? (
          <div className="mt-1 flex flex-col gap-1">
            <Label htmlFor="upload-credit-text">クレジット表記テキスト</Label>
            <Input
              id="upload-credit-text"
              name="credit_text"
              maxLength={200}
              placeholder="例: Illustration: ○○"
            />
          </div>
        ) : (
          <input type="hidden" name="credit_text" value="" />
        )}
      </fieldset>

      <div className="flex flex-col gap-1">
        <Label htmlFor="upload-usage-terms">利用条件（自由記述）</Label>
        <Textarea
          id="upload-usage-terms"
          name="usage_terms"
          rows={3}
          maxLength={1000}
          placeholder="例: EMN Records関連イベントの告知にのみ使用可。再配布禁止。"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="upload-password">アップロード用パスワード *</Label>
        <Input
          id="upload-password"
          name="password"
          type="password"
          required
          autoComplete="off"
          placeholder="Discordで共有されているアップロード用パスワード"
        />
        <p className="text-[11px] text-muted">
          パスワードはWordPressサーバー側で照合されます（このページを開く際の
          パスワードと同じものです）。
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-line bg-surface p-3">
        <Checkbox
          checked={consented}
          onChange={(e) => setConsented(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-xs leading-relaxed text-ink">
          私は、この素材をEMN Records関連のイベント告知、クレジット、
          サムネイル作成、出演者紹介のために使用できる権利または許可を
          持っています。
        </span>
      </label>

      {result ? (
        result.ok ? (
          <div className="rounded-md border border-line bg-surface p-3">
            <p className="text-xs font-medium text-ink">
              アップロードが完了しました。
            </p>
            {result.simulated ? (
              <p className="mt-1 text-[11px] text-amber-700">
                （開発モード: WordPress endpoint未設定のため、実ファイルは
                保存されていません）
              </p>
            ) : null}
            {result.file_url ? (
              <p className="mt-1 break-all text-[11px] text-muted">
                {result.file_url}
              </p>
            ) : null}
            {(result.warnings ?? []).map((warning) => (
              <p key={warning} className="mt-1 text-[11px] text-amber-700">
                ⚠ {warning}
              </p>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {result.error ?? "アップロードに失敗しました。"}
          </p>
        )
      ) : null}

      {MISSING_ENDPOINT_IN_PRODUCTION ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          WordPress upload endpoint is not configured.
          （NEXT_PUBLIC_WORDPRESS_ASSET_UPLOAD_ENDPOINT が未設定のため、
          アップロードできません。管理者はVercelの環境変数を確認してください）
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          variant="solid"
          disabled={
            submitting || !file || !consented || MISSING_ENDPOINT_IN_PRODUCTION
          }
          className="w-fit"
        >
          <Upload className="size-3.5" />
          {submitting ? "アップロード中…" : "アップロード"}
        </Button>
        {MISSING_ENDPOINT_IN_PRODUCTION ? null : (
          <p className="text-[11px] text-muted">
            {usingFallback
              ? "WordPress endpoint未設定のため、開発用ローカルAPI（シミュレーション）へ送信します。"
              : "ファイルはWordPress（ConoHa）へ直接アップロードされます。Vercelを経由しません。"}
          </p>
        )}
      </div>
    </form>
  );
}

function CheckRow({
  name,
  label,
  defaultChecked = false,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <Checkbox name={name} defaultChecked={defaultChecked} />
      <span className="text-xs text-ink">{label}</span>
    </label>
  );
}
