# EMN Records Musician Directory & Credit Builder

`musicians.emnrecords.com` は、公開情報だけを扱うミュージシャン名鑑とCredit作成支援Webアプリです。

## 現在のプロダクト境界

- 公開名鑑: ログインなしで名前、担当、公開SNSリンクを閲覧できます。
- Credit作成: 名鑑から出演者を選び、一時編集・並び替えをして複数形式で出力できます。一時編集は名鑑DBへ書き戻しません。
- 情報入力: Discord Interactionを正規の入口とし、slash command、Modal、ephemeral preview、buttonで本人プロフィールを受け付けます。既存の自己紹介投稿はクロールしません。
- 公開反映: Modal submitでは確定せず、本人がpreviewの`[反映する]`を押した後、再認可・再検証して監査ログと同時に反映します。通常の運営者承認は行いません。
- 対象外: 立ち絵その他の非公開ファイルのアップロード、保管、ダウンロードは行いません。
- 対象外: Discord OAuthによるWeb上の本人編集は行いません。

方針とセキュリティ境界は [docs/architecture.md](docs/architecture.md)、導入作業は [docs/operator-setup.md](docs/operator-setup.md)、実装順は [docs/implementation-prompts.md](docs/implementation-prompts.md) を参照してください。

## 技術構成

- Next.js App Router + TypeScript + Tailwind CSS
- Supabase PostgreSQL
- Vercel
- Discord HTTP Interactions Endpoint（今後追加。Next.js Route Handlerで受付）

ブラウザとDiscord BotにSupabaseのservice-role keyを渡しません。匿名クライアントはRLSにより公開レコードだけを読み取れます。DBへの書き込みは、入力検証・認可・監査を行うサーバー側境界に限定します。

## 現在実装済みの機能と今後の機能

現在実装済みなのは、公開名鑑、Credit作成、運営者用のミュージシャン追加画面、公開データを匿名ユーザーの読み取りだけに制限するRLS、そしてDiscord Interactionによる本人プロフィール受付です。

Discord受付は `/api/discord/interactions`(署名検証、PING応答、3秒以内の初回応答)、`/emn-profile`・`/emn-admin` guild command、Modal、ephemeral preview、確定transaction(session消費・version確認・監査ログ追加を同一transactionで実行)、限定監査チャンネル通知、レコード単位ロック、代表者変更、過去状態への復旧までを含みます。DB側の確定処理は `sql/003_functions.sql` の関数が担います。コード上の実装は自動テストで検証済みですが、実際のDiscordサーバー・検証用DBでの疎通確認は運用開始前に [docs/operator-setup.md](docs/operator-setup.md) の手順で行ってください。

バックアップと復旧の手順は [docs/backup-restore.md](docs/backup-restore.md)、インシデント対応は [docs/incident-response.md](docs/incident-response.md) を参照してください。

## ローカル実行

```bash
npm install
npm run dev
```

環境変数は `.env.example` を参照してください。Supabase未設定時はmockデータで公開画面を確認できます。

## 検証

```bash
npm run lint
npm run build
npm run test
npx tsx scripts/import-office-people.ts
```

Discordのguild command登録は、環境変数(`DISCORD_APPLICATION_ID`、`DISCORD_BOT_TOKEN`、`DISCORD_GUILD_ID`)を設定したうえで次を実行します。

```bash
npx tsx scripts/register-discord-commands.ts
```

`import-office-people.ts` は現在dry-runのみです。`nameEn`を推測せず、人間が確定するための変換結果を出力します。

## Legacy

立ち絵配布系コード、WordPress plugin、member用パスワードスコープは方針転換によりリポジトリから削除しました。過去実装はGit履歴でのみ参照します。まだ実データがないため移行SQLは作らず、運用開始前に現行の初期SQLからDBを作り直します。外部サービス上の撤去手順は [docs/operator-setup.md](docs/operator-setup.md) を参照してください。
