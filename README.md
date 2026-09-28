# EMN Records Musician Directory & Credit Builder

公開プロフィールからミュージシャンを探し、イベント用Creditを作るWebアプリです。
本人はDiscordの専用チャンネルのボタンから、本人専用のWeb画面でプロフィールを確認・編集します。未登録なら下書きを新規作成し、Discordアカウントに自動で紐付けます。従来のスラッシュコマンドも利用できます。
Credit作成時の一時編集は名鑑へ書き戻しません。
名鑑はMusicianを中心にCreator / Staffも掲載します。外部コラボレーターはCredit画面でゲストとして追加でき、任意のアイコンURLも指定できます。
「この端末に保存」で同じブラウザから再利用・編集・削除できます。サイトデータを消すと保存済みゲストも失われます。

## 運用構成

ConoHa WINGのPHP・MySQLと静的ファイルで運用します。Vercel・Supabase・常駐Botは不要です。
Next.js / Reactは既存の画面を維持するため、ローカルのビルドに使います。
プロフィールは閲覧時にAPIから取得するため、Discord更新後の再ビルドは不要です。

- `src/`: 名鑑・検索・Credit作成・管理画面。
- `server/`: PHPの認証・Discord受付・DB処理。公開ディレクトリの外へ配置。
- `public/api/index.php`: HTTP受付。秘密情報を含みません。
- `sql/schema.sql`: 新規MySQL DBの定義。
- `docs/architecture.md`: プロダクト方針と安全境界。
- `docs/operator-setup.md`: ローカル起動・WINGへの設置・Discord設定。
- `docs/roadmap.md`: 公開までの残作業と公開後の運用改善。

## ローカル起動

Node.jsとDocker Desktopを使います。Windows PowerShellでnpmが実行制限される場合は `npm.cmd` を使ってください。

```sh
npm ci
npm run local:setup
npm run dev
```

http://127.0.0.1:8080 で確認できます。管理パスワードは `.local/admin-password.txt`。
初期DBは空です。`/admin/` から登録できます。接続失敗を架空データに置き換えません。
画面を変更したら `npm run build`、PHPの変更はそのまま反映されます。

トップページの写真はGit管理外です。この端末では `assets/top/` に圧縮済みWebPと元写真の参照先を保存し、使用中の `virtual-session.webp` を `public/images/top/` に置いています。別端末で写真を含む表示・公開ビルドを作る場合は、この画像を別途配置してください。写真はGitHubへ送らず、公開時だけ配信ファイルに含めます。
停止は `docker compose stop`。ローカルDBはDocker volumeに保持されます。

## 検証と公開候補

```sh
npm run check
npm run release:prepare
```

`check` はlint・静的ビルド・隔離MySQLでのPHP安全性テストです。
公開候補は `build/release-日時/` に生成します。アップロードやDiscordへの送信は行いません。
本番公開はアムニェカさんの確認後に行います。

旧Supabase構成はGit履歴で参照できます。既存の実データを移す処理は含みません。
Officeの人物情報は、重複防止付きの移行スクリプトで下書きとして取り込めます。本人確認・掲載辞退をDiscordで記録し、確認済みの対象だけを期日後に一括公開します。
