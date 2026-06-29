import { useState } from "react";
import CopyResepPreview from "../../components/copyresep/CopyResepPreview";

const defaultPreview = {
  nomorCopyResep: "CR-20260610-0001",
  tanggal: new Date().toISOString().slice(0, 10),
  pasien: {
    nama: "Contoh Pasien",
    umur: "35",
    jenisKelamin: "L",
    alamat: "Jl. Contoh No. 1, Sleman",
    nomorRekamMedis: "RM-001234",
  },
  obat: [
    { namaObat: "Amoxicillin", bentukSediaan: "Kapsul", kekuatanDosis: "500mg", jumlah: "15", signa: "3 x sehari 1 kapsul", keterangan: "Habiskan" },
    { namaObat: "Paracetamol", bentukSediaan: "Tablet", kekuatanDosis: "500mg", jumlah: "9", signa: "3 x sehari 1 tablet", keterangan: "Jika demam" },
  ],
  keterangan: "Salinan resep sesuai resep asli",
  catatanTambahan: "",
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

export default function PageCopyResepSettings({ copyResepSettings, setCopyResepSettings }) {
  const [form, setForm] = useState(copyResepSettings);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const setField = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleSave = () => {
    setCopyResepSettings(form);
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
    <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>⚙️ Pengaturan Kop Copy Resep</h2>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Konfigurasi identitas Apotek dan Apoteker untuk cetak copy resep (A4)
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
          👁️ Preview Copy Resep
        </button>
      </div>

      {saved && (
        <div style={{ background: "#ddf4e9", border: "0.5px solid #9ce4c2", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "#0d7142", fontSize: 14 }}>
          ✅ Pengaturan kop copy resep berhasil disimpan!
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Identitas Apotek */}
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>
            🏪 Identitas Apotek
          </div>

          {/* Logo */}
          <Field label="Logo Apotek">
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

          <Field label="Nama Apotek">
            <input value={form.pharmacyName || ""} onChange={(e) => setField("pharmacyName", e.target.value)} placeholder="Nama Apotek" style={inputStyle} />
          </Field>

          <Field label="Alamat">
            <textarea value={form.pharmacyAddress || ""} onChange={(e) => setField("pharmacyAddress", e.target.value)} rows={2} placeholder="Jl. ..." style={{ ...inputStyle, resize: "vertical" }} />
          </Field>

          <Field label="Kota">
            <input value={form.pharmacyCity || ""} onChange={(e) => setField("pharmacyCity", e.target.value)} placeholder="Sleman, Yogyakarta" style={inputStyle} />
          </Field>

          <Field label="Nomor Telepon">
            <input value={form.pharmacyPhone || ""} onChange={(e) => setField("pharmacyPhone", e.target.value)} placeholder="021-..." style={inputStyle} />
          </Field>

          <Field label="Email">
            <input type="email" value={form.pharmacyEmail || ""} onChange={(e) => setField("pharmacyEmail", e.target.value)} placeholder="apotek@email.com" style={inputStyle} />
          </Field>

          <Field label="Website">
            <input value={form.pharmacyWebsite || ""} onChange={(e) => setField("pharmacyWebsite", e.target.value)} placeholder="www.apotek.com" style={inputStyle} />
          </Field>
        </div>

        {/* Identitas Apoteker + Footer */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Identitas Apoteker */}
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>
              👩‍⚕️ Identitas Apoteker
            </div>

            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 12, background: "var(--color-background-secondary)", borderRadius: 6, padding: "6px 10px" }}>
              ℹ️ Nama & SIPA Apoteker yang tampil pada footer copy resep.
            </div>

            <Field label="Nama Apoteker">
              <input value={form.pharmacistName || ""} onChange={(e) => setField("pharmacistName", e.target.value)} placeholder="Apt. Nama Apoteker, S.Farm" style={inputStyle} />
            </Field>

            <Field label="No. SIPA">
              <input value={form.pharmacistSIPA || ""} onChange={(e) => setField("pharmacistSIPA", e.target.value)} placeholder="SIPA-123/DKK/2024" style={inputStyle} />
            </Field>

            <Field label="Jabatan">
              <input value={form.pharmacistTitle || ""} onChange={(e) => setField("pharmacistTitle", e.target.value)} placeholder="Apoteker Penanggung Jawab" style={inputStyle} />
            </Field>
          </div>

          {/* Footer */}
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>
              📝 Footer
            </div>

            <Field label="Catatan Footer">
              <input value={form.footerNote || ""} onChange={(e) => setField("footerNote", e.target.value)} placeholder="cth: Copy resep hanya untuk keperluan arsip" style={inputStyle} />
            </Field>

            <Field label="Informasi Legalitas">
              <input value={form.footerLegal || ""} onChange={(e) => setField("footerLegal", e.target.value)} placeholder="cth: Izin Apotek No. ..." style={inputStyle} />
            </Field>

            <Field label="Teks Tambahan">
              <input value={form.footerExtra || ""} onChange={(e) => setField("footerExtra", e.target.value)} placeholder="Teks tambahan di footer..." style={inputStyle} />
            </Field>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button
          onClick={handleSave}
          style={{ flex: 1, padding: "13px 0", background: "#1240ab", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 15 }}
        >
          💾 Simpan Pengaturan Kop Copy Resep
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
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--color-text-secondary)" }}>💡 Tips Cetak Copy Resep</div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
          • Kertas: <strong>A4 Portrait (210 × 297 mm)</strong><br />
          • Di dialog cetak, pilih ukuran kertas <strong>A4</strong><br />
          • Set <strong>Margins: 10mm</strong> semua sisi (atau gunakan custom)<br />
          • Watermark <strong>COPY RESEP</strong> akan tampil otomatis<br />
          • Footer menampilkan identitas Apoteker yang sudah dikonfigurasi
        </div>
      </div>

      {showPreview && (
        <CopyResepPreview
          copyResep={defaultPreview}
          copyResepSettings={form}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
