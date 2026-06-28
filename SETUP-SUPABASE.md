# Panduan Setup Supabase (Penyimpanan Data Online)

Aplikasi saat ini menggunakan **localStorage** (browser) — data akan hilang jika browser cache dihapus.
Untuk penyimpanan **persisten & aman**, ikuti langkah berikut menggunakan Supabase (gratis).

---

## Langkah 1 — Buat Akun & Project Supabase

1. Buka https://supabase.com → Sign Up (gratis)
2. Klik **"New Project"**, isi nama project dan password database
3. Tunggu ~2 menit sampai project siap

---

## Langkah 2 — Buat Tabel di Supabase

Buka **SQL Editor** di dashboard Supabase, lalu jalankan script berikut:

```sql
-- Tabel dokter
create table if not exists doctors (
  id text primary key,
  name text not null,
  sip text default '',
  active boolean default true,
  created_at timestamptz default now()
);

-- Tabel transaksi kasir
create table if not exists transactions (
  id text primary key,
  invoice text,
  doctor_id text,
  doctor_name text,
  patient_name text,
  fee integer,
  method text,
  paid integer,
  date timestamptz,
  created_at timestamptz default now()
);

-- Tabel resep (e-prescribing)
create table if not exists prescriptions (
  id text primary key,
  prescription_number text,
  patient_name text,
  patient_age text,
  patient_gender text,
  patient_weight text,
  doctor_id text,
  date text,
  diagnosis text,
  allergies text,
  doctor_notes text,
  medicines jsonb,
  selected_doctor jsonb,
  created_at timestamptz default now()
);

-- Tabel pengaturan aplikasi
create table if not exists app_settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

-- Row Level Security (izinkan akses dari aplikasi)
alter table doctors enable row level security;
alter table transactions enable row level security;
alter table prescriptions enable row level security;
alter table app_settings enable row level security;

create policy "allow all" on doctors for all using (true);
create policy "allow all" on transactions for all using (true);
create policy "allow all" on prescriptions for all using (true);
create policy "allow all" on app_settings for all using (true);
```

---

## Langkah 3 — Dapatkan API Keys

1. Di Supabase dashboard → **Settings** → **API**
2. Copy:
   - **Project URL** (contoh: `https://abcxyz.supabase.co`)
   - **anon/public key**

---

## Langkah 4 — Tambahkan ke Aplikasi

Buat file `.env` di root folder project (`kasir-klinik/`):

```env
VITE_SUPABASE_URL=https://xxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Install Supabase client:

```bash
npm install @supabase/supabase-js
```

---

## Langkah 5 — File Konfigurasi

Buat file `src/lib/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

---

## Langkah 6 — Ganti useStorage dengan Supabase

Contoh hook untuk resep:

```js
// Hook: gunakan Supabase untuk prescriptions
async function fetchPrescriptions() {
  const { data, error } = await supabase
    .from('prescriptions')
    .select('*')
    .order('created_at', { ascending: false })
  if (!error) setPrescriptions(data)
}

async function savePrescription(rx) {
  const { error } = await supabase
    .from('prescriptions')
    .insert([{
      id: rx.id,
      prescription_number: rx.prescriptionNumber,
      patient_name: rx.patientName,
      // ... field lainnya
      medicines: rx.medicines,        // disimpan sebagai JSON
      created_at: rx.createdAt,
    }])
  if (!error) fetchPrescriptions()
}
```

---

## Catatan Keamanan

- Jangan commit file `.env` ke Git (sudah ada di `.gitignore`)
- Untuk produksi, tambahkan autentikasi (login) agar data terlindungi
- Supabase gratis: 500MB database, cukup untuk ribuan resep & transaksi

---

## Alternatif Offline: File JSON Lokal

Jika tidak mau pakai cloud, gunakan **Electron** atau **Tauri** untuk mengemas
aplikasi sebagai desktop app yang menyimpan data ke file `.json` di folder lokal.

Hubungi developer untuk implementasi ini.
