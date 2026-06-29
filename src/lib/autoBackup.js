// src/lib/autoBackup.js
// ─────────────────────────────────────────────────────────────────────────────
// Safety-net: backup otomatis setiap malam pukul 20:45 (waktu lokal device),
// HANYA berjalan jika ada user dengan role "apoteker" yang sedang live
// (login & app terbuka) di device tersebut. File backup otomatis terdownload
// ke device lokal apoteker yang bersangkutan — tidak perlu akses Developer Panel.
//
// Ini terpisah dari Backup manual di Developer Panel (PageDevPanel.jsx) supaya
// tidak ada risiko mengubah perilaku backup manual yang sudah berjalan baik.
// Kedua jalur menghasilkan format file backup yang sama & saling kompatibel
// untuk Restore.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabaseClient";
import { getSharedSetting } from "./supabase";

const APP_SETTINGS_KEYS = [
  "pos_doctors",
  "pos_transactions",
  "pos_settings",
  "pos_invoice_counter",
  "pos_prescriptions",
  "pos_prescription_counter",
  "pos_print_settings",
  "pos_cash_counts",
  "pos_otc_sales",
  "pos_otc_counter",
  "pos_copy_resep_list",
  "pos_copy_resep_counter",
  "pos_copy_resep_settings",
  "pos_users",
];

const SUPABASE_TABLES = ["patients", "allergies_log", "encounters", "user_profiles"];

// Jadwal: 20:45 waktu lokal device. Jendela toleransi 5 menit (20:45–20:49)
// untuk mengantisipasi interval pengecekan / tab yang sempat idle/throttled,
// tapi tetap hanya berjalan SATU KALI per hari (dijaga oleh localStorage).
export const AUTO_BACKUP_HOUR = 20;
export const AUTO_BACKUP_MINUTE = 45;
const WINDOW_MINUTES = 5;

const LAST_RUN_KEY = "pos_auto_backup_last_run_date";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Cek apakah sekarang sudah waktunya & belum pernah jalan hari ini di device ini. */
export function isAutoBackupDue() {
  try {
    const lastRun = localStorage.getItem(LAST_RUN_KEY);
    if (lastRun === todayKey()) return false; // sudah jalan hari ini

    const now = new Date();
    const targetMinutes = AUTO_BACKUP_HOUR * 60 + AUTO_BACKUP_MINUTE;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return nowMinutes >= targetMinutes && nowMinutes < targetMinutes + WINDOW_MINUTES;
  } catch {
    return false; // localStorage tidak tersedia (mode privat dsb.) — jangan paksa jalan
  }
}

export function markAutoBackupRanToday() {
  try {
    localStorage.setItem(LAST_RUN_KEY, todayKey());
  } catch {
    /* abaikan — paling buruk backup otomatis jalan lagi besok seperti normal */
  }
}

function downloadJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Jalankan backup penuh (app_settings + tabel Supabase) dan otomatis
 * terdownload sebagai file .json ke device ini.
 * @param {string} exportedBy - identitas user yang sedang live (untuk audit di meta backup)
 */
export async function runAutoBackup(exportedBy = "auto-backup@apoteker-live") {
  const backup = {
    meta: {
      version: "6.3",
      exported_at: new Date().toISOString(),
      exported_by: exportedBy,
      app: "KASIR-KLINIK-PANCANAKA",
      trigger: "auto-backup-20:45",
    },
    app_settings: {},
    supabase_tables: {},
  };

  for (const key of APP_SETTINGS_KEYS) {
    try {
      const { data, error } = await getSharedSetting(key);
      if (error) throw error;
      backup.app_settings[key] = data;
    } catch {
      backup.app_settings[key] = null;
    }
  }

  for (const tbl of SUPABASE_TABLES) {
    try {
      if (!supabase) throw new Error("Supabase belum dikonfigurasi");
      const { data, error } = await supabase.from(tbl).select("*").order("created_at", { ascending: true });
      if (error) throw error;
      backup.supabase_tables[tbl] = data || [];
    } catch {
      backup.supabase_tables[tbl] = null;
    }
  }

  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const filename = `auto-backup-kasir-klinik-${ts}.json`;
  downloadJSON(backup, filename);

  return { filename, backup };
}
