# 実装段階ごとのAI作業者向けプロンプト

以下を上から順に実行する。各段階のAI作業者は、最初に`AGENTS.md`、`README.md`、`docs/architecture.md`、Discordの現行公式Interactions・Components文書、`node_modules/next/dist/docs/`内の関係するNext.js文書、現在の作業ツリーを読むこと。関係のないユーザー変更を保持し、lint、build、追加したテストを実行し、外部環境で未確認の事項を確認済みと報告しないこと。

## 第1段階: Interaction受付APIとDB確定処理

> `sql/001_init.sql`と`sql/002_rls.sql`を正本として、代表者、レコード単位lock、version、短命な`profile_update_sessions`、interaction idempotency、追記専用`musician_audit_logs`の制約が要件を満たすか確認し、必要なら修正してください。Next.js Route Handler `/api/discord/interactions`をHTTP Interactions Endpointとして実装し、raw request bodyに対する`X-Signature-Ed25519`と`X-Signature-Timestamp`の検証、PINGへのPONG、3秒以内の初回応答を実装してください。対象guild、member/operator role、Discord user ID、代表者、record lockをAPI側で再認可してください。Modal submitでは正本DBを更新せず、未知項目を拒否して検証済みpayloadを短命sessionへ保存してください。previewの`[反映する]`buttonでのみ、session所有者、有効期限、未使用状態、`base_version`、lock、許可項目を再確認し、session消費、プロフィール更新、version加算、監査ログ追加を同一transactionで一度だけ実行してください。失敗も可能な範囲で監査してください。browser、interaction response、通知、ログへ`SUPABASE_SECRET_KEY`を露出させないでください。署名失敗401、PING、guild/role/代表者/lock拒否、未知項目、不正URL、過大入力、Modal submit非更新、confirm限定更新、二重confirm、古いversion、監査失敗時rollback、operator再認可、secret非露出を自動テストしてください。既存投稿のクロール、Web OAuth編集、運営者承認待ちフローは実装しないでください。

## 第2段階: command・Modal・preview button

> Discord Interactionによる本人プロフィール受付UIを実装してください。EMN Recordsサーバー専用のguild commandとして`/emn-profile edit`、`view`、`lock`と、運営者用の`/emn-admin representative-set`、`profile-lock`、`profile-unlock`を登録するscriptを追加してください。`/emn-profile edit`への応答として基本プロフィールModalを開き、`display_name`、`name_jp`、`name_en`、`roles`、`primary_sns_url`の5項目以内にしてください。Modal titleは45文字以内、`custom_id`は1〜100文字、Text InputはLabel内に配置してください。Modal submit後はephemeral preview messageを返し、`[反映する]`、`[修正する]`、`[キャンセル]`buttonを表示してください。追加リンクや任意項目はpreviewのbutton interactionへの応答として別Modalを開いてください。`MODAL_SUBMIT`への応答として次のModalを直接開かないでください。追加リンクModalも5項目以内にし、本人項目と運営項目を混在させないでください。各interactionへ3秒以内に応答し、必要ならdeferして15分以内にfollow-upしてください。Discord側permissionは補助とし、API側の再認可を省略しないでください。実際のDiscord資格情報と検証用guildを使っていない場合、実環境で確認済みとは報告しないでください。

## 第3段階: ロック申請と限定監査通知

> 本人または運営者が対象レコードをロックできるInteractionを完成させてください。本人は自分に紐づいたレコードだけを対象にし、運営者だけがロック解除、代表者変更、運営項目変更を実行できるよう、操作時点でoperator roleをAPI側でも再確認してください。プロフィール更新、拒否、失敗、lock、unlock、代表者変更の結果を、秘密情報や不要な個人情報を含めず限定監査チャンネルへ通知してください。通知失敗によってDBの監査記録を失わない設計にしてください。権限外操作、重複操作、更新との競合、通知失敗をテストしてください。通常更新の承認画面や汎用的な別管理ツールは作らないでください。

## 第4段階: 復旧、代表者変更、バックアップ

> 運営者専用の代表者変更、非公開化、lock解除、過去状態への復旧を実装してください。復旧は過去の監査情報をもとに新しい変更として反映し、復旧操作自体も監査ログへ追加してください。通常画面から物理削除できる機能は作らないでください。初期無料運用ではSupabase公式の自動バックアップやPITRを前提にせず、Supabase CLIの`db dump`、`pg_dump`、管理者向けJSON exportのいずれかを使い、追加の金銭的コストなしでプロジェクト外へ暗号化論理バックアップを保存する手順を実装してください。復元先はローカルDBまたは検証用DBとし、本番DBへ直接復元する前に内容を確認してください。秘密情報、DB接続文字列、dumpの復号鍵はリポジトリへ保存しないでください。Supabase Proの日次バックアップやPITRは、データ量、利用頻度、責任範囲が増えた場合の将来選択肢として文書化するだけでよく、初期運用の必須条件にしないでください。検証用DBへの復元を実施できる場合は実行し、できない場合は正確な手順と未確認事項を報告してください。Discordアカウント乗っ取り、application認証情報流出、不正更新、監査通知失敗に対する対応手順もまとめてください。

## 第5段階: 本番前の安全性確認

> merge前の修正と本番前の安全性確認を行ってください。依存関係の脆弱性情報、Next.jsとDiscord APIの現行公式文書、Discord request署名、3秒応答、15分token期限、Modal component制約、RLSとDB権限、service-role keyの利用箇所、ログ、回数制限、セキュリティヘッダー、秘密情報の交換手順、エラー表示、個人情報の最小化、アクセシビリティ、スマートフォンでの操作を確認してください。検証環境でcommand、Modal submit、ephemeral preview、修正button、確定button、即時更新、監査、限定通知、重複送信、lock、unlock、代表者変更、復旧、バックアップ、restoreを一通り確認してください。問題を先に修正してから文書を更新してください。最後にEmnyecaが行う外部操作だけを短いチェックリストにし、確認済み事項と未確認事項を分けて報告してください。
