// src/pages/dev/PageDevPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Panel Developer — hanya bisa diakses oleh dev@bima.local
// Fitur:
//   1. Backup Data → export semua data ke file JSON di drive lokal
//   2. Restore Data → import file JSON backup, preview, lalu tulis ulang ke Supabase
//   3. Audit Trail  → tampilkan log perubahan dari tabel audit_log (Supabase)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { getSharedSetting, saveSharedSetting } from "../../lib/supabase";

// ── Konstanta ─────────────────────────────────────────────────────────────────
const DEV_EMAIL = "dev@bima.local";

// Semua storage key app_settings yang di-backup
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDatetime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
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

// ── Badge komponen ─────────────────────────────────────────────────────────────
function Badge({ children, color = "blue" }) {
  const colors = {
    blue:   { bg: "#dbeafe", text: "#1d4ed8" },
    green:  { bg: "#dcfce7", text: "#15803d" },
    red:    { bg: "#fee2e2", text: "#b91c1c" },
    amber:  { bg: "#fef3c7", text: "#92400e" },
    purple: { bg: "#f3e8ff", text: "#7c3aed" },
    gray:   { bg: "#f3f4f6", text: "#374151" },
  };
  const c = colors[color] || colors.gray;
  return (
    <span style={{
      background: c.bg, color: c.text,
      fontSize: 11, fontWeight: 700, padding: "2px 8px",
      borderRadius: 99, display: "inline-block",
    }}>{children}</span>
  );
}

// ── Section card ───────────────────────────────────────────────────────────────
function SectionCard({ title, icon, children, accent = "#6366f1" }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, border: "1.5px solid #e5e7eb",
      boxShadow: "0 1px 4px rgba(0,0,0,.06)", marginBottom: 24, overflow: "hidden",
    }}>
      <div style={{
        background: accent, padding: "14px 20px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{title}</span>
      </div>
      <div style={{ padding: "20px" }}>{children}</div>
    </div>
  );
}

// ── Komponen utama ─────────────────────────────────────────────────────────────
export default function PageDevPanel({ currentUser }) {
  // Guard: hanya dev@bima.local
  if (!currentUser || currentUser.email !== DEV_EMAIL) {
    return (
      <div style={{
        minHeight: 400, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16, color: "#6b7280",
      }}>
        <span style={{ fontSize: 64 }}>🔒</span>
        <div style={{ fontWeight: 700, fontSize: 18, color: "#1f2937" }}>Akses Ditolak</div>
        <div style={{ fontSize: 14, textAlign: "center", maxWidth: 320 }}>
          Halaman ini hanya bisa diakses oleh akun developer.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%)",
        borderRadius: 16, padding: "24px 28px", marginBottom: 28,
        display: "flex", alignItems: "center", gap: 16, color: "#fff",
      }}>
        <span style={{ fontSize: 40 }}>🛠️</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: 0.5 }}>Developer Panel</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
            Backup · Restore · Audit Trail — Login sebagai{" "}
            <span style={{ fontWeight: 700, background: "rgba(255,255,255,0.15)", padding: "1px 8px", borderRadius: 20 }}>
              {currentUser.email}
            </span>
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 12, opacity: 0.7 }}>
          <div>⚠️ Area sensitif</div>
          <div>Operasi di sini permanen</div>
        </div>
      </div>

      {/* Tab: Backup / Restore / Audit */}
      <DevTabs currentUser={currentUser} />
    </div>
  );
}

// ── Tab controller ─────────────────────────────────────────────────────────────
function DevTabs({ currentUser }) {
  const [activeTab, setActiveTab] = useState("backup");

  const tabs = [
    { id: "backup",  label: "💾 Backup Data",   },
    { id: "restore", label: "🔄 Restore Data",  },
    { id: "audit",   label: "📋 Audit Trail",   },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "2px solid #e5e7eb" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "10px 22px", border: "none", background: "none", cursor: "pointer",
              fontSize: 14, fontWeight: activeTab === t.id ? 700 : 500,
              color: activeTab === t.id ? "#6366f1" : "#6b7280",
              borderBottom: `3px solid ${activeTab === t.id ? "#6366f1" : "transparent"}`,
              marginBottom: -2, transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "backup"  && <BackupSection />}
      {activeTab === "restore" && <RestoreSection />}
      {activeTab === "audit"   && <AuditSection />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: BACKUP
// ─────────────────────────────────────────────────────────────────────────────
function BackupSection() {
  const [status, setStatus] = useState("idle"); // idle | running | done | error
  const [log, setLog] = useState([]);
  const [summary, setSummary] = useState(null);

  function addLog(msg, type = "info") {
    setLog((prev) => [...prev, { msg, type, ts: new Date().toISOString() }]);
  }

  async function runBackup() {
    setStatus("running");
    setLog([]);
    setSummary(null);

    const backup = {
      meta: {
        version: "6.3",
        exported_at: new Date().toISOString(),
        exported_by: "dev@bima.local",
        app: "KASIR-KLINIK-PANCANAKA",
      },
      app_settings: {},
      supabase_tables: {},
    };

    // 1. Backup app_settings (blob JSON di Supabase)
    addLog("⏳ Membaca app_settings dari Supabase…");
    let settingsOk = 0;
    for (const key of APP_SETTINGS_KEYS) {
      try {
        const { data, error } = await getSharedSetting(key);
        if (error) throw error;
        backup.app_settings[key] = data;
        settingsOk++;
        addLog(`  ✅ ${key}`, "success");
      } catch (e) {
        addLog(`  ⚠️ ${key}: ${e.message}`, "warn");
        backup.app_settings[key] = null;
      }
    }

    // 2. Backup tabel Supabase (patients, encounters, dll)
    addLog("⏳ Membaca tabel relasional Supabase…");
    let tablesOk = 0;
    for (const tbl of SUPABASE_TABLES) {
      try {
        if (!supabase) throw new Error("Supabase belum dikonfigurasi");
        const { data, error } = await supabase.from(tbl).select("*").order("created_at", { ascending: true });
        if (error) throw error;
        backup.supabase_tables[tbl] = data || [];
        tablesOk++;
        addLog(`  ✅ ${tbl} — ${(data || []).length} baris`, "success");
      } catch (e) {
        addLog(`  ⚠️ ${tbl}: ${e.message}`, "warn");
        backup.supabase_tables[tbl] = null;
      }
    }

    // 3. Hitung ukuran & download
    const json = JSON.stringify(backup, null, 2);
    const bytes = new Blob([json]).size;
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const filename = `backup-kasir-klinik-${ts}.json`;

    downloadJSON(backup, filename);

    setSummary({
      filename,
      bytes,
      settingsOk,
      tablesOk,
      ts: backup.meta.exported_at,
    });
    setStatus("done");
    addLog(`✅ Backup selesai → ${filename} (${formatBytes(bytes)})`, "success");
  }

  return (
    <SectionCard title="Backup Data ke Drive Lokal" icon="💾" accent="#059669">
      <p style={{ fontSize: 13.5, color: "#4b5563", marginTop: 0, marginBottom: 20, lineHeight: 1.6 }}>
        Mengekspor <strong>seluruh data aplikasi</strong> (transaksi, resep, pasien, encounters, dll) ke
        satu file <code>.json</code> yang langsung tersimpan di drive lokal Anda. Jalankan backup
        secara rutin (disarankan setiap hari atau setiap minggu).
      </p>

      <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 10, padding: "14px 18px", marginBottom: 20, fontSize: 13 }}>
        <div style={{ fontWeight: 700, color: "#166534", marginBottom: 6 }}>Yang akan di-backup:</div>
        <div style={{ color: "#15803d", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 20px" }}>
          {APP_SETTINGS_KEYS.map((k) => <div key={k}>• {k}</div>)}
          {SUPABASE_TABLES.map((t) => <div key={t} style={{ fontWeight: 600 }}>• Tabel: {t}</div>)}
        </div>
      </div>

      <button
        onClick={runBackup}
        disabled={status === "running"}
        style={{
          background: status === "running" ? "#9ca3af" : "#059669",
          color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px",
          fontSize: 14, fontWeight: 700, cursor: status === "running" ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        {status === "running" ? "⏳ Sedang backup…" : "💾 Mulai Backup Sekarang"}
      </button>

      {log.length > 0 && (
        <div style={{
          marginTop: 20, background: "#1e1b4b", borderRadius: 8, padding: "14px 16px",
          fontFamily: "monospace", fontSize: 12, maxHeight: 280, overflowY: "auto",
        }}>
          {log.map((l, i) => (
            <div key={i} style={{
              color: l.type === "success" ? "#4ade80" : l.type === "warn" ? "#fbbf24" : "#c4b5fd",
              marginBottom: 3,
            }}>
              <span style={{ color: "#6b7280", marginRight: 8 }}>{l.ts.slice(11, 19)}</span>
              {l.msg}
            </div>
          ))}
        </div>
      )}

      {summary && (
        <div style={{ marginTop: 20, background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontWeight: 700, color: "#166534", marginBottom: 10, fontSize: 14 }}>✅ Backup Berhasil!</div>
          <div style={{ fontSize: 13, color: "#166534", lineHeight: 2 }}>
            <div>📄 File: <strong>{summary.filename}</strong></div>
            <div>📦 Ukuran: <strong>{formatBytes(summary.bytes)}</strong></div>
            <div>🔧 App settings: <strong>{summary.settingsOk} / {APP_SETTINGS_KEYS.length} key</strong></div>
            <div>🗃️ Tabel DB: <strong>{summary.tablesOk} / {SUPABASE_TABLES.length} tabel</strong></div>
            <div>🕐 Waktu: <strong>{formatDatetime(summary.ts)}</strong></div>
          </div>
          <div style={{ marginTop: 12, padding: "8px 12px", background: "#dcfce7", borderRadius: 6, fontSize: 12, color: "#166534" }}>
            💡 Simpan file ini di tempat aman (USB drive, Google Drive, NAS, dll). File ini berisi data klinik lengkap.
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: RESTORE
// ─────────────────────────────────────────────────────────────────────────────
function RestoreSection() {
  const [step, setStep]             = useState("upload");   // upload | preview | confirm | running | done | error
  const [backupData, setBackupData] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [log, setLog]               = useState([]);
  const [restoreOpts, setRestoreOpts] = useState({
    app_settings: true,
    patients: true,
    encounters: true,
    allergies_log: true,
    user_profiles: false, // default OFF — berbahaya overwrite akun
  });
  const fileRef = useRef();

  function addLog(msg, type = "info") {
    setLog((prev) => [...prev, { msg, type, ts: new Date().toISOString() }]);
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        // Validasi struktur minimal
        if (!parsed.meta || !parsed.app_settings) {
          throw new Error("File tidak valid: bukan format backup KASIR-KLINIK.");
        }
        setBackupData(parsed);
        setStep("preview");
      } catch (err) {
        setParseError(err.message);
      }
    };
    reader.readAsText(file);
  }

  async function runRestore() {
    setStep("running");
    setLog([]);
    let errors = 0;

    // 1. Restore app_settings
    if (restoreOpts.app_settings && backupData.app_settings) {
      addLog("⏳ Mengembalikan app_settings…");
      for (const key of APP_SETTINGS_KEYS) {
        const val = backupData.app_settings[key];
        if (val === undefined || val === null) {
          addLog(`  ⏭️ ${key}: data kosong, dilewati`, "warn");
          continue;
        }
        try {
          const { error } = await saveSharedSetting(key, val);
          if (error) throw error;
          addLog(`  ✅ ${key}`, "success");
        } catch (e) {
          addLog(`  ❌ ${key}: ${e.message}`, "error");
          errors++;
        }
      }
    }

    // 2. Restore tabel relasional (upsert)
    const tableOpts = {
      patients:      restoreOpts.patients,
      encounters:    restoreOpts.encounters,
      allergies_log: restoreOpts.allergies_log,
      user_profiles: restoreOpts.user_profiles,
    };

    for (const [tbl, enabled] of Object.entries(tableOpts)) {
      if (!enabled) { addLog(`  ⏭️ Tabel ${tbl}: dilewati (tidak dipilih)`, "warn"); continue; }
      const rows = backupData.supabase_tables?.[tbl];
      if (!rows || rows.length === 0) { addLog(`  ⏭️ Tabel ${tbl}: data kosong`, "warn"); continue; }

      addLog(`⏳ Restore tabel ${tbl} (${rows.length} baris)…`);
      try {
        if (!supabase) throw new Error("Supabase belum dikonfigurasi");
        // Upsert batch — chunk 100 baris agar tidak timeout
        const CHUNK = 100;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const { error } = await supabase.from(tbl).upsert(chunk, { onConflict: "id" });
          if (error) throw error;
        }
        addLog(`  ✅ ${tbl} — ${rows.length} baris di-upsert`, "success");
      } catch (e) {
        addLog(`  ❌ ${tbl}: ${e.message}`, "error");
        errors++;
      }
    }

    if (errors === 0) {
      addLog("🎉 Restore selesai tanpa error!", "success");
      setStep("done");
    } else {
      addLog(`⚠️ Restore selesai dengan ${errors} error. Cek log di atas.`, "warn");
      setStep("done");
    }
  }

  function reset() {
    setStep("upload");
    setBackupData(null);
    setParseError(null);
    setLog([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <SectionCard title="Restore Data dari File Backup" icon="🔄" accent="#dc2626">
      {/* Warning banner */}
      <div style={{
        background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 10,
        padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#b91c1c",
        display: "flex", gap: 10, alignItems: "flex-start",
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
        <div>
          <strong>Peringatan:</strong> Restore akan <strong>menimpa (overwrite)</strong> data yang ada di Supabase.
          Pastikan Anda sudah membuat backup terbaru sebelum melanjutkan.
          Operasi ini <strong>tidak bisa dibatalkan</strong>.
        </div>
      </div>

      {/* STEP: Upload */}
      {(step === "upload" || step === "done") && (
        <div>
          {step === "done" && (
            <div style={{ background: "#dcfce7", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "#166534", fontWeight: 600 }}>
              ✅ Restore selesai! Refresh halaman untuk melihat data terbaru.
              <button onClick={reset} style={{ marginLeft: 16, background: "#059669", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 12 }}>
                Upload Backup Lain
              </button>
            </div>
          )}
          <label style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            border: "2px dashed #d1d5db", borderRadius: 12, padding: "40px 20px",
            cursor: "pointer", background: "#f9fafb", gap: 12,
            transition: "border-color 0.2s",
          }}>
            <input ref={fileRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: "none" }} />
            <span style={{ fontSize: 48 }}>📂</span>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#374151" }}>Pilih File Backup</div>
            <div style={{ fontSize: 12.5, color: "#6b7280" }}>Format: <code>backup-kasir-klinik-*.json</code></div>
          </label>
          {parseError && (
            <div style={{ marginTop: 12, background: "#fee2e2", borderRadius: 8, padding: "10px 14px", color: "#b91c1c", fontSize: 13 }}>
              ❌ {parseError}
            </div>
          )}
        </div>
      )}

      {/* STEP: Preview */}
      {step === "preview" && backupData && (
        <div>
          {/* Info backup */}
          <div style={{ background: "#eff6ff", border: "1.5px solid #93c5fd", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: "#1d4ed8", marginBottom: 8 }}>📋 Info File Backup</div>
            <div style={{ fontSize: 13, color: "#1e40af", lineHeight: 2 }}>
              <div>📅 Diekspor: <strong>{formatDatetime(backupData.meta?.exported_at)}</strong></div>
              <div>🔖 Versi app: <strong>{backupData.meta?.version || "?"}</strong></div>
              <div>👤 Diekspor oleh: <strong>{backupData.meta?.exported_by || "?"}</strong></div>
              <div>🔧 App settings: <strong>{Object.keys(backupData.app_settings || {}).length} key</strong></div>
              <div>🗃️ Tabel DB: <strong>{Object.entries(backupData.supabase_tables || {}).map(([t, v]) => `${t}(${Array.isArray(v) ? v.length : 0})`).join(", ")}</strong></div>
            </div>
          </div>

          {/* Pilih apa yang di-restore */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#374151" }}>Pilih data yang akan di-restore:</div>
            {[
              { key: "app_settings",  label: "App Settings (transaksi, resep, pengaturan, dll)", danger: false },
              { key: "patients",      label: "Tabel patients (data pasien)",                      danger: false },
              { key: "encounters",    label: "Tabel encounters (kunjungan / SOAP)",               danger: false },
              { key: "allergies_log", label: "Tabel allergies_log (riwayat alergi)",              danger: false },
              { key: "user_profiles", label: "Tabel user_profiles (akun staf) — BERBAHAYA",      danger: true  },
            ].map(({ key, label, danger }) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={restoreOpts[key]}
                  onChange={(e) => setRestoreOpts((prev) => ({ ...prev, [key]: e.target.checked }))}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13, color: danger ? "#b91c1c" : "#374151", fontWeight: danger ? 700 : 400 }}>
                  {danger && "⚠️ "}{label}
                </span>
              </label>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setStep("confirm")}
              style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              🔄 Lanjutkan Restore
            </button>
            <button
              onClick={reset}
              style={{ background: "#f3f4f6", color: "#374151", border: "1.5px solid #d1d5db", borderRadius: 8, padding: "10px 18px", fontSize: 14, cursor: "pointer" }}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* STEP: Confirm */}
      {step === "confirm" && (
        <div style={{ background: "#fff7ed", border: "2px solid #f97316", borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ fontSize: 32, marginBottom: 12, textAlign: "center" }}>⚠️</div>
          <div style={{ fontWeight: 800, fontSize: 16, textAlign: "center", color: "#c2410c", marginBottom: 12 }}>
            Konfirmasi Restore
          </div>
          <div style={{ fontSize: 13.5, color: "#7c2d12", textAlign: "center", lineHeight: 1.6, marginBottom: 20 }}>
            Data yang dipilih akan <strong>ditimpa permanen</strong> dengan isi file backup.<br />
            Ini <strong>tidak bisa dibatalkan</strong>. Apakah Anda yakin?
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={runRestore}
              style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
            >
              Ya, Lakukan Restore
            </button>
            <button
              onClick={() => setStep("preview")}
              style={{ background: "#f3f4f6", color: "#374151", border: "1.5px solid #d1d5db", borderRadius: 8, padding: "10px 18px", fontSize: 14, cursor: "pointer" }}
            >
              Kembali
            </button>
          </div>
        </div>
      )}

      {/* STEP: Running */}
      {step === "running" && (
        <div>
          <div style={{ fontWeight: 700, color: "#374151", marginBottom: 12 }}>⏳ Sedang mengembalikan data…</div>
          <div style={{
            background: "#1e1b4b", borderRadius: 8, padding: "14px 16px",
            fontFamily: "monospace", fontSize: 12, maxHeight: 320, overflowY: "auto",
          }}>
            {log.map((l, i) => (
              <div key={i} style={{
                color: l.type === "success" ? "#4ade80" : l.type === "error" ? "#f87171" : l.type === "warn" ? "#fbbf24" : "#c4b5fd",
                marginBottom: 3,
              }}>
                <span style={{ color: "#6b7280", marginRight: 8 }}>{l.ts.slice(11, 19)}</span>
                {l.msg}
              </div>
            ))}
            {log.length === 0 && <span style={{ color: "#c4b5fd" }}>Memulai…</span>}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: AUDIT TRAIL
// ─────────────────────────────────────────────────────────────────────────────
function AuditSection() {
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [filter, setFilter]     = useState({ table: "all", action: "all", search: "" });
  const [page, setPage]         = useState(0);
  const PAGE_SIZE = 50;

  async function loadAudit() {
    if (!supabase) { setError("Supabase belum dikonfigurasi"); return; }
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("audit_log")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(500); // maks 500 baris terakhir

      const { data, error: err } = await query;
      if (err) throw err;
      setLogs(data || []);
      setPage(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAudit(); }, []);

  // Filter client-side
  const filtered = logs.filter((l) => {
    if (filter.table !== "all" && l.table_name !== filter.table) return false;
    if (filter.action !== "all" && l.action !== filter.action) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const hay = JSON.stringify(l).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const uniqueTables = ["all", ...new Set(logs.map((l) => l.table_name))];

  const actionColor = { INSERT: "green", UPDATE: "blue", DELETE: "red" };

  function exportAudit() {
    downloadJSON({
      exported_at: new Date().toISOString(),
      filters: filter,
      total: filtered.length,
      logs: filtered,
    }, `audit-trail-${new Date().toISOString().slice(0,10)}.json`);
  }

  return (
    <SectionCard title="Audit Trail" icon="📋" accent="#4f46e5">
      <div style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {/* Filter tabel */}
        <select
          value={filter.table}
          onChange={(e) => { setFilter((f) => ({ ...f, table: e.target.value })); setPage(0); }}
          style={{ border: "1.5px solid #d1d5db", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
        >
          {uniqueTables.map((t) => <option key={t} value={t}>{t === "all" ? "Semua Tabel" : t}</option>)}
        </select>

        {/* Filter aksi */}
        <select
          value={filter.action}
          onChange={(e) => { setFilter((f) => ({ ...f, action: e.target.value })); setPage(0); }}
          style={{ border: "1.5px solid #d1d5db", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
        >
          <option value="all">Semua Aksi</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>

        {/* Search */}
        <input
          type="text"
          placeholder="Cari di log…"
          value={filter.search}
          onChange={(e) => { setFilter((f) => ({ ...f, search: e.target.value })); setPage(0); }}
          style={{ border: "1.5px solid #d1d5db", borderRadius: 6, padding: "6px 12px", fontSize: 13, flex: 1, minWidth: 160 }}
        />

        <button onClick={loadAudit} disabled={loading}
          style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {loading ? "⏳" : "🔄 Refresh"}
        </button>

        <button onClick={exportAudit}
          style={{ background: "#f3f4f6", border: "1.5px solid #d1d5db", borderRadius: 6, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>
          📥 Export
        </button>
      </div>

      {/* Summary */}
      <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 12 }}>
        Menampilkan <strong>{filtered.length}</strong> dari <strong>{logs.length}</strong> log
        {totalPages > 1 && ` — Halaman ${page + 1} / ${totalPages}`}
      </div>

      {error && (
        <div style={{ background: "#fee2e2", borderRadius: 8, padding: "10px 14px", color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
          ❌ {error}
          {error.toLowerCase().includes("rls") || error.toLowerCase().includes("denied") ? (
            <div style={{ marginTop: 6, fontSize: 12 }}>
              Pastikan RLS policy <code>admin read audit</code> sudah aktif di Supabase, dan akun ini terdaftar sebagai role <code>admin</code>.
            </div>
          ) : null}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>⏳ Memuat audit log…</div>
      )}

      {!loading && !error && paged.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
          Tidak ada log yang sesuai filter.
        </div>
      )}

      {!loading && paged.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                {["Waktu", "Tabel", "ID Baris", "Aksi", "Role", "Actor ID", "Perubahan"].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((l, i) => (
                <AuditRow key={l.id} log={l} i={i} actionColor={actionColor} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            style={{ border: "1.5px solid #d1d5db", borderRadius: 6, padding: "5px 12px", cursor: "pointer", background: "#fff" }}>← Prev</button>
          <span style={{ padding: "5px 12px", fontSize: 13, color: "#6b7280" }}>{page + 1} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            style={{ border: "1.5px solid #d1d5db", borderRadius: 6, padding: "5px 12px", cursor: "pointer", background: "#fff" }}>Next →</button>
        </div>
      )}
    </SectionCard>
  );
}

function AuditRow({ log, i, actionColor }) {
  const [expanded, setExpanded] = useState(false);
  const bg = i % 2 === 0 ? "#fff" : "#fafafa";

  const changes = [];
  if (log.action === "UPDATE" && log.old_data && log.new_data) {
    const allKeys = new Set([...Object.keys(log.old_data), ...Object.keys(log.new_data)]);
    allKeys.forEach((k) => {
      const oldVal = log.old_data[k];
      const newVal = log.new_data[k];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ key: k, old: oldVal, new: newVal });
      }
    });
  }

  return (
    <>
      <tr
        style={{ background: bg, borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
        onClick={() => setExpanded((e) => !e)}
        title="Klik untuk melihat detail"
      >
        <td style={{ padding: "7px 10px", whiteSpace: "nowrap", color: "#6b7280" }}>
          {formatDatetime(log.changed_at)}
        </td>
        <td style={{ padding: "7px 10px" }}>
          <Badge color="purple">{log.table_name}</Badge>
        </td>
        <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: 11, color: "#374151" }}>
          {String(log.row_id).slice(0, 12)}{String(log.row_id).length > 12 ? "…" : ""}
        </td>
        <td style={{ padding: "7px 10px" }}>
          <Badge color={actionColor[log.action] || "gray"}>{log.action}</Badge>
        </td>
        <td style={{ padding: "7px 10px", color: "#6b7280" }}>{log.actor_role || "-"}</td>
        <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: 10, color: "#9ca3af" }}>
          {log.actor_id ? String(log.actor_id).slice(0, 8) + "…" : "-"}
        </td>
        <td style={{ padding: "7px 10px", color: "#6b7280" }}>
          {log.action === "UPDATE"
            ? <span style={{ color: "#4f46e5" }}>🔍 {changes.length} field berubah {expanded ? "▲" : "▼"}</span>
            : log.action === "INSERT"
            ? <span style={{ color: "#059669" }}>➕ Data baru {expanded ? "▲" : "▼"}</span>
            : <span style={{ color: "#dc2626" }}>🗑️ Dihapus {expanded ? "▲" : "▼"}</span>
          }
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: "#f8f7ff" }}>
          <td colSpan={7} style={{ padding: "10px 14px" }}>
            {log.action === "UPDATE" && changes.length > 0 ? (
              <div>
                <div style={{ fontWeight: 700, fontSize: 12, color: "#4f46e5", marginBottom: 6 }}>Field yang berubah:</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {changes.map(({ key, old: o, new: n }) => (
                    <div key={key} style={{ background: "#fff", borderRadius: 6, padding: "6px 10px", border: "1px solid #e0e7ff", fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: "#374151" }}>{key}: </span>
                      <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "1px 6px", borderRadius: 4, marginRight: 6, fontFamily: "monospace" }}>
                        {JSON.stringify(o) ?? "null"}
                      </span>
                      →{" "}
                      <span style={{ background: "#dcfce7", color: "#15803d", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace" }}>
                        {JSON.stringify(n) ?? "null"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <pre style={{ margin: 0, fontSize: 11, overflowX: "auto", maxHeight: 200, color: "#374151" }}>
                {JSON.stringify(log.action === "INSERT" ? log.new_data : log.old_data, null, 2)}
              </pre>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
