-- MIGRATION-DEV-PANEL-V6.3.sql
-- Menambahkan akses dev@bima.local ke:
--   1. audit_log (baca) — di samping admin role yang sudah ada
--   2. app_settings (baca) — sudah ada via anon key, tapi diperjelas di sini
-- Juga menambahkan tabel audit untuk app_settings (backup audit trail)
-- ─────────────────────────────────────────────────────────────────────────────
-- Cara pakai:
--   Supabase Dashboard → SQL Editor → paste & Run
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Helper: cek apakah user yang login adalah dev@bima.local ────────────
-- Fungsi ini dipakai di RLS policy agar tidak perlu query auth.users berulang.
create or replace function is_dev_user()
returns boolean
language sql
stable
security definer
as $$
  select coalesce(
    (select email = 'dev@bima.local'
     from auth.users
     where id = auth.uid()
     limit 1),
    false
  );
$$;

-- ── 2. RLS audit_log — tambah policy untuk dev@bima.local ─────────────────
-- Policy yang sudah ada ("admin read audit") tetap dipertahankan.
-- Policy baru khusus untuk dev user.
drop policy if exists "dev read audit" on audit_log;
create policy "dev read audit" on audit_log
  for select using (is_dev_user());

-- ── 3. RLS user_profiles — dev bisa baca semua profil (untuk audit trail) ─
drop policy if exists "dev read profiles" on user_profiles;
create policy "dev read profiles" on user_profiles
  for select using (is_dev_user());

-- ── 4. Tabel backup_audit — mencatat kapan backup/restore dilakukan ────────
-- Berguna untuk audit: siapa yang backup/restore dan kapan.
create table if not exists backup_audit (
  id          bigserial primary key,
  action      text not null,              -- BACKUP | RESTORE
  actor_email text not null,              -- email yang melakukan
  actor_id    uuid,
  details     jsonb,                       -- metadata: ukuran file, tabel yang di-restore, dll
  performed_at timestamptz default now()
);

alter table backup_audit enable row level security;

-- Hanya dev dan admin yang bisa lihat log backup
drop policy if exists "dev read backup audit" on backup_audit;
create policy "dev read backup audit" on backup_audit
  for select using (is_dev_user() or current_user_role() = 'admin');

-- Insert hanya bisa dilakukan oleh trigger / security definer function, bukan langsung
-- (sama prinsipnya dengan audit_log). Tapi karena kita insert dari frontend,
-- kita izinkan dev user insert:
drop policy if exists "dev insert backup audit" on backup_audit;
create policy "dev insert backup audit" on backup_audit
  for insert with check (is_dev_user());

-- ── 5. Indeks backup_audit ──────────────────────────────────────────────────
create index if not exists idx_backup_audit_performed on backup_audit(performed_at desc);
create index if not exists idx_backup_audit_actor     on backup_audit(actor_email);

-- ── Selesai ────────────────────────────────────────────────────────────────
-- Jalankan MIGRATION-DEV-PANEL-V6.3.sql ini satu kali di Supabase SQL Editor.
-- Setelah itu, login dengan dev@bima.local dan buka tab "Dev Panel".
