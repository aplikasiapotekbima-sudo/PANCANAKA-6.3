# Checklist Drill Restore — Dilakukan Tiap Kuartal

> Backup yang belum pernah dites restore-nya bukan backup, itu cuma harapan.
> Jadwalkan ini di kalender, bukan "kalau ada waktu" — kalau dilewatkan terus,
> kemungkinan besar baru ketahuan ada masalah saat sudah benar-benar darurat.

## Yang dites
- [ ] PITR (Point-in-Time Recovery) bawaan Supabase — restore ke timestamp tertentu
- [ ] File dump eksternal hasil `backup-database.sh` — restore ke project terpisah

## Langkah A — Tes PITR
1. Dashboard Supabase → Database → Backups → Point in Time Recovery
2. Pilih timestamp acak dari ~3 hari lalu, klik restore ke **project staging**
   (JANGAN langsung ke project produksi — pakai project Supabase kedua khusus
   staging, gratis untuk keperluan ini)
3. Setelah restore selesai, cek:
   - [ ] Jumlah baris `patients` masuk akal (mendekati jumlah di produksi pada timestamp tersebut)
   - [ ] Buka satu pasien acak, cek riwayat alergi & resepnya utuh
   - [ ] Cek `audit_log` — baris-baris log sebelum timestamp restore ikut ada
4. Catat **berapa lama proses restore selesai** (penting untuk estimasi downtime kalau ini bukan drill)

## Langkah B — Tes restore dump eksternal
1. Unduh file `.sql.gz` terbaru dari bucket backup eksternal
2. Siapkan instance Postgres kosong (bisa Docker lokal: `docker run -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:15`)
3. Restore:
   ```bash
   gunzip -c kasir-klinik-2026-xx-xxTxx-xx-xxZ.sql.gz | psql "postgresql://postgres:test@localhost:5433/postgres"
   ```
4. Cek:
   - [ ] Tabel `patients`, `prescriptions`, `audit_log`, `allergies_log` semua ada dan terisi
   - [ ] Tidak ada error fatal saat proses restore (warning soal `role does not exist` untuk owner umumnya aman karena dump pakai `--no-owner`)
   - [ ] Jumlah baris `patients` di dump ini cocok dengan jumlah di produksi pada tanggal dump dibuat

## Langkah C — Tinjau setelah drill
- [ ] Update tanggal "Drill restore terakhir: ____" di dokumen ini
- [ ] Kalau ada langkah yang ternyata membingungkan/lambat saat drill, perbaiki skrip/dokumentasinya SEKARANG, jangan ditunda — drill berikutnya akan menemukan masalah yang sama kalau tidak diperbaiki
- [ ] Kalau drill gagal total (dump corrupt, PITR tidak jalan, dll), itu artinya kondisi backup saat ini TIDAK bisa diandalkan — eskalasi sebagai prioritas, bukan catatan biasa

---

**Drill restore terakhir dilakukan:** _(isi tanggal setelah drill pertama)_
**Hasil:** _(berhasil / berhasil dengan catatan / gagal — lihat catatan di atas)_
**Drill berikutnya dijadwalkan:** _(+3 bulan dari tanggal di atas)_
