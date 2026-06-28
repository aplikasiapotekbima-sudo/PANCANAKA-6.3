# Changelog — Kasir Klinik v6.2

## Bugfix: Rekam Medis — SOAP Encounter Modal

### Bug yang diperbaiki

**1. Error message tidak terlihat saat simpan SOAP gagal**
- Sebelumnya: kotak pesan error tersembunyi di bawah konten scroll,
  user tidak tahu simpan gagal karena tidak ada indikator yang terlihat.
- Sesudah: notifikasi error & sukses dipindah ke footer sticky (di atas
  tombol Simpan), selalu terlihat tanpa perlu scroll.

**2. Pesan error Supabase tidak informatif**
- Sebelumnya: hanya tampil pesan generik tanpa detail penyebab.
- Sesudah: detail error dari Supabase ditampilkan agar mudah
  mendiagnosis masalah (mis. RLS, koneksi, field constraint).
- Tambah `try/catch` untuk error tak terduga (network timeout, dll).

**3. Modal SOAP tidak terbuka otomatis setelah daftar pasien baru**
- Sebelumnya: user harus klik "+" Tambah Kunjungan secara manual
  setelah mendaftarkan pasien baru — alur terputus.
- Sesudah: setelah pasien berhasil didaftarkan, modal SOAP langsung
  terbuka otomatis untuk input kunjungan pertama.

### File yang diubah
- `src/components/rekam-medis/SoapEncounterModal.jsx`
- `src/pages/rekam-medis/PageRekamMedis.jsx`
- `package.json` (version 5.6.0 → 6.2.0)
- `index.html` (title updated)
