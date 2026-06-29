import { useState } from "react";
import PrescriptionPreview from "../../components/eprescribing/PrescriptionPreview";

const defaultPreview = {
  prescriptionNumber: "RX/2601/0001",
  date: new Date().toISOString().slice(0, 10),
  patientName: "Contoh Pasien",
  patientAge: "35",
  patientGender: "L",
  patientWeight: "65",
  diagnosis: "ISPA",
  allergies: "Penisilin",
  doctorNotes: "Minum obat sampai habis",
  medicines: [
    { name: "Amoxicillin", strength: "500mg", signa: "3 x sehari 1 kapsul", quantity: "15", notes: "Habiskan" },
    { name: "Paracetamol", strength: "500mg", signa: "3 x sehari 1 tablet", quantity: "9", notes: "Jika demam" },
    { name: "Vitamin C", strength: "50mg", signa: "1 x sehari 1 tablet", quantity: "7", notes: "" },
  ],
  selectedDoctor: { name: "dr. Contoh Dokter, Sp.PD", sip: "123/SIP/2020" },
};

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "0.5px solid var(--color-border-secondary)",
  background: "var(--color-background-secondary)",
  color: "var(--color-text-primary)",
  fontSize: 14,
  boxSizing: "border-box",
};

export default function PagePrescriptionSettings({ printSettings, setPrintSettings }) {
  const [form, setForm] = useState(printSettings);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const setField = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSave = () => {
    setPrintSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setField("logo", ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>⚙️ Pengaturan Kop Resep</h2>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Konfigurasi tampilan dan cetak resep (10.5 × 16.5 cm)
          </div>
        </div>
        <button
          onClick={() => setShowPreview(true)}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "0.5px solid #1240ab",
            background: "#e5ecfc",
            color: "#1240ab",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          👁️ Preview Resep
        </button>
      </div>

      {saved && (
        <div style={{ background: "#ddf4e9", border: "0.5px solid #9ce4c2", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "#0d7142", fontSize: 14 }}>
          ✅ Pengaturan resep berhasil disimpan!
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Identitas Klinik */}
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>
            🏥 Identitas Klinik
          </div>

          {/* Logo */}
          <Field label="Logo Klinik">
            {form.logo && (
              <div style={{ marginBottom: 8 }}>
                <img src={form.logo} alt="logo" style={{ maxWidth: 100, maxHeight: 60, borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)" }} />
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ padding: "7px 14px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary)" }}>
                📁 Upload Logo
                <input type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
              </label>
              {form.logo && (
                <button onClick={() => setField("logo", "")} style={{ padding: "7px 14px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 12, color: "#a8282f" }}>
                  Hapus
                </button>
              )}
            </div>
          </Field>

          <Field label="Nama Klinik / Apotek">
            <input value={form.clinicName || ""} onChange={(e) => setField("clinicName", e.target.value)} placeholder="Nama Klinik" style={inputStyle} />
          </Field>

          <Field label="Alamat">
            <textarea value={form.clinicAddress || ""} onChange={(e) => setField("clinicAddress", e.target.value)} rows={2} placeholder="Jl. ..." style={{ ...inputStyle, resize: "vertical" }} />
          </Field>

          <Field label="Telepon">
            <input value={form.clinicPhone || ""} onChange={(e) => setField("clinicPhone", e.target.value)} placeholder="021-..." style={inputStyle} />
          </Field>

          <Field label="Footer Resep">
            <input value={form.footer || ""} onChange={(e) => setField("footer", e.target.value)} placeholder="cth: Resep hanya berlaku 3 hari" style={inputStyle} />
          </Field>
        </div>

        {/* Identitas Dokter + Cetak */}
        <div>
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>
              👨‍⚕️ Dokter Default
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12, background: "var(--color-background-secondary)", borderRadius: 6, padding: "6px 10px" }}>
              ℹ️ Nama & SIP dokter pada kop resep. Dokter aktif bisa dipilih per resep di form E-Resep.
            </div>
            <Field label="Nama Dokter">
              <input value={form.doctorName || ""} onChange={(e) => setField("doctorName", e.target.value)} placeholder="dr. Nama Dokter, Sp.X" style={inputStyle} />
            </Field>
            <Field label="No. SIP Dokter">
              <input value={form.doctorSIP || ""} onChange={(e) => setField("doctorSIP", e.target.value)} placeholder="123/SIP/DKK/20XX" style={inputStyle} />
            </Field>
          </div>

          {/* Pengaturan Cetak */}
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>
              🖨️ Pengaturan Cetak
            </div>

            <Field label={`Ukuran Font: ${form.fontSize || 11}px`}>
              <input
                type="range"
                min={9}
                max={14}
                value={form.fontSize || 11}
                onChange={(e) => setField("fontSize", Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--color-text-secondary)" }}>
                <span>9px (kecil)</span>
                <span>14px (besar)</span>
              </div>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label={`Margin Atas: ${form.marginTop || 8}mm`}>
                <input type="range" min={3} max={15} value={form.marginTop || 8} onChange={(e) => setField("marginTop", Number(e.target.value))} style={{ width: "100%" }} />
              </Field>
              <Field label={`Margin Bawah: ${form.marginBottom || 8}mm`}>
                <input type="range" min={3} max={15} value={form.marginBottom || 8} onChange={(e) => setField("marginBottom", Number(e.target.value))} style={{ width: "100%" }} />
              </Field>
              <Field label={`Margin Kiri: ${form.marginLeft || 8}mm`}>
                <input type="range" min={3} max={15} value={form.marginLeft || 8} onChange={(e) => setField("marginLeft", Number(e.target.value))} style={{ width: "100%" }} />
              </Field>
              <Field label={`Margin Kanan: ${form.marginRight || 8}mm`}>
                <input type="range" min={3} max={15} value={form.marginRight || 8} onChange={(e) => setField("marginRight", Number(e.target.value))} style={{ width: "100%" }} />
              </Field>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button
          onClick={handleSave}
          style={{ flex: 1, padding: "13px 0", background: "#1240ab", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 15 }}
        >
          💾 Simpan Pengaturan Resep
        </button>
        <button
          onClick={() => setShowPreview(true)}
          style={{ padding: "13px 20px", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 10, cursor: "pointer", fontSize: 14 }}
        >
          👁️ Preview
        </button>
      </div>

      {/* Info cetak */}
      <div style={{ marginTop: 16, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--color-text-secondary)" }}>💡 Tips Cetak Resep</div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
          • Kertas resep: <strong>10.5 × 16.5 cm</strong> (½ A5 / Folio)<br />
          • Di dialog cetak, pilih <strong>Custom Paper Size → 10.5 × 16.5 cm</strong><br />
          • Set <strong>Margins: None / Minimum</strong><br />
          • Pastikan <strong>"Fit to Page"</strong> tidak aktif<br />
          • Untuk printer thermal, cek ukuran roll yang digunakan
        </div>
      </div>

      {showPreview && (
        <PrescriptionPreview
          prescription={{ ...defaultPreview }}
          printSettings={form}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
