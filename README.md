# EMN Records Musician Directory & Credit Builder

EMN Records公式のミュージシャン名鑑・クレジット生成・立ち絵素材配布ツール。

公開予定URL: `https://musicians.emnrecords.com`（`NEXT_PUBLIC_APP_URL`で管理。ハードコードしない）

## 目的

1. バーチャルミュージシャンの公開名鑑として、外部への広報・導線になる
2. イベンターが出演者を選択し、クレジット表記を簡単に生成できる
3. 告知サムネイル・クレジット制作用の立ち絵素材を、確認済みメンバーが簡単にダウンロードできる

通常時は「ミュージシャン名鑑」として見え、クレジット生成は必要なときだけONにする便利機能。立ち絵素材は公開名鑑とは別の、共通パスワード保護されたメンバー向けページで扱う。

## 技術スタック

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase PostgreSQL（未設定時はmockデータで全画面動作）
- WordPress REST API + ConoHa WING上のWordPress uploads（立ち絵ファイル置き場）
- Vercel deploy想定

## ローカル起動

```bash
npm install
npm run dev
```

環境変数なしで起動でき、mockデータ（`src/lib/data/mock-*.ts`）で全画面が動く。

開発時のみ、パスワード未設定の場合は以下のフォールバックが有効:

- ダウンロードページ（`/member/standing-assets`）: `member-dev`
- アップロードページ（`/member/upload-standing-asset`）: `upload-dev`

本番（`NODE_ENV=production`）ではフォールバックは無効。環境変数の設定が必須。

## 主要画面

| パス | 内容 |
| --- | --- |
| `/musicians` | 名鑑一覧。検索・role絞り込み・クレジット作成モード |
| `/musicians/[slug]` | 詳細ページ（OGP対応） |
| `/credit-builder` | クレジット生成。一時編集・並び替え・7形式出力 |
| `/member/standing-assets` | 立ち絵ダウンロード（共通パスワード、noindex） |
| `/member/upload-standing-asset` | 立ち絵アップロード（別パスワード、noindex） |
| `/admin` | v0.1では設定状況の確認のみ（noindex） |

## 環境変数

`.env.example` を `.env.local` にコピーして設定する。

### Public（ブラウザに公開される）

| 変数 | 内容 |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | 公開URL。本番は `https://musicians.emnrecords.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key（`NEXT_PUBLIC_SUPABASE_ANON_KEY`でも可） |

### Server-only（絶対に `NEXT_PUBLIC` を付けない）

| 変数 | 内容 |
| --- | --- |
| `SUPABASE_SECRET_KEY` | Supabase secret (service_role) key。members_only素材の取得とmetadata保存に必要 |
| `WORDPRESS_BASE_URL` | WordPressサイトURL（例: `https://emnrecords.com`） |
| `WORDPRESS_UPLOAD_USERNAME` | アップロード専用WordPressユーザー名 |
| `WORDPRESS_APPLICATION_PASSWORD` | 上記ユーザーのApplication Password |
| `MEMBER_DOWNLOAD_PASSWORD_HASH` | ダウンロードページ共通パスワードのsha256 hexハッシュ（推奨） |
| `MEMBER_DOWNLOAD_PASSWORD` | 同・平文（v0.1の暫定。本番はhashへ移行すること） |
| `ASSET_UPLOAD_PASSWORD_HASH` | アップロードページパスワードのハッシュ。**download用と必ず別にする** |
| `ASSET_UPLOAD_PASSWORD` | 同・平文（暫定） |
| `ACCESS_TOKEN_SECRET` | 任意。アクセスcookie署名用（未設定時はパスワードから導出） |

パスワードハッシュの生成:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('ここにパスワード').digest('hex'))"
```

認証成功時はhttpOnly cookie（12時間有効、HMAC署名付き）が発行される。「アクセスを終了」ボタンでいつでも破棄できる。

## Supabase setup

1. Supabaseプロジェクト `musicians.emnrecords.com` を開く
2. SQL Editorで `sql/001_init.sql` → `sql/002_rls.sql` の順に実行
3. Project Settings → API から URL / publishable key / secret key を環境変数に設定

### schema概要

- `musicians` — 名鑑の正本。`roles text[]`が「担当」の正本フィールド（**`instruments`は作らない**）。`icon_image_url` / `icon_image_source` / `icon_storage_path` でアイコン管理
- `musician_links` — SNS等のリンク（platform / display_order / is_public）
- `standing_assets` — 立ち絵素材metadata。ファイル本体はWordPress uploads。素材ごとのパスワードは持たない（ページ全体を共通パスワードで保護）
- `credit_exports` — クレジット生成履歴。`selected_people`に一時編集込みのスナップショットを保存してよいが、**musiciansへ書き戻さない**
- `credit_format_templates` — Custom Formatテンプレート（v0.1のUI保存はlocalStorage）

### RLS方針

- 匿名（publishable key）: public musicians / public links / public+activeな standing_assets のみselect可
- members_only素材・書き込みは、パスワード認証済みのserver routeがsecret key（service_role、RLSバイパス）経由でのみ実行
- `credit_format_templates` はpublicなら誰でもselect可、本人管理はSupabase Auth導入後（v0.2）

## WordPress REST API upload setup

立ち絵はSupabase Storageではなく**ConoHa WING上のWordPress uploads**に保存する。理由: ConoHaの容量が余っており、Supabase Freeは20MB級ファイルにはすぐ上限が来る。立ち絵はWeb表示でなくダウンロード用途のため、WordPressのMedia Libraryで十分。

### 専用ユーザーの作成（ユーザー作業）

1. WordPress管理画面 → ユーザー → 新規追加
2. 権限グループは **Author（投稿者）相当**にする（`upload_files`権限があれば足りる。Administratorは使わない）
3. そのユーザーでログイン → プロフィール → Application Passwords → 名前（例: `musicians-app`）を入れて発行
4. 表示されたパスワードを `WORDPRESS_APPLICATION_PASSWORD` に設定（**この画面でしか表示されない**）

漏洩時のrevoke: 該当ユーザーのプロフィール → Application Passwords → 当該パスワードをRevoke → 新規発行してVercelの環境変数を更新。

### アップロードの流れ

```text
ブラウザ → Next.js API route (/api/upload-standing-asset)
  → WordPress REST API (/wp/v2/media) → ConoHa上のuploads
  → Supabase standing_assets へmetadata保存
```

- Application Passwordはserver-side環境変数のみ。client bundleには絶対に入れない
- ファイル名はユーザー入力を使わず、server側で `slug-日時-乱数.拡張子` に置換
- 許可形式: PNG / JPEG / WebP のみ（最大20MB、1人あたり最大5件）。SVG / zip / pdf / psd / clip / 不明な形式はserver側でreject
- 開発中（WordPress未設定時）はアップロードをシミュレートする

> **Vercelの制約**: Vercel serverless functionのrequest body上限は約4.5MBのため、Vercel上では20MB級のアップロードは通らない。v0.1では「大きいファイルはローカル起動でアップロードする」か「4MB以下に抑える」運用とし、恒久対応（直接アップロード方式など）はv0.2のTODO。

## Standing assets download方針

- 共通パスワード認証後、`/api/standing-asset-download?id=...` が**WordPress/ConoHa上のfile_urlへ302 redirect**する
- 20MB級ファイルをVercel経由でproxy streamしない（ファイル配信はConoHaが担う）
- 利用条件の同意チェックをしないとDownloadボタンは有効にならない

### members_only素材は「厳密な非公開」ではない（重要）

v0.1ではWordPress Media Library / WordPress uploadsを使うため、members_only素材は厳密な非公開ではない。アプリ上では共通パスワードでダウンロードページを保護するが、**ファイルURLが外部に漏れた場合は直接アクセスできる可能性がある**。これは「限定共有」であり「完全な非公開保管庫」ではない（UI上にも注記あり）。

URL直アクセスも防ぎたい場合は、将来的にWordPress custom plugin、protected directory、signed download token、PHP streaming endpoint、Supabase Storage / S3 signed URL等を検討する。

### 運用

EMN RecordsのメンバーオンリーDiscordチャンネルに、ダウンロードページURLと共通パスワードを掲示する。Discordメンバーは管理者が確認した活動者のみ。素材ごとの個別パスワードは運用負荷が高いため採用しない。

## クレジット生成

- 名鑑でクレジット作成モードON → 出演者を選択 → `/credit-builder`
- 選択状態・一時編集・Custom FormatはlocalStorageに保存（DBには書かない）
- **一時編集（override）はmusicians tableを絶対に上書きしない**。名鑑DBは正本、credit builder上の値は「今回のイベント用の一時出力値」
- 出力形式: EMN Minimal Credit / Custom Format / Plain Text / Markdown / WordPress HTML / Discord / JSON
- Custom Formatは安全な文字列置換のみ（eval等は使わない）。未知のプレースホルダーは警告表示
- 使用可能プレースホルダー: `<name>` `<name_jp>` `<name_en>` `<display_name>` `<canonical_name>` `<role>` `<roles_csv>` `<instrument>`(=role互換) `<link_primary>` `<link_secondary>` `<links_csv>` `<links_lines>` `<x_url>` `<youtube_url>` `<website_url>` `<profile_url>` `<image_url>` `<icon_image_url>` `<credit_html>`

## office people import

officeリポジトリの `knowledge/wordpress/credits/people.json` をWebアプリ用形式に変換する（v0.1はdry-runのみ。実DB insertはv0.2）。

```bash
npx tsx scripts/import-office-people.ts ../office/knowledge/wordpress/credits/people.json > converted.json
```

- `display_name` → `displayName` / `nameJp`初期候補
- `default_role` + `roles_seen` → `roles`（instrumentsは作らない）
- `icon_url` → `iconImageUrl`、`sns_urls` → `musician_links`、`person_id` → slug候補
- **`nameEn`は自動推定しない**。全件TODOとして出力し、人間が確定する
- 変換結果は全件 `visibility: draft`。公開前に人間が確認する

## Vercel deploy手順（ユーザー作業）

1. Vercelで本リポジトリをimport（Framework: Next.js、設定はデフォルトでよい）
2. 環境変数を設定（上記の表を参照。Production/Preview両方）
3. Settings → Domains に `musicians.emnrecords.com` を追加

### DNS設定（ConoHa側・ユーザー作業）

ConoHa WINGのDNS設定で、サブドメイン `musicians` のCNAMEレコードを追加:

```text
musicians.emnrecords.com  CNAME  cname.vercel-dns.com
```

（Vercelのドメイン追加画面に表示される値を正とする。`emnrecords.com`本体のWordPress運用には影響しない）

### URL方針

- v0.1: サブドメイン `musicians.emnrecords.com`
- 将来候補: `emnrecords.com/musicians`（basePath移行を想定し、URLは全て`NEXT_PUBLIC_APP_URL`基準で生成している）

## セキュリティ上の制約まとめ

- WordPress Application Password / 各種パスワードはserver-only環境変数。`NEXT_PUBLIC`を付けない。GitHubにcommitしない
- download用とupload用のパスワードは別
- パスワード照合はserver側（sha256 + timing-safe比較）。成功時はhttpOnly署名cookie（12時間）
- パスワード試行は簡易rate limit（インスタンス内メモリ、10分10回）
- アップロードはserver側でMIME / 拡張子 / サイズを許可リスト検証
- members_only素材のfile_urlは公開ページに出さない。ただし上記の通りURL漏洩時は直接アクセス可能
- `/member/*` `/admin` `/credit-builder` はnoindex + robots.txtでdisallow
- Custom Formatは正規表現による文字列置換のみ

## 確認コマンド

```bash
npm run lint
npm run build
npx tsx scripts/import-office-people.ts   # dry-run変換
```

## v0.1の範囲

- 名鑑（検索・role絞り込み・詳細・OGP）
- クレジット生成（一時編集・並び替え・7形式・copy/download）
- 立ち絵素材のアップロード / ダウンロード（共通パスワード方式）
- mock fallback（Supabase未設定でも全画面動作）
- SQL / importスクリプト（dry-run）

## v0.2以降のTODO

- Supabase Auth導入（本人編集・承認フロー、templateの本人管理）
- credit_exports / credit_format_templates のDB保存UI
- import script の実DB insert
- 大容量アップロードのVercel対応（直接アップロード方式 or 別経路）
- 素材の非公開配信（signed URL等）の検討
- アイコン画像のカスタムアップロード（Supabase Storage / 正方形警告）
- 管理画面でのデータ管理（v0.1はSQL/dashboard運用）
- basePath対応（`emnrecords.com/musicians` 配下への移行オプション）
- rate limitの永続化（KV等）

## ユーザー側で必要な作業（このリポジトリではやらない）

- 本番DNS変更（ConoHa側CNAME追加）
- Vercelプロジェクト作成と本番環境変数の実値設定
- Supabase secret key / DB passwordの入力、SQL実行
- WordPress専用ユーザー作成とApplication Password発行
- Discordチャンネルへのページ URL・共通パスワードの掲示
