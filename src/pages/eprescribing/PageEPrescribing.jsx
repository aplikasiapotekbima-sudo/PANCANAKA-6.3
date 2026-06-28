import { useState } from "react";
import MedicineRow from "../../components/eprescribing/MedicineRow";
import PrescriptionPreview from "../../components/eprescribing/PrescriptionPreview";

function getPrescriptionNumber(counter) {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `RX/${y}${m}/${String(counter).padStart(4, "0")}`;
}

const emptyMed = () => ({ name: "", strength: "", signa: "", quantity: "", notes: "" });
const emptyForm = (doctorId = "") => ({
  patientName: "",
  patientAge: "",
  patientGender: "L",
  patientWeight: "",
  doctorId,
  date: new Date().toISOString().slice(0, 10),
  diagnosis: "",
  allergies: "",
  doctorNotes: "",
  medicines: [emptyMed()],
});

// ── helpers ──────────────────────────────────────────────────────
function fmtDateTime(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// ── small UI components ───────────────────────────────────────────
function FieldLabel({ children, required, hint }) {
  return (
    <label className="kk-field-label">
      {children}
      {required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
      {hint && <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>{hint}</span>}
    </label>
  );
}

function ErrorMsg({ msg }) {
  if (!msg) return null;
  return <div style={{ fontSize: 11.5, color: "#ef4444", marginTop: 3, fontWeight: 500 }}>{msg}</div>;
}

function SectionHeader({ icon, label, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: -0.1 }}>{label}</span>
      {count != null && (
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)", background: "var(--bg-hover)", borderRadius: 20, padding: "2px 8px" }}>
          {count} item
        </span>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
export default function PageEPrescribing({
  doctors,
  prescriptions,
  setPrescriptions,
  prescriptionCounter,
  setPrescriptionCounter,
  printSettings,
}) {
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});
  const [previewData, setPreviewData] = useState(null);
  const [success, setSuccess] = useState(null);
  const [historyPreview, setHistoryPreview] = useState(null);

  // History filters
  const [searchQ, setSearchQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeQuick, setActiveQuick] = useState("");

  const activeDoctors = doctors.filter((d) => d.active);
  const setField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }));

  const addMed = () => setForm((f) => ({ ...f, medicines: [...f.medicines, emptyMed()] }));
  const updateMed = (i, med) => setForm((f) => { const m = [...f.medicines]; m[i] = med; return { ...f, medicines: m }; });
  const removeMed = (i) => setForm((f) => ({ ...f, medicines: f.medicines.filter((_, idx) => idx !== i) }));

  // ── quick date filters ────────────────────────────────────────
  const applyQuick = (key) => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (key === "today") { setDateFrom(today); setDateTo(today); }
    else if (key === "7d") {
      const d = new Date(); d.setDate(d.getDate() - 6);
      setDateFrom(d.toISOString().slice(0, 10)); setDateTo(today);
    } else if (key === "30d") {
      const d = new Date(); d.setDate(d.getDate() - 29);
      setDateFrom(d.toISOString().slice(0, 10)); setDateTo(today);
    } else { setDateFrom(""); setDateTo(""); }
    setActiveQuick(key);
  };

  // ── filter history ────────────────────────────────────────────
  const filteredRx = prescriptions.filter((rx) => {
    if (searchQ) {
      const q = searchQ.toLowerCase();
      const match = rx.prescriptionNumber?.toLowerCase().includes(q) ||
        rx.patientName?.toLowerCase().includes(q) ||
        rx.selectedDoctor?.name?.toLowerCase().includes(q) ||
        rx.diagnosis?.toLowerCase().includes(q);
      if (!match) return false;
    }
    const rxDate = rx.createdAt?.slice(0, 10) || "";
    if (dateFrom && rxDate < dateFrom) return false;
    if (dateTo && rxDate > dateTo) return false;
    return true;
  });

  // ── validate ──────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.patientName.trim()) e.patientName = "Nama pasien wajib diisi";
    if (!form.doctorId) e.doctorId = "Pilih dokter";
    if (form.medicines.length === 0) e.medicines = "Tambah minimal 1 obat";
    else if (form.medicines.some((m) => !m.name.trim())) e.medicines = "Semua nama obat wajib diisi";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── save helpers ──────────────────────────────────────────────
  const buildRx = () => {
    const counter = prescriptionCounter + 1;
    setPrescriptionCounter(counter);
    const doctor = doctors.find((d) => d.id === form.doctorId);
    return {
      id: Date.now().toString(),
      prescriptionNumber: getPrescriptionNumber(counter),
      ...form,
      selectedDoctor: doctor || null,
      createdAt: new Date().toISOString(),
    };
  };

  const handlePreview = () => {
    if (!validate()) return;
    const doctor = doctors.find((d) => d.id === form.doctorId);
    setPreviewData({ ...form, selectedDoctor: doctor || null, prescriptionNumber: null });
  };

  const handleSave = () => {
    if (!validate()) return;
    const rx = buildRx();
    setPrescriptions((p) => [rx, ...p]);
    setSuccess(rx);
    setForm(emptyForm(form.doctorId));
  };

  const handleSaveAndPrint = () => {
    if (!validate()) return;
    const rx = buildRx();
    setPrescriptions((p) => [rx, ...p]);
    setSuccess(rx);
    setPreviewData(rx);
    setForm(emptyForm(form.doctorId));
  };

  // ── css helpers ───────────────────────────────────────────────
  const cardStyle = {
    background: "var(--bg-card)",
    border: "1.5px solid var(--border-mid)",
    borderRadius: "var(--r-lg)",
    padding: "18px 20px",
    boxShadow: "var(--shadow-sm)",
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 48 }}>

      {/* ── Page header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>💊 E-Resep</h2>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>
            Buat resep elektronik dan cetak langsung ke kertas 10.5×16.5 cm
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <span style={{ background: "var(--blue-bg)", border: "1.5px solid var(--blue-border)", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "var(--blue-text)", fontWeight: 600 }}>
            {prescriptions.length} Resep Tersimpan
          </span>
        </div>
      </div>

      {/* ── Success banner ──────────────────────────────────────── */}
      {success && (
        <div style={{ background: "var(--green-bg)", border: "1.5px solid var(--green-border)", borderRadius: "var(--r-md)", padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: "var(--green-text)", fontSize: 14 }}>Resep disimpan!</div>
            <div style={{ color: "#166534", fontSize: 12.5, marginTop: 1 }}>{success.prescriptionNumber} · {success.patientName}</div>
          </div>
          <button onClick={() => setHistoryPreview(success)} className="kk-btn kk-btn-sm" style={{ background: "#fff", border: "1.5px solid var(--green-border)", color: "var(--green-text)" }}>🖨️ Cetak</button>
          <button onClick={() => setSuccess(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--green-text)", fontSize: 18, padding: "0 4px" }}>✕</button>
        </div>
      )}

      {/* ── 2-column layout ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 20, alignItems: "start" }}>

        {/* ══ LEFT COLUMN: Patient + Prescription meta ══════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Pasien */}
          <div style={cardStyle}>
            <SectionHeader icon="👤" label="Data Pasien" />

            <div style={{ marginBottom: 12 }}>
              <FieldLabel required>Nama Pasien</FieldLabel>
              <input
                className={`kk-input${errors.patientName ? " error" : ""}`}
                value={form.patientName}
                onChange={(e) => setField("patientName", e.target.value)}
                placeholder="Nama lengkap pasien"
                style={{ fontSize: 15, fontWeight: 500 }}
              />
              <ErrorMsg msg={errors.patientName} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div>
                <FieldLabel>Umur (thn)</FieldLabel>
                <input className="kk-input" type="number" min="0" max="120" value={form.patientAge} onChange={(e) => setField("patientAge", e.target.value)} placeholder="—" style={{ textAlign: "center" }} />
              </div>
              <div>
                <FieldLabel>BB (kg)</FieldLabel>
                <input className="kk-input" type="number" min="0" value={form.patientWeight} onChange={(e) => setField("patientWeight", e.target.value)} placeholder="—" style={{ textAlign: "center" }} />
              </div>
              <div>
                <FieldLabel>J. Kelamin</FieldLabel>
                <select className="kk-input" value={form.patientGender} onChange={(e) => setField("patientGender", e.target.value)}>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
            </div>

            {/* Allergies — compact, secondary */}
            <div style={{ padding: "10px 12px", background: "var(--red-bg)", border: "1.5px solid var(--red-border)", borderRadius: "var(--r-sm)" }}>
              <FieldLabel>⚠️ Alergi <span style={{ fontWeight: 400, color: "var(--red-text)", fontSize: 11 }}>(opsional)</span></FieldLabel>
              <input
                className="kk-input"
                value={form.allergies}
                onChange={(e) => setField("allergies", e.target.value)}
                placeholder="cth: Penisilin, Sulfa, Aspirin..."
                style={{ background: "#fff", borderColor: form.allergies ? "#ef4444" : "var(--border-strong)", color: form.allergies ? "#b91c1c" : undefined, fontWeight: form.allergies ? 600 : 400, fontSize: 13 }}
              />
            </div>
          </div>

          {/* Resep meta */}
          <div style={cardStyle}>
            <SectionHeader icon="📋" label="Data Resep" />

            <div style={{ marginBottom: 12 }}>
              <FieldLabel required>Dokter</FieldLabel>
              {activeDoctors.length === 0 ? (
                <div style={{ padding: "10px 12px", background: "var(--amber-bg)", border: "1.5px solid var(--amber-border)", borderRadius: "var(--r-sm)", fontSize: 13, color: "var(--amber-text)" }}>
                  ⚠️ Tidak ada dokter aktif. Tambah di menu Dokter.
                </div>
              ) : (
                <select
                  className={`kk-input${errors.doctorId ? " error" : ""}`}
                  value={form.doctorId}
                  onChange={(e) => setField("doctorId", e.target.value)}
                >
                  <option value="">-- Pilih Dokter --</option>
                  {activeDoctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}
              <ErrorMsg msg={errors.doctorId} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <FieldLabel>Tanggal Resep</FieldLabel>
              <input className="kk-input" type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <FieldLabel>Diagnosis / Anamnesis</FieldLabel>
              <input className="kk-input" value={form.diagnosis} onChange={(e) => setField("diagnosis", e.target.value)} placeholder="cth: ISPA, Hipertensi Gr. I, Gastritis..." />
            </div>

            <div>
              <FieldLabel hint="(opsional)">Catatan Dokter</FieldLabel>
              <textarea
                className="kk-input"
                value={form.doctorNotes}
                onChange={(e) => setField("doctorNotes", e.target.value)}
                placeholder="Instruksi tambahan kepada pasien / apoteker..."
                rows={2}
                style={{ resize: "vertical", minHeight: 60 }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="kk-btn kk-btn-primary kk-btn-lg kk-btn-block" onClick={handleSaveAndPrint}>
              💾 Simpan &amp; Cetak Resep
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button className="kk-btn kk-btn-secondary kk-btn-block" onClick={handlePreview} style={{ borderColor: "var(--brand)", color: "var(--brand)" }}>
                👁️ Preview
              </button>
              <button className="kk-btn kk-btn-secondary kk-btn-block" onClick={handleSave}>
                💾 Simpan Saja
              </button>
            </div>
            <button className="kk-btn kk-btn-ghost kk-btn-block" onClick={() => { setForm(emptyForm()); setErrors({}); setSuccess(null); }} style={{ fontSize: 12.5 }}>
              🔄 Bersihkan Form
            </button>
          </div>
        </div>

        {/* ══ RIGHT COLUMN: Medicines (DOMINANT) ════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...cardStyle, flex: 1 }}>
            <SectionHeader icon="💊" label="Daftar Obat" count={form.medicines.length} />

            {errors.medicines && (
              <div style={{ background: "var(--red-bg)", border: "1.5px solid var(--red-border)", borderRadius: "var(--r-sm)", padding: "8px 12px", marginBottom: 12, color: "var(--red-text)", fontSize: 13, fontWeight: 500 }}>
                ⚠️ {errors.medicines}
              </div>
            )}

            {/* Medicine list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {form.medicines.map((med, i) => (
                <MedicineRow key={i} med={med} index={i} onUpdate={updateMed} onRemove={removeMed} />
              ))}
            </div>

            {/* Add button — prominent */}
            <button
              onClick={addMed}
              style={{
                marginTop: 14, width: "100%", padding: "11px 0",
                borderRadius: "var(--r-sm)",
                border: "2px dashed var(--brand-mid)",
                background: "var(--blue-bg)",
                color: "var(--brand)",
                cursor: "pointer", fontSize: 14, fontWeight: 600,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--brand-light)"; e.currentTarget.style.borderColor = "var(--brand)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--blue-bg)"; e.currentTarget.style.borderColor = "var(--brand-mid)"; }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Tambah Obat
            </button>
          </div>

          {/* ── Riwayat Resep ────────────────────────────────── */}
          <div style={cardStyle}>
            <SectionHeader icon="📋" label="Riwayat Resep" count={filteredRx.length} />

            {/* Search */}
            <div style={{ marginBottom: 10 }}>
              <input
                className="kk-input"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="🔍 No. resep, nama pasien, diagnosis..."
                style={{ fontSize: 13 }}
              />
            </div>

            {/* Quick date buttons */}
            <div className="kk-date-quick" style={{ marginBottom: 10 }}>
              {[
                { key: "today", label: "Hari Ini" },
                { key: "7d",    label: "7 Hari" },
                { key: "30d",   label: "30 Hari" },
                { key: "",      label: "Semua" },
              ].map((q) => (
                <button
                  key={q.key}
                  className={activeQuick === q.key ? "active" : ""}
                  onClick={() => applyQuick(q.key)}
                >
                  {q.label}
                </button>
              ))}
            </div>

            {/* Date range */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div>
                <label className="kk-field-label">Dari Tanggal</label>
                <input className="kk-input" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setActiveQuick("custom"); }} style={{ fontSize: 12.5 }} />
              </div>
              <div>
                <label className="kk-field-label">Sampai Tanggal</label>
                <input className="kk-input" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setActiveQuick("custom"); }} style={{ fontSize: 12.5 }} />
              </div>
            </div>

            {/* Prescription list */}
            {filteredRx.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-muted)", fontSize: 13 }}>
                {prescriptions.length === 0 ? "Belum ada resep tersimpan." : "Tidak ada resep di rentang ini."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 360, overflowY: "auto" }}>
                {filteredRx.map((rx) => (
                  <div
                    key={rx.id}
                    style={{
                      background: "var(--bg-input)",
                      border: "1.5px solid var(--border-mid)",
                      borderRadius: "var(--r-md)",
                      padding: "10px 14px",
                      display: "flex", alignItems: "center", gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "var(--brand)" }}>{rx.prescriptionNumber}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{rx.patientName}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                        {rx.selectedDoctor?.name || "-"} · {rx.medicines?.length || 0} obat
                        {rx.diagnosis ? ` · ${rx.diagnosis}` : ""}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{fmtDateTime(rx.createdAt)}</div>
                    </div>
                    <button
                      onClick={() => setHistoryPreview(rx)}
                      className="kk-btn kk-btn-sm kk-btn-secondary"
                    >
                      🖨️ Cetak
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {previewData && (
        <PrescriptionPreview prescription={previewData} printSettings={printSettings} onClose={() => setPreviewData(null)} />
      )}
      {historyPreview && (
        <PrescriptionPreview prescription={historyPreview} printSettings={printSettings} onClose={() => setHistoryPreview(null)} />
      )}
    </div>
  );
}
