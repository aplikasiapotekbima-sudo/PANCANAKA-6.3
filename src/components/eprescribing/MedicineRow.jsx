export default function MedicineRow({ med, index, onUpdate, onRemove }) {
  const update = (field, val) => onUpdate(index, { ...med, [field]: val });

  return (
    <div className="kk-med-row">
      {/* Row Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: "var(--brand)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>
          {index + 1}
        </div>
        <button
          onClick={() => onRemove(index)}
          style={{
            background: "var(--red-bg)", border: "1.5px solid var(--red-border)",
            borderRadius: 6, padding: "3px 10px", cursor: "pointer",
            fontSize: 12, color: "var(--red-text)", fontWeight: 500,
          }}
        >
          ✕ Hapus
        </button>
      </div>

      {/* Nama Obat + Kekuatan */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <label className="kk-field-label">Nama Obat *</label>
          <input
            className={`kk-input${!med.name ? " error" : ""}`}
            value={med.name || ""}
            onChange={(e) => update("name", e.target.value)}
            placeholder="cth: Amoxicillin, Paracetamol..."
          />
        </div>
        <div>
          <label className="kk-field-label">Kekuatan</label>
          <input
            className="kk-input"
            value={med.strength || ""}
            onChange={(e) => update("strength", e.target.value)}
            placeholder="500mg"
          />
        </div>
      </div>

      {/* Jumlah */}
      <div style={{ marginBottom: 10 }}>
        <label className="kk-field-label">Jumlah</label>
        <input
          className="kk-input"
          value={med.quantity || ""}
          onChange={(e) => update("quantity", e.target.value)}
          placeholder="10"
          style={{ width: 80, textAlign: "center", fontWeight: 600 }}
        />
      </div>

      {/* Signa & Catatan — bebas menulis */}
      <div>
        <label className="kk-field-label">
          Signa / Aturan Pakai & Catatan{" "}
          <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(opsional)</span>
        </label>
        <textarea
          className="kk-input"
          value={med.signa || ""}
          onChange={(e) => update("signa", e.target.value)}
          placeholder="cth: 3 x sehari 1 tablet, habiskan, sebelum makan..."
          rows={2}
          style={{ resize: "vertical", fontSize: 13, lineHeight: 1.5 }}
        />
      </div>
    </div>
  );
}
