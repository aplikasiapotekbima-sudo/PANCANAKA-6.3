// src/components/rekam-medis/NewPatientModal.jsx
// Form registrasi pasien baru — SATU-SATUNYA tempat pasien baru
// didaftarkan (lihat catatan di PatientSelector.jsx). Field-nya mengikuti
// header formulir rekam medis kertas klinik: Nama, TTL, Alamat, KK,
// Agama, No RM (otomatis), Status (UMUM/BPJS/SKTM/GRATIS), No.
// BPJS/SKTM, No. Telp, Pekerjaan.

import { useState } from "react";
import { createPatient } from "../../lib/patientsApi";

const emptyForm = (presetName = "") => ({
  name: presetName,
  gender: "L",
  birthDate: "",
  address: "",
  kkNumber: "",
  religion: "",
  status: "UMUM",
  insuranceNumber: "",
  phone: "",
  occupation: "",
  nik: "",
  chronicConditions: "",
});

function Field({ label, children, span2 }) {
  return (
    <div style={{ gridColumn: span2 ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

export default function NewPatientModal({ presetName, onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm(presetName));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Nama lengkap wajib diisi.");
      return;
    }
    setSaving(true);
    setError("");
    const { data, error: err } = await createPatient(form);
    setSaving(false);
    if (err) {
      setError("Gagal menyimpan pasien. Coba lagi.");
      return;
    }
    setJustSaved(true);
    setTimeout(() => onCreated?.(data), 900);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div style={{
        background: "#fff", borderRadius: "var(--r-lg)", width: 680, maxHeight: "92vh",
        overflowY: "auto", boxShadow: "var(--shadow-lg)",
      }}>
        <div style={{ padding: "18px 24px", borderBottom: "1.5px solid var(--border-mid)", display: "flex", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>📝 Registrasi Pasien Baru</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              No. RM akan dibuat otomatis setelah disimpan.
            </div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-muted)" }}>✕</button>
        </div>

        <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Nama Lengkap *" span2>
            <input className="kk-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nama lengkap pasien" />
          </Field>

          <Field label="Jenis Kelamin">
            <select className="kk-input" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </Field>

          <Field label="Tgl. Lahir">
            <input className="kk-input" type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
          </Field>

          <Field label="Alamat" span2>
            <input className="kk-input" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Alamat tempat tinggal" />
          </Field>

          <Field label="No. KK">
            <input className="kk-input" value={form.kkNumber} onChange={(e) => set("kkNumber", e.target.value)} placeholder="Nomor Kartu Keluarga" />
          </Field>

          <Field label="NIK">
            <input className="kk-input" value={form.nik} onChange={(e) => set("nik", e.target.value)} placeholder="Nomor Induk Kependudukan" />
          </Field>

          <Field label="Agama">
            <input className="kk-input" value={form.religion} onChange={(e) => set("religion", e.target.value)} placeholder="cth: Islam, Kristen, ..." />
          </Field>

          <Field label="Pekerjaan">
            <input className="kk-input" value={form.occupation} onChange={(e) => set("occupation", e.target.value)} placeholder="cth: Wiraswasta, PNS, ..." />
          </Field>

          <Field label="Status">
            <select className="kk-input" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="UMUM">UMUM</option>
              <option value="BPJS">BPJS</option>
              <option value="SKTM">SKTM</option>
              <option value="GRATIS">GRATIS</option>
            </select>
          </Field>

          <Field label="No. BPJS / SKTM">
            <input className="kk-input" value={form.insuranceNumber} onChange={(e) => set("insuranceNumber", e.target.value)} placeholder="Diisi jika BPJS/SKTM" disabled={form.status === "UMUM" || form.status === "GRATIS"} />
          </Field>

          <Field label="No. Telp">
            <input className="kk-input" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Nomor HP aktif" />
          </Field>

          <Field label="Riwayat Penyakit Kronis" span2>
            <textarea className="kk-input" rows={2} style={{ resize: "vertical" }} value={form.chronicConditions} onChange={(e) => set("chronicConditions", e.target.value)} placeholder="Opsional" />
          </Field>
        </div>

        {justSaved && (
          <div style={{ margin: "0 24px 14px", padding: "10px 14px", background: "var(--green-bg)", border: "1.5px solid var(--green-border)", borderRadius: "var(--r-sm)", color: "var(--green-text)", fontSize: 13, fontWeight: 600 }}>
            ✅ Pasien berhasil didaftarkan!
          </div>
        )}
        {error && (
          <div style={{ margin: "0 24px 14px", padding: "8px 12px", background: "var(--red-bg)", border: "1.5px solid var(--red-border)", borderRadius: "var(--r-sm)", color: "var(--red-text)", fontSize: 12.5, fontWeight: 500 }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ padding: "16px 24px", borderTop: "1.5px solid var(--border-mid)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="kk-btn kk-btn-secondary" onClick={onClose} disabled={justSaved}>Batal</button>
          <button className="kk-btn kk-btn-primary" onClick={handleSubmit} disabled={saving || justSaved}>
            {saving ? "Menyimpan..." : justSaved ? "✅ Tersimpan" : "💾 Simpan & Daftarkan"}
          </button>
        </div>
      </div>
    </div>
  );
}
