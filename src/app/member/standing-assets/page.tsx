import type { Metadata } from "next";
import Link from "next/link";
import type { StandingAsset } from "@/types/musician";
import { IconImage } from "@/components/icon-image";
import { AccessLogoutButton, PasswordGate } from "@/components/password-gate";
import { StandingAssetCard } from "@/components/standing-asset-card";
import { hasValidAccess } from "@/lib/assets/access";
import { getStandingAssetsForMembers } from "@/lib/assets/standing-assets";

export const metadata: Metadata = {
  title: "Standing Assets (Members)",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MemberStandingAssetsPage() {
  const authorized = await hasValidAccess("member-download");

  if (!authorized) {
    return (
      <PasswordGate
        endpoint="/api/member-access"
        title="Standing Assets"
        description="立ち絵素材のダウンロードページです。EMN Recordsの確認済みメンバー向けに共有されている共通パスワードを入力してください。"
      />
    );
  }

  const assets = await getStandingAssetsForMembers();
  const groups = groupByMusician(assets);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Standing Assets
          </h1>
          <p className="text-sm text-muted">
            告知サムネイル・クレジット制作用の立ち絵素材（メンバー向け）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/member/upload-standing-asset"
            className="inline-flex h-8 items-center rounded-md border border-line bg-background px-3 text-xs text-ink hover:bg-surface"
          >
            素材をアップロード
          </Link>
          <AccessLogoutButton endpoint="/api/member-access" />
        </div>
      </div>

      <div className="rounded-md border border-line bg-surface p-3">
        <p className="text-[11px] leading-relaxed text-muted">
          注意:
          素材ファイルはWordPress（ConoHa）上の通常のURLで保管されています。
          このページは共通パスワードで保護されていますが、ファイルURL自体が
          外部に漏れた場合は直接アクセスされる可能性があります。URLの再共有は
          しないでください。
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          まだ素材が登録されていません。
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.musicianId} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <IconImage
                  src={group.iconImageUrl}
                  name={group.displayName}
                  initialsSource={group.nameEn}
                  className="w-10 rounded-full"
                />
                <div>
                  <h2 className="text-sm font-medium text-ink">
                    {group.displayName}
                  </h2>
                  <p className="text-xs text-muted">{group.roles.join(" / ")}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {group.assets.map((asset) => (
                  <StandingAssetCard key={asset.id} asset={asset} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

type AssetGroup = {
  musicianId: string;
  displayName: string;
  nameEn: string;
  roles: string[];
  iconImageUrl: string | null;
  assets: StandingAsset[];
};

function groupByMusician(assets: StandingAsset[]): AssetGroup[] {
  const map = new Map<string, AssetGroup>();
  for (const asset of assets) {
    const key = asset.musicianId;
    const existing = map.get(key);
    if (existing) {
      existing.assets.push(asset);
      continue;
    }
    map.set(key, {
      musicianId: key,
      displayName: asset.musician?.displayName ?? "Unknown musician",
      nameEn: asset.musician?.nameEn ?? "",
      roles: asset.musician?.roles ?? [],
      iconImageUrl: asset.musician?.iconImageUrl ?? null,
      assets: [asset],
    });
  }
  return [...map.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "ja"),
  );
}
