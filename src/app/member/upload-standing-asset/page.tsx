import type { Metadata } from "next";
import Link from "next/link";
import { AccessLogoutButton, PasswordGate } from "@/components/password-gate";
import {
  StandingAssetUploadForm,
  type UploadMusicianOption,
} from "@/components/standing-asset-upload-form";
import { hasValidAccess } from "@/lib/assets/access";
import { getPublicMusicians } from "@/lib/data/musicians";

export const metadata: Metadata = {
  title: "Upload Standing Asset (Members)",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UploadStandingAssetPage() {
  const authorized = await hasValidAccess("asset-upload");

  if (!authorized) {
    return (
      <PasswordGate
        endpoint="/api/asset-upload-access"
        title="Upload Standing Asset"
        description="立ち絵素材のアップロードページです。ダウンロード用とは別の、アップロード用パスワードを入力してください。"
      />
    );
  }

  const musicians = await getPublicMusicians();
  const options: UploadMusicianOption[] = musicians.map((m) => ({
    id: m.id,
    slug: m.slug,
    displayName: m.displayName,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Upload Standing Asset
          </h1>
          <p className="text-sm text-muted">
            立ち絵素材をWordPress（ConoHa）へアップロードし、名鑑に登録します
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/member/standing-assets"
            className="inline-flex h-8 items-center rounded-md border border-line bg-background px-3 text-xs text-ink hover:bg-surface"
          >
            ダウンロードページ
          </Link>
          <AccessLogoutButton endpoint="/api/asset-upload-access" />
        </div>
      </div>
      <StandingAssetUploadForm musicians={options} />
    </div>
  );
}
