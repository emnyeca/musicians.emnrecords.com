# 設置と運用

## ローカル

Node.jsとDocker Desktopで `npm ci` → `npm run local:setup` → `npm run dev`。
http://127.0.0.1:8080/admin/ のパスワードは `.local/admin-password.txt`。
初期DBは空。テストは `npm test` で別の `db-test` コンテナへ実行し、開発DBへは接続しない。
Dockerは開発用であり、WINGには不要。
PHP 8.3以降を直接使う場合は、pdo_mysql・mbstring・sodium・curlを有効にし、
`MUSICIANS_CONFIG` にローカルconfigの絶対パスを指定して `npm start`。

### ローカルデバッグ環境

本番と同じ画面を、このPCの中だけで試せる環境。本番のデータを壊す心配はなく、ここで保存・削除しても本番には何も起きない。

#### 起動のしかた

1. **Docker Desktopを起動する。** スタートメニューから「Docker Desktop」を開き、画面左下が緑色（Engine running）になるまで待つ（1分ほど）。
2. **VS Codeでこのフォルダを開き、ターミナルを開く。** メニューの「ターミナル」→「新しいターミナル」（または `Ctrl` + `@`）。
3. **初めてのときだけ**、次を入力して `Enter`。必要な部品をダウンロードする（数分かかる）。

   ```powershell
   npm.cmd ci
   ```

4. 次を入力して `Enter`。2〜3分かかる。

   ```powershell
   npm.cmd run debug
   ```

   最後に `Copied 3 public profiles ... into the local debug DB.` のような行が出たら起動完了（数字は公開中の人数）。
5. ブラウザで <http://127.0.0.1:8081/__debug/> を開く。

#### できること

- 「サイトを開く」：名鑑・クレジット作成を本番と同じ画面で試せる。
- 人の名前をクリック：その人の本人編集画面が開く（Discordのボタンを押したときと同じ画面）。
- 「未登録メンバーとして本人編集を開く」：新規登録の画面を試せる。
- 「管理画面」：パスワードは `local-debug`。

データは起動するたびに本番の公開中プロフィールからコピーし直す。試しに変えた内容は、次に起動すると元に戻る。

#### 終わるとき

ターミナルで次を実行する。Docker Desktopは閉じてもよい。

```powershell
npm.cmd run debug:stop
```

#### うまくいかないとき

- `failed to connect to the docker API` と出る：Docker Desktopが起動していない。手順1からやり直す。
- `npm` が「スクリプトの実行が無効」と言われる：コマンドの `npm` を `npm.cmd` にする（上の手順は `npm.cmd` で書いてある）。
- ページが開かない：手順4の完了メッセージが出ているか確認し、出ていなければ `npm.cmd run debug` をもう一度実行する。

#### 仕組み（開発者向け）

- 専用の使い捨てDB（`db-debug`）を起動のたびに `schema.sql` から作り、本番の公開API（誰でも見られる情報）からプロフィールをコピーする。本番のDB・Discord・configには接続しない。
- 設定は `scripts/local-debug-config.php`（ローカル値だけ）。`.local/config.php` は使わない。管理画面のパスワードは `local-debug`。
- `/__debug/` から任意のプロフィールの本人として、または未登録メンバーとして本人編集を開ける。Discordの在籍・ロール確認だけを `local-debug-router.php` で差し替え、リンク発行・session・CSRF・保存は本番と同じコードを通る。
- デバッグ用ファイルは `package.mjs` の配布対象に含めない。ポートは127.0.0.1だけで待ち受ける。

## 公開候補の作成

`npm run check` 後に `npm run release:prepare`。
`build/release-日時/` にpublic・musicians-private・schema.sql・scripts・手順を生成する。
これはローカルファイル作成だけで、外部へのアップロードもDiscordへの送信もしない。

## ConoHa WINGの初期設定

公開先は `musicians.emnrecords.com`。既存のホームページとは公開ディレクトリ・DBを分ける。

1. ConoHaでサブドメインと無料SSLを設定し、PHP 8.3以降を選ぶ。
2. 専用MySQL DBとユーザーを作り、そのDBへ `schema.sql` を適用する。既存サイトのDBには適用しない。
3. `musicians-private/` を `public_html` と同じ階層へ配置する。
4. `config.example.php` を同じフォルダの `config.php` へコピーして、DB接続先とDiscord設定を入れる。
5. 管理パスワードは `password_hash` でhash化して `admin_password_hash` へ保存する。実行例はconfig.example.phpに記載。
6. 本人が公開を確認した後、`public/` の中身をサブドメインのdocument rootへ配置する。`.htaccess` を含める。

標準配置は次のとおり。

```text
/home/ACCOUNT/
  musicians-private/
    config.php
    bootstrap.php / profile.php / store.php / discord.php / http.php
  public_html/
    musicians.emnrecords.com/
      index.html / _next/ / api/index.php / .htaccess / ...
```

実際のdocument rootが異なる場合は `public/api/index.php` のruntime解決先を合わせる。
公開ディレクトリにはconfig・SQL・バックアップ・開発用ファイルを置かない。
configの権限は所有者だけが読み書きできる設定を基本とする。

## 本番への接続

このWindows端末ではSSH configを使わず、鍵とポートを毎回指定する。Codex・Claude Codeとも同じ接続方法を使う。2026-09-30に接続確認済み。

- ホスト: `www178.conoha.ne.jp`
- ユーザー: `c6542929`
- SSHポート: `8022`
- 秘密鍵の保存場所: `C:\Users\emnye\Downloads\Musician Directory Deployment.pem`
- 接続先ホストの確認情報: `C:\Users\emnye\.ssh\known_hosts`

PowerShellからの接続・ファイル転送例:

```powershell
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes `
  -i "C:\Users\emnye\Downloads\Musician Directory Deployment.pem" `
  -p 8022 c6542929@www178.conoha.ne.jp

scp -o BatchMode=yes -o StrictHostKeyChecking=yes `
  -i "C:\Users\emnye\Downloads\Musician Directory Deployment.pem" `
  -P 8022 local-file c6542929@www178.conoha.ne.jp:/home/c6542929/musicians-release-backups/
```

本番の配置先:

- 公開ファイル: `/home/c6542929/public_html/musicians.emnrecords.com/`
- PHP・config・アップロード画像: `/home/c6542929/musicians-private/`
- 運用スクリプト: `/home/c6542929/musicians-scripts/`
- 非公開の作業・バックアップ領域: `/home/c6542929/musicians-release-backups/`
- PHP CLI: `/opt/alt/php83/usr/bin/php`

接続後の読み取り専用確認:

```sh
/opt/alt/php83/usr/bin/php /home/c6542929/musicians-scripts/preflight.php
```

秘密鍵の内容や本番configの秘密値は文書・Git・公開候補へ含めない。既存の`config.php`と`icon-storage/`はコード更新で上書き・削除しない。

## 実サーバーでの確認

PHP・DB機能は契約環境に依存するため、ローカル成功とWINGでの検証を区別する。
公開候補の `scripts/` はpublic_html外で `musicians-private/` と同じ親ディレクトリへ配置し、
`php scripts/preflight.php` を実行する。PHPバージョン、拡張、DB、監査trigger、設定の有無だけを表示し、秘密値は表示しない。
CLIのPHPが古い場合はConoHaが案内するPHP 8.3以降の実行パスを指定する。

- MySQL 8.4でローカル検証。SQLは5.7以降の構文を使うが、旧契約の5.7は実機未検証。
- trigger作成権限とbinary log設定はWING実機で確認する。監査triggerが作れない場合、黙って省略して公開しない。
- Web用PHPでもsodium・curl・mbstring・pdo_mysqlが利用できることを確認する。
- HTTPSで署名不正が401、署名付きPINGがPONGになることを確認する。
- WAFがDiscordの正当なPOSTを拒否する場合、対象URLのルールだけを調整する。
- APIとプロフィールHTMLにキャッシュを適用しない。WEXAL/CDN等を使う場合も動的URLを除外する。

## Discord

configの `discord_application_id`、`discord_public_key`、`discord_guild_id`、
`discord_member_role_id`、`discord_operator_role_id`、`discord_bot_token`、`discord_audit_channel_id` を設定する。
Botを対象guildへ追加し、限定監査チャンネルだけに必要な閲覧・送信権限を付ける。

`php scripts/register-discord-commands.php` は定義確認のみ。
対象guildと内容を確認した後に `--apply` を付けて登録する。global commandは登録しない。
`/emn-admin` はDiscordのIntegration設定でも運営者ロールへ制限する。
Developer PortalのInteractions Endpoint URLは
`https://musicians.emnrecords.com/api/discord/interactions`。

## Office人物データの初回移行

`office/knowledge/wordpress/credits/people.json` をサーバーの非公開領域へ置き、まずdry-runする。

```bash
php scripts/import-office-drafts.php /非公開パス/people.json
```

件数、`ADD`、`SKIP`を確認した後だけ`--apply`を付ける。Office由来のslugは安定した`office-{person_id}`とし、`source_office_person_id`でも再実行時の重複を防ぐ。既存行は上書きせず、追加分だけを`draft`で作る。

```bash
php scripts/import-office-drafts.php /非公開パス/people.json --apply
```

本人確認は`/emn-profile confirm`または本人によるプロフィール更新で記録する。掲載を望まない本人は、Web画面で公開状態を「非公開」（hidden）にする。

告知した確認期日の後、一括公開候補をdry-runで確認する。

```bash
php scripts/publish-confirmed-drafts.php
```

代表者が設定済みで、本人確認後に変更されておらず、未ロックで、表示名・英語名・役割が揃う下書きだけが`READY`になる。日本語名は任意。`HOLD`の理由を確認し、公開対象が正しい場合だけ次を実行する。

```bash
php scripts/publish-confirmed-drafts.php --apply
```

`/admin/` でレコードを作り、`/emn-admin representative-set` で代表者を割り当てる。
`/emn-profile edit` → Modal送信 → preview → 修正／任意項目／リンク → 反映を実機で確認する。
確定前には名鑑が変わらず、確定後には再ビルドなしで変わること、二度押しで二重反映しないことを確認する。
lock中の拒否、非公開化、監査ログからの復旧、通知も確認する。
Modal表示の同期応答とdeferがDiscordの3秒制限内であることは本番相当環境で測定する。

## 更新

### 本人Web編集の導入

既存DBには初期schemaを再投入せず、公開候補に含む追加migrationを1回適用する。次の順番で更新する（本番公開の確認後）。

1. `musicians-private/member.php`を含むPHP一式と`scripts`一式を配置する。既存configは維持する。
2. `php /home/c6542929/musicians-scripts/install-member-web.php`で追加内容を確認し、同じコマンドに`--apply`を付けて実行する。既存プロフィールは変更しない。
3. 公開ファイルを更新し、`preflight.php`を実行する。公開ディレクトリは755、公開ファイルは644にする。非公開ディレクトリの権限は維持する。
4. 案内先のテキストチャンネルIDで`php /home/c6542929/musicians-scripts/post-member-panel.php CHANNEL_ID`を実行し、投稿内容・投稿先を確認する。本人の投稿承認後に`--apply`を付ける。Botにはそのチャンネルの閲覧・メッセージ送信権限が必要。
5. 投稿をピン留めし、既存代表者と未登録メンバーの両方で確認する。コマンドの再登録、OAuth設定、新しい秘密情報は不要。

未登録判定は代表者の紐付け有無で行うため、案内開始前に既存プロフィールを本人へ割り当てる。投稿スクリプトを再実行すると別の投稿が増えるので、通常は一度だけ実行する。

メンバーへの案内は「下のボタンを押してプロフィールを確認してください。」とする。本人限定の返信からWeb画面を開き、変更があれば「変更を保存」、変更がなければ「変更せずに確認済みにする」。未登録なら「下書きとして登録」。リンクは5分以内、編集は30分以内。期限切れの場合はDiscordから新しいリンクを開く。

公開状態は本人がWeb画面で選ぶ。掲載を辞退する場合は「非公開」を選んで保存する。

導入後、Discord実機で本人限定の返信、共有投稿に個人リンクが出ないこと、保存・監査通知、退会・role削除後の拒否を確認する。ローカル検証ではDiscordへの実送信を行わない。

### バージョン表記とGitタグ

本番へ反映するたびに、バージョンと最終変更の短い名前を更新し、反映したコミットにGitタグを付ける。トップページ最下部に `version 0.1.1 TagOrder` のように小さく表示される。

1. 反映するブランチで `package.json` の `version` と `releaseLabel` を更新する（どちらもこの1か所だけが正本）。
   - `version`：通常の反映は3桁目を1つ上げる（0.1.1 → 0.1.2）。大きな機能追加や仕様変更で2桁目を上げたいときは本人に確認する。
   - `releaseLabel`：その反映の主な変更を英語1〜3語のPascalCaseで書く（例：`TagOrder`、`SaveFeedback`）。
2. mainへ取り込み、mainから公開候補を作って本番へ配置する。
3. 配置したmainのコミットに注釈付きタグを付けてpushする。

   ```sh
   git tag -a v0.1.1 -m "TagOrder: タグの並び順・複数選択など"
   git push origin v0.1.1
   ```

PHPだけの修正など画面を再ビルドしない反映でも、`package.json` を更新してタグを付ける（表示は次の画面反映から変わる）。

### 通常の更新

画像・担当選択対応版では`roles.php`、`role-catalog.json`、`icons.php`も非公開領域へ配置する。`preflight.php`でGDの有効化を確認し、PHPの`upload_max_filesize`を5M以上、`post_max_size`を6M以上にする。本番は32M/32Mで確認済み。`musicians-private/icon-storage`はPHPが作成・書き込みできる状態にし、以後の配布で削除しない。バックアップ対象に追加する。ローカルは`docker compose build web`でGD対応イメージを作る。

既存プロフィールへのVanity Role取込みは`php /home/c6542929/musicians-scripts/import-vanity-roles.php`で候補を確認し、`--apply`で確定する。先頭担当は維持し、区分はMusicianロールの有無で設定する。取込み後に本人が選び直した区分・担当は再実行しても上書きしない。変更後は本人確認が必要になるため、既存の確認済み判定はversion更新により古くなる。

### 不審フラグ・本人の公開状態・削除の導入

1. PHP一式・`scripts`一式・公開ファイルを配置する。
2. `install-suspicious-flag.php`で内容を確認し、`--apply`で適用する。先に新しい監査triggerを作り、成功した場合だけ旧triggerの削除と`is_verified`→`is_suspicious`の置換へ進む。trigger作成が拒否された場合（binary log有効でSUPER権限がないなど）は何も変えずに止まるので、phpMyAdminから同じSQLを実行するか、サーバー設定を確認する。
3. `preflight.php`で`MySQL schema and audit triggers`がOKになることを確認する。
4. `register-discord-commands.php --apply`で`/emn-profile withdraw`を外したコマンドを登録する。

画面/PHPの変更は公開候補を作り、本人レビュー後にアップロードする。
プロフィールの通常変更には再ビルド・デプロイ・PCの常時起動は不要。
初期SQLを更新のたびに再実行しない。DBの内容とconfigはコード配布で上書きしない。
