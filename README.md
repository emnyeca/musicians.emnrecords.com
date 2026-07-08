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
- WordPress custom plugin（`wordpress-plugin/emn-musicians-assets`）+ ConoHa WING上のWordPress uploads（立ち絵の受け口・置き場）
- Vercel deploy想定（**Vercelは20MBアップロードを受けない**。名鑑UI・クレジット生成UI・ダウンロードUIのみ担当）

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
| `NEXT_PUBLIC_WORDPRESS_ASSET_UPLOAD_ENDPOINT` | 立ち絵アップロード先のWordPress custom endpoint URL（例: `https://emnrecords.com/wp-json/emn-musicians/v1/standing-assets/upload`）。URL自体は公開情報 |

### Server-only（絶対に `NEXT_PUBLIC` を付けない）

| 変数 | 内容 |
| --- | --- |
| `SUPABASE_SECRET_KEY` | Supabase secret (service_role) key。members_only素材の取得に必要 |
| `MEMBER_DOWNLOAD_PASSWORD_HASH` | ダウンロードページ共通パスワードのsha256 hexハッシュ（推奨） |
| `MEMBER_DOWNLOAD_PASSWORD` | 同・平文（v0.1の暫定。本番はhashへ移行すること） |
| `ASSET_UPLOAD_PASSWORD_HASH` | アップロードページパスワードのハッシュ。**download用と必ず別にする**。WordPress側の `EMN_MUSICIANS_UPLOAD_PASSWORD_HASH` と同じ値を設定する |
| `ASSET_UPLOAD_PASSWORD` | 同・平文（暫定） |
| `ACCESS_TOKEN_SECRET` | 任意。アクセスcookie署名用（未設定時はパスワードから導出） |

legacy: 旧構成で使っていた `WORDPRESS_BASE_URL` / `WORDPRESS_UPLOAD_USERNAME` / `WORDPRESS_APPLICATION_PASSWORD` は**不要**になった。Next.js側にWordPress Application Passwordを持たせない（発行済みのものがあればrevokeしてよい）。

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
- members_only素材の**読み取り**は、パスワード認証済みのNext.js server routeがservice role key（RLSバイパス）で取得する
- standing_assetsへの**書き込み**は、WordPress custom endpointがWordPressサーバー側のSupabase secret keyで行う
- ブラウザからstanding_assetsへ直接writeしない
- `credit_format_templates` はpublicなら誰でもselect可、本人管理はSupabase Auth導入後（v0.2）

## Standing assets upload方針（WordPress custom endpoint）

立ち絵はSupabase Storageではなく**ConoHa WING上のWordPress uploads**に保存する。理由: ConoHaの容量が余っており、Supabase Freeは20MB級ファイルにはすぐ上限が来る。立ち絵はWeb表示でなくダウンロード用途のため、WordPressのMedia Libraryで十分。

さらに、**20MB級のアップロードはVercelを経由しない**。Vercel serverless functionのrequest body上限（約4.5MB）があるため、アップロードの受け口はConoHa上のWordPressに寄せている。

### アップロードの流れ

```text
ブラウザ（upload form）
  → WordPress custom endpoint
    POST /wp-json/emn-musicians/v1/standing-assets/upload
  → WordPress Media Library / uploads（ConoHa）
  → WordPressサーバーからSupabase standing_assets へmetadata保存
```

- 認証はDiscordで共有する**アップロード用共通パスワード**（formで送信し、WordPress側でsha256ハッシュと`hash_equals`照合）。管理者パスワードやApplication Passwordではなく、漏洩時は定数変更でローテーションできる
- 許可形式: PNG / JPEG / WebP のみ、最大20MB、1人あたり最大5件
- MIME type・拡張子に加えて**magic number**（PNG: `89 50 4E 47...` / JPEG: `FF D8 FF` / WebP: `RIFF....WEBP`）を検証し、SVG / HTML / ZIP / PDF / PSD / CLIP / 不明形式はreject
- ファイル名はユーザー入力を使わず、server側で `slug-日時-乱数.拡張子` に置換
- 原本をそのまま保存する（`-scaled`コピーや中間サイズは生成しない）
- **Supabaseへのmetadata保存に失敗した場合は `wp_delete_attachment()` でファイルを削除**し、孤児ファイルを残さない
- Supabase secret keyはWordPressサーバー側（wp-config.php）にのみ置く。ブラウザ・Next.js clientには出さない
- Next.js側の旧route `/api/upload-standing-asset` は**開発用シミュレーションfallback**（本番では410を返す）。`NEXT_PUBLIC_WORDPRESS_ASSET_UPLOAD_ENDPOINT` 未設定時のみformがこちらへ送信する

### WordPress pluginの設置（ユーザー作業）

1. `wordpress-plugin/emn-musicians-assets/` ディレクトリを、WordPressの `wp-content/plugins/` へアップロード（ConoHaのファイルマネージャーまたはFTP）
2. `wp-config.php` に以下の定数を追加（**実値はGitHubにcommitしない**）:

   ```php
   define('EMN_MUSICIANS_UPLOAD_PASSWORD_HASH', '<アップロード用パスワードのsha256 hex>');
   define('EMN_MUSICIANS_SUPABASE_URL', 'https://xxxx.supabase.co');
   define('EMN_MUSICIANS_SUPABASE_SECRET_KEY', '<Supabase secret (service_role) key>');
   // 任意（デフォルト: 下記2origin / 20MB / 5件）
   // define('EMN_MUSICIANS_ALLOWED_ORIGINS', 'https://musicians.emnrecords.com,http://localhost:3000');
   // define('EMN_MUSICIANS_MAX_FILE_BYTES', 20971520);
   // define('EMN_MUSICIANS_MAX_ASSETS_PER_MUSICIAN', 5);
   ```

3. WordPress管理画面 → プラグイン → 「EMN Musicians Assets」を有効化
4. PHPのアップロード上限を確認する（ConoHa WINGコントロールパネル → PHP設定）: `upload_max_filesize` と `post_max_size` を**25M以上**にする（20MBファイル+フォームデータ分の余裕）
5. Vercel側の `NEXT_PUBLIC_WORDPRESS_ASSET_UPLOAD_ENDPOINT` に `https://emnrecords.com/wp-json/emn-musicians/v1/standing-assets/upload` を設定
6. Next.js側 `ASSET_UPLOAD_PASSWORD_HASH` にWordPressと同じハッシュを設定（ページのゲートとendpoint照合で同じパスワードを使うため）

パスワードローテーション: 新しいパスワードのハッシュを生成し、`EMN_MUSICIANS_UPLOAD_PASSWORD_HASH`（wp-config.php）と `ASSET_UPLOAD_PASSWORD_HASH`（Vercel）を両方更新し、Discordの掲示を差し替える。

### CORS

WordPress endpointは以下のoriginのみ許可する（ワイルドカード`*`は使わない）。OPTIONS preflightにも応答する。

- `https://musicians.emnrecords.com`
- `http://localhost:3000`

変更する場合は `EMN_MUSICIANS_ALLOWED_ORIGINS`（カンマ区切り）で上書きする。

トラブルシューティング: セキュリティ系プラグインがREST APIを制限している場合、`emn-musicians/v1` namespaceを許可すること。

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

- 各種パスワードハッシュ・Supabase secretはserver-only（Vercel環境変数 / wp-config.php）。`NEXT_PUBLIC`を付けない。GitHubにcommitしない
- **WordPress Application PasswordはNext.js側に持たない**（新構成では不要）
- download用とupload用のパスワードは別
- パスワード照合はserver側（sha256 + timing-safe比較）。Next.js側は成功時にhttpOnly署名cookie（12時間）、WordPress側は都度照合
- パスワード試行は簡易rate limit（10分10回。Next.js側はインスタンス内メモリ、WordPress側はtransient）
- アップロードはWordPress server側でMIME / 拡張子 / magic number / サイズを許可リスト検証
- WordPress endpointのCORSは許可origin限定（ワイルドカード不使用）
- Supabase metadata保存失敗時はWordPress attachmentを削除（孤児ファイルを残さない）
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
- 素材の非公開配信（signed URL等）の検討
- アイコン画像のカスタムアップロード（Supabase Storage / 正方形警告）
- 管理画面でのデータ管理（v0.1はSQL/dashboard運用）
- basePath対応（`emnrecords.com/musicians` 配下への移行オプション）
- rate limitの永続化（KV等）

## ユーザー側で必要な作業（このリポジトリではやらない）

- 本番DNS変更（ConoHa側CNAME追加）
- Vercelプロジェクト作成と本番環境変数の実値設定
- Supabase secret key / DB passwordの入力、SQL実行
- WordPress pluginの設置・有効化と `wp-config.php` への定数追加（EMN_MUSICIANS_*）
- ConoHaのPHPアップロード上限確認（upload_max_filesize / post_max_size ≥ 25M）
- Discordチャンネルへのページ URL・共通パスワードの掲示
