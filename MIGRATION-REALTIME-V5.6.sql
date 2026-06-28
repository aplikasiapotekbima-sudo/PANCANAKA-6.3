-- ================================================================
-- MIGRATION: Aktifkan Supabase Realtime untuk Multi-User Sync
-- Kasir Klinik v5.6.0
-- Jalankan di Supabase SQL Editor
-- ================================================================

-- ── 1. Pastikan tabel app_settings sudah ada ─────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Aktifkan Realtime pada tabel app_settings ─────────────────
-- Ini yang membuat WebSocket push update ke semua browser secara instan
ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;

-- ── 3. Index updated_at untuk performa query polling ─────────────
CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at ON app_settings(updated_at DESC);

-- ── 4. Row Level Security (opsional tapi direkomendasikan) ────────
-- Aktifkan RLS agar anon key hanya bisa akses tabel ini
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow semua operasi via anon key (sesuaikan jika pakai Auth)
DROP POLICY IF EXISTS "allow_all_app_settings" ON app_settings;
CREATE POLICY "allow_all_app_settings"
  ON app_settings FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── 5. Audit logs table (opsional) ───────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT,
  user_email  TEXT,
  user_name   TEXT,
  role        TEXT,
  action      TEXT NOT NULL,
  target      TEXT,
  detail      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_role ON audit_logs(role);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_audit_logs"
  ON audit_logs FOR ALL
  USING (true) WITH CHECK (true);

-- ================================================================
-- VERIFIKASI
-- Setelah menjalankan migration ini, pastikan di Supabase Dashboard:
-- Database → Replication → Realtime → tabel app_settings sudah
-- muncul dengan status ENABLED
-- ================================================================
