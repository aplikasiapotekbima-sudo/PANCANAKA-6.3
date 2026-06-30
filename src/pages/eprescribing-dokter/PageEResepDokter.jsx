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

// ── Racikan shortcut presets (saved per-device in localStorage) ────
const RACIKAN_PRESETS_KEY = "kk_racikan_presets";
const defaultRacikanPresets = () => ([
  {
    id: "default-a",
    name: "Racikan A",
    text: "Racikan:\nParacetamol 500mg\nCTM 4mg\nDextromethorphan 15mg\nm.f. pulv. dtd No. X\n3 x sehari 1 bungkus",
  },
  {
    id: "default-b",
    name: "Racikan B",
    text: "Racikan:\nAmoxicillin 250mg\nGG 100mg\nm.f. pulv. dtd No. X\n3 x sehari 1 bungkus",
  },
]);
function loadRacikanPresets() {
  try {
    const raw = window.localStorage.getItem(RACIKAN_PRESETS_KEY);
    if (!raw) return defaultRacikanPresets();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return defaultRacikanPresets();
  } catch {
    return defaultRacikanPresets();
  }
}
function saveRacikanPresets(presets) {
  try {
    window.localStorage.setItem(RACIKAN_PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // localStorage tidak tersedia — abaikan
  }
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
function MedicineRowExt({ med, index, onUpdate, onRemove, onOpenRacikan }) {
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
            onChange={(e) => {
              const checked = e.target.checked;
              update("compounded", checked);
              if (checked) onOpenRacikan && onOpenRacikan(index);
            }}
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

// ── Racikan shortcut picker modal ───────────────────────────────────
function RacikanPickerModal({ presets, onInsert, onClose, onSavePresets }) {
  const [manageMode, setManageMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [draftText, setDraftText] = useState("");

  const startNew = () => {
    setEditingId("__new__");
    setDraftName("");
    setDraftText("");
  };
  const startEdit = (p) => {
    setEditingId(p.id);
    setDraftName(p.name);
    setDraftText(p.text);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraftName("");
    setDraftText("");
  };
  const saveDraft = () => {
    if (!draftName.trim() || !draftText.trim()) return;
    let next;
    if (editingId === "__new__") {
      next = [...presets, { id: `r-${Date.now()}`, name: draftName.trim(), text: draftText }];
    } else {
      next = presets.map((p) => (p.id === editingId ? { ...p, name: draftName.trim(), text: draftText } : p));
    }
    onSavePresets(next);
    cancelEdit();
  };
  const deletePreset = (id) => {
    if (window.confirm("Hapus shortcut racikan ini?")) {
      onSavePresets(presets.filter((p) => p.id !== id));
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#fff", borderRadius: "var(--r-lg, 16px)",
        border: "2px solid #ffc94a",
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        padding: "22px 24px", maxWidth: 460, width: "100%",
        maxHeight: "85vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>🧪</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#976d09" }}>Shortcut Racikan</span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>
          Pilih shortcut untuk langsung diisi ke resep, atau kelola daftar shortcut.
        </div>

        {!manageMode && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {presets.length === 0 && (
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontStyle: "italic" }}>
                  Belum ada shortcut racikan. Tambah lewat tombol "Kelola Shortcut" di bawah.
                </div>
              )}
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onInsert(p.text)}
                  style={{
                    textAlign: "left", border: "1.5px solid #ffc94a", background: "#fff9eb",
                    borderRadius: "var(--r-sm)", padding: "10px 14px", cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#ffeec6")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff9eb")}
                >
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "#976d09", marginBottom: 3 }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-secondary)", whiteSpace: "pre-line", lineHeight: 1.5 }}>
                    {p.text.length > 90 ? p.text.slice(0, 90) + "…" : p.text}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              <button className="kk-btn kk-btn-sm kk-btn-secondary" onClick={() => setManageMode(true)}>
                ⚙️ Kelola Shortcut
              </button>
              <button className="kk-btn kk-btn-sm kk-btn-ghost" onClick={onClose}>
                Lewati / Tutup
              </button>
            </div>
          </>
        )}

        {manageMode && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {presets.map((p) => (
                <div key={p.id} style={{ border: "1.5px solid var(--border-mid)", borderRadius: "var(--r-sm)", padding: "8px 12px" }}>
                  {editingId === p.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <input className="kk-input" value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Nama shortcut" style={{ fontSize: 13 }} />
                      <textarea className="kk-input" value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={4} placeholder="Isi racikan..." style={{ fontSize: 12.5, lineHeight: 1.6, resize: "vertical" }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="kk-btn kk-btn-sm" style={{ background: "#1a8f55", color: "#fff" }} onClick={saveDraft}>Simpan</button>
                        <button className="kk-btn kk-btn-sm kk-btn-ghost" onClick={cancelEdit}>Batal</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                      </div>
                      <button className="kk-btn kk-btn-sm kk-btn-ghost" onClick={() => startEdit(p)}>✏️</button>
                      <button className="kk-btn kk-btn-sm kk-btn-ghost" style={{ color: "var(--red-text)" }} onClick={() => deletePreset(p.id)}>🗑️</button>
                    </div>
                  )}
                </div>
              ))}

              {editingId === "__new__" ? (
                <div style={{ border: "1.5px solid #ffc94a", borderRadius: "var(--r-sm)", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <input className="kk-input" value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Nama shortcut (cth: Racikan Demam Anak)" style={{ fontSize: 13 }} />
                  <textarea className="kk-input" value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={4} placeholder="Isi racikan..." style={{ fontSize: 12.5, lineHeight: 1.6, resize: "vertical" }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="kk-btn kk-btn-sm" style={{ background: "#1a8f55", color: "#fff" }} onClick={saveDraft}>Simpan</button>
                    <button className="kk-btn kk-btn-sm kk-btn-ghost" onClick={cancelEdit}>Batal</button>
                  </div>
                </div>
              ) : (
                <button className="kk-btn kk-btn-sm kk-btn-secondary" onClick={startNew}>+ Tambah Shortcut Baru</button>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button className="kk-btn kk-btn-sm kk-btn-ghost" onClick={() => { setManageMode(false); cancelEdit(); }}>← Kembali ke daftar</button>
              <button className="kk-btn kk-btn-sm kk-btn-ghost" onClick={onClose}>Tutup</button>
            </div>
          </>
        )}
      </div>
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
  const [racikanPresets, setRacikanPresets] = useState(loadRacikanPresets);
  const [racikanPickerFor, setRacikanPickerFor] = useState(null); // index of medicine row, or null
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

      {/* Success popup — dark overlay + centered card */}
      {success && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => e.target === e.currentTarget && setSuccess(null)}
        >
          <div style={{
            background: "#fff", borderRadius: "var(--r-lg, 16px)",
            border: "2px solid var(--green-border)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
            padding: "28px 32px", maxWidth: 440, width: "100%",
            textAlign: "center",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "var(--green-bg)", border: "2px solid var(--green-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, margin: "0 auto 14px",
            }}>
              ✅
            </div>
            <div style={{ fontWeight: 800, color: "var(--green-text)", fontSize: 19, marginBottom: 8 }}>
              Resep tersimpan &amp; diteruskan ke Apoteker!
            </div>
            <div style={{ color: "#136840", fontSize: 14, marginBottom: 22 }}>
              {success.prescriptionNumber} · {success.patientName}<br />
              Status: <strong>Menunggu Dispensing</strong>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setHistoryPreview(success)}
                className="kk-btn"
                style={{ background: "#fff", border: "1.5px solid var(--green-border)", color: "var(--green-text)", fontWeight: 700, padding: "10px 20px" }}
              >
                🖨️ Cetak
              </button>
              <button
                onClick={() => setSuccess(null)}
                className="kk-btn"
                style={{ background: "#1a8f55", border: "1.5px solid var(--green-border)", color: "#fff", fontWeight: 700, padding: "10px 20px" }}
              >
                Tutup
              </button>
            </div>
          </div>
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

          </div>

          {/* Catatan untuk Apoteker — highlighted, enlarged, centered */}
          <div style={{ padding: "18px 18px", background: "#fff9eb", border: "2px solid #feb302", borderRadius: "var(--r-sm)", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>💬</span>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#976d09" }}>Catatan untuk Apoteker</span>
              <span style={{ fontSize: 12, color: "#bb8302", fontWeight: 400, marginLeft: 4 }}>(hanya dilihat apoteker)</span>
            </div>
            <textarea
              className="kk-input"
              value={form.notesForPharmacist}
              onChange={(e) => setField("notesForPharmacist", e.target.value)}
              placeholder={"cth:\n• Mohon edukasi cara penggunaan\n• Pasien alergi NSAID\n• Jika obat kosong boleh substitusi generik"}
              rows={5}
              style={{ resize: "vertical", minHeight: 120, fontSize: 15, lineHeight: 1.7, background: "#fff", borderColor: "#feb302", textAlign: "left" }}
            />
          </div>

          {/* Action buttons — Kirim ke Apoteker is the primary action */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <button
              className="kk-btn kk-btn-block"
              onClick={handleSave}
              style={{
                borderColor: "var(--green-border)",
                color: "#fff",
                background: "#1a8f55",
                fontSize: 18,
                fontWeight: 800,
                padding: "16px 20px",
                borderRadius: "var(--r-sm)",
                boxShadow: "0 2px 6px rgba(26,143,85,0.35)",
              }}
            >
              📤 Simpan &amp; Kirim ke Apoteker
            </button>
            <button className="kk-btn kk-btn-secondary kk-btn-block" onClick={handleSaveAndPrint} style={{ fontSize: 13 }}>
              💾 Simpan &amp; Cetak Resep
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
                <MedicineRowExt key={i} med={med} index={i} onUpdate={updateMed} onRemove={removeMed} onOpenRacikan={setRacikanPickerFor} />
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
      {racikanPickerFor !== null && (
        <RacikanPickerModal
          presets={racikanPresets}
          onInsert={(text) => {
            const i = racikanPickerFor;
            const med = form.medicines[i];
            const merged = med?.text?.trim() ? `${med.text}\n${text}` : text;
            updateMed(i, { ...med, text: merged });
            setRacikanPickerFor(null);
          }}
          onClose={() => setRacikanPickerFor(null)}
          onSavePresets={(next) => { setRacikanPresets(next); saveRacikanPresets(next); }}
        />
      )}
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
