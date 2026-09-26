# 障害・誤更新への対応

## 誤更新・不審な操作

`/emn-admin profile-lock` で対象レコードを止め、必要なら `profile-hide` で非公開にする。
`audit-list` のIDを使って `profile-restore` でbefore/afterを選ぶ。
復旧は現在のlockを維持する。内容確認後に必要なら明示的にunlockする。
代表者を外す場合は `representative-revoke`。代表者変更は未確定previewも失効する。

## 認証情報の流出

Discord Bot tokenはDeveloper Portalで再発行し、公開領域外のconfigを更新する。
DBパスワードが流出した場合はConoHaで変更し、configも更新する。
管理パスワードはhashを差し替える。既存管理sessionは新hashと一致しないため無効になる。
config・dump・ログに秘密値が混入した場合は、公開経路を止めてから流出範囲を確認する。

## Discord通知の欠落

通知失敗だけではDB更新を取り消さない。PHPログの `musicians: Discord request failed` と監査DBを確認する。
監査チャンネルの閲覧/送信権限とtokenを確認する。通知の自動再送はない。
確定結果メッセージが届かなかった場合も、再操作前にprofile viewと監査ログで確定済みか確認する。

## DB・API障害

図鑑APIはエラーを返し、mockへ切り替えない。ConoHaのPHPログ、DB接続設定、容量、WAFを確認する。
個人データ・認証情報・raw requestをログへ追加しない。
全体復旧は `backup-restore.md` の手順で別DBに復元して確認する。
