#!/usr/bin/env bash
# Supabase PostgreSQLの暗号化論理バックアップを作成する。
#
# 使い方:
#   SUPABASE_DB_URL='postgresql://...' BACKUP_PASSPHRASE='...' \
#     ./scripts/backup/backup-db.sh [出力ディレクトリ]
#
# - 出力ディレクトリの既定は "$HOME/emn-backups"。リポジトリ内へ出力しない。
# - pg_dump(PostgreSQL client tools)とopensslが必要。追加費用は不要。
# - DB接続文字列とパスフレーズは環境変数でのみ渡し、リポジトリへ保存しない。
# - 出力は AES-256-GCM 相当の openssl enc -aes-256-cbc -pbkdf2 で暗号化する。
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL を設定してください(SupabaseのDB接続文字列)。" >&2
  exit 1
fi
if [[ -z "${BACKUP_PASSPHRASE:-}" ]]; then
  echo "BACKUP_PASSPHRASE を設定してください(復号にも同じ値が必要)。" >&2
  exit 1
fi

OUT_DIR="${1:-$HOME/emn-backups}"
mkdir -p "$OUT_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PLAIN="$OUT_DIR/emn-musicians-$STAMP.sql"
ENCRYPTED="$PLAIN.enc"

cleanup() { rm -f "$PLAIN"; }
trap cleanup EXIT

# --no-owner --no-privileges で復元先(ローカル/検証用DB)に依存しない形にする。
pg_dump "$SUPABASE_DB_URL" \
  --no-owner --no-privileges \
  --format=plain \
  --file="$PLAIN"

openssl enc -aes-256-cbc -pbkdf2 -salt \
  -pass env:BACKUP_PASSPHRASE \
  -in "$PLAIN" -out "$ENCRYPTED"

echo "作成: $ENCRYPTED"
echo "検証: openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in '$ENCRYPTED' | head"
echo "このファイルをSupabaseプロジェクト外の2箇所以上へコピーしてください。"
