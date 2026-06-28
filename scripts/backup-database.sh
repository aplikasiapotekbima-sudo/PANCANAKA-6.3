#!/usr/bin/env bash
# scripts/backup-database.sh
#
# Backup database Supabase (pg_dump) lalu unggah ke storage S3-compatible
# yang TERPISAH dari Supabase (Backblaze B2 / Cloudflare R2 / AWS S3 / Wasabi
# — bebas, asal bukan project Supabase yang sama). Ini melengkapi PITR
# bawaan Supabase sesuai prinsip 3-2-1 backup: PITR = backup #1 (di vendor
# yang sama), file dump ini = backup #2 (vendor/lokasi berbeda).
#
# Dipanggil otomatis terjadwal lewat .github/workflows/backup-database.yml,
# tapi juga bisa dijalankan manual:
#   SUPABASE_DB_URL=... BACKUP_S3_*=... ./scripts/backup-database.sh
#
# Variabel environment yang dibutuhkan:
#   SUPABASE_DB_URL        — connection string Postgres Supabase
#                            (Dashboard → Project Settings → Database →
#                            Connection string → URI, pakai mode "Session pooler"
#                            kalau dijalankan dari luar VPC Supabase)
#   BACKUP_S3_ENDPOINT     — endpoint S3-compatible, mis. https://s3.us-west-002.backblazeb2.com
#   BACKUP_S3_BUCKET       — nama bucket, mis. kasir-klinik-backup
#   BACKUP_S3_ACCESS_KEY   — access key
#   BACKUP_S3_SECRET_KEY   — secret key
#   BACKUP_RETENTION_DAYS  — opsional, default 90 (untuk pembersihan lokal)

set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL belum diset}"
: "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT belum diset}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET belum diset}"
: "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY belum diset}"
: "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY belum diset}"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
DUMP_FILE="kasir-klinik-${TIMESTAMP}.sql.gz"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

echo "📦 Membuat dump database (pg_dump)..."
# --no-owner --no-acl: hindari masalah permission saat restore ke project
# Supabase lain (mis. saat drill restore atau migrasi server).
pg_dump "$SUPABASE_DB_URL" \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip -9 > "${WORKDIR}/${DUMP_FILE}"

DUMP_SIZE=$(du -h "${WORKDIR}/${DUMP_FILE}" | cut -f1)
echo "✅ Dump selesai: ${DUMP_FILE} (${DUMP_SIZE})"

echo "☁️  Mengunggah ke storage eksternal..."
export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY"

aws s3 cp "${WORKDIR}/${DUMP_FILE}" \
  "s3://${BACKUP_S3_BUCKET}/db-backups/${DUMP_FILE}" \
  --endpoint-url "$BACKUP_S3_ENDPOINT"

echo "✅ Backup berhasil diunggah ke s3://${BACKUP_S3_BUCKET}/db-backups/${DUMP_FILE}"

# Catatan retensi: pengaturan "hapus otomatis setelah N hari" sebaiknya
# diatur lewat Lifecycle Rule di sisi bucket (B2/R2/S3 semua mendukung ini
# lewat dashboard masing-masing), bukan dihapus manual dari skrip ini —
# supaya kalaupun skrip ini gagal/disusupi, kebijakan retensi tetap berjalan
# independen di sisi storage.
echo "ℹ️  Pastikan Lifecycle Rule di bucket sudah diatur (retensi ${BACKUP_RETENTION_DAYS:-90} hari) lewat dashboard storage provider."
