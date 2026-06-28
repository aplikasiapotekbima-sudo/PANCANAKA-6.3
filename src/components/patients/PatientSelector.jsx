// src/components/patients/PatientSelector.jsx
// Komponen pencarian/pilih pasien dari master data (tabel `patients`).
// Begitu pasien terpilih, alergi aktifnya otomatis tampil — dokter/apoteker
// tidak perlu mengetik ulang alergi setiap kali membuat resep baru.
//
// CATATAN PENTING: pendaftaran pasien BARU sengaja TIDAK lagi dilakukan
// di sini. Pasien baru harus didaftarkan lewat menu Rekam Medis, supaya
// Rekam Medis jadi satu-satunya sumber data pasien (single source of
// truth) — bukan didaftarkan diam-diam dari form E-Resep / Kasir.

import { useState, useEffect, useRef } from "react";
import { searchPatients, getAllergies } from "../../lib/patientsApi";

export default function PatientSelector({ value, onChange, autoFocus, onNavigateToRekamMedis }) {
  const [query, setQuery] = useState(value?.name || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allergies, setAllergies] = useState([]);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  // Sinkronkan query text kalau parent mengganti value dari luar (misal reset form)
  useEffect(() => {
    setQuery(value?.name || "");
  }, [value?.id]);

  // Ambil alergi aktif setiap kali pasien terpilih berubah
  useEffect(() => {
    if (value?.id) {
      getAllergies(value.id).then(({ data }) => setAllergies(data));
    } else {
      setAllergies([]);
    }
  }, [value?.id]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const { data } = await searchPatients(query);
      setResults(data);
      setLoading(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, open]);

  // Tutup dropdown saat klik di luar komponen
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (p) => {
    onChange(p);
    setQuery(p.name);
    setOpen(false);
  };

  const severityStyle = {
    ringan: { c: "#92400e", bg: "#fffbeb", b: "#fcd34d" },
    sedang: { c: "#9a3412", bg: "#fff7ed", b: "#fdba74" },
    berat: { c: "#991b1b", bg: "#fef2f2", b: "#fca5a5" },
    "tidak diketahui": { c: "#374151", bg: "#f3f4f6", b: "#d1d5db" },
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        className="kk-input"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); if (value) onChange(null); }}
        onFocus={() => setOpen(true)}
        placeholder="🔍 Cari nama pasien / No. RM / NIK..."
        style={{ fontSize: 14, fontWeight: 500 }}
      />

      {value?.id && (
        <div style={{ marginTop: 5, fontSize: 11.5, color: "var(--text-muted)", display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span>RM: <strong>{value.rm_number}</strong></span>
          {value.birth_date && <span>Lahir: {value.birth_date}</span>}
          {value.gender && <span>{value.gender === "L" ? "Laki-laki" : "Perempuan"}</span>}
        </div>
      )}

      {allergies.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {allergies.map((a) => {
            const s = severityStyle[a.severity] || severityStyle["tidak diketahui"];
            return (
              <span key={a.id} style={{ background: s.bg, border: `1.5px solid ${s.b}`, color: s.c, borderRadius: 20, padding: "3px 10px", fontSize: 11.5, fontWeight: 700 }}>
                ⚠️ Alergi {a.allergen}
              </span>
            );
          })}
        </div>
      )}

      {open && (
        <div style={{
          position: "absolute", zIndex: 50, top: "100%", left: 0, right: 0, marginTop: 4,
          background: "#fff", border: "1.5px solid var(--border-mid)", borderRadius: "var(--r-md)",
          boxShadow: "var(--shadow-md)", maxHeight: 320, overflowY: "auto",
        }}>
          {loading && <div style={{ padding: 14, fontSize: 12.5, color: "var(--text-muted)" }}>Mencari...</div>}

          {!loading && results.map((p) => (
            <div
              key={p.id}
              onClick={() => pick(p)}
              style={{ padding: "9px 14px", cursor: "pointer", borderBottom: "1px solid var(--border-mid)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                RM: {p.rm_number}{p.nik ? ` · NIK: ${p.nik}` : ""}{p.birth_date ? ` · Lahir: ${p.birth_date}` : ""}
              </div>
            </div>
          ))}

          {!loading && results.length === 0 && (
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: onNavigateToRekamMedis ? 10 : 0 }}>
                Pasien "{query}" tidak ditemukan. Pasien baru harus didaftarkan lewat menu <strong>📁 Rekam Medis</strong> terlebih dahulu.
              </div>
              {onNavigateToRekamMedis && (
                <button
                  type="button"
                  className="kk-btn kk-btn-sm kk-btn-primary"
                  onClick={() => { setOpen(false); onNavigateToRekamMedis(query); }}
                >
                  📁 Buka Rekam Medis untuk Daftarkan Pasien
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
