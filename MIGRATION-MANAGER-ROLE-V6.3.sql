-- ================================================================
-- MIGRATION: Tambah role "manager" (view-all, edit hanya di Laporan)
-- Kasir Klinik v6.3 — PANCANAKA
-- Jalankan di Supabase SQL Editor, SATU KALI, setelah MIGRATION-RME-V6.sql
--
-- Tujuan migration ini:
--   1. Izinkan role baru 'manager' pada user_profiles.role
--   2. Manager boleh MEMBACA (SELECT) semua data medis & transaksional —
--      sama seperti dokter/apoteker/admin, supaya bisa "lihat semua navbar"
--   3. Manager TIDAK diberi izin INSERT/UPDATE pada data medis & resep di
--      level DATABASE (bukan cuma di-disable di UI) — defense-in-depth,
--      supaya larangan "hanya bisa edit di Laporan" tetap berlaku walau
--      ada yang mencoba menulis langsung lewat API/Supabase client.
-- ================================================================


-- ================================================================
-- BAGIAN 1 — Izinkan nilai role 'manager'
-- ================================================================
alter table user_profiles drop constraint if exists user_profiles_role_check;
alter table user_profiles add constraint user_profiles_role_check
  check (role in ('dokter', 'apoteker', 'admin', 'manager'));


-- ================================================================
-- BAGIAN 2 — Kunci ulang policy INSERT/UPDATE agar manager dikecualikan
-- ================================================================
-- Policy SELECT (baca) TIDAK diubah — semua role aktif (termasuk manager)
-- tetap bisa membaca, karena hanya memeriksa current_user_active().

-- ── patients ───────────────────────────────────────────────────
drop policy if exists "staff insert patients" on patients;
create policy "staff insert patients" on patients
  for insert with check (current_user_active() and current_user_role() in ('dokter','apoteker','admin'));
  -- (tidak berubah — manager memang sudah tidak ada di list ini)

drop policy if exists "staff update patients" on patients;
create policy "staff update patients" on patients
  for update using (current_user_active() and current_user_role() in ('dokter','apoteker','admin'));

-- ── allergies_log ──────────────────────────────────────────────
drop policy if exists "staff insert allergies" on allergies_log;
create policy "staff insert allergies" on allergies_log
  for insert with check (current_user_active() and current_user_role() in ('dokter','apoteker','admin'));

-- ── encounters ───────────────────────────────────────────────
drop policy if exists "staff insert encounters" on encounters;
create policy "staff insert encounters" on encounters
  for insert with check (current_user_active() and current_user_role() in ('dokter','apoteker','admin'));

drop policy if exists "staff update encounters" on encounters;
create policy "staff update encounters" on encounters
  for update using (current_user_active() and current_user_role() in ('dokter','apoteker','admin'));

-- ── prescriptions ──────────────────────────────────────────────
drop policy if exists "staff insert prescriptions" on prescriptions;
create policy "staff insert prescriptions" on prescriptions
  for insert with check (current_user_active() and current_user_role() in ('dokter','apoteker','admin'));

drop policy if exists "staff update prescriptions" on prescriptions;
create policy "staff update prescriptions" on prescriptions
  for update using (current_user_active() and current_user_role() in ('dokter','apoteker','admin'));

-- ── prescription_items ──────────────────────────────────────────
drop policy if exists "staff insert rx items" on prescription_items;
create policy "staff insert rx items" on prescription_items
  for insert with check (current_user_active() and current_user_role() in ('dokter','apoteker','admin'));


-- ================================================================
-- BAGIAN 3 — Cara membuat akun manager
-- ================================================================
-- Sama seperti membuat dokter/apoteker/admin:
--   1) Buat user baru di Supabase Dashboard → Authentication → Add user
--      (isi email + password).
--   2) Copy UUID user tersebut, lalu jalankan:
--
--      insert into user_profiles (id, full_name, role)
--      values ('<UUID-DARI-AUTH-USERS>', 'Nama Manager', 'manager');
--
--   (atau gunakan halaman Akun di aplikasi — pilihan role "Manager" sudah
--   tersedia di dropdown setelah update aplikasi terbaru)
-- ================================================================


-- ================================================================
-- CATATAN PENTING — batas dari migration ini
-- ================================================================
-- Data ringkasan di menu Laporan (kas, penjualan OTC, riwayat transaksi)
-- TIDAK disimpan di tabel relasional di atas — melainkan sebagai blob JSON
-- di tabel `app_settings` (key/value), diakses lewat REST langsung pakai
-- anon key (lihat src/lib/supabase.js), BUKAN lewat sesi auth user.
-- Artinya policy RLS berbasis current_user_role()/auth.uid() di atas TIDAK
-- otomatis berlaku untuk tabel `app_settings`.
--
-- Implikasinya: larangan "manager hanya boleh edit di Laporan" untuk data
-- yang sumbernya app_settings (transaksi kasir, dokter, dll — bukan rekam
-- medis) saat ini HANYA ditegakkan di sisi UI (fieldset disabled di
-- App.jsx), belum di level database. Kalau ini perlu ditutup juga secara
-- penuh di level DB, app_settings perlu direstrukturisasi memakai sesi
-- auth user (bukan anon key) + policy per `key`. Beri tahu saya kalau mau
-- saya bantu buatkan migration-nya.
-- ================================================================
