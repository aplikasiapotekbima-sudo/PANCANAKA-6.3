-- ================================================================
-- MIGRATION: Fondasi Rekam Medis Elektronik (RME) + Audit Trail
-- Kasir Klinik v6.0
-- Jalankan di Supabase SQL Editor, SATU KALI, secara berurutan dari atas.
--
-- Tujuan migration ini:
--   1. Pindah dari pola "blob JSON di app_settings" ke tabel relasional asli
--   2. Pasien jadi entitas (patient_id), bukan teks bebas
--   3. Audit trail otomatis (append-only, tidak bisa dimanipulasi dari app)
--   4. Soft-delete wajib untuk data medis (hard delete diblokir oleh RLS)
--   5. RLS per role memakai Supabase Auth (bukan login custom di JSON blob)
-- ================================================================


-- ================================================================
-- BAGIAN 0 — EXTENSION
-- ================================================================
create extension if not exists pgcrypto;  -- untuk gen_random_uuid()


-- ================================================================
-- BAGIAN 1 — PROFIL STAF (menggantikan tabel `users` di JSON blob)
-- ================================================================
-- Setiap baris di sini terhubung 1:1 ke auth.users (akun login Supabase Auth).
-- JANGAN simpan password di sini — password ditangani oleh Supabase Auth.

create table if not exists user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  role         text not null check (role in ('dokter', 'apoteker', 'admin')),
  sip          text,                      -- nomor SIP untuk dokter
  active       boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Helper function: ambil role user yang sedang login (dipakai di RLS policy)
create or replace function current_user_role()
returns text
language sql
stable
security definer
as $$
  select role from user_profiles where id = auth.uid();
$$;

create or replace function current_user_active()
returns boolean
language sql
stable
security definer
as $$
  select coalesce((select active from user_profiles where id = auth.uid()), false);
$$;


-- ================================================================
-- BAGIAN 2 — MASTER PASIEN
-- ================================================================
create table if not exists patients (
  id                  uuid primary key default gen_random_uuid(),
  rm_number           text unique not null,        -- nomor RM resmi, generate di app
  nik                 text,                         -- sesuai elemen wajib Permenkes 24/2022
  name                text not null,
  gender              text check (gender in ('L', 'P')),
  birth_date          date,
  phone               text,
  address             text,
  chronic_conditions  text,
  -- CATATAN: alergi TIDAK disimpan sebagai 1 kolom di sini.
  -- Lihat tabel `allergies_log` di Bagian 3 — alergi adalah riwayat, bukan field tunggal.
  deleted_at          timestamptz,                  -- soft delete, NULL = aktif
  created_by          uuid references user_profiles(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_patients_rm     on patients(rm_number);
create index if not exists idx_patients_name   on patients(name);
create index if not exists idx_patients_active on patients(id) where deleted_at is null;


-- ================================================================
-- BAGIAN 3 — RIWAYAT ALERGI (append-only, bukan field yang bisa ketimpa)
-- ================================================================
create table if not exists allergies_log (
  id            bigserial primary key,
  patient_id    uuid not null references patients(id) on delete cascade,
  allergen      text not null,
  severity      text check (severity in ('ringan', 'sedang', 'berat', 'tidak diketahui')),
  reported_by   uuid references user_profiles(id),
  reported_at   timestamptz default now(),
  note          text,
  -- alergi yang sudah tidak relevan ditandai resolved, TIDAK dihapus
  resolved_at   timestamptz
);

create index if not exists idx_allergies_patient on allergies_log(patient_id);


-- ================================================================
-- BAGIAN 4 — KUNJUNGAN (ENCOUNTER)
-- ================================================================
-- Satu baris = satu episode kunjungan/konsultasi. Resep, diagnosis, dan
-- transaksi kasir pada kunjungan yang sama saling terhubung lewat encounter_id.
create table if not exists encounters (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patients(id),
  doctor_id       uuid references user_profiles(id),
  visit_date      timestamptz default now(),
  diagnosis       text,
  anamnesis       text,
  deleted_at      timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_encounters_patient on encounters(patient_id);
create index if not exists idx_encounters_doctor  on encounters(doctor_id);


-- ================================================================
-- BAGIAN 5 — RESEP (extend tabel yang sudah ada dari MIGRATION-ERESEP-V5.2)
-- ================================================================
-- Jika tabel `prescriptions` sudah ada dari migration sebelumnya, kita
-- tambahkan kolom baru tanpa menghapus data lama.
create table if not exists prescriptions (
  id                    text primary key,
  prescription_number   text not null unique,
  patient_name          text,                       -- dipertahankan untuk kompatibilitas data lama
  patient_age           text,
  patient_gender        text default 'L',
  patient_weight        text,
  patient_rm            text,
  doctor_id             text,
  doctor_name           text,
  doctor_data           jsonb,
  date                  date,
  diagnosis             text,
  allergies             text,
  notes_for_pharmacist  text,
  status                text not null default 'MENUNGGU_DISPENSING',
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- Kolom baru untuk keterhubungan dengan rekam medis terstruktur
alter table prescriptions add column if not exists patient_id   uuid references patients(id);
alter table prescriptions add column if not exists encounter_id uuid references encounters(id);
alter table prescriptions add column if not exists created_by   uuid references user_profiles(id);
alter table prescriptions add column if not exists deleted_at   timestamptz;  -- WAJIB: ganti hard delete

create table if not exists prescription_items (
  id               bigserial primary key,
  prescription_id  text not null references prescriptions(id) on delete cascade,
  drug_name        text not null,
  strength         text,
  signa            text,
  quantity         text,
  unit             text default 'tab',
  compounded       boolean default false,
  notes            text,
  sort_order       int default 0,
  created_at       timestamptz default now()
);

create index if not exists idx_prescriptions_status     on prescriptions(status);
create index if not exists idx_prescriptions_patient_id on prescriptions(patient_id);
create index if not exists idx_prescriptions_created_at on prescriptions(created_at desc);
create index if not exists idx_prescription_items_rx    on prescription_items(prescription_id);


-- ================================================================
-- BAGIAN 6 — AUTO-UPDATE updated_at
-- ================================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_patients_updated_at on patients;
create trigger trg_patients_updated_at before update on patients
  for each row execute function update_updated_at();

drop trigger if exists trg_encounters_updated_at on encounters;
create trigger trg_encounters_updated_at before update on encounters
  for each row execute function update_updated_at();

drop trigger if exists trg_prescriptions_updated_at on prescriptions;
create trigger trg_prescriptions_updated_at before update on prescriptions
  for each row execute function update_updated_at();

drop trigger if exists trg_user_profiles_updated_at on user_profiles;
create trigger trg_user_profiles_updated_at before update on user_profiles
  for each row execute function update_updated_at();


-- ================================================================
-- BAGIAN 7 — AUDIT TRAIL (append-only, tidak bisa dimanipulasi dari app)
-- ================================================================
create table if not exists audit_log (
  id          bigserial primary key,
  table_name  text not null,
  row_id      text not null,
  action      text not null,              -- INSERT | UPDATE | DELETE
  actor_id    uuid,                        -- auth.uid() pelaku
  actor_role  text,
  old_data    jsonb,
  new_data    jsonb,
  changed_at  timestamptz default now()
);

create index if not exists idx_audit_table_row on audit_log(table_name, row_id);
create index if not exists idx_audit_changed_at on audit_log(changed_at desc);

-- security definer => trigger ini tetap bisa menulis ke audit_log
-- walaupun role yang memicunya (dokter/apoteker) TIDAK punya izin INSERT
-- langsung ke audit_log lewat RLS. Inilah yang membuat log ini tidak
-- bisa "dilewati" dari sisi aplikasi.
create or replace function fn_audit()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into audit_log(table_name, row_id, action, actor_id, actor_role, old_data, new_data)
  values (
    TG_TABLE_NAME,
    coalesce((NEW).id::text, (OLD).id::text),
    TG_OP,
    auth.uid(),
    current_user_role(),
    case when TG_OP <> 'INSERT' then to_jsonb(OLD) else null end,
    case when TG_OP <> 'DELETE' then to_jsonb(NEW) else null end
  );
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_audit_patients on patients;
create trigger trg_audit_patients after insert or update or delete on patients
  for each row execute function fn_audit();

drop trigger if exists trg_audit_encounters on encounters;
create trigger trg_audit_encounters after insert or update or delete on encounters
  for each row execute function fn_audit();

drop trigger if exists trg_audit_prescriptions on prescriptions;
create trigger trg_audit_prescriptions after insert or update or delete on prescriptions
  for each row execute function fn_audit();

drop trigger if exists trg_audit_prescription_items on prescription_items;
create trigger trg_audit_prescription_items after insert or update or delete on prescription_items
  for each row execute function fn_audit();

drop trigger if exists trg_audit_allergies_log on allergies_log;
create trigger trg_audit_allergies_log after insert or update or delete on allergies_log
  for each row execute function fn_audit();


-- ================================================================
-- BAGIAN 8 — ROW LEVEL SECURITY
-- ================================================================
alter table user_profiles    enable row level security;
alter table patients         enable row level security;
alter table allergies_log    enable row level security;
alter table encounters       enable row level security;
alter table prescriptions    enable row level security;
alter table prescription_items enable row level security;
alter table audit_log        enable row level security;

-- ── user_profiles ──────────────────────────────────────────────
drop policy if exists "self read" on user_profiles;
create policy "self read" on user_profiles
  for select using (id = auth.uid() or current_user_role() = 'admin');

drop policy if exists "admin manage staff" on user_profiles;
create policy "admin manage staff" on user_profiles
  for insert with check (current_user_role() = 'admin');
drop policy if exists "admin update staff" on user_profiles;
create policy "admin update staff" on user_profiles
  for update using (current_user_role() = 'admin');
-- TIDAK ADA policy DELETE → staff tidak pernah benar-benar terhapus dari sistem.

-- ── patients ───────────────────────────────────────────────────
-- Staf aktif (dokter/apoteker/admin) boleh baca semua pasien yang belum di-soft-delete.
drop policy if exists "staff read patients" on patients;
create policy "staff read patients" on patients
  for select using (current_user_active() and deleted_at is null);

drop policy if exists "staff insert patients" on patients;
create policy "staff insert patients" on patients
  for insert with check (current_user_active() and current_user_role() in ('dokter','apoteker','admin'));

drop policy if exists "staff update patients" on patients;
create policy "staff update patients" on patients
  for update using (current_user_active());
-- TIDAK ADA policy DELETE pada `patients`. Hapus pasien hanya lewat
-- UPDATE deleted_at = now() (soft delete). Hard delete diblokir di level DB,
-- bukan cuma di level UI — developer tidak bisa "lupa" menerapkannya.

-- ── allergies_log ──────────────────────────────────────────────
drop policy if exists "staff read allergies" on allergies_log;
create policy "staff read allergies" on allergies_log
  for select using (current_user_active());
drop policy if exists "staff insert allergies" on allergies_log;
create policy "staff insert allergies" on allergies_log
  for insert with check (current_user_active());
-- TIDAK ADA policy UPDATE/DELETE → alergi hanya bisa ditambah riwayat baru
-- atau ditandai resolved_at, tidak bisa diubah/dihapus diam-diam.

-- ── encounters ───────────────────────────────────────────────
drop policy if exists "staff read encounters" on encounters;
create policy "staff read encounters" on encounters
  for select using (current_user_active() and deleted_at is null);
drop policy if exists "staff insert encounters" on encounters;
create policy "staff insert encounters" on encounters
  for insert with check (current_user_active());
drop policy if exists "staff update encounters" on encounters;
create policy "staff update encounters" on encounters
  for update using (current_user_active());

-- ── prescriptions ──────────────────────────────────────────────
drop policy if exists "staff read prescriptions" on prescriptions;
create policy "staff read prescriptions" on prescriptions
  for select using (current_user_active() and deleted_at is null);
drop policy if exists "staff insert prescriptions" on prescriptions;
create policy "staff insert prescriptions" on prescriptions
  for insert with check (current_user_active());
drop policy if exists "staff update prescriptions" on prescriptions;
create policy "staff update prescriptions" on prescriptions
  for update using (current_user_active());
-- TIDAK ADA policy DELETE → resep hanya bisa soft-delete via deleted_at.

drop policy if exists "staff read rx items" on prescription_items;
create policy "staff read rx items" on prescription_items
  for select using (current_user_active());
drop policy if exists "staff insert rx items" on prescription_items;
create policy "staff insert rx items" on prescription_items
  for insert with check (current_user_active());

-- ── audit_log ──────────────────────────────────────────────────
-- HANYA admin yang boleh membaca. TIDAK ADA policy insert/update/delete
-- untuk role apapun — satu-satunya jalan masuk adalah trigger fn_audit()
-- yang berjalan sebagai security definer (bypass RLS by design, terkontrol).
drop policy if exists "admin read audit" on audit_log;
create policy "admin read audit" on audit_log
  for select using (current_user_role() = 'admin');


-- ================================================================
-- BAGIAN 9 — REALTIME (opsional, untuk notifikasi live ke apoteker)
-- ================================================================
-- Aktifkan hanya untuk tabel operasional, BUKAN untuk audit_log/patients
-- agar payload realtime tidak membawa data medis sensitif ke semua klien.
-- alter publication supabase_realtime add table prescriptions;


-- ================================================================
-- CATATAN IMPLEMENTASI & LANGKAH SELANJUTNYA
-- ================================================================
--
-- 1. BUAT AKUN STAF VIA SUPABASE AUTH (bukan lagi di JSON blob `users`):
--      - Dashboard → Authentication → Add user (email + password)
--      - Lalu insert baris user_profiles dengan id = auth user id tersebut:
--        insert into user_profiles (id, full_name, role)
--        values ('<uuid-dari-auth-users>', 'dr. Niken', 'dokter');
--
-- 2. NONAKTIFKAN POLICY "allow all" LAMA (jika masih ada di app_settings/
--    doctors/transactions/prescriptions dari setup sebelumnya):
--        drop policy if exists "allow all" on prescriptions;
--    Policy "allow all" memberi akses baca-tulis tanpa login ke siapa pun
--    yang punya anon key — ini WAJIB dicabut untuk data medis.
--
-- 3. AKTIFKAN POINT-IN-TIME RECOVERY (PITR):
--      Dashboard Supabase → Database → Backups → Point in Time Recovery
--      (memerlukan plan Pro ke atas). Ini lapis pemulihan utama jika ada
--      kesalahan input/serangan/penghapusan tak sengaja.
--
-- 4. BACKUP EKSTERNAL TERJADWAL (di luar Supabase, prinsip 3-2-1):
--      Jadwalkan job (Supabase Edge Function + pg_cron, atau server kecil)
--      menjalankan `pg_dump` harian, lalu upload hasilnya ke storage
--      independen (Google Drive/S3/Backblaze) — JANGAN simpan hanya di
--      Supabase Storage milik project yang sama.
--      Uji-coba restore dari backup ini minimal setiap 3 bulan.
--
-- 5. MIGRASI DATA LAMA:
--      Data prescriptions/transactions lama (sebelum migration ini) hanya
--      punya `patient_name` teks bebas tanpa patient_id. Buat skrip satu-kali
--      untuk mencocokkan nama → bikin/temukan baris di `patients`, lalu isi
--      `patient_id` pada baris lama. Baris yang tidak bisa dicocokkan
--      otomatis (nama ambigu) dibiarkan NULL dan ditinjau manual oleh admin.
--
-- 6. SISI APLIKASI (React):
--      - Ganti semua tombol "🗑️ Hapus" pada data medis agar memanggil
--        UPDATE deleted_at = now() (soft delete), BUKAN DELETE FROM.
--      - Pindahkan login dari useStorage(STORAGE_KEYS.users) ke
--        supabase.auth.signInWithPassword().
--      - Form pasien di E-Resep Dokter, Kasir, dan Copy Resep diganti jadi
--        komponen cari/pilih dari tabel `patients` (autocomplete by nama/RM),
--        bukan input teks bebas.
-- ================================================================
