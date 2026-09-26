# 設置と運用

## ローカル

Node.jsとDocker Desktopで `npm ci` → `npm run local:setup` → `npm run dev`。
http://127.0.0.1:8080/admin/ のパスワードは `.local/admin-password.txt`。
初期DBは空。テストは `npm test` で別の `db-test` コンテナへ実行し、開発DBへは接続しない。
Dockerは開発用であり、WINGには不要。
PHP 8.3以降を直接使う場合は、pdo_mysql・mbstring・sodium・curlを有効にし、
`MUSICIANS_CONFIG` にローカルconfigの絶対パスを指定して `npm start`。

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

本人確認は`/emn-profile confirm`または本人によるプロフィール更新で記録する。掲載辞退は`/emn-profile withdraw confirm:true`で非公開・ロック状態にする。

告知した確認期日の後、一括公開候補をdry-runで確認する。

```bash
php scripts/publish-confirmed-drafts.php
```

代表者が設定済みで、本人確認後に変更されておらず、未ロックで、表示名・日本語名・英語名・役割が揃う下書きだけが`READY`になる。`HOLD`の理由を確認し、公開対象が正しい場合だけ次を実行する。

```bash
php scripts/publish-confirmed-drafts.php --apply
```

`/admin/` でレコードを作り、`/emn-admin representative-set` で代表者を割り当てる。
`/emn-profile edit` → Modal送信 → preview → 修正／任意項目／リンク → 反映を実機で確認する。
確定前には名鑑が変わらず、確定後には再ビルドなしで変わること、二度押しで二重反映しないことを確認する。
lock中の拒否、非公開化、監査ログからの復旧、通知も確認する。
Modal表示の同期応答とdeferがDiscordの3秒制限内であることは本番相当環境で測定する。

## 更新

画面/PHPの変更は公開候補を作り、本人レビュー後にアップロードする。
プロフィールの通常変更には再ビルド・デプロイ・PCの常時起動は不要。
初期SQLを更新のたびに再実行しない。DBの内容とconfigはコード配布で上書きしない。
