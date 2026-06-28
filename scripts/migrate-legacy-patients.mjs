#!/usr/bin/env node
// scripts/migrate-legacy-patients.mjs
//
// Skrip migrasi SATU KALI: menarik nama-nama pasien dari data lama
// (blob JSON di app_settings: prescriptions, copyResepList, transactions)
// dan membuat baris di tabel `patients` untuk masing-masing nama unik.
//
// TIDAK mengubah data lama (prescriptions/copyResepList/transactions tetap
// blob seperti semula, tetap bisa dibuka di halaman Riwayat/Salinan Resep).
// Tujuan skrip ini HANYA mengisi master data pasien agar nama-nama yang
// sudah pernah dicatat bisa langsung ditemukan lewat PatientSelector ke
// depannya, tanpa harus didaftarkan ulang dari nol satu per satu.
//
// CARA PAKAI:
//   1. npm install @supabase/supabase-js dotenv   (kalau belum ada)
//   2. Buat file .env.migration (JANGAN dicommit ke git) isinya:
//        SUPABASE_URL=https://xxxx.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=ey...   <-- service role, BUKAN anon key
//      Service role dipakai supaya bisa baca app_settings & tulis ke
//      `patients` tanpa terhalang RLS. Key ini SANGAT SENSITIF — jangan
//      pernah dipakai di kode frontend/client, hanya untuk skrip lokal ini.
//   3. node scripts/migrate-legacy-patients.mjs
//   4. Cek file output `legacy-patients-mapping.csv` yang dihasilkan —
//      tinjau manual untuk gabungkan nama yang sebenarnya orang yang sama
//      tapi beda penulisan (typo, "Bu" vs tanpa "Bu", dst).

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync } from "fs";

config({ path: ".env.migration" });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di .env.migration");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function normalizeName(name) {
  return (name || "").trim().replace(/\s+/g, " ");
}

function genRmNumber(seq) {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `RM-${y}${m}-L${String(seq).padStart(4, "0")}`; // prefix "L" = legacy/migrasi
}

async function fetchBlob(key) {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    console.warn(`⚠️  Gagal ambil key "${key}":`, error.message);
    return [];
  }
  if (!data?.value) return [];
  try {
    const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function main() {
  console.log("📥 Mengambil data lama dari app_settings...");

  const [prescriptions, copyResepList, transactions] = await Promise.all([
    fetchBlob("prescriptions"),
    fetchBlob("copyResepList"),
    fetchBlob("transactions"),
  ]);

  // Kumpulkan kandidat pasien unik (key = nama lowercase, biar dedup gampang)
  const candidates = new Map(); // key -> { name, rm, gender, sourceCount }

  const addCandidate = (name, rm, gender) => {
    const n = normalizeName(name);
    if (!n) return;
    const key = n.toLowerCase();
    const existing = candidates.get(key);
    if (existing) {
      existing.sourceCount += 1;
      if (!existing.rm && rm) existing.rm = rm;
      if (!existing.gender && gender) existing.gender = gender;
    } else {
      candidates.set(key, { name: n, rm: rm || null, gender: gender || null, sourceCount: 1 });
    }
  };

  for (const rx of prescriptions) {
    addCandidate(rx.patientName, rx.patientRM, rx.patientGender);
  }
  for (const cr of copyResepList) {
    addCandidate(cr.pasien?.nama, cr.pasien?.nomorRekamMedis, cr.pasien?.jenisKelamin);
  }
  for (const tx of transactions) {
    addCandidate(tx.patientName, null, null);
  }

  console.log(`🔎 Ditemukan ${candidates.size} nama pasien unik dari data lama.`);

  // Cek pasien yang sudah ada di tabel `patients` (hindari duplikat kalau skrip dijalankan ulang)
  const { data: existingPatients } = await supabase.from("patients").select("id, name, rm_number");
  const existingByName = new Map((existingPatients || []).map((p) => [p.name.toLowerCase(), p]));

  const rows = [];
  let seq = (existingPatients || []).length + 1;

  for (const [key, c] of candidates) {
    if (existingByName.has(key)) continue; // sudah ada, skip
    rows.push({
      rm_number: c.rm || genRmNumber(seq++),
      name: c.name,
      gender: c.gender === "L" || c.gender === "P" ? c.gender : null,
    });
  }

  console.log(`✏️  Akan membuat ${rows.length} pasien baru (sisanya sudah ada di master data).`);

  const inserted = [];
  // Insert satu-satu (bukan batch) supaya error di satu baris (misal rm_number
  // bentrok) tidak menggagalkan semuanya, dan supaya audit_log mencatat tiap
  // baris secara rapi.
  for (const row of rows) {
    const { data, error } = await supabase.from("patients").insert(row).select().single();
    if (error) {
      console.warn(`⚠️  Gagal insert "${row.name}":`, error.message);
      continue;
    }
    inserted.push(data);
  }

  console.log(`✅ Berhasil membuat ${inserted.length} pasien baru di master data.`);

  // Tulis CSV mapping untuk ditinjau manual (nama lama -> RM baru -> jumlah kemunculan)
  const csvLines = ["nama_lama,rm_baru,jumlah_kemunculan_di_data_lama"];
  for (const [, c] of candidates) {
    const match = inserted.find((p) => p.name.toLowerCase() === c.name.toLowerCase())
      || existingByName.get(c.name.toLowerCase());
    csvLines.push(`"${c.name}",${match?.rm_number || "-"},${c.sourceCount}`);
  }
  writeFileSync("legacy-patients-mapping.csv", csvLines.join("\n"), "utf-8");
  console.log("📄 Mapping ditulis ke legacy-patients-mapping.csv — tinjau manual untuk gabungkan nama yang ternyata orang sama.");
}

main().catch((err) => {
  console.error("❌ Migrasi gagal:", err);
  process.exit(1);
});
