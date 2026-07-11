# プロダクト方針とセキュリティ設計

## 目的と対象範囲

このプロダクトの目的は、EMN Recordsのミュージシャンを見つけやすくすることと、イベントの正確なCreditを簡単に作れるようにすることである。扱う情報は、本人が公開を希望したプロフィール情報に限る。

Credit作成画面での一時編集は、その場の出力だけに使い、名鑑DBへ書き戻さない。立ち絵などの非公開ファイルの配布、既存Discord投稿のクロール、Discord OAuthを使ったWeb上の本人編集、運営者による通常更新の事前承認は対象外とする。

## Discord Interactionとしての受付

正規の入力経路を「Discord Modalによる本人入力」ではなく「Discord Interactionによる本人プロフィール受付」と定義する。Modalは単独のフォーム基盤ではなく、application commandまたはmessage componentへの応答として自由入力を受けるUI部品である。

Discord公式仕様に基づき、次を守る。

- Modalはcommandまたはmessage componentへの応答として開く。`MODAL_SUBMIT`への応答として別のModalを直接開かない。
- interactionへの初回応答は3秒以内に返す。時間のかかる処理は3秒以内にdeferし、その後に処理する。
- interaction tokenを使うfollow-upは発行から15分以内に行う。
- Modal titleは45文字以内、Modalと入力部品の`custom_id`は1〜100文字にする。
- 1つのModalに置く入力componentは1〜5個にする。Text Inputは自由入力用であり、現行のComponent Referenceに従ってLabel内へ置く。
- HTTP Interactions Endpointは、Discordの`PING`へ`PONG`を返し、すべてのrequestで`X-Signature-Ed25519`と`X-Signature-Timestamp`を検証する。
- コマンドはEMN Recordsサーバー専用のguild commandとして登録する。
- Discord側のcommand permissionとmember roleは操作ミスを減らす補助とし、受付APIでもguild、role、Discord user ID、代表者、lockを毎回確認する。

参照する正本は、Discord公式の [Receiving and Responding](https://docs.discord.com/developers/interactions/receiving-and-responding)、[Interactions Overview](https://docs.discord.com/developers/interactions/overview)、[Component Reference](https://docs.discord.com/developers/components/reference)、[Application Commands](https://docs.discord.com/developers/interactions/application-commands) とする。実装時には固定した記憶ではなく、その時点の公式仕様を読み直す。

## 採用する更新の流れ

1. 本人がEMN Recordsサーバー内で`/emn-profile edit`を実行する。
2. Interaction handlerが`guild_id`、member role、Discord user ID、代表者との紐づけ、record lockを確認する。
3. commandへの応答として、基本プロフィール入力Modalを開く。
4. 最初のModalでは`display_name`、`name_jp`、`name_en`、`roles`、`primary_sns_url`の最大5項目を受ける。
5. Modal submitを受けたら形式を検証し、正本DBを更新せず、短命の`profile_update_sessions`へ提出値と検証済み値を保存する。
6. 本人だけに見えるephemeral preview messageを返し、`[反映する]`、`[修正する]`、`[キャンセル]`buttonを表示する。
7. 追加リンクや任意項目はpreview上のbuttonから別Modalを開いて編集する。Modal submitから直接次のModalは開かない。
8. `[反映する]`が押された時点で、受付APIがguild、role、代表者、session所有者、有効期限、未使用状態、version、lock、許可項目、入力形式を再確認する。
9. 許可項目だけをホワイトリストで更新し、プロフィール更新と監査ログ追加を同一transactionで行う。sessionの`consumed_at`も同じ確定処理で一度だけ設定する。
10. 成功後、秘密情報や不要な個人情報を含めず、限定監査チャンネルへ通知する。
11. `[修正する]`ではbutton interactionへの応答として対象Modalを開き、`[キャンセル]`ではsessionを失効させる。

「即時反映」とはModal送信直後の反映ではない。本人がephemeral previewで内容を確認し、`[反映する]`を押した後、運営者の事前承認を挟まずに反映することを指す。

## 本人項目と運営項目

本人が変更できる項目は次に限定する。

- `display_name`
- `name_jp`
- `name_en`
- `roles`
- `primary_sns_url`
- `website_url`
- `icon_image_url`
- `vrc_name`
- `aliases`
- 公開する`musician_links`

追加リンクModalは`platform`、`label`、`url`、`display_order`、削除指定の最大5項目とする。自由記述のnoteは正本DBへ保存しない。

本人が変更できない項目は次のとおりである。

- `id`、`slug`
- `visibility`、`is_verified`
- 代表者とowner情報
- `is_locked`、`locked_at`、`locked_reason`
- 監査項目
- `created_at`、`updated_at`
- `version`

許可項目はAPI側で明示的に列挙する。未知の項目は無視せずrequest全体を拒否する。

## 権限とコマンド

- 一般閲覧者: `visibility = 'public'`のミュージシャンと公開リンクだけを読む。
- 代表者: 自分に紐づいた1レコードの公開プロフィールをpreview確認後に更新し、自分のレコードをロック申請できる。
- 運営者: 代表者の設定・失効、対象レコードのロック・解除、非公開化、復旧を行う。
- DB書き込み処理: 信頼されたNext.js server routeだけがservice roleで実行する。ブラウザ、Discord interaction payload、通知、ログへservice-role keyを渡さない。

初期コマンドは次のとおりとする。

- `/emn-profile edit`: 自分の公開プロフィール更新を開始する。
- `/emn-profile view`: 現在の登録情報をephemeralで確認する。
- `/emn-profile lock`: 自分のレコードの一時ロックを申請する。
- `/emn-admin representative-set`: 運営者がDiscord user IDとmusician IDを紐づける。
- `/emn-admin profile-lock`: 運営者が対象レコードをロックする。
- `/emn-admin profile-unlock`: 運営者がロックを解除する。

運営者コマンドはDiscord側で利用者を絞ったうえで、API側でも`DISCORD_OPERATOR_ROLE_ID`を操作時点で再確認する。ユニットやデュオも初期運用では有効な代表者を1名にする。

## API構成の判断

初期実装は、Vercel上のNext.js Route Handler `/api/discord/interactions`をDiscordのHTTP Interactions Endpointとして使う。

この構成を選ぶ理由は、常駐Bot用の別実行環境を増やさず、PING、署名検証、slash command、button、Modal submit、DB transactionを同じserver-only境界に集約でき、初期無料運用と秘密情報管理が単純になるためである。commandやModal表示は3秒以内に同期応答し、確定処理が3秒を超える可能性がある場合はbutton interactionへdeferred responseを返す。

将来Gateway接続や常駐処理が必要になった場合はBotプロセスを分離できる。その場合もBotが持つのは個別に交換できる`INTAKE_API_SECRET`だけとし、`SUPABASE_SECRET_KEY`は受付API側だけに置く。

## DB正本

実データがないため、`sql/001_init.sql`と`sql/002_rls.sql`を作り直し用の正本とする。

- `musicians`: `version`、`is_locked`、`locked_at`、`locked_reason`を持つ。
- `musician_representatives`: Discord user IDとmusician recordの代表者関係を管理し、部分unique indexで有効な代表者を1名にする。
- `profile_update_sessions`: Modal submit後、確定前の短命draft、提出値、検証済み値、基準version、有効期限、消費状態を持つ。`discord_interaction_id`と`session_id`をuniqueにする。
- `musician_audit_logs`: 通常更新、失敗、ロック、解除、復旧、代表者変更を記録する。`interaction_id`をuniqueにし、triggerでupdateとdeleteを拒否する。

`profile_update_sessions`の確定は、未使用sessionの消費、`base_version`と現在versionの一致、lock確認、プロフィール更新、version加算、監査ログ追加を1つのtransactionで行う。二重confirmは最初の1回だけが成功する。

## RLS

- 匿名クライアントはpublic musiciansと、その公開リンクだけをselectできる。
- `musician_representatives`、`profile_update_sessions`、`musician_audit_logs`にはclient向けpolicyを作らない。
- `credit_exports`にも匿名policyを作らない。
- Discord本人性をSupabase Authへ載せ替えず、署名検証済みのserver routeがservice roleで操作する。
- service roleはRLSを迂回するため、route内の再認可、項目ホワイトリスト、transaction、監査を必須とする。

## ロックと復旧

- 本人または運営者から申請があった場合、対象レコードだけをロックする。
- 不審な連続更新、権限不整合、認証情報流出でも対象レコードをロックできる。
- ロック中は新規session作成と確定を拒否する。
- ロック解除、代表者変更、過去状態への復旧は運営者だけが行う。
- 公開画面から物理削除する機能は作らず、通常は非公開化で対応する。
- 通常のプロフィール復旧は監査ログの過去状態を新しい変更として反映し、復旧操作も記録する。

## バックアップ

- 初期運用では金銭的コストを増やさず、Supabase Freeに自動バックアップがあると仮定しない。利用時点のFreeとProの仕様は確認するが、未確認の無料プラン仕様を前提にしない。
- 初期の復旧方針は、追記専用監査ログと、プロジェクト外へ暗号化して保存する論理バックアップで成立させる。
- 論理バックアップは最低2箇所へ保存し、検証用DBまたはローカルDBへ定期的に復元する。
- Supabase Proの日次バックアップやPITRは初期運用の必須条件にしない。データ量、利用頻度、責任範囲が増えた場合の将来選択肢とする。

## テスト方針

Interaction受付実装では、少なくとも次を自動テストする。

- 署名検証失敗は401、正しいPINGはPONG。
- 対象外guild、対象roleなし、代表者なし、locked recordを拒否する。
- 未知項目、不正URL、過大入力を拒否する。
- Modal submitでは正本DBを更新せず、短命sessionだけを作る。
- previewの`[反映する]`でだけDBを更新する。
- confirm二重押し、同じinteraction IDの再送で二重更新しない。
- 古い`base_version`を拒否する。
- 監査ログ追加に失敗した場合、プロフィール更新とsession消費もrollbackする。
- 運営者コマンドはAPI側でもoperator roleを再確認する。
- browser bundle、interaction response、通知、ログにservice-role keyが露出しない。

## Legacy

中止した立ち絵機能は実行可能な`legacy`サブシステムとして残さない。コードと初期DB定義から削除し、必要な場合だけGit履歴を参照する。
