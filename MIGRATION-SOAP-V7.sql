-- ================================================================
-- MIGRATION: Rekam Medis format SOAP + kelengkapan data registrasi pasien
-- Kasir Klinik v6.0 — V7
-- Jalankan di Supabase SQL Editor, SATU KALI, setelah MIGRATION-RME-V6.sql.
--
-- Tujuan migration ini:
--   1. Registrasi pasien punya kolom lengkap sesuai formulir rekam medis
--      kertas (KK, Agama, Status UMUM/BPJS/SKTM/GRATIS, No. BPJS/SKTM,
--      Pekerjaan) — sebelumnya hanya nama/NIK/HP/alamat.
--   2. Kunjungan (encounters) diperluas jadi format SOAP penuh:
--      S (Subjective/Anamnesis), O (Objective/Vital Sign & Pemeriksaan),
--      A (Assessment/Diagnosis), P (Plan/Rencana Asuhan) — meniru
--      formulir SOAP kertas klinik, bukan field bebas seperti sebelumnya.
-- ================================================================


-- ================================================================
-- BAGIAN 1 — KELENGKAPAN DATA PASIEN (form registrasi)
-- ================================================================
alter table patients add column if not exists kk_number     text;  -- No. KK
alter table patients add column if not exists religion       text;  -- Agama
alter table patients add column if not exists status         text  -- UMUM / BPJS / SKTM / GRATIS
  check (status in ('UMUM', 'BPJS', 'SKTM', 'GRATIS'));
alter table patients add column if not exists insurance_number text; -- No. BPJS/SKTM
alter table patients add column if not exists occupation      text; -- Pekerjaan


-- ================================================================
-- BAGIAN 2 — KUNJUNGAN (ENCOUNTER) FORMAT SOAP
-- ================================================================
-- Header formulir (ruang tujuan, jam mulai/selesai)
alter table encounters add column if not exists room_destination text;        -- Ruang Tujuan
alter table encounters add column if not exists time_start        time;       -- Waktu Mulai
alter table encounters add column if not exists time_end           time;       -- Waktu Selesai

-- S — Subjective (Anamnesis). Kolom `anamnesis` lama dipertahankan dan
-- dipakai sebagai "Keluhan Utama".

-- O — Objective (Vital Sign & Pemeriksaan Fisik)
alter table encounters add column if not exists vs_td              text;       -- Tekanan Darah (mmHg)
alter table encounters add column if not exists vs_rr               text;       -- Respiration Rate (x/mnt)
alter table encounters add column if not exists vs_nadi            text;       -- Nadi (x/mnt)
alter table encounters add column if not exists vs_suhu            text;       -- Suhu (C)
alter table encounters add column if not exists pf_bb               text;       -- Berat Badan (kg)
alter table encounters add column if not exists pf_tb               text;       -- Tinggi Badan (cm)
alter table encounters add column if not exists pf_lp               text;       -- Lingkar Perut (cm)
alter table encounters add column if not exists supporting_exam    text;       -- Pemeriksaan Penunjang / Rujukan Internal / Observasi

-- A — Assessment (Diagnosis). Kolom `diagnosis` lama dipertahankan sebagai
-- "Diagnosis & kode ICD 10" utama (dipakai juga oleh tabel prescriptions).
alter table encounters add column if not exists icd10_code         text;       -- Kode ICD 10
alter table encounters add column if not exists differential_diagnosis text;   -- DD (Diagnosis Banding)
alter table encounters add column if not exists nursing_diagnosis  text;       -- Diagnosis Keperawatan

-- P — Plan (Rencana Asuhan)
alter table encounters add column if not exists therapy_plan       text;       -- Terapi
alter table encounters add column if not exists nursing_care       text;       -- KIE / Asuhan Keperawatan

-- TTD Petugas — siapa yang mengisi/menandatangani SOAP ini (boleh beda dari doctor_id
-- bila perawat/bidan yang mengisi sebagian formulir).
alter table encounters add column if not exists staff_name         text;

comment on column encounters.anamnesis is 'S (Subjective) — Keluhan Utama pasien';
comment on column encounters.diagnosis is 'A (Assessment) — Diagnosis & kode ICD 10 utama';
comment on column encounters.therapy_plan is 'P (Plan) — Terapi';
comment on column encounters.nursing_care is 'P (Plan) — KIE / Asuhan Keperawatan';


-- ================================================================
-- BAGIAN 3 — SOFT DELETE UNTUK KUNJUNGAN (konsisten dgn tabel lain)
-- ================================================================
-- `deleted_at` sudah ada dari MIGRATION-RME-V6.sql, tidak perlu diulang.
-- Pastikan trigger updated_at & audit log mencakup kolom baru — trigger
-- yang sudah ada (trg_encounters_updated_at, trg_audit_encounters) memakai
-- to_jsonb(NEW)/(OLD) jadi otomatis ikut kolom baru tanpa perlu diubah.


-- ================================================================
-- SELESAI — verifikasi cepat
-- ================================================================
-- select column_name from information_schema.columns where table_name = 'patients' order by ordinal_position;
-- select column_name from information_schema.columns where table_name = 'encounters' order by ordinal_position;
