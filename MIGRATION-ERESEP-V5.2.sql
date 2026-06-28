-- ================================================================
-- MIGRATION: E-Resep Dokter ↔ Apoteker
-- Kasir Klinik v5.2
-- Jalankan di Supabase SQL Editor
-- ================================================================

-- ── Tabel utama resep ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
  id                    TEXT PRIMARY KEY,
  prescription_number   TEXT NOT NULL UNIQUE,
  patient_name          TEXT NOT NULL,
  patient_age           TEXT,
  patient_gender        TEXT DEFAULT 'L',
  patient_weight        TEXT,
  patient_rm            TEXT,
  doctor_id             TEXT,
  doctor_name           TEXT,
  doctor_data           JSONB,          -- snapshot data dokter saat resep dibuat
  date                  DATE,
  diagnosis             TEXT,
  allergies             TEXT,
  notes_for_pharmacist  TEXT,           -- catatan dokter untuk apoteker
  status                TEXT NOT NULL DEFAULT 'MENUNGGU_DISPENSING',
  -- status: MENUNGGU_DISPENSING | SEDANG_DISIAPKAN | SIAP_DIAMBIL | SUDAH_DISERAHKAN
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabel item obat dalam resep ──────────────────────────────────
CREATE TABLE IF NOT EXISTS prescription_items (
  id               BIGSERIAL PRIMARY KEY,
  prescription_id  TEXT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  drug_name        TEXT NOT NULL,
  strength         TEXT,               -- dosis / kekuatan (cth: 500mg)
  signa            TEXT,               -- aturan pakai
  quantity         TEXT,
  unit             TEXT DEFAULT 'tab',
  compounded       BOOLEAN DEFAULT FALSE,  -- TRUE = racikan
  notes            TEXT,
  sort_order       INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Index untuk performa query ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prescriptions_status     ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON prescriptions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id  ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescription_items_rx    ON prescription_items(prescription_id);

-- ── Auto-update updated_at ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prescriptions_updated_at ON prescriptions;
CREATE TRIGGER trg_prescriptions_updated_at
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Enable Realtime (untuk notifikasi live ke apoteker) ───────────
-- Jalankan ini jika ingin notifikasi realtime Supabase:
-- ALTER PUBLICATION supabase_realtime ADD TABLE prescriptions;

-- ================================================================
-- CATATAN IMPLEMENTASI
-- ================================================================
--
-- Saat ini aplikasi masih menggunakan localStorage (useStorage hook).
-- Tabel di atas disiapkan untuk migrasi ke Supabase di masa depan.
--
-- Untuk mengaktifkan Supabase:
-- 1. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env
-- 2. Jalankan migration SQL ini di Supabase SQL Editor
-- 3. Update lib/supabase.js dengan fungsi CRUD untuk prescriptions
-- 4. Ganti useStorage pada state prescriptions di App.jsx
--    dengan hooks yang fetch/push ke Supabase
--
-- Untuk Realtime (notifikasi badge apoteker):
-- Aktifkan baris ALTER PUBLICATION di atas, lalu di React:
--   const channel = supabase
--     .channel('prescriptions')
--     .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'prescriptions' }, handler)
--     .subscribe()
-- ================================================================
