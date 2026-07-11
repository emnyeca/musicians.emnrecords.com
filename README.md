# EMN Records Musician Directory & Credit Builder

`musicians.emnrecords.com` は、公開情報だけを扱うミュージシャン名鑑とCredit作成支援Webアプリです。

## 現在のプロダクト境界

- 公開名鑑: ログインなしで名前、担当、公開SNSリンクを閲覧できます。
- Credit作成: 名鑑から出演者を選び、一時編集・並び替えをして複数形式で出力できます。一時編集は名鑑DBへ書き戻しません。
- 情報入力: 専用Discord BotのModalを正規の入口とします。既存の自己紹介投稿はクロールしません。
- 公開反映: Discord入力を二重に検証し、本人が変更できる公開項目だけを監査ログと同時に即時反映します。通常の事前承認は行いません。
- 対象外: 立ち絵その他の非公開ファイルのアップロード、保管、ダウンロードは行いません。
- 対象外: Discord OAuthによるWeb上の本人編集は行いません。

方針とセキュリティ境界は [docs/architecture.md](docs/architecture.md)、導入作業は [docs/operator-setup.md](docs/operator-setup.md)、実装順は [docs/implementation-prompts.md](docs/implementation-prompts.md) を参照してください。

## 技術構成

- Next.js App Router + TypeScript + Tailwind CSS
- Supabase PostgreSQL
- Vercel
- Discord Bot（今後追加。Modal受付、ロック申請、運営操作）

ブラウザとDiscord BotにSupabaseのservice-role keyを渡しません。匿名クライアントはRLSにより公開レコードだけを読み取れます。DBへの書き込みは、入力検証・認可・監査を行うサーバー側境界に限定します。

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
npx tsx scripts/import-office-people.ts
```

`import-office-people.ts` は現在dry-runのみです。`nameEn`を推測せず、人間が確定するための変換結果を出力します。

## Legacy

立ち絵配布系コード、WordPress plugin、member用パスワードスコープは方針転換によりリポジトリから削除しました。過去実装はGit履歴でのみ参照します。まだ実データがないため移行SQLは作らず、運用開始前に現行の初期SQLからDBを作り直します。外部サービス上の撤去手順は [docs/operator-setup.md](docs/operator-setup.md) を参照してください。
