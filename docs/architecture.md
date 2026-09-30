# プロダクト方針とセキュリティ設計

## 目的と対象範囲

このプロダクトの目的は、EMN Recordsのミュージシャンを見つけやすくすることと、イベントの正確なCreditを簡単に作れるようにすることである。扱う情報は、本人が公開を希望したプロフィール情報に限る。

Credit作成画面での一時編集は、その場の出力だけに使い、名鑑DBへ書き戻さない。選択中の名鑑メンバーは、名鑑データを読み込むたびに最新の公開プロフィールへ更新し、一時編集の値は維持する。名鑑は閲覧モードで開き、クレジット作成モードはトグル操作かCredit Builderの「名鑑から追加」（`/musicians?mode=credit`）でだけ有効にする。立ち絵などの非公開ファイルの配布、既存Discord投稿のクロール、Discord OAuthを使ったWeb上の本人編集、運営者による通常更新の事前承認は対象外とする。

### 名鑑の対象とCredit用ゲスト

名鑑の主役はバーチャルミュージシャン。登録対象は掲載を希望するEMN Recordsコミュニティ構成員とし、Creator / Staffも含める。所属を問わずイベントに関わった人をCreditへ追加できる。

`profile.directory_categories` は `musician` / `creator/staff`。運営と本人が編集でき、演奏・歌唱・作曲などと他の担当を兼ねる人はMusicianとして扱う。具体的な担当は `roles` に記入する。初期表示はMusician、Creator / StaffフィルターはMusicianを含まない人。名前検索・Credit作成モードでは全員を対象にする。分類のない既存レコードは移行互換としてMusician扱いとし、公開前に運営が確認する。

外部コラボレーターは名鑑へ継続登録せず、Credit画面でゲストとして入力する。表示名は必須、日本語名・英語名・担当・リンク2件・アイコンURLは任意。日本語名未入力時は表示名を出力に使う。名鑑への所属や公開プロフィールURLをゲストに付与しない。Creditへ載せる名前・担当・リンクは主催者が本人との合意に沿って確認する。

ゲストのアイコンはURLのほか端末の画像も選べる。端末の画像は256pxのJPEG data URLに縮小してブラウザ内だけで使い、サーバーへ送らず、Creditの文字出力（JSON・Custom Formatを含む）にも含めない。

ゲストの「この端末に保存」は同じorigin・ブラウザのlocalStorageに保存し、検索・編集・削除・再利用を可能にする。クラウド同期は行わず、サイトデータ削除で失われる。保存失敗は通知する。選択中のCreditは追加時点のスナップショットを使い、保存済み一覧の編集・削除・Creditのクリアは相互に波及させない。Creditで編集したゲストを保存済み一覧へ反映する際は、明示的な保存操作を必要とする。

Office移行データの外部コラボレーターは公開対象から外す。監査・復旧を保つため通常は管理画面で `hidden` にし、必要なイベントではゲスト入力を利用する。

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

主な入口は専用チャンネルの「自分のプロフィールを確認・編集」ボタンとする。署名・guild・member/operator roleを検証し、本人だけに見える返信でWeb編集画面へのリンクを発行する。共通メッセージの編集応答は使わず、必ずephemeral応答を作る。

- リンクはランダム256bit、5分間・1回限り。DBにはhashだけを保存し、URLのfragmentで渡してWeb画面で直ちに除去する。ブラウザの永続ストレージへ保存しない。
- リンク交換後は管理画面とは別の30分sessionを使う。HttpOnly・SameSite=Strict・本番Secure cookie、書き込みのOrigin照合とCSRF tokenで保護する。新しいリンクの発行で古いリンクと編集sessionを失効する。
- 交換・読み込み・保存時にDiscord APIで現在のguild所属とroleを確認する。Discord障害時は許可せず再試行を案内する。対象はsession内の本人レコードに固定し、紐付け変更、有効期限、version、lockを保存時に再検証する。
- 紐付け済みなら現在のプロフィールを表示し、明示的な「変更を保存」または「変更せずに確認済みにする」で確定する。
- 紐付けがなければ新規登録画面にする。既存プロフィールの紐付けは運用開始前に運営が済ませる。作成・本人への紐付け・確認済み監査を同一transactionで行う。公開状態の初期値はdraft。二重作成はDiscord IDのunique制約と行lockで防ぐ。
- slugは新規・既存とも本人が変更できる。入力中に重複を照会し、確定時もDBのunique制約で競合を防ぐ。変更後は旧URLを転送せず404にする旨を入力画面に示す。公開状態（public / draft / hidden）は本人が選べる。掲載辞退は専用操作を設けず、本人がhiddenを選ぶ。代表者・不審フラグ・ロックなどの運営項目は本人Web APIでは変更できない。

### 担当の選択とDiscord初期値

`server/role-catalog.json`を担当候補・既知の表記揺れ・Vanity Role ID対応の正本とし、PHPとWeb画面で共用する。本人と管理画面では選択式（最大30件）とし、先頭がクレジットの主担当。「メインにする」で先頭へ移動できる。`roles`はクレジット用の表示文字列、`role_choices`は選択肢の順序、`other_role`はOtherの任意記入。検索タグは`role_choices`から作り、Otherの記入内容を新しいタグにしない。旧データ・従来のDiscord Modalの自由記入は、既知の表記を候補に対応させ、それ以外をOtherタグとして扱う。

新規作成画面には現在のDiscord Vanity Roleを初期表示し、MusicianロールがあればMusician区分、なければCreator / Staff区分とする。本人が保存前後に変更でき、継続同期で上書きしない。既存代表者への一括取込みは`import-vanity-roles.php`でdry-run後に1回だけ行う。既存担当・先頭順・公開状態を維持してVanity Roleを追加し、区分を初期設定する。ロック・退会・競合は反映せず、監査とversion更新を伴う。取込み済みの人と新規自己登録済みの人は再実行で除外する。

### アイコン画像

本人Web画面から5MB以下・1600万画素以下のJPEG/PNG/WebPを受け付ける。拡張子を信用せずGDで復号し、中央の正方形を最大512pxのPNGに再生成してメタデータを除く。非公開領域の`icon-storage`（configの`icon_storage_dir`で変更可）へ乱数名で保存し、ファイルを直接公開ディレクトリに置かない。公開APIはpublicプロフィールに指定された画像のみ返す。本人専用APIは本人のアップロード画像・本人プロフィールの画像を返し、管理者は管理sessionで下書き画像も確認できる。アップロードだけではプロフィールを変更せず、通常保存でURLを確定する。アップロード回数制限と既存の本人認証・Origin・CSRF・lock検証を適用する。

画像ファイルはコード更新で上書き・削除せず、DBとともにバックアップする。過去の監査からの復旧でも元画像を参照できるよう保持する。

### 従来のスラッシュコマンド

Discordだけで完結する以下の経路も維持する。

1. 本人がEMN Recordsサーバー内で`/emn-profile edit`を実行する。
2. Interaction handlerが`guild_id`、member role、Discord user ID、代表者との紐づけ、record lockを確認する。
3. commandへの応答として、基本プロフィール入力Modalを開く。
4. 最初のModalでは`display_name`、`name_jp`、`name_en`、`roles`、`primary_sns_url`の最大5項目を受ける。
5. Modal submitを受けたら形式を検証し、正本DBを更新せず、短命の`profile_update_sessions`へ提出値と検証済み値を保存する。
6. 本人だけに見えるephemeral preview messageを返し、`[反映する]`、`[修正する]`、`[キャンセル]`buttonを表示する。
7. 追加リンクや任意項目はpreview上のbuttonから別Modalを開いて編集する。Modal submitから直接次のModalは開かない。
8. `[反映する]`が押された時点で、受付APIがguild、role、代表者、session所有者、有効期限、未使用状態、version、lock、許可項目、入力形式を再確認する。
9. 許可項目だけをホワイトリストで更新し、プロフィール更新と監査ログ追加を同一transactionで行う。sessionの`consumed_at`も同じ確定処理で一度だけ設定する。
10. 成功後、秘密情報を含めず、限定監査チャンネルへ通知する。
11. `[修正する]`ではbutton interactionへの応答として対象Modalを開き、`[キャンセル]`ではsessionを失効させる。

「即時反映」とはModal送信直後の反映ではない。本人がephemeral previewで内容を確認し、`[反映する]`を押した後、運営者の事前承認を挟まずに反映することを指す。

## 初回移行と一括公開

Officeの共演履歴から得た人物情報は公開情報の完成版とはみなさず、すべて`draft`として取り込む。初回公開は次の順序で行う。

1. Officeの人物情報を重複させずに下書きとして取り込む。
2. 運営者が名前、英語名、役割、SNS、画像を確認する。
3. 運営者がDiscordユーザーとmusicianレコードを代表者として紐づける。
4. Discordで確認方法と確認期日を告知する。
5. 本人が自分の情報だけを確認・修正する。掲載を望まない場合は公開状態をhiddenにする。
6. 確認期日時点でdraftのまま、未確認で判断を保留した対象、必須項目が不十分な対象を除き、運営者が一括公開する。hiddenは一括公開の対象外。

## 本人による変更の監視と削除

本人の変更は事前承認せずに反映し、監査チャンネルで事後に確認する。本人による作成・更新の通知には、変わった項目だけを載せる。リスト項目（担当・区分・別名義・追加リンク）は追加・削除した要素だけ、並び替えだけなら新しい先頭を示す。確認済み操作とロック申請には差分もボタンも付けない。

作成・更新の通知には、目立ちすぎないグレーの「気になる変更ならこちら（非公開にしてロックします）」ボタンを付ける。operator roleの人が押すと、そのレコードに`is_suspicious`を立て、hiddenにし、ロックする。本人は以後、保存・確認済み・削除ができない。解除・復旧は運営が管理画面または`/emn-admin`で行う。押した結果は通知メッセージに追記してボタンを外し、押した人にだけ、変更前へ戻すための`profile-restore`コマンドを返す。

本人Web画面の「データベースから削除」では、プロフィール・代表者の紐付け・未確定preview・本人の変更履歴（監査ログ）・アップロード画像を削除する。内容を含まない`profile_erased`記録と監査チャンネルへの通知を残す。監査ログは通常triggerで削除を拒否し、例外は削除処理が同じDB sessionで`@emn_erase_musician_id`に対象IDを設定した場合だけにする。画像は、他のプロフィールやその監査履歴から参照されていないものだけを削除する。古い編集sessionの再有効化を防ぐため、`member_web_access`の世代番号は増やして保持し、リンクとプロフィールへの紐付けを失効させる。ロック中は本人による削除を受け付けない。バックアップに残る過去データは消えない。

## 本人項目と運営項目

本人が変更できる項目は次に限定する。

- `display_name`
- `name_jp`
- `name_en`
- `roles`
- `slug`（本人Web画面）
- `visibility`（本人Web画面）
- `primary_sns_url`
- `website_url`
- `icon_image_url`
- `vrc_name`
- `aliases`
- `directory_categories`（本人Web画面）
- 公開する`musician_links`

追加リンクModalは`platform`、`label`、`url`、`display_order`、削除指定の最大5項目とする。自由記述のnoteは正本DBへ保存しない。

本人が変更できない項目は次のとおりである。

- `id`
- `is_suspicious`
- 代表者とowner情報
- `is_locked`、`locked_at`、`locked_reason`
- 監査項目
- `created_at`、`updated_at`
- `version`

許可項目はAPI側で明示的に列挙する。未知の項目は無視せずrequest全体を拒否する。

## 権限とコマンド

- 一般閲覧者: `visibility = 'public'`のミュージシャンと公開リンクだけを読む。
- 代表者: 自分に紐づいた1レコードのプロフィールと公開状態をWeb画面の保存またはDiscordのpreview確認で更新し、自分のレコードをロック申請・削除できる。
- 運営者: 代表者の設定・失効、対象レコードのロック・解除、不審フラグの設定・解除、非公開化、復旧を行う。
- DB書き込み処理: 信頼されたPHP APIだけがMySQLへ接続する。DB接続情報・管理パスワード・Discord tokenをブラウザ、interaction payload、通知、ログへ渡さない。

初期コマンドは次のとおりとする。

- `/emn-profile edit`: 自分の公開プロフィール更新を開始する。
- `/emn-profile view`: 現在の登録情報をephemeralで確認する。
- `/emn-profile confirm`: 修正がない場合も現在の登録内容を確認済みとして記録する。
- `/emn-profile lock`: 自分のレコードの一時ロックを申請する。
- `/emn-admin representative-set`: 運営者がDiscord user IDとmusician IDを紐づける。
- `/emn-admin representative-revoke`: 運営者が現在の代表者を失効する。
- `/emn-admin profile-lock`: 運営者が対象レコードをロックする。
- `/emn-admin profile-unlock`: 運営者がロックを解除する。
- `/emn-admin profile-hide` / `profile-show`: 運営者が対象レコードを非公開化・再公開する。
- `/emn-admin profile-restore`: 運営者が監査ログの過去状態を新しい変更として反映する。
- `/emn-admin audit-list`: 運営者が復旧に使う監査ログIDを確認する。

運営者コマンドはDiscord側で利用者を絞ったうえで、API側でも`DISCORD_OPERATOR_ROLE_ID`を操作時点で再確認する。ユニットやデュオも初期運用では有効な代表者を1名にする。

## 配信とAPI構成

外部サービスごとの認証・維持管理を減らし、既存契約のConoHa WINGへ集約する。
静的ビルドしたNext.jsの画面とPHP APIを `musicians.emnrecords.com` へ置き、MySQLを正本とする。
Node.jsはビルド時だけ使用する。Next.js server、Vercel、Supabase、常駐Botを運用条件にしない。

一覧・検索・Credit作成の画面は公開APIから最新のプロフィールを取得する。
`/musicians/{slug}` はPHPが公開状態を確認し、共通の詳細画面にtitle・OGPを付けて返す。
存在しないレコードと非公開レコードは404。プロフィール更新時の再ビルドは不要。
静的ページに実データや秘密情報を埋め込まない。API障害を空の名鑑やmock表示で隠さない。

Discord受付は `/api/discord/interactions`。署名とtimestampを検証したraw bodyだけを扱う。
Modalを開く操作は同期応答し、ほかはDB処理前にdeferする。
LSAPI/FPMではHTTP応答を終了して処理を継続する。それ以外の実行環境ではDiscord callback APIで先に応答する。
通知の失敗はDBの確定を取り消さない。通知欠落時は監査ログで確認する。

運営Web画面はパスワードのhash検証と1時間のサーバーsessionで保護する。
HttpOnly・SameSite=Strict cookie、本番HTTPSでSecure、書き込み時のOrigin照合を用いる。
ログイン試行とDiscord操作のrate limitはMySQLへ保存し、PHPプロセス間で共有する。

## DB正本とアクセス境界

`sql/schema.sql` を新規DB用の正本とする。

- `musicians`: ID、slug、公開状態、version、lockを通常columnで管理し、プロフィール項目と公開リンクを `profile` JSONへまとめる。
- `musician_representatives`: 現在の代表者だけを管理する。musician IDとDiscord user IDをそれぞれuniqueにし、変更履歴は監査へ残す。
- `profile_update_sessions`: 提出値・検証済みpayload・基準version・10分の有効期限・消費状態を保持する。
- `member_web_access`: Discord IDごとの使い捨てリンクhash・5分の期限・対象レコード・session失効用の世代を保持する。既存DBへの追加は`sql/002_member_web_access.sql`を使う。
- `musician_audit_logs`: 作成、本人更新、失敗、lock、公開状態、不審フラグ、復旧、代表者変更の追記専用履歴。updateをtriggerで拒否し、deleteは本人の削除処理だけに限る。既存DBへの変更は`scripts/install-suspicious-flag.php`で適用する。
- `rate_limits`: 短期の操作回数。期限切れは通常アクセス時に掃除する。

プロフィール更新・version加算・session消費・監査追加は同一InnoDB transactionで行う。
同じmusicianへの書き込みは行lockで直列化し、interaction IDのunique制約で二重反映を防ぐ。
preview修正時の旧session失効と新session作成も同一transactionとする。
運営者による変更はversionを更新し、未確定previewを失効する。復旧でもversionを巻き戻さない。

DBに公開接続口は設けず、PHPの公開APIはpublic recordと公開リンクだけを明示的な項目で返す。
代表者・session・監査・lock詳細を公開レスポンスに含めない。
自己編集の許可項目・型・長さ・URL形式は提出時と確定時の両方で検証する。
DBの認証情報とPHP実装は `public_html` の外に配置する。

## ロックと復旧

- 本人または運営者から申請があった場合、対象レコードだけをロックする。
- 不審な連続更新、権限不整合、認証情報流出でも対象レコードをロックできる。
- ロック中はDiscord編集session作成と確定を拒否する。本人Web画面は読み取りだけ許可し、保存・確認済み操作を拒否する。
- ロック解除、代表者変更、過去状態への復旧は運営者だけが行う。運営者は事故対応のためロック中でも復旧でき、復旧後もロック状態を維持する。確認後に必要な場合だけ`/emn-admin profile-unlock`で明示的に解除する。
- 物理削除は本人Web画面の「データベースから削除」だけとし、運営の通常対応は非公開化とする。
- 通常のプロフィール復旧は監査ログの過去状態を新しい変更として反映し、復旧操作も記録する。

## バックアップ

ConoHaの既存バックアップと、プロジェクト外へ保存する暗号化したMySQL論理バックアップを利用する。
監査ログによる個別復旧と、DB全体の障害復旧を区別する。
バックアップを取得したことだけで復旧可能と判断せず、別DBへの復元で確認する。
追加の有料サービスを必須にしない。手順は `backup-restore.md` にまとめる。

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
- browser bundle、interaction response、通知、ログにDBパスワード・Discord tokenが露出しない。

## Legacy

中止した立ち絵機能は実行可能な`legacy`サブシステムとして残さない。コードと初期DB定義から削除し、必要な場合だけGit履歴を参照する。
