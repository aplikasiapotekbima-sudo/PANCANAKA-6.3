// src/components/AutoBackupWatcher.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Mount sekali di App.jsx (selama user login & app terbuka/"live").
// Setiap 30 detik mengecek jam device — jika sudah pukul 20:45 (jendela 5
// menit) DAN currentUser.role === "apoteker", jalankan backup otomatis &
// download ke device lokal apoteker tersebut. Maksimal 1x per hari per device.
// Komponen ini tidak merender apa pun (safety-net, berjalan diam-diam).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { isAutoBackupDue, markAutoBackupRanToday, runAutoBackup } from "../lib/autoBackup";

const CHECK_INTERVAL_MS = 30 * 1000;

export default function AutoBackupWatcher({ currentUser }) {
  const runningRef = useRef(false);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "apoteker") return;

    const check = async () => {
      if (runningRef.current) return;
      if (!isAutoBackupDue()) return;

      runningRef.current = true;
      // Tandai dulu SEBELUM proses async, supaya kalau ada 2 tab terbuka
      // di device yang sama, tidak ter-trigger dobel.
      markAutoBackupRanToday();
      try {
        await runAutoBackup(currentUser.email || currentUser.full_name || "apoteker-live");
      } catch {
        // Gagal diam-diam — ini safety-net tambahan, backup manual di Dev
        // Panel tetap tersedia sebagai jalur utama.
      } finally {
        runningRef.current = false;
      }
    };

    check(); // cek langsung saat mount (mis. tab baru dibuka tepat di jendela jadwal)
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [currentUser]);

  return null;
}
