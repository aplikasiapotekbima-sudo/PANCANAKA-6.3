# Kasir Klinik v5.6.0 — Multi-User Concurrency

## Masalah yang Diperbaiki

Versi sebelumnya (5.5.1) menyimpan **sesi login** (`pos_auth_session`) ke Supabase,
sehingga login user A di komputer satu menimpa sesi user B di komputer lain.
Data juga hanya tersinkronisasi setiap 4 detik (polling), bukan realtime.

---

## Perubahan di v5.6.0

### 1. Sesi Login Independen Per Browser
| Sebelum (5.5.1) | Sesudah (5.6.0) |
|---|---|
| `session` disimpan di Supabase (`pos_auth_session`) | `session` disimpan di `sessionStorage` (per tab browser) |
| Login user A bisa menimpa sesi user B | Setiap tab/komputer punya sesi sendiri |

### 2. Supabase Realtime (WebSocket)
Data kritis kini di-push ke semua klien secara **instan** via WebSocket:
- `pos_prescriptions` — resep dokter langsung muncul di dashboard apoteker
- `pos_transactions` — transaksi kasir tersinkron
- `pos_copy_resep_list` — salinan resep
- `pos_cash_counts` — penghitungan kas

### 3. Polling Fallback
Jika WebSocket tidak tersedia (jaringan terputus sementara),
sistem otomatis fallback ke polling **2 detik** (sebelumnya 4 detik).

### 4. Visibility Sync
Saat pengguna kembali ke tab yang lama ditinggal,
data langsung di-refresh dari Supabase.

### 5. Indikator Status Koneksi
Dot kecil di topbar menunjukkan status realtime:
- 🟢 **Live** — Realtime WebSocket aktif, update instan
- 🟡 **Sync** — Mode polling 2 detik (fallback)
- ⚫ **...** — Sedang menghubungkan
- 🔴 **Offline** — Supabase tidak dikonfigurasi

---

## Setup Wajib di Supabase

### Step 1 — Jalankan Migration SQL
Buka **Supabase Dashboard → SQL Editor**, paste dan jalankan isi file:
```
MIGRATION-REALTIME-V5.6.sql
```

### Step 2 — Aktifkan Realtime di Dashboard
1. Buka **Database → Replication**
2. Klik tab **Realtime**
3. Pastikan tabel `app_settings` sudah muncul dan statusnya **enabled**

Jika belum muncul, jalankan manual di SQL Editor:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;
```

### Step 3 — Verifikasi
Buka aplikasi di **2 browser berbeda / 2 komputer berbeda**:
1. Login sebagai Dokter di komputer A
2. Login sebagai Apoteker di komputer B
3. Buat resep di komputer A → resep harus muncul **langsung** di komputer B
4. Indikator di topbar harus menunjukkan 🟢 **Live** di kedua komputer

---

## Arsitektur Sinkronisasi

```
Browser A (Dokter)          Supabase                Browser B (Apoteker)
─────────────────           ────────                 ─────────────────────
sessionStorage ──┐
(sesi lokal)    │
                │
Simpan Resep ───┼──► app_settings (UPSERT) ──► Realtime WebSocket ──► update prescriptions
                │                                                       badge ⏳ muncul
                │                                                       di navbar
                │
                │◄── polling 2s (fallback) ◄────────────────────────────────────────┘
```

---

## File yang Berubah

```
src/
├── App.jsx
│   ├── SESSION: useStorage(authSession) → useState + sessionStorage
│   ├── POLLING: 4000ms → 2000ms
│   ├── REALTIME: subscribeRealtime() di useStorage hook
│   ├── VISIBILITY: sync saat tab kembali aktif
│   └── UI: <RealtimeIndicator /> di topbar
│
└── lib/supabase.js
    └── tambah subscribeRealtime() — WebSocket ke Supabase Realtime

MIGRATION-REALTIME-V5.6.sql  ← jalankan di Supabase SQL Editor
```
