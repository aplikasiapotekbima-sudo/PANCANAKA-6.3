# CHANGELOG: E-Resep Dokter & Apoteker — v5.2

## Ringkasan Perubahan

Menu **E-Resep** (tunggal) dipecah menjadi **dua menu terpisah** dengan alur komunikasi profesional dokter → apoteker.

---

## Menu Baru

| Menu Lama | Menu Baru |
|-----------|-----------|
| 💊 E-Resep | 🩺 E-Resep Dokter |
| | ⚗️ E-Resep Apoteker |

---

## E-Resep Dokter (`/pages/eprescribing-dokter/PageEResepDokter.jsx`)

### Fitur Baru
- **Field No. RM / ID Pasien** — identifikasi rekam medis
- **Field Satuan Obat** — tab, kaps, ml, sachet, tube, fls, ampul, pcs, bungkus
- **Checkbox Racikan** — tandai apakah obat adalah racikan 🧪
- **Keterangan tambahan per item obat**
- **Catatan untuk Apoteker** — textarea khusus berwarna kuning amber, hanya terlihat di dashboard apoteker
- **Tombol "Simpan & Kirim ke Apoteker"** — menyimpan resep dengan status `MENUNGGU_DISPENSING` otomatis

### Alur Save
1. Dokter isi form → klik **Simpan & Kirim ke Apoteker**
2. Resep tersimpan ke state `prescriptions` dengan `status: "MENUNGGU_DISPENSING"`
3. Badge kuning langsung muncul di tab **E-Resep Apoteker**

---

## E-Resep Apoteker (`/pages/eprescribing-apoteker/PageEResepApoteker.jsx`)

### Fitur
- **Dashboard ringkasan** — 4 kartu status yang bisa diklik sebagai filter
- **Badge notifikasi** di tab navbar — jumlah resep menunggu dispensing (warna amber)
- **Tabel resep masuk** — no. resep, waktu, pasien, dokter, jumlah obat, status
  - Row berwarna kuning jika `MENUNGGU_DISPENSING`
  - Indikator `⚠️` alergi dan `💬 ada catatan dokter`
  - Tombol quick-update status langsung dari tabel (tanpa buka modal)
- **Filter** — Hari Ini / Semua, per dokter, per status (klik kartu)
- **Search** — nama pasien dan nomor resep
- **Modal Detail Resep** — tampilan lengkap:
  - Data pasien + alergi
  - Daftar obat dengan badge Racikan
  - **Catatan dokter** (blok amber — informasi eksklusif apoteker)
  - Progress bar status dispensing
  - Tombol update status: next step atau pilih manual
  - Print resep dari dalam modal

### Status Workflow

```
MENUNGGU_DISPENSING → SEDANG_DISIAPKAN → SIAP_DIAMBIL → SUDAH_DISERAHKAN
        ⏳                   ⚗️                ✅                🤝
```

---

## File yang Diubah / Dibuat

```
src/
├── App.jsx                                          ← DIUBAH
│   ├── Import PageEResepDokter, PageEResepApoteker
│   ├── Nav: tambah 2 menu baru
│   ├── Badge: eresep-apoteker (amber, jumlah menunggu)
│   └── Routing: page === "eresep-dokter" / "eresep-apoteker"
│
├── pages/
│   ├── eprescribing-dokter/
│   │   └── PageEResepDokter.jsx                    ← BARU
│   └── eprescribing-apoteker/
│       └── PageEResepApoteker.jsx                  ← BARU
│
└── (eprescribing lama tetap ada, tidak dihapus)

MIGRATION-ERESEP-V5.2.sql                           ← BARU
```

---

## Struktur Data Resep (localStorage)

Field baru yang ditambahkan ke setiap objek resep:

```js
{
  // ... field lama tetap ada ...
  patientRM: "",              // No. RM pasien
  notesForPharmacist: "",     // Catatan dokter untuk apoteker
  status: "MENUNGGU_DISPENSING",  // Status dispensing
  updatedAt: "",              // Timestamp update status terakhir

  // medicines[] kini punya field tambahan:
  medicines: [{
    name: "",
    strength: "",
    signa: "",
    quantity: "",
    unit: "tab",              // BARU: satuan
    compounded: false,        // BARU: flag racikan
    notes: "",                // BARU: keterangan tambahan
  }]
}
```

---

## Kompatibilitas

- Resep lama (dari PageEPrescribing) **tetap terbaca** di PageEResepApoteker
  — field `status` akan `undefined`, ditangani dengan fallback ke `MENUNGGU_DISPENSING`
- PageEPrescribing lama **tidak dihapus** (masih bisa diakses jika diperlukan)
- Tidak ada perubahan breaking pada struktur `doctors`, `transactions`, dll.
