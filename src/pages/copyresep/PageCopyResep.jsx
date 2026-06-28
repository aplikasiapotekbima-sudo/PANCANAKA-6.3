import { useState } from "react";
import CopyResepPreview from "../../components/copyresep/CopyResepPreview";
import PatientSelector from "../../components/patients/PatientSelector";

function getSalinanResepNumber(counter) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `SR-${y}${m}${d}-${String(counter).padStart(4, "0")}`;
}

// Tipe obat: "tunggal" atau "racikan"
const emptyObatTunggal = () => ({
  tipe: "tunggal",
  namaObat: "",
  bentukSediaan: "",
  kekuatanDosis: "",
  jumlah: "",
  signa: "",
  keterangan: "",
});

const emptyObatRacikan = () => ({
  tipe: "racikan",
  namaRacikan: "", // mis: "Racikan Salep"
  komponenRacikan: "", // mis: "Kloderma 10\nMediklin 5\nNiaceff 10\nFla da in pot"
  jumlah: "",
  satuan: "", // mis: "pot", "bungkus", "kapsul"
  signa: "",
  keterangan: "",
});

const emptyForm = () => ({
  namaPasien: "",
  umurPasien: "",
  jenisKelamin: "L",
  alamatPasien: "",
  nomorRekamMedis: "",
  namaDokter: "",
  tanggalResep: new Date().toISOString().slice(0, 10),
  tanggal: new Date().toISOString().slice(0, 10),
  nomorSalinanResepManual: "",
  obat: [emptyObatTunggal()],
  keterangan: "",
  catatanTambahan: "",
});

function fmtDateTime(d) {
  if (!d) return "-";
  return (
    new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  );
}

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

// ObatRow: mendukung tipe "tunggal" dan "racikan"
function ObatRow({ obat, index, onUpdate, onRemove, onChangeTipe }) {
  const update = (field, val) => onUpdate(index, { ...obat, [field]: val });
  const isTunggal = obat.tipe === "tunggal";

  return (
    <div className="kk-med-row">
      {/* Header baris */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: "var(--brand)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>
          {index + 1}
        </div>

        {/* Toggle tipe */}
        <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1.5px solid var(--border-strong)", flex: 1 }}>
          {[
            { val: "tunggal", label: "💊 Obat Tunggal" },
            { val: "racikan", label: "🧪 Racikan" },
          ].map((t) => (
            <button
              key={t.val}
              onClick={() => onChangeTipe(index, t.val)}
              style={{
                flex: 1, padding: "5px 0", border: "none", cursor: "pointer",
                background: obat.tipe === t.val ? "var(--brand)" : "var(--bg-input)",
                color: obat.tipe === t.val ? "#fff" : "var(--text-secondary)",
                fontSize: 11.5, fontWeight: obat.tipe === t.val ? 700 : 400,
                fontFamily: "var(--font)", transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => onRemove(index)}
          style={{
            background: "var(--red-bg)", border: "1.5px solid var(--red-border)",
            borderRadius: 6, padding: "3px 10px", cursor: "pointer",
            fontSize: 12, color: "var(--red-text)", fontWeight: 500, flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {isTunggal ? (
        /* ── OBAT TUNGGAL ── */
        <>
          <div style={{ marginBottom: 10 }}>
            <FieldLabel required>Nama Obat</FieldLabel>
            <input
              className={`kk-input${!obat.namaObat ? " error" : ""}`}
              value={obat.namaObat || ""}
              onChange={(e) => update("namaObat", e.target.value)}
              placeholder="cth: Amoxicillin, Paracetamol..."
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <FieldLabel>Bentuk Sediaan</FieldLabel>
              <input className="kk-input" value={obat.bentukSediaan || ""} onChange={(e) => update("bentukSediaan", e.target.value)} placeholder="Tablet, Kapsul, Sirup..." />
            </div>
            <div>
              <FieldLabel>Kekuatan Dosis</FieldLabel>
              <input className="kk-input" value={obat.kekuatanDosis || ""} onChange={(e) => update("kekuatanDosis", e.target.value)} placeholder="500mg, 250mg..." />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <FieldLabel>Jumlah</FieldLabel>
              <input className="kk-input" value={obat.jumlah || ""} onChange={(e) => update("jumlah", e.target.value)} placeholder="10" style={{ textAlign: "center", fontWeight: 600 }} />
            </div>
            <div>
              <FieldLabel>Signa / Aturan Pakai</FieldLabel>
              <input className="kk-input" value={obat.signa || ""} onChange={(e) => update("signa", e.target.value)} placeholder="cth: 3 x sehari 1 tablet, habiskan, sebelum makan..." />
            </div>
          </div>
          <div>
            <FieldLabel hint="(opsional)">Keterangan</FieldLabel>
            <input className="kk-input" value={obat.keterangan || ""} onChange={(e) => update("keterangan", e.target.value)} placeholder="Catatan tambahan untuk obat ini..." />
          </div>
        </>
      ) : (
        /* ── RACIKAN ── */
        <>
          <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: 6, padding: "6px 10px", marginBottom: 10, fontSize: 11.5, color: "var(--amber-text)" }}>
            🧪 Input komponen racikan satu per baris, misal: Kloderma 10 / Mediklin 5 / Niaceff 10 / Fla da in pot
          </div>
          <div style={{ marginBottom: 10 }}>
            <FieldLabel hint="(opsional)">Nama Racikan</FieldLabel>
            <input
              className="kk-input"
              value={obat.namaRacikan || ""}
              onChange={(e) => update("namaRacikan", e.target.value)}
              placeholder="cth: Racikan Salep, Racikan Kapsul..."
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <FieldLabel required>Komponen Racikan</FieldLabel>
            <textarea
              className={`kk-input${!obat.komponenRacikan ? " error" : ""}`}
              value={obat.komponenRacikan || ""}
              onChange={(e) => update("komponenRacikan", e.target.value)}
              placeholder={"Kloderma 10\nMediklin 5\nNiaceff 10\nFla da in pot"}
              rows={4}
              style={{ resize: "vertical", fontSize: 13, lineHeight: 1.6, fontFamily: "monospace" }}
            />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Tulis satu komponen per baris</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <FieldLabel>Jumlah</FieldLabel>
              <input className="kk-input" value={obat.jumlah || ""} onChange={(e) => update("jumlah", e.target.value)} placeholder="1" style={{ textAlign: "center", fontWeight: 600 }} />
            </div>
            <div>
              <FieldLabel>Satuan</FieldLabel>
              <input className="kk-input" value={obat.satuan || ""} onChange={(e) => update("satuan", e.target.value)} placeholder="pot, bungkus, kapsul..." />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <FieldLabel required>Signa / Aturan Pakai</FieldLabel>
            <textarea
              className="kk-input"
              value={obat.signa || ""}
              onChange={(e) => update("signa", e.target.value)}
              placeholder="cth: 2 x sehari, oleskan tipis pada area yang sakit..."
              rows={2}
              style={{ resize: "vertical", fontSize: 13, lineHeight: 1.5 }}
            />
          </div>
          <div>
            <FieldLabel hint="(opsional)">Keterangan</FieldLabel>
            <input className="kk-input" value={obat.keterangan || ""} onChange={(e) => update("keterangan", e.target.value)} placeholder="Catatan tambahan..." />
          </div>
        </>
      )}
    </div>
  );
}

export default function PageCopyResep({
  copyResepList,
  setCopyResepList,
  copyResepCounter,
  setCopyResepCounter,
  copyResepSettings,
}) {
  const [form, setForm] = useState(emptyForm());
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [errors, setErrors] = useState({});
  const [previewData, setPreviewData] = useState(null);
  const [success, setSuccess] = useState(null);
  const [historyPreview, setHistoryPreview] = useState(null);
  const [editId, setEditId] = useState(null);

  const [searchQ, setSearchQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeQuick, setActiveQuick] = useState("");

  const setField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }));

  const addObat = (tipe = "tunggal") =>
    setForm((f) => ({ ...f, obat: [...f.obat, tipe === "racikan" ? emptyObatRacikan() : emptyObatTunggal()] }));

  const updateObat = (i, item) => setForm((f) => { const o = [...f.obat]; o[i] = item; return { ...f, obat: o }; });
  const removeObat = (i) => setForm((f) => ({ ...f, obat: f.obat.filter((_, idx) => idx !== i) }));

  const changeTipeObat = (i, tipe) => {
    setForm((f) => {
      const o = [...f.obat];
      // Ganti ke tipe baru, reset field-field yang relevan
      if (tipe === "tunggal") {
        o[i] = { ...emptyObatTunggal(), signa: o[i].signa || "", keterangan: o[i].keterangan || "" };
      } else {
        o[i] = { ...emptyObatRacikan(), signa: o[i].signa || "", keterangan: o[i].keterangan || "" };
      }
      return { ...f, obat: o };
    });
  };

  const applyQuick = (key) => {
    const today = new Date().toISOString().slice(0, 10);
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

  const filteredList = copyResepList.filter((cr) => {
    if (searchQ) {
      const q = searchQ.toLowerCase();
      const match =
        cr.nomorCopyResep?.toLowerCase().includes(q) ||
        cr.pasien?.nama?.toLowerCase().includes(q) ||
        cr.pasien?.nomorRekamMedis?.toLowerCase().includes(q);
      if (!match) return false;
    }
    const crDate = cr.createdAt?.slice(0, 10) || "";
    if (dateFrom && crDate < dateFrom) return false;
    if (dateTo && crDate > dateTo) return false;
    return true;
  });

  const validate = () => {
    const e = {};
    if (!form.namaPasien.trim()) e.namaPasien = "Nama pasien wajib diisi";
    if (form.obat.length === 0) e.obat = "Tambah minimal 1 obat";
    else {
      const invalid = form.obat.some((o) => {
        if (o.tipe === "tunggal") return !o.namaObat.trim();
        if (o.tipe === "racikan") return !o.komponenRacikan.trim();
        return false;
      });
      if (invalid) e.obat = "Nama/komponen obat wajib diisi untuk setiap item";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildSalinanResep = () => {
    const counter = copyResepCounter + 1;
    setCopyResepCounter(counter);
    const autoNumber = editId
      ? (copyResepList.find((c) => c.id === editId)?.nomorCopyResep || getSalinanResepNumber(counter))
      : getSalinanResepNumber(counter);
    const nomorCopyResep = form.nomorSalinanResepManual.trim() || autoNumber;
    return {
      id: editId || Date.now().toString(),
      nomorCopyResep,
      tanggal: form.tanggal,
      namaDokter: form.namaDokter,
      tanggalResep: form.tanggalResep,
      pasien: {
        nama: form.namaPasien,
        umur: form.umurPasien,
        jenisKelamin: form.jenisKelamin,
        alamat: form.alamatPasien,
        nomorRekamMedis: form.nomorRekamMedis,
        patientId: selectedPatient?.id || null,
      },
      obat: form.obat,
      keterangan: form.keterangan,
      catatanTambahan: form.catatanTambahan,
      createdAt: editId
        ? (copyResepList.find((c) => c.id === editId)?.createdAt || new Date().toISOString())
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const formFromObj = (cr) => ({
    namaPasien: cr.pasien?.nama || "",
    umurPasien: cr.pasien?.umur || "",
    jenisKelamin: cr.pasien?.jenisKelamin || "L",
    alamatPasien: cr.pasien?.alamat || "",
    nomorRekamMedis: cr.pasien?.nomorRekamMedis || "",
    namaDokter: cr.namaDokter || "",
    tanggalResep: cr.tanggalResep || new Date().toISOString().slice(0, 10),
    tanggal: cr.tanggal || new Date().toISOString().slice(0, 10),
    nomorSalinanResepManual: cr.nomorCopyResep || "",
    obat: cr.obat?.length ? cr.obat : [emptyObatTunggal()],
    keterangan: cr.keterangan || "",
    catatanTambahan: cr.catatanTambahan || "",
  });

  const handlePreview = () => { if (!validate()) return; setPreviewData(buildSalinanResep()); };
  const handleSave = () => {
    if (!validate()) return;
    const cr = buildSalinanResep();
    if (editId) setCopyResepList((p) => p.map((x) => (x.id === editId ? cr : x)));
    else setCopyResepList((p) => [cr, ...p]);
    setSuccess(cr); setForm(emptyForm()); setEditId(null);
  };
  const handleSaveAndPrint = () => {
    if (!validate()) return;
    const cr = buildSalinanResep();
    if (editId) setCopyResepList((p) => p.map((x) => (x.id === editId ? cr : x)));
    else setCopyResepList((p) => [cr, ...p]);
    setSuccess(cr); setPreviewData(cr); setForm(emptyForm()); setEditId(null);
  };
  const handleEdit = (cr) => { setForm(formFromObj(cr)); setEditId(cr.id); setSuccess(null); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const handleDelete = (id) => {
    if (window.confirm("Hapus data salinan resep ini?")) setCopyResepList((p) => p.filter((cr) => cr.id !== id));
  };

  const cardStyle = {
    background: "var(--bg-card)", border: "1.5px solid var(--border-mid)",
    borderRadius: "var(--r-lg)", padding: "18px 20px", boxShadow: "var(--shadow-sm)",
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 48 }}>

      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            📋 Salinan Resep
          </h2>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>
            Buat salinan resep pasien (obat tunggal & racikan) dan cetak pada kertas A4
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <span style={{ background: "var(--blue-bg)", border: "1.5px solid var(--blue-border)", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "var(--blue-text)", fontWeight: 600 }}>
            {copyResepList.length} Salinan Tersimpan
          </span>
        </div>
      </div>

      {editId && (
        <div style={{ background: "#FAEEDA", border: "1.5px solid #FAC775", borderRadius: "var(--r-md)", padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18 }}>✏️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: "#854F0B", fontSize: 14 }}>Mode Edit</div>
            <div style={{ color: "#854F0B", fontSize: 12.5, marginTop: 1 }}>Anda sedang mengedit salinan resep. Simpan untuk memperbarui data.</div>
          </div>
          <button onClick={() => { setForm(emptyForm()); setEditId(null); setErrors({}); }} className="kk-btn kk-btn-sm" style={{ background: "#fff", border: "1.5px solid #FAC775", color: "#854F0B" }}>
            ✕ Batal Edit
          </button>
        </div>
      )}

      {success && (
        <div style={{ background: "var(--green-bg)", border: "1.5px solid var(--green-border)", borderRadius: "var(--r-md)", padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: "var(--green-text)", fontSize: 14 }}>Salinan Resep disimpan!</div>
            <div style={{ color: "#166534", fontSize: 12.5, marginTop: 1 }}>{success.nomorCopyResep} · {success.pasien?.nama}</div>
          </div>
          <button onClick={() => setHistoryPreview(success)} className="kk-btn kk-btn-sm" style={{ background: "#fff", border: "1.5px solid var(--green-border)", color: "var(--green-text)" }}>🖨️ Cetak</button>
          <button onClick={() => setSuccess(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--green-text)", fontSize: 18, padding: "0 4px" }}>✕</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 20, alignItems: "start" }}>

        {/* LEFT COLUMN */}
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
                  setField("namaPasien", p?.name || "");
                  setField("nomorRekamMedis", p?.rm_number || "");
                  setField("jenisKelamin", p?.gender || form.jenisKelamin);
                  if (p?.birth_date) {
                    const age = Math.floor((Date.now() - new Date(p.birth_date)) / 31557600000);
                    setField("umurPasien", String(age));
                  }
                }}
              />
              <ErrorMsg msg={errors.namaPasien} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div>
                <FieldLabel>Umur (thn)</FieldLabel>
                <input className="kk-input" type="number" min="0" max="120" value={form.umurPasien} onChange={(e) => setField("umurPasien", e.target.value)} placeholder="—" style={{ textAlign: "center" }} />
              </div>
              <div>
                <FieldLabel>Jenis Kelamin</FieldLabel>
                <select className="kk-input" value={form.jenisKelamin} onChange={(e) => setField("jenisKelamin", e.target.value)}>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
            </div>
            <div>
              <FieldLabel hint="(opsional)">Alamat</FieldLabel>
              <textarea className="kk-input" value={form.alamatPasien} onChange={(e) => setField("alamatPasien", e.target.value)} placeholder="Alamat lengkap pasien..." rows={2} style={{ resize: "vertical" }} />
            </div>
            {/* Informasi Dokter */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "0.5px solid var(--border-secondary)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Informasi Dokter</div>
              <div style={{ marginBottom: 10 }}>
                <FieldLabel hint="(opsional)">Nama Dokter</FieldLabel>
                <input className="kk-input" value={form.namaDokter} onChange={(e) => setField("namaDokter", e.target.value)} placeholder="dr. Nama Dokter" />
              </div>
              <div>
                <FieldLabel hint="(opsional)">Tanggal Resep Asli</FieldLabel>
                <input className="kk-input" type="date" value={form.tanggalResep} onChange={(e) => setField("tanggalResep", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Data Salinan Resep */}
          <div style={cardStyle}>
            <SectionHeader icon="📋" label="Data Salinan Resep" />
            <div style={{ marginBottom: 12 }}>
              <FieldLabel hint="(kosongkan = auto-generate)">No. Salinan Resep</FieldLabel>
              <input
                className="kk-input"
                value={form.nomorSalinanResepManual}
                onChange={(e) => setField("nomorSalinanResepManual", e.target.value)}
                placeholder={`cth: SR-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-0001`}
                style={{ fontFamily: "monospace", fontSize: 13 }}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Jika dikosongkan, nomor akan digenerate otomatis (SR-...).</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <FieldLabel>Tanggal Salinan Resep</FieldLabel>
              <input className="kk-input" type="date" value={form.tanggal} onChange={(e) => setField("tanggal", e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <FieldLabel hint="(opsional)">Keterangan</FieldLabel>
              <textarea className="kk-input" value={form.keterangan} onChange={(e) => setField("keterangan", e.target.value)} placeholder="Keterangan umum salinan resep..." rows={2} style={{ resize: "vertical" }} />
            </div>
            <div>
              <FieldLabel hint="(opsional)">Catatan Tambahan</FieldLabel>
              <textarea className="kk-input" value={form.catatanTambahan} onChange={(e) => setField("catatanTambahan", e.target.value)} placeholder="Instruksi atau informasi tambahan..." rows={2} style={{ resize: "vertical" }} />
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="kk-btn kk-btn-primary kk-btn-lg kk-btn-block" onClick={handleSaveAndPrint}>
              💾 {editId ? "Update" : "Simpan"} &amp; Cetak Salinan Resep
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button className="kk-btn kk-btn-secondary kk-btn-block" onClick={handlePreview} style={{ borderColor: "var(--brand)", color: "var(--brand)" }}>
                👁️ Preview
              </button>
              <button className="kk-btn kk-btn-secondary kk-btn-block" onClick={handleSave}>
                💾 {editId ? "Update" : "Simpan"} Saja
              </button>
            </div>
            <button className="kk-btn kk-btn-ghost kk-btn-block" onClick={() => { setForm(emptyForm()); setErrors({}); setSuccess(null); setEditId(null); }} style={{ fontSize: 12.5 }}>
              🔄 Bersihkan Form
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Daftar Obat */}
          <div style={{ ...cardStyle, flex: 1 }}>
            <SectionHeader icon="💊" label="Daftar Obat / Racikan" count={form.obat.length} />

            {errors.obat && (
              <div style={{ background: "var(--red-bg)", border: "1.5px solid var(--red-border)", borderRadius: "var(--r-sm)", padding: "8px 12px", marginBottom: 12, color: "var(--red-text)", fontSize: 13, fontWeight: 500 }}>
                ⚠️ {errors.obat}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {form.obat.map((item, i) => (
                <ObatRow key={i} obat={item} index={i} onUpdate={updateObat} onRemove={removeObat} onChangeTipe={changeTipeObat} />
              ))}
            </div>

            {/* Tombol tambah obat */}
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                onClick={() => addObat("tunggal")}
                style={{
                  padding: "10px 0", borderRadius: "var(--r-sm)",
                  border: "2px dashed var(--brand-mid)", background: "var(--blue-bg)",
                  color: "var(--brand)", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                }}
              >
                <span style={{ fontSize: 16 }}>+</span> Tambah Obat Tunggal
              </button>
              <button
                onClick={() => addObat("racikan")}
                style={{
                  padding: "10px 0", borderRadius: "var(--r-sm)",
                  border: "2px dashed var(--amber-border)", background: "var(--amber-bg)",
                  color: "var(--amber-text)", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                }}
              >
                <span style={{ fontSize: 16 }}>+</span> Tambah Racikan
              </button>
            </div>
          </div>

          {/* Riwayat Salinan Resep */}
          <div style={cardStyle}>
            <SectionHeader icon="📋" label="Riwayat Salinan Resep" count={filteredList.length} />

            <div style={{ marginBottom: 10 }}>
              <input className="kk-input" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="🔍 No. salinan resep, nama pasien..." style={{ fontSize: 13 }} />
            </div>

            <div className="kk-date-quick" style={{ marginBottom: 10 }}>
              {[
                { key: "today", label: "Hari Ini" },
                { key: "7d", label: "7 Hari" },
                { key: "30d", label: "30 Hari" },
                { key: "", label: "Semua" },
              ].map((q) => (
                <button key={q.key} className={activeQuick === q.key ? "active" : ""} onClick={() => applyQuick(q.key)}>
                  {q.label}
                </button>
              ))}
            </div>

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

            {filteredList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-muted)", fontSize: 13 }}>
                {copyResepList.length === 0 ? "Belum ada salinan resep tersimpan." : "Tidak ada salinan resep di rentang ini."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 400, overflowY: "auto" }}>
                {filteredList.map((cr) => {
                  const jumlahRacikan = cr.obat?.filter((o) => o.tipe === "racikan").length || 0;
                  const jumlahTunggal = cr.obat?.filter((o) => o.tipe !== "racikan").length || 0;
                  return (
                    <div key={cr.id} style={{
                      background: "var(--bg-input)", border: "1.5px solid var(--border-mid)",
                      borderRadius: "var(--r-md)", padding: "10px 14px",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: "var(--brand)" }}>{cr.nomorCopyResep}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{cr.pasien?.nama || "-"}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                          {jumlahTunggal > 0 && <span>{jumlahTunggal} obat tunggal</span>}
                          {jumlahTunggal > 0 && jumlahRacikan > 0 && <span style={{ margin: "0 4px" }}>·</span>}
                          {jumlahRacikan > 0 && <span>🧪 {jumlahRacikan} racikan</span>}
                          {cr.pasien?.nomorRekamMedis ? ` · RM: ${cr.pasien.nomorRekamMedis}` : ""}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{fmtDateTime(cr.createdAt)}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => handleEdit(cr)} className="kk-btn kk-btn-sm kk-btn-secondary" style={{ fontSize: 11 }}>✏️</button>
                        <button onClick={() => setHistoryPreview(cr)} className="kk-btn kk-btn-sm kk-btn-secondary">🖨️ Cetak</button>
                        <button onClick={() => handleDelete(cr.id)} className="kk-btn kk-btn-sm" style={{ background: "var(--red-bg)", border: "1.5px solid var(--red-border)", color: "var(--red-text)", fontSize: 11 }}>🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {previewData && (
        <CopyResepPreview copyResep={previewData} copyResepSettings={copyResepSettings} onClose={() => setPreviewData(null)} />
      )}
      {historyPreview && (
        <CopyResepPreview copyResep={historyPreview} copyResepSettings={copyResepSettings} onClose={() => setHistoryPreview(null)} />
      )}
    </div>
  );
}
