# インシデント対応手順

秘密情報をIssue、Discord、作業報告へ貼らないこと。対応の各操作は監査ログ(`musician_audit_logs`)に自動で残る。

## 1. Discordアカウントの乗っ取り(代表者本人)

対象: 代表者アカウントが第三者に操作されている、または不審な更新previewや反映が行われた。

1. `/emn-admin profile-lock musician:<slug> reason:乗っ取り疑い` で対象レコードを即時ロックする。ロック中は新規session作成と確定が拒否される。
2. `/emn-admin audit-list musician:<slug>` で不正な `profile_update` を特定する。
3. 不正更新があれば `/emn-admin profile-restore musician:<slug> audit_log:<不正更新のID> state:before` で直前の状態へ復旧する(新しい監査記録として残る)。
4. 本人がDiscordアカウントを回復できない場合、`/emn-admin representative-set` で本人の新アカウントへ代表者を付け替える(旧代表者行は自動で無効化される)。
5. 状況が収束したら `/emn-admin profile-unlock` で解除する。

## 2. Discord application認証情報の流出(Bot token / public keyの取り違え等)

対象: `DISCORD_BOT_TOKEN`等がログ、チャット、commitへ出た。

1. Discord Developer PortalでBot tokenを直ちにRegenerateする。
2. Vercelの環境変数を新しい値へ更新し、再デプロイする。
3. 流出中に登録・変更されたcommandがないかDeveloper Portalで確認し、`npx tsx scripts/register-discord-commands.ts` で正しい定義へ上書きする。
4. `/emn-admin audit-list` と限定監査チャンネルの通知を突き合わせ、流出時間帯の不審な操作を確認する。
5. `SUPABASE_SECRET_KEY`はBotへ渡していないため、この流出だけではDBへ直接書き込めない。ただし同時流出が疑われる場合はSupabase側のkeyもローテーションする。

## 3. 不正更新(権限内アカウントによる不適切な変更)

1. `/emn-admin profile-lock` で対象レコードをロックする。
2. `/emn-admin audit-list` で対象の監査ログIDを特定する。
3. `/emn-admin profile-restore … state:before` で不正更新前の状態へ復旧する。
4. 必要に応じて `/emn-admin representative-set` で代表者を変更し、`/emn-admin profile-unlock` で解除する。
5. 公開を止めるべき場合は `/emn-admin profile-hide` で非公開化する(物理削除は行わない)。

## 4. 監査通知の失敗

設計上、DBの監査記録はDiscord通知より先にcommitされるため、通知が失敗しても監査記録は失われない。

1. 限定監査チャンネルへ通知が届いていない期間を特定する。
2. Vercelのログで `discord api` の警告を確認する(token等は出力されない)。
3. `DISCORD_BOT_TOKEN`と`DISCORD_AUDIT_CHANNEL_ID`の設定、Botのチャンネル閲覧・送信権限を確認する。
4. 欠落期間の操作は `musician_audit_logs` を直接参照して確認する(Supabaseダッシュボード → Table Editor)。

## 共通の初動

- 影響範囲が不明な間は対象レコードをロックする(全体停止は不要。ロックはレコード単位)。
- 認証情報が疑わしければ先にローテーションし、その後に調査する。
- 対応後、`docs/operator-setup.md`の確認基準を再実行してから通常運用へ戻す。
