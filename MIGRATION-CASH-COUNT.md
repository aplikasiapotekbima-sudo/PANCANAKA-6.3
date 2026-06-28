# Database Schema & Migration Notes — V3.2.5

Semua data disimpan via sistem `app_settings` (localStorage + Supabase sync) yang sudah ada.
Tidak diperlukan migrasi tabel baru — cukup jalankan aplikasi dan data langsung tersimpan.

## Storage Keys (V3.2.5 — tidak berubah dari V3.2.4)

| Key | Isi | Format |
|-----|-----|--------|
| `pos_otc_sales` | Array penjualan non resep (OTC) | JSON array |
| `pos_otc_counter` | Counter invoice OTC | number |
| `pos_cash_counts` | Array data closing kas | JSON array |

---

## Schema: pos_cash_counts (V3.2.5 — field baru ditandai ✨)

Setiap record closing kas:

```json
{
  "id": 1748940099999,
  "tanggal": "09/06/2026",
  "tanggalISO": "2026-06-09",
  "jam": "21:30",
  "kasir": "Admin",
  "pecahan": { "100000": 5, "50000": 3, "20000": 1, "10000": 0, "5000": 2, "2000": 1, "1000": 5, "500": 4, "200": 0, "100": 0 },
  "totalTunai": 689000,
  "omset": {
    "omsetKonsulTunai": 350000,
    "omsetKonsulQris":  150000,
    "omsetObatTunai":   200000,
    "omsetObatQris":    100000,
    "totalTransfer":     50000
  },
  "grandTotal": 989000,
  "catatanClosing": "Closing shift malam",

  "modal_pagi":         500000,
  "uang_tunai_masuk":   189000,
  "omset_tunai_sistem": 550000,
  "total_omset_sistem": 850000,
  "selisih_kas":        -361000,
  "setor_manajemen":    2000000,
  "status_closing":     "SELISIH KURANG",

  "createdAt": "2026-06-09T21:30:00.000Z"
}
```

### Penjelasan Field Baru (V3.2.5)

| Field | Tipe | Keterangan |
|-------|------|------------|
| `modal_pagi` | number | Uang awal kas saat buka apotek |
| `uang_tunai_masuk` | number | `totalTunai − modal_pagi` |
| `omset_tunai_sistem` | number | `omsetKonsulTunai + omsetObatTunai` |
| `total_omset_sistem` | number | Semua omset: tunai + QRIS + transfer |
| `selisih_kas` | number | `uang_tunai_masuk − omset_tunai_sistem` (negatif = kurang, positif = lebih) |
| `setor_manajemen` | number | Nominal yang diserahkan ke manajemen |
| `status_closing` | string | `"SESUAI"` / `"SELISIH LEBIH"` / `"SELISIH KURANG"` |

---

## Opsional: Tabel Dedicated Supabase (V3.2.5)

Jika ingin query SQL langsung, jalankan migration berikut:

```sql
-- Tabel closing kas (V3.2.5 — dengan field rekap kas)
CREATE TABLE IF NOT EXISTS cash_counts (
  id                   BIGINT PRIMARY KEY,
  tanggal              DATE NOT NULL,
  jam                  TIME NOT NULL,
  kasir                TEXT NOT NULL DEFAULT 'Admin',
  pecahan              JSONB NOT NULL DEFAULT '{}',
  total_tunai          NUMERIC(14,0) NOT NULL DEFAULT 0,
  omset_konsul_tunai   NUMERIC(14,0) NOT NULL DEFAULT 0,
  omset_konsul_qris    NUMERIC(14,0) NOT NULL DEFAULT 0,
  omset_obat_tunai     NUMERIC(14,0) NOT NULL DEFAULT 0,
  omset_obat_qris      NUMERIC(14,0) NOT NULL DEFAULT 0,
  total_transfer       NUMERIC(14,0) NOT NULL DEFAULT 0,
  grand_total          NUMERIC(14,0) NOT NULL DEFAULT 0,
  catatan              TEXT,

  -- ✨ Field baru V3.2.5
  modal_pagi           NUMERIC(14,0) NOT NULL DEFAULT 0,
  uang_tunai_masuk     NUMERIC(14,0) NOT NULL DEFAULT 0,
  omset_tunai_sistem   NUMERIC(14,0) NOT NULL DEFAULT 0,
  total_omset_sistem   NUMERIC(14,0) NOT NULL DEFAULT 0,
  selisih_kas          NUMERIC(14,0) NOT NULL DEFAULT 0,
  setor_manajemen      NUMERIC(14,0) NOT NULL DEFAULT 0,
  status_closing       TEXT NOT NULL DEFAULT 'SESUAI'
                         CHECK (status_closing IN ('SESUAI','SELISIH LEBIH','SELISIH KURANG')),

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_counts_tanggal ON cash_counts (tanggal DESC);
CREATE INDEX idx_cash_counts_status  ON cash_counts (status_closing);
```

### Migrasi jika tabel sudah ada (ALTER TABLE)

```sql
ALTER TABLE cash_counts
  ADD COLUMN IF NOT EXISTS modal_pagi          NUMERIC(14,0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uang_tunai_masuk    NUMERIC(14,0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS omset_tunai_sistem  NUMERIC(14,0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_omset_sistem  NUMERIC(14,0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selisih_kas         NUMERIC(14,0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS setor_manajemen     NUMERIC(14,0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status_closing      TEXT NOT NULL DEFAULT 'SESUAI';
```

---

## Format Nomor Invoice OTC

`OTC/YYMM/NNNN` — contoh: `OTC/2606/0001`
