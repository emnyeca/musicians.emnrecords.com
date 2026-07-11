# 運営者が行う初期設定

この文書は、Emnyecaによる外部サービス上の操作だけをまとめる。秘密情報をIssue、Discord、作業報告へ貼らないこと。

## 旧構成の撤去

まだ実データがないため、旧DBを部分的に変更せず、運用開始前に現行の初期SQLから作り直す。

1. WordPress管理画面で`EMN Musicians Assets`を無効化して削除する。
2. `wp-config.php`から、この機能専用の`EMN_MUSICIANS_*`定数を削除する。
3. この機能専用に発行した認証情報があれば失効させる。
4. VercelのProductionとPreviewから次の環境変数を削除する。
   - `NEXT_PUBLIC_WORDPRESS_ASSET_UPLOAD_ENDPOINT`
   - `MEMBER_DOWNLOAD_PASSWORD_HASH`
   - `MEMBER_DOWNLOAD_PASSWORD`
   - `ASSET_UPLOAD_PASSWORD_HASH`
   - `ASSET_UPLOAD_PASSWORD`
5. Supabaseの現在のプロジェクトに残すべき実データがないことを確認する。
6. DBを作り直し、`sql/001_init.sql`、`sql/002_rls.sql`の順に実行する。
7. デプロイ後、旧`/member/*`と立ち絵APIが404になり、`/`、`/musicians`、`/credit-builder`、`/admin`が動くことを確認する。

## Discord入力機能の準備

1. Discord Developer PortalでApplicationとBotを作成する。Administrator権限は与えない。
2. Application Command、Modal応答、限定監査チャンネルへの通知に必要な最小権限だけで、EMN Recordsサーバーへ招待する。
3. 登録対象のメンバーロール、運営者ロール、限定監査チャンネルを決め、それぞれのIDを控える。
4. `.env.example`に記載された環境変数を設定する。
5. Botには`INTAKE_API_SECRET`を設定し、`SUPABASE_SECRET_KEY`は設定しない。
6. Bot tokenまたは受付APIの認証情報がログ、チャット、commitへ出た場合は直ちに交換する。

## DBと復旧手段の準備

1. 開発・検証用のSupabaseプロジェクトを本番とは別に用意する。
2. 初期運用では有料プランを前提にせず、利用時点のSupabase FreeとProのバックアップ機能・保存期間を確認する。Supabase Freeに自動バックアップがあるとは仮定しない。
3. Supabase CLIの`db dump`、`pg_dump`、または管理者向けJSON exportのうち、現行スキーマを復元できる方法で論理バックアップを作成する。
4. 論理バックアップは週1回、または大きな登録・更新の前後に作成する。
5. dumpまたはJSON exportを暗号化し、Supabaseプロジェクト外の最低2箇所へ保存する。初期の保存先はローカルPCと、外部ストレージまたはクラウドストレージの組み合わせを基準にする。
6. バックアップを公開GitHubリポジトリへ置かない。privateリポジトリへ保存する場合も必ず暗号化する。DB接続文字列、パスワード、復号鍵はリポジトリへ保存しない。
7. 月1回、バックアップを検証用DBまたはローカルDBへ復元し、手順、結果、所要時間を記録する。
8. 本番DBへ直接復元する前に、必ず検証用DBまたはローカルDBで内容と復元結果を確認する。
9. 通常のプロフィール復旧にはDB全体のrestoreを使わず、監査ログの過去状態を新しい変更として反映する。DB全体のrestoreは、通常操作で復旧できない障害に限定する。
10. 登録、更新、ロック、ロック解除、過去状態への復旧を検証用環境で確認してから本番運用を開始する。

Supabase Proの日次バックアップやPITRは初期運用には必須としない。データ量、利用頻度、運営が負う責任範囲が増えた場合に、復旧時間と許容できるデータ損失量を見直したうえで将来選択肢として検討する。

## 運用開始の確認基準

- 対象ロールを持たないユーザーは入力を開始・送信できない。
- 本人は許可された公開プロフィール項目だけを変更できる。
- 正常な申請は承認待ちにならず、即時反映される。
- DB更新と監査ログが必ず同時に成立する。
- 同じDiscord interactionを再送しても二重更新されない。
- 本人または運営者の申請で対象レコードをロックできる。
- ロックされたレコードは本人から更新できない。
- 過去状態への復旧も新しい監査記録として残る。
