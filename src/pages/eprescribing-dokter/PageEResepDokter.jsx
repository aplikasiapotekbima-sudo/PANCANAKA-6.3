import { useState, useEffect } from "react";
import MedicineRow from "../../components/eprescribing/MedicineRow";
import PrescriptionPreview from "../../components/eprescribing/PrescriptionPreview";
import PatientSelector from "../../components/patients/PatientSelector";
import { createEncounter, insertPrescriptionRecord, softDeletePrescription } from "../../lib/patientsApi";

// ── helpers ──────────────────────────────────────────────────────
function getPrescriptionNumber(counter) {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `RX/${y}${m}/${String(counter).padStart(4, "0")}`;
}

const emptyMed = () => ({
  text: "",          // freestyle teks bebas dokter
  compounded: false, // flag racikan
});

const emptyForm = (doctorId = "") => ({
  patientName: "", patientAge: "", patientGender: "L",
  patientWeight: "", patientRM: "", doctorId,
  date: new Date().toISOString().slice(0, 10),
  diagnosis: "", allergies: "",
  notesForPharmacist: "",
  medicines: [emptyMed()],
});

function FieldLabel({ children, required, hint }) {
  return (
    <label className="kk-field-label">
      {children}
      {required && <span style={{ color: "#f63d46", marginLeft: 2 }}>*</span>}
      {hint && <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>{hint}</span>}
    </label>
  );
}
function ErrorMsg({ msg }) {
  if (!msg) return null;
  return <div style={{ fontSize: 11.5, color: "#f63d46", marginTop: 3, fontWeight: 500 }}>{msg}</div>;
}
function SectionHeader({ icon, label, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{label}</span>
      {count != null && (
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)", background: "var(--bg-hover)", borderRadius: 20, padding: "2px 8px" }}>
          {count} item
        </span>
      )}
    </div>
  );
}

// ── Medicine Row with compounded + unit ──────────────────────────
function MedicineRowExt({ med, index, onUpdate, onRemove }) {
  const update = (field, val) => onUpdate(index, { ...med, [field]: val });

  return (
    <div style={{
      border: "1.5px solid var(--border-mid)",
      borderRadius: "var(--r-md)",
      overflow: "hidden",
      background: "#fff",
    }}>
      {/* Header: nomor + racikan + hapus */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px",
        background: "var(--bg-input)",
        borderBottom: med.text
          ? "1.5px solid var(--border-mid)"
          : "1.5px solid transparent",
      }}>
        {/* Nomor urut */}
        <div style={{
          width: 24, height: 24, borderRadius: "50%",
          background: "var(--brand)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>
          {index + 1}
        </div>

        {/* Tanda R/ — selalu tampil, racikan maupun non-racikan */}
        <span style={{
          fontStyle: "italic", fontWeight: 700, fontSize: 14,
          color: "var(--text-primary)", flexShrink: 0,
        }}>
          R/
        </span>

        {/* Checkbox racikan */}
        <label style={{
          display: "flex", alignItems: "center", gap: 5,
          fontSize: 12.5, cursor: "pointer",
          color: med.compounded ? "#976d09" : "var(--text-secondary)",
          fontWeight: med.compounded ? 600 : 400,
          userSelect: "none",
          background: med.compounded ? "#ffeec6" : "transparent",
          border: med.compounded ? "1px solid #ffc94a" : "1px solid transparent",
          borderRadius: 20, padding: "2px 10px 2px 6px",
          transition: "all 0.15s",
        }}>
          <input
            type="checkbox"
            checked={med.compounded || false}
            onChange={(e) => update("compounded", e.target.checked)}
            style={{ accentColor: "#feb302", width: 13, height: 13 }}
          />
          🧪 Racikan
        </label>

        {/* Hapus */}
        <button
          onClick={() => onRemove(index)}
          style={{
            marginLeft: "auto",
            background: "none", border: "1.5px solid var(--red-border)",
            borderRadius: 6, padding: "2px 10px",
            cursor: "pointer", fontSize: 12,
            color: "var(--red-text)", fontWeight: 500,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--red-bg)"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}
        >
          ✕ Hapus
        </button>
      </div>

      {/* Textarea freestyle */}
      <textarea
        value={med.text || ""}
        onChange={(e) => update("text", e.target.value)}
        placeholder={"Tulis resep bebas di sini...\ncth:\nAmoxicillin 500mg\n3 x sehari 1 kaps, habiskan\n\u2211 15 kaps"}
        rows={5}
        style={{
          display: "block",
          width: "100%",
          padding: "12px 14px",
          border: "none",
          outline: "none",
          resize: "vertical",
          fontSize: 14,
          lineHeight: 1.7,
          fontFamily: "var(--font)",
          color: "var(--text-primary)",
          background: "#fff",
          minHeight: 110,
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
export default function PageEResepDokter({
  doctors,
  prescriptions,
  setPrescriptions,
  prescriptionCounter,
  setPrescriptionCounter,
  printSettings,
  currentRole,
  initialPatient,
  onPatientConsumed,
  currentUser,
  onNavigateToRekamMedis,
}) {
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});
  const [previewData, setPreviewData] = useState(null);
  const [success, setSuccess] = useState(null);
  const [historyPreview, setHistoryPreview] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(initialPatient || null);

  useEffect(() => {
    if (initialPatient) {
      setSelectedPatient(initialPatient);
      setField("patientName", initialPatient.name || "");
      setField("patientRM", initialPatient.rm_number || "");
      if (initialPatient.gender) setField("patientGender", initialPatient.gender);
      onPatientConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPatient]);

  const activeDoctors = doctors.filter((d) => d.active);
  const setField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }));

  const addMed = () => setForm((f) => ({ ...f, medicines: [...f.medicines, emptyMed()] }));
  const updateMed = (i, med) => setForm((f) => { const m = [...f.medicines]; m[i] = med; return { ...f, medicines: m }; });
  const removeMed = (i) => setForm((f) => ({ ...f, medicines: f.medicines.filter((_, idx) => idx !== i) }));

  // Riwayat milik dokter terpilih saja (jika sudah pilih dokter)
  const myRx = prescriptions.filter((rx) => {
    if (!form.doctorId) return true;
    const q = searchQ.toLowerCase();
    if (q && !rx.patientName?.toLowerCase().includes(q) && !rx.prescriptionNumber?.toLowerCase().includes(q)) return false;
    return true;
  }).slice(0, 20);

  const validate = () => {
    const e = {};
    if (!form.patientName.trim()) e.patientName = "Nama pasien wajib diisi";
    if (!selectedPatient) e.patientName = "Pilih pasien dari Rekam Medis (atau daftarkan baru) sebelum menyimpan resep";
    if (!form.doctorId) e.doctorId = "Pilih dokter";
    if (form.medicines.length === 0) e.medicines = "Tambah minimal 1 obat";
    else if (form.medicines.some((m) => !m.text?.trim())) e.medicines = "Semua item resep wajib diisi";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildRx = () => {
    const counter = prescriptionCounter + 1;
    setPrescriptionCounter(counter);
    const doctor = doctors.find((d) => d.id === form.doctorId);
    return {
      id: Date.now().toString(),
      prescriptionNumber: getPrescriptionNumber(counter),
      ...form,
      patientId: selectedPatient?.id || null,
      selectedDoctor: doctor || null,
      status: "MENUNGGU_DISPENSING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  // Tulis resep ke tabel relasional (patients/encounters/prescriptions) supaya
  // muncul di Rekam Medis & tercatat di audit_log — tetap disimpan ke state
  // lokal juga (di handleSave/handleSaveAndPrint) untuk preview cetak.
  const persistToRekamMedis = async (rx) => {
    if (!selectedPatient) return;
    // Resep dibuat dari sini hanya menautkan diagnosis singkat ke kunjungan;
    // pengisian SOAP lengkap (S/O/A/P) dilakukan di menu Rekam Medis.
    const { data: encounter } = await createEncounter({
      patientId: selectedPatient.id,
      doctorId: currentUser?.id,
      soap: { diagnosis: rx.diagnosis },
    });
    await insertPrescriptionRecord({ ...rx, encounterId: encounter?.id, createdBy: currentUser?.id });
  };

  const handleSave = () => {
    if (!validate()) return;
    const rx = buildRx();
    setPrescriptions((p) => [rx, ...p]);
    persistToRekamMedis(rx);
    setSuccess(rx);
    setForm(emptyForm(form.doctorId));
    setSelectedPatient(null);
  };

  const handleSaveAndPrint = () => {
    if (!validate()) return;
    const rx = buildRx();
    setPrescriptions((p) => [rx, ...p]);
    persistToRekamMedis(rx);
    setSuccess(rx);
    setPreviewData(rx);
    setForm(emptyForm(form.doctorId));
    setSelectedPatient(null);
  };

  const cardStyle = {
    background: "var(--bg-card)",
    border: "1.5px solid var(--border-mid)",
    borderRadius: "var(--r-lg)",
    padding: "18px 20px",
    boxShadow: "var(--shadow-sm)",
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 48 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>🩺 E-Resep Dokter</h2>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>
            Buat resep elektronik — langsung masuk ke dashboard apoteker
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <span style={{ background: "var(--blue-bg)", border: "1.5px solid var(--blue-border)", borderRadius: 20, padding: "4px 14px", fontSize: 12, color: "var(--blue-text)", fontWeight: 600 }}>
            {prescriptions.length} Resep Total
          </span>
        </div>
      </div>

      {/* Success banner */}
      {success && (
        <div style={{ background: "var(--green-bg)", border: "1.5px solid var(--green-border)", borderRadius: "var(--r-md)", padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: "var(--green-text)", fontSize: 14 }}>Resep tersimpan & diteruskan ke Apoteker!</div>
            <div style={{ color: "#136840", fontSize: 12.5, marginTop: 1 }}>{success.prescriptionNumber} · {success.patientName} · Status: <strong>Menunggu Dispensing</strong></div>
          </div>
          <button onClick={() => setHistoryPreview(success)} className="kk-btn kk-btn-sm" style={{ background: "#fff", border: "1.5px solid var(--green-border)", color: "var(--green-text)" }}>🖨️ Cetak</button>
          <button onClick={() => setSuccess(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--green-text)", fontSize: 18, padding: "0 4px" }}>✕</button>
        </div>
      )}

      {/* 2-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 20, alignItems: "start" }}>

        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Data Pasien */}
          <div style={cardStyle}>
            <SectionHeader icon="👤" label="Data Pasien" />

            <div style={{ marginBottom: 12 }}>
              <FieldLabel required>Pasien</FieldLabel>
              <PatientSelector
                value={selectedPatient}
                onChange={(p) => {
                  setSelectedPatient(p);
                  setField("patientName", p?.name || "");
                  setField("patientRM", p?.rm_number || "");
                  if (p?.gender) setField("patientGender", p.gender);
                }}
                onNavigateToRekamMedis={onNavigateToRekamMedis}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Pasien baru? Daftarkan dulu lewat menu 📁 Rekam Medis.
              </div>
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

            <div style={{ padding: "10px 12px", background: "var(--red-bg)", border: "1.5px solid var(--red-border)", borderRadius: "var(--r-sm)" }}>
              <FieldLabel>⚠️ Alergi <span style={{ fontWeight: 400, color: "var(--red-text)", fontSize: 11 }}>(opsional)</span></FieldLabel>
              <input
                className="kk-input"
                value={form.allergies}
                onChange={(e) => setField("allergies", e.target.value)}
                placeholder="cth: Penisilin, NSAID, Sulfa..."
                style={{ background: "#fff", borderColor: form.allergies ? "#f63d46" : "var(--border-strong)", color: form.allergies ? "#bf161e" : undefined, fontWeight: form.allergies ? 600 : 400, fontSize: 13 }}
              />
            </div>
          </div>

          {/* Data Resep */}
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

            {/* Catatan untuk Apoteker — highlighted */}
            <div style={{ padding: "12px 14px", background: "#fff9eb", border: "2px solid #feb302", borderRadius: "var(--r-sm)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>💬</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#976d09" }}>Catatan untuk Apoteker</span>
                <span style={{ fontSize: 11, color: "#bb8302", fontWeight: 400, marginLeft: 4 }}>(hanya dilihat apoteker)</span>
              </div>
              <textarea
                className="kk-input"
                value={form.notesForPharmacist}
                onChange={(e) => setField("notesForPharmacist", e.target.value)}
                placeholder={"cth:\n• Mohon edukasi cara penggunaan\n• Pasien alergi NSAID\n• Jika obat kosong boleh substitusi generik"}
                rows={4}
                style={{ resize: "vertical", minHeight: 80, fontSize: 13, lineHeight: 1.6, background: "#fff", borderColor: "#feb302" }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="kk-btn kk-btn-primary kk-btn-lg kk-btn-block" onClick={handleSaveAndPrint}>
              💾 Simpan &amp; Cetak Resep
            </button>
            <button className="kk-btn kk-btn-secondary kk-btn-block" onClick={handleSave} style={{ borderColor: "var(--green-border)", color: "#136840", background: "var(--green-bg)" }}>
              📤 Simpan &amp; Kirim ke Apoteker
            </button>
            <button className="kk-btn kk-btn-ghost kk-btn-block" onClick={() => { setForm(emptyForm()); setErrors({}); setSuccess(null); }} style={{ fontSize: 12.5 }}>
              🔄 Bersihkan Form
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...cardStyle, flex: 1 }}>
            <SectionHeader icon="💊" label="Daftar Obat" count={form.medicines.length} />

            {errors.medicines && (
              <div style={{ background: "var(--red-bg)", border: "1.5px solid var(--red-border)", borderRadius: "var(--r-sm)", padding: "8px 12px", marginBottom: 12, color: "var(--red-text)", fontSize: 13, fontWeight: 500 }}>
                ⚠️ {errors.medicines}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {form.medicines.map((med, i) => (
                <MedicineRowExt key={i} med={med} index={i} onUpdate={updateMed} onRemove={removeMed} />
              ))}
            </div>

            <button
              onClick={addMed}
              style={{
                marginTop: 14, width: "100%", padding: "11px 0",
                borderRadius: "var(--r-sm)", border: "2px dashed var(--brand-mid)",
                background: "var(--blue-bg)", color: "var(--brand)",
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

          {/* Riwayat singkat */}
          <div style={cardStyle}>
            <SectionHeader icon="📋" label="Resep Terbaru" />
            <div style={{ marginBottom: 10 }}>
              <input
                className="kk-input"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="🔍 Cari nama pasien / no. resep..."
                style={{ fontSize: 13 }}
              />
            </div>
            {myRx.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>Belum ada resep.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                {myRx.map((rx) => (
                  <div key={rx.id} style={{ background: "var(--bg-input)", border: "1.5px solid var(--border-mid)", borderRadius: "var(--r-md)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 12.5, color: "var(--brand)" }}>{rx.prescriptionNumber}</span>
                        <RxStatusBadge status={rx.status} small />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginTop: 2 }}>{rx.patientName}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 1 }}>
                        {rx.selectedDoctor?.name || "-"} · {rx.medicines?.length || 0} obat
                      </div>
                    </div>
                    <button onClick={() => setHistoryPreview(rx)} className="kk-btn kk-btn-sm kk-btn-secondary">🖨️</button>
                    <button
                      onClick={async () => {
                        if (window.confirm(`Hapus resep ${rx.prescriptionNumber} (${rx.patientName})? Resep akan disembunyikan dari daftar ini, tapi tetap tersimpan untuk audit & rekam medis.`)) {
                          await softDeletePrescription(rx.id);
                          setPrescriptions((prev) => prev.filter((p) => p.id !== rx.id));
                        }
                      }}
                      className="kk-btn kk-btn-sm kk-btn-secondary"
                      title="Hapus resep ini"
                      style={{ color: "var(--red-text)" }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {previewData && <PrescriptionPreview prescription={previewData} printSettings={printSettings} onClose={() => setPreviewData(null)} />}
      {historyPreview && <PrescriptionPreview prescription={historyPreview} printSettings={printSettings} onClose={() => setHistoryPreview(null)} />}
    </div>
  );
}

// Status badge helper (shared)
export function RxStatusBadge({ status, small }) {
  const map = {
    MENUNGGU_DISPENSING: { label: "Menunggu Dispensing", color: "#976d09", bg: "#ffeec6", border: "#ffc94a" },
    SEDANG_DISIAPKAN:    { label: "Sedang Disiapkan",    color: "#1652df", bg: "#eff4ff", border: "#91b2ff" },
    SIAP_DIAMBIL:        { label: "Siap Diambil",        color: "#026336", bg: "#ebfef5", border: "#69ecaf" },
    SUDAH_DISERAHKAN:    { label: "Sudah Diserahkan",    color: "#363e52", bg: "#f3f4f6", border: "#d1d4db" },
  };
  const s = map[status] || map["MENUNGGU_DISPENSING"];
  return (
    <span style={{
      fontSize: small ? 10.5 : 12, fontWeight: 600,
      color: s.color, background: s.bg, border: `1.5px solid ${s.border}`,
      borderRadius: 20, padding: small ? "1px 7px" : "2px 10px",
      whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
}
