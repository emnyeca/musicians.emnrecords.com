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
6. DBを作り直し、`sql/001_init.sql`、`sql/002_rls.sql`、`sql/003_functions.sql`の順に実行する。
7. デプロイ後、旧`/member/*`と立ち絵APIが404になり、`/`、`/musicians`、`/credit-builder`、`/admin`が動くことを確認する。

## Discord Interaction受付の準備

1. Discord Developer PortalでApplicationを作成する。限定監査チャンネルへの投稿にBot userが必要な場合だけBotも有効にし、Administrator権限は与えない。
2. Applicationを`applications.commands`と必要最小限の権限だけでEMN Recordsサーバーへ追加する。コマンドはglobalではなくguild commandとして登録する。
3. 登録対象のメンバーロール、運営者ロール、限定監査チャンネルを決め、それぞれのIDを控える。
4. `npx tsx scripts/register-discord-commands.ts` でguild commandを登録する(`DISCORD_APPLICATION_ID`、`DISCORD_BOT_TOKEN`、`DISCORD_GUILD_ID`が必要)。`/emn-admin`はDiscordのIntegration設定で運営者ロールだけに許可する。これは補助であり、APIも毎回operator roleを再確認する。
5. Vercelへ`/api/discord/interactions`をデプロイした後、そのURLをDeveloper PortalのInteractions Endpoint URLへ設定する。PING応答と署名検証は実装済みのため、環境変数を設定してからデプロイすれば検証が通る。
6. `.env.example`に記載されたapplication public key、guild ID、member/operator role IDなどをVercelへ設定する。`SUPABASE_SECRET_KEY`はNext.jsのserver-only環境変数とし、browserやDiscord responseへ出さない。
7. 将来Botプロセスを分離する場合、Botには`INTAKE_API_SECRET`だけを設定し、`SUPABASE_SECRET_KEY`は設定しない。
8. Bot token、受付API認証情報、DB認証情報がログ、チャット、commitへ出た場合は直ちに交換する(手順は [incident-response.md](incident-response.md))。

## Discord実機確認

検証用の代表者とミュージシャンレコードを使い、実際のDiscord clientから次を順に確認する。自動テストだけで運用開始可とはしない。

1. `npx tsx scripts/register-discord-commands.ts`の実行後、対象guildだけに`/emn-profile`と`/emn-admin`が登録されている。
2. 代表者が`/emn-profile edit`を実行すると基本プロフィールModalが表示される。
3. Modal submit後、正本DBはまだ更新されず、入力内容を含むephemeral previewと各buttonが表示される。
4. previewの`[修正する]`から再びModalが表示される。
5. 再Modal submit後、同じpreview messageが新しい入力内容へ更新され、`[反映する]`などのbuttonが引き続き操作できる。ここでは、message componentから開いたModalの`MODAL_SUBMIT`に対する`UPDATE_MESSAGE`相当の応答が実Discordで成立することを重点確認する。
6. `[反映する]`を押すと`musicians`と公開リンクが更新される。
7. 同じtransactionで`musician_audit_logs`に`profile_update`が記録される。
8. DB監査のcommit後、限定監査チャンネルへ通知が送られる。通知失敗を再現できる場合は、DB更新と監査ログが失われないことも確認する。
9. 対象を`/emn-admin profile-lock`でロックすると本人更新は拒否される一方、`/emn-admin profile-restore`は成功し、復旧後もlockが維持される。確認後に必要な場合だけ`/emn-admin profile-unlock`で解除する。

[Discord公式仕様](https://docs.discord.com/developers/interactions/receiving-and-responding)では`UPDATE_MESSAGE`はcomponent由来のinteractionに限られ、componentから開いたModalのsubmitには元messageが含まれる。実機で手順5が通らない場合は、`submitSessionRevision`の応答を新しい`CHANNEL_MESSAGE_WITH_SOURCE`のephemeral previewへ切り替える。新sessionを有効、旧sessionを失効済みとする現在のDB処理は維持し、旧previewのbuttonが押された場合は「処理済み」と返す。これによりpreviewが一時的に2件見えても、有効な確定経路は新previewだけになる。切替後は手順3〜8を再確認する。

## DBと復旧手段の準備

1. 開発・検証用のSupabaseプロジェクトを本番とは別に用意する。
2. 初期運用では有料プランを前提にせず、利用時点のSupabase FreeとProのバックアップ機能・保存期間を確認する。Supabase Freeに自動バックアップがあるとは仮定しない。
3. `scripts/backup/backup-db.ps1`(Windows)または`scripts/backup/backup-db.sh`で暗号化論理バックアップを作成する。詳細は [backup-restore.md](backup-restore.md) を参照する。
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
- Modal submitだけでは正本DBが更新されない。
- ephemeral previewで本人が`[反映する]`を押した後、運営者の承認待ちなしで即時反映される。
- DB更新と監査ログが必ず同時に成立する。
- 同じDiscord interactionを再送しても二重更新されない。
- 本人または運営者の申請で対象レコードをロックできる。
- ロックされたレコードは本人から更新できない。
- 運営者はロック中のレコードを監査ログから復旧でき、復旧後もロック状態が維持される。
- 過去状態への復旧も新しい監査記録として残る。
