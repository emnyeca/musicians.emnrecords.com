# バックアップと復旧

プロフィールの誤更新は `/emn-admin audit-list` と `profile-restore` で戻す。
復旧も新しい変更として監査へ記録され、現在のlockは維持される。

DB全体の保護はConoHaの自動バックアップとMySQL論理バックアップを使う。
ConoHa側の保存期間・復元方法・対象DBは管理画面で確認する。

論理バックアップはphpMyAdminから対象DB全体をSQL形式でexportする。
すべてのテーブル・データ・監査triggerを含める。接続できるサーバー側CLIでは
`mysqldump --single-transaction --triggers --no-tablespaces --set-gtid-purged=OFF -h HOST -u USER -p DATABASE > backup.sql`
でも取得できる。パスワードを引数やGitへ保存しない。

dumpには監査・Discord ID等を含むため、プロジェクト外で暗号化し、暗号化済みコピーを別の保存先にも保持する。
`config.php` はdumpに含まれないので別途安全な場所へ退避する。

復元は新しい検証用DBへimportして行う。監査triggerを削除して本番DBへ上書きしない。
件数・公開状態・代表者・最新監査を確認し、PHPの接続先を検証DBへ切り替えて読取と更新を確認する。
本番への切替えは確認後に行う。
