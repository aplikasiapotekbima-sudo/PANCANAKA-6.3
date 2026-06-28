# Kasir Klinik v6.2 — dengan Rekam Medis Terintegrasi

Project ini **sudah berisi seluruh kode integrasi Rekam Medis (RME)** —
`App.jsx`, `PageEResepDokter.jsx`, `PageEResepApoteker.jsx`, dan
`PageCopyResep.jsx` sudah disunting langsung, file komponen/lib baru sudah
ada di `src/`. **Anda tidak perlu menyunting kode apa pun lagi** — yang
tersisa hanya langkah konfigurasi di Supabase Dashboard dan sekali jalan
`npm install`.

Sudah diverifikasi: `npm run build` sukses tanpa error pada kode hasil
integrasi ini.

---

## Langkah deploy (urutan wajib)

### 1. Install dependency
```bash
npm install
```

### 2. Siapkan `.env`
File `env.txt` di root project ini berisi kredensial Supabase Anda yang
sudah ada sebelumnya. Ganti namanya jadi `.env`:
```bash
mv env.txt .env
```
Pastikan isinya:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=ey...
```

### 3. Backup dulu sebelum ubah skema database
Supabase Dashboard → Database → Backups → buat snapshot manual dulu,
sebelum lanjut ke langkah 4.

### 4. Jalankan migration SQL
Supabase Dashboard → **SQL Editor** → tempel isi `MIGRATION-RME-V6.sql` →
jalankan. Ini membuat tabel `user_profiles`, `patients`, `allergies_log`,
`encounters`, `prescriptions`, `prescription_items`, `audit_log`, lengkap
dengan trigger audit dan RLS per role.

### 5. Cabut policy lama yang berbahaya (kalau ada)
Kalau project ini sebelumnya pernah pakai policy `"allow all"` tanpa
autentikasi (dari setup versi awal):
```sql
drop policy if exists "allow all" on prescriptions;
-- ulangi untuk tabel lain yang masih punya policy "allow all"
```

### 6. Buat akun staf pertama
Dashboard → **Authentication → Add user** (email + password). Catat UUID-nya,
lalu di SQL Editor:
```sql
insert into user_profiles (id, full_name, role)
values ('<uuid-dari-langkah-ini>', 'dr. Niken', 'dokter');
```
Ulangi untuk apoteker, dan buat minimal **satu akun `admin`** (dibutuhkan
untuk mengelola staf lain & membaca `audit_log`).

> Login lama (`dokter`/`dokter123`, `apoteker`/`apoteker123`) **sudah tidak
> berfungsi** — sistem login sekarang sepenuhnya lewat Supabase Auth.

### 7. Jalankan & tes
```bash
npm run dev
```
Tes minimal:
- [ ] Login dengan akun dari Langkah 6
- [ ] Menu "Rekam Medis" muncul di sidebar (dokter & apoteker)
- [ ] Tambah pasien baru lewat pencarian pasien di E-Resep Dokter / Kasir / Copy Resep
- [ ] Tambah alergi pasien di halaman Rekam Medis, cek muncul badge merah di form resep
- [ ] Simpan resep, cek muncul di riwayat resep pasien tersebut di Rekam Medis
- [ ] Hapus satu resep (sisi dokter & sisi apoteker) — cek di Table Editor baris masih ada tapi `deleted_at` terisi
- [ ] Cek tabel `audit_log` otomatis terisi

### 8. Build untuk produksi
```bash
npm run build
```
Deploy folder `dist/` ke Vercel seperti biasa.

---

## Langkah opsional

### Migrasi nama pasien lama
Kalau ada data pasien lama (di blob `prescriptions`/`copyResepList`/`transactions`)
yang ingin langsung tersedia di pencarian pasien:
```bash
npm install dotenv
cp scripts/.env.example .env.migration   # isi SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
node scripts/migrate-legacy-patients.mjs
```
⚠️ `.env.migration` sudah masuk `.gitignore` — pastikan tidak ter-commit.
Tinjau `legacy-patients-mapping.csv` hasilnya secara manual.

### Backup otomatis ke storage eksternal
1. Buat akun storage S3-compatible (Backblaze B2/Cloudflare R2/dll) — bukan Supabase
2. Repo GitHub → Settings → Secrets → tambahkan: `SUPABASE_DB_URL`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY`
3. `scripts/backup-database.sh` + `.github/workflows/backup-database.yml` sudah ada di project ini — trigger manual sekali lewat tab Actions untuk tes
4. Aktifkan PITR di Supabase Dashboard (Database → Backups)

### Drill restore
Ikuti `RESTORE-DRILL-CHECKLIST.md` — jadwalkan tiap 3 bulan.

---

## Apa yang berubah dari versi sebelumnya

| Area | Sebelum | Sekarang |
|---|---|---|
| Login | Username/password di JSON blob | Supabase Auth |
| Pasien | Teks bebas, ketik ulang tiap form | Entitas (`patient_id`), satu master data |
| Alergi | Field teks, ketimpa tiap resep | Riwayat (`allergies_log`), tidak pernah hilang |
| Hapus resep | Hard delete (hilang permanen) | Soft delete (`deleted_at`), tetap di audit |
| Audit | Tidak ada | Otomatis tiap insert/update/delete di tabel medis |
| Backup | Manual/tidak ada | Harian otomatis + PITR + drill restore terjadwal |
| Menu baru | — | **Rekam Medis** (dokter & apoteker) |

## Yang masih jadi pekerjaan rumah ke depan
- `transactions` (data kasir) masih blob JSON — riwayat transaksi kasir belum
  otomatis tampil di Rekam Medis kecuali tabel ini juga dipindah ke relasional
- Interoperabilitas SATUSEHAT (kalau klinik berbadan hukum resmi yang wajib lapor)
