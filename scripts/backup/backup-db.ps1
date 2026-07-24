# Supabase PostgreSQLの暗号化論理バックアップを作成する(Windows用)。
#
# 使い方:
#   $env:SUPABASE_DB_URL = 'postgresql://...'
#   $env:BACKUP_PASSPHRASE = '...'
#   powershell -File scripts/backup/backup-db.ps1 [-OutDir C:\path\to\backups]
#
# - 既定の出力先は "$HOME\emn-backups"。リポジトリ内へ出力しない。
# - pg_dump(PostgreSQL client tools)とopensslが必要。追加費用は不要。
# - DB接続文字列とパスフレーズは環境変数でのみ渡し、リポジトリへ保存しない。
param(
  [string]$OutDir = (Join-Path $HOME "emn-backups")
)

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_DB_URL) {
  Write-Error "SUPABASE_DB_URL を設定してください(SupabaseのDB接続文字列)。"
}
if (-not $env:BACKUP_PASSPHRASE) {
  Write-Error "BACKUP_PASSPHRASE を設定してください(復号にも同じ値が必要)。"
}

New-Item -ItemType Directory -Force $OutDir | Out-Null

$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$plain = Join-Path $OutDir "emn-musicians-$stamp.sql"
$encrypted = "$plain.enc"

try {
  & pg_dump $env:SUPABASE_DB_URL --no-owner --no-privileges --format=plain --file=$plain
  if ($LASTEXITCODE -ne 0) { throw "pg_dump が失敗しました (exit $LASTEXITCODE)" }

  & openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE -in $plain -out $encrypted
  if ($LASTEXITCODE -ne 0) { throw "openssl による暗号化が失敗しました (exit $LASTEXITCODE)" }

  Write-Output "作成: $encrypted"
  Write-Output "検証: openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in `"$encrypted`" | Select-Object -First 10"
  Write-Output "このファイルをSupabaseプロジェクト外の2箇所以上へコピーしてください。"
}
finally {
  # 平文dumpは残さない。
  if (Test-Path $plain) { Remove-Item -Force $plain }
}
