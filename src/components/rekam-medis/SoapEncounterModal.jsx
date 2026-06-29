// src/components/rekam-medis/SoapEncounterModal.jsx
// Formulir kunjungan/rekam medis dalam format SOAP, meniru formulir
// kertas klinik (Ruang Tujuan / Tanggal / Waktu Mulai-Selesai, lalu
// S-O-A-P). Dipakai untuk menambah ATAU mengedit satu kunjungan,
// langsung dari menu Rekam Medis.

import { useState } from "react";
import { createEncounter, updateEncounter } from "../../lib/patientsApi";

function blankSoap() {
  return {
    roomDestination: "",
    visitDate: new Date().toISOString().slice(0, 10),
    timeStart: "",
    timeEnd: "",
    // S
    chiefComplaint: "",
    // O
    vsTd: "", vsRr: "", vsNadi: "", vsSuhu: "",
    pfBb: "", pfTb: "", pfLp: "",
    supportingExam: "",
    // A
    diagnosis: "", icd10Code: "", differentialDiagnosis: "", nursingDiagnosis: "",
    // P
    therapyPlan: "", nursingCare: "",
    // sign-off
    staffName: "",
  };
}

function soapFromEncounter(enc) {
  if (!enc) return blankSoap();
  return {
    roomDestination: enc.room_destination || "",
    visitDate: enc.visit_date ? new Date(enc.visit_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    timeStart: enc.time_start || "",
    timeEnd: enc.time_end || "",
    chiefComplaint: enc.anamnesis || "",
    vsTd: enc.vs_td || "", vsRr: enc.vs_rr || "", vsNadi: enc.vs_nadi || "", vsSuhu: enc.vs_suhu || "",
    pfBb: enc.pf_bb || "", pfTb: enc.pf_tb || "", pfLp: enc.pf_lp || "",
    supportingExam: enc.supporting_exam || "",
    diagnosis: enc.diagnosis || "", icd10Code: enc.icd10_code || "",
    differentialDiagnosis: enc.differential_diagnosis || "", nursingDiagnosis: enc.nursing_diagnosis || "",
    therapyPlan: enc.therapy_plan || "", nursingCare: enc.nursing_care || "",
    staffName: enc.staff_name || "",
  };
}

const sectionStyle = {
  border: "1.5px solid var(--border-mid)",
  borderRadius: "var(--r-md)",
  overflow: "hidden",
  marginBottom: 14,
};
const sectionHeaderStyle = (color, bg) => ({
  padding: "8px 14px",
  background: bg,
  borderBottom: "1.5px solid var(--border-mid)",
  fontWeight: 700,
  fontSize: 13,
  color,
});
const sectionBodyStyle = { padding: 14, display: "grid", gap: 10 };

function Field({ label, children, cols }) {
  return (
    <div style={{ gridColumn: cols ? `span ${cols}` : undefined }}>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function SoapEncounterModal({ patient, encounter, doctors, doctorId, onClose, onSaved }) {
  const [soap, setSoap] = useState(soapFromEncounter(encounter));
  const [chosenDoctorId, setChosenDoctorId] = useState(encounter?.doctor_id || doctorId || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const isEdit = !!encounter?.id;
  const set = (f, v) => setSoap((p) => ({ ...p, [f]: v }));

  // Dokter dari localStorage lama pakai id "1", "2", dst — bukan UUID.
  // Supabase menolak nilai non-UUID untuk kolom uuid. Kirim null jika
  // id yang dipilih bukan format UUID valid.
  const safeUuid = (v) => (v && UUID_RE.test(v) ? v : null);

  const handleSubmit = async () => {
    // Reset state sebelum simpan
    setSaving(true);
    setSaveError("");
    setJustSaved(false);

    const payload = { doctorId: safeUuid(chosenDoctorId), soap };
    let res;
    try {
      res = isEdit
        ? await updateEncounter(encounter.id, payload)
        : await createEncounter({ patientId: patient.id, ...payload });
    } catch (err) {
      setSaving(false);
      setSaveError("Terjadi kesalahan tak terduga: " + (err?.message || String(err)));
      return;
    }

    setSaving(false);

    if (res.error) {
      // Tampilkan pesan error spesifik dari Supabase jika tersedia
      const detail = res.error?.message || res.error?.details || JSON.stringify(res.error);
      setSaveError("Gagal menyimpan SOAP: " + detail + ". Periksa koneksi/Supabase lalu coba lagi.");
      return;
    }

    setJustSaved(true);
    setTimeout(() => onSaved?.(res.data), 1200);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div style={{
        background: "#fff", borderRadius: "var(--r-lg)", width: 760, maxHeight: "94vh",
        overflowY: "auto", boxShadow: "var(--shadow-lg)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header — sticky top */}
        <div style={{
          padding: "18px 24px", borderBottom: "1.5px solid var(--border-mid)",
          display: "flex", alignItems: "center",
          position: "sticky", top: 0, background: "#fff", zIndex: 10,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{isEdit ? "✏️ Ubah Kunjungan (SOAP)" : "🩺 Kunjungan Baru (SOAP)"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {patient.name} · RM: {patient.rm_number}
            </div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-muted)" }}>✕</button>
        </div>

        {/* Body — scrollable */}
        <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
          {/* Header kunjungan */}
          <div style={{ ...sectionStyle }}>
            <div style={sectionHeaderStyle("#363e52", "#f3f4f6")}>📅 Data Kunjungan</div>
            <div style={{ ...sectionBodyStyle, gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
              <Field label="Ruang Tujuan" cols={2}>
                <input className="kk-input" value={soap.roomDestination} onChange={(e) => set("roomDestination", e.target.value)} placeholder="cth: Poli Umum, IGD..." />
              </Field>
              <Field label="Tanggal" cols={2}>
                <input className="kk-input" type="date" value={soap.visitDate} onChange={(e) => set("visitDate", e.target.value)} />
              </Field>
              <Field label="Waktu Mulai" cols={2}>
                <input className="kk-input" type="time" value={soap.timeStart} onChange={(e) => set("timeStart", e.target.value)} />
              </Field>
              <Field label="Waktu Selesai" cols={2}>
                <input className="kk-input" type="time" value={soap.timeEnd} onChange={(e) => set("timeEnd", e.target.value)} />
              </Field>
              <Field label="Petugas / Dokter" cols={4}>
                <select className="kk-input" value={chosenDoctorId} onChange={(e) => setChosenDoctorId(e.target.value)}>
                  <option value="">-- Pilih Dokter --</option>
                  {(doctors || []).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>

              </Field>
            </div>
          </div>

          {/* S */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle("#1652df", "#eff4ff")}>S — Anamnesis (Subjective)</div>
            <div style={sectionBodyStyle}>
              <Field label="Keluhan Utama">
                <textarea className="kk-input" rows={3} style={{ resize: "vertical" }} value={soap.chiefComplaint} onChange={(e) => set("chiefComplaint", e.target.value)} placeholder="Keluhan yang disampaikan pasien..." />
              </Field>
            </div>
          </div>

          {/* O */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle("#9f730d", "#fffaed")}>O — Vital Sign & Pemeriksaan (Objective)</div>
            <div style={sectionBodyStyle}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textDecoration: "underline" }}>Vital Sign</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                <Field label="TD (mmHg)"><input className="kk-input" value={soap.vsTd} onChange={(e) => set("vsTd", e.target.value)} placeholder="120/80" /></Field>
                <Field label="RR (x/mnt)"><input className="kk-input" value={soap.vsRr} onChange={(e) => set("vsRr", e.target.value)} /></Field>
                <Field label="Nadi (x/mnt)"><input className="kk-input" value={soap.vsNadi} onChange={(e) => set("vsNadi", e.target.value)} /></Field>
                <Field label="Suhu (°C)"><input className="kk-input" value={soap.vsSuhu} onChange={(e) => set("vsSuhu", e.target.value)} /></Field>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textDecoration: "underline", marginTop: 4 }}>Pemeriksaan Fisik</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <Field label="BB (kg)"><input className="kk-input" value={soap.pfBb} onChange={(e) => set("pfBb", e.target.value)} /></Field>
                <Field label="TB (cm)"><input className="kk-input" value={soap.pfTb} onChange={(e) => set("pfTb", e.target.value)} /></Field>
                <Field label="LP (cm)"><input className="kk-input" value={soap.pfLp} onChange={(e) => set("pfLp", e.target.value)} /></Field>
              </div>
              <Field label="Pemeriksaan Penunjang / Rujukan Internal / Observasi">
                <textarea className="kk-input" rows={2} style={{ resize: "vertical" }} value={soap.supportingExam} onChange={(e) => set("supportingExam", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* A */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle("#136840", "#effef7")}>A — Diagnosis (Assessment)</div>
            <div style={sectionBodyStyle}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                <Field label="Diagnosis"><input className="kk-input" value={soap.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} placeholder="cth: ISPA, Hipertensi Gr. I..." /></Field>
                <Field label="Kode ICD 10"><input className="kk-input" value={soap.icd10Code} onChange={(e) => set("icd10Code", e.target.value)} placeholder="cth: J06.9" /></Field>
              </div>
              <Field label="DD (Diagnosis Banding)">
                <input className="kk-input" value={soap.differentialDiagnosis} onChange={(e) => set("differentialDiagnosis", e.target.value)} />
              </Field>
              <Field label="Diagnosis Keperawatan">
                <input className="kk-input" value={soap.nursingDiagnosis} onChange={(e) => set("nursingDiagnosis", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* P */}
          <div style={{ ...sectionStyle, marginBottom: 0 }}>
            <div style={sectionHeaderStyle("#976d09", "#fff9eb")}>P — Rencana Asuhan (Plan)</div>
            <div style={sectionBodyStyle}>
              <Field label="Terapi">
                <textarea className="kk-input" rows={3} style={{ resize: "vertical" }} value={soap.therapyPlan} onChange={(e) => set("therapyPlan", e.target.value)} placeholder="Rencana terapi. Untuk resep obat detail, gunakan menu E-Resep Dokter." />
              </Field>
              <Field label="KIE / Asuhan Keperawatan">
                <textarea className="kk-input" rows={3} style={{ resize: "vertical" }} value={soap.nursingCare} onChange={(e) => set("nursingCare", e.target.value)} />
              </Field>
              <Field label="TTD Petugas (nama)">
                <input className="kk-input" value={soap.staffName} onChange={(e) => set("staffName", e.target.value)} placeholder="Nama petugas yang mengisi" />
              </Field>
            </div>
          </div>
        </div>

        {/* Footer — sticky bottom, termasuk notifikasi error/sukses */}
        <div style={{
          borderTop: "1.5px solid var(--border-mid)",
          position: "sticky", bottom: 0, background: "#fff",
          zIndex: 10, flexShrink: 0,
        }}>
          {/* Notifikasi sukses */}
          {justSaved && (
            <div style={{
              margin: "12px 24px 0",
              padding: "10px 14px",
              background: "#effef7",
              border: "1.5px solid #82f3be",
              borderRadius: "var(--r-sm)",
              color: "#136840",
              fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              ✅ SOAP berhasil disimpan! Menutup formulir...
            </div>
          )}

          {/* Notifikasi error — selalu terlihat di atas tombol */}
          {saveError && (
            <div style={{
              margin: "12px 24px 0",
              padding: "10px 14px",
              background: "#fef2f2",
              border: "1.5px solid #ffa2a7",
              borderRadius: "var(--r-sm)",
              color: "#9e161d",
              fontSize: 13, fontWeight: 600,
              lineHeight: 1.5,
            }}>
              ⚠️ {saveError}
            </div>
          )}

          {/* Tombol aksi */}
          <div style={{ padding: "14px 24px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              className="kk-btn kk-btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Batal
            </button>
            <button
              className="kk-btn kk-btn-primary"
              onClick={handleSubmit}
              disabled={saving || justSaved}
              style={{ minWidth: 140 }}
            >
              {saving ? "⏳ Menyimpan..." : justSaved ? "✅ Tersimpan" : "💾 Simpan SOAP"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
