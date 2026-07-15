# バックアップと復元の手順

初期無料運用の方針は [docs/architecture.md](architecture.md) のとおり、Supabase公式の自動バックアップやPITRを前提にせず、追加の金銭的コストなしで暗号化論理バックアップをプロジェクト外へ保存する。

## 前提ツール

- PostgreSQL client tools(`pg_dump`、`psql`)。<https://www.postgresql.org/download/> から無料で入手できる。
- `openssl`(Git for Windowsに同梱。`openssl version`で確認)。
- 接続文字列はSupabaseダッシュボードの Project Settings → Database → Connection string(URI)を使う。

## バックアップの作成

リポジトリ同梱のscriptを使う。DB接続文字列と暗号化パスフレーズは環境変数でのみ渡し、リポジトリ・Issue・チャットへ貼らない。

Windows (PowerShell):

```powershell
$env:SUPABASE_DB_URL = "postgresql://…"   # Supabaseの接続文字列
$env:BACKUP_PASSPHRASE = "十分に長いパスフレーズ"
powershell -File scripts/backup/backup-db.ps1
```

macOS / Linux:

```bash
SUPABASE_DB_URL='postgresql://…' BACKUP_PASSPHRASE='…' ./scripts/backup/backup-db.sh
```

出力は `~/emn-backups/emn-musicians-<UTC時刻>.sql.enc`(AES-256-CBC + PBKDF2)。平文dumpはscriptが削除する。

Supabase CLIを使う場合は `supabase db dump --db-url "$SUPABASE_DB_URL" -f dump.sql` でも同等の論理バックアップを作成できる。その場合も必ず暗号化してから保存する。

## 保存のルール

- 週1回、および大きな登録・更新の前後に作成する。
- Supabaseプロジェクト外の最低2箇所へ保存する(例: ローカルPCと、暗号化済みファイルをクラウドストレージ)。
- 公開GitHubリポジトリへ置かない。privateリポジトリでも暗号化済みファイル以外は置かない。
- `SUPABASE_DB_URL`、`BACKUP_PASSPHRASE`、復号鍵をリポジトリへ保存しない。パスフレーズはパスワードマネージャで管理する。

## 復元(検証用DBまたはローカルDBのみ)

本番DBへ直接復元しない。まず検証用DBまたはローカルDBで内容を確認する。

```bash
# 1. 復号
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE \
  -in emn-musicians-<stamp>.sql.enc -out restore.sql

# 2. 復元先(ローカルDBの例。検証用SupabaseプロジェクトのURIでも可)
createdb emn_restore_check
psql postgresql://localhost/emn_restore_check -f restore.sql

# 3. 内容確認の例
psql postgresql://localhost/emn_restore_check -c "select count(*) from musicians;"
psql postgresql://localhost/emn_restore_check -c "select count(*) from musician_audit_logs;"

# 4. 平文を消す
rm restore.sql
```

月1回、復元手順・結果・所要時間を記録する。通常のプロフィール復旧にはDB全体のrestoreを使わず、`/emn-admin profile-restore`(監査ログの過去状態を新しい変更として反映)を使う。DB全体のrestoreは通常操作で復旧できない障害に限定する。

## 将来選択肢(初期運用では必須にしない)

データ量、利用頻度、運営が負う責任範囲が増えた場合は、復旧時間(RTO)と許容できるデータ損失量(RPO)を見直したうえで、Supabase Proの日次バックアップやPITRを検討する。導入判断時点の公式ドキュメントで、Freeプランのバックアップ有無・Proの保存期間を確認すること(未確認の無料プラン仕様を前提にしない)。
