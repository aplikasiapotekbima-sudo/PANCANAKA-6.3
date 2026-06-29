import { useState } from "react";
import { printCopyResep } from "../../utils/print/printCopyResep";

function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export default function CopyResepPreview({ copyResep, copyResepSettings, onClose }) {
  const [editableNomor, setEditableNomor] = useState(copyResep.nomorCopyResep || "");

  const handlePrint = () => {
    printCopyResep({ ...copyResep, nomorCopyResep: editableNomor }, copyResepSettings);
  };

  const {
    tanggal, namaDokter, tanggalResep,
    pasien = {}, obat = [], keterangan = "", catatanTambahan = "",
  } = copyResep;

  const {
    pharmacyName = "Apotek",
    pharmacyAddress = "",
    pharmacyCity = "",
    pharmacyPhone = "",
    pharmacyEmail = "",
    pharmacyWebsite = "",
    logo = "",
    pharmacistName = "",
    pharmacistSIPA = "",
    pharmacistTitle = "Apoteker",
    footerNote = "",
    footerLegal = "",
    footerExtra = "",
  } = copyResepSettings || {};

  const fullAddress = [pharmacyAddress, pharmacyCity].filter(Boolean).join(", ");

  // Render satu item obat (tunggal atau racikan)
  function renderObatItem(item, i) {
    const isRacikan = item.tipe === "racikan";
    return (
      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: i < obat.length - 1 ? "0.5px dashed #ccc" : "none" }}>
        <div style={{ fontWeight: "bold", minWidth: 18, flexShrink: 0, fontSize: 11.5 }}>{i + 1}.</div>
        <div style={{ flex: 1 }}>
          {isRacikan ? (
            /* Racikan */
            <>
              <div style={{ fontWeight: "bold", fontSize: 12, marginBottom: 3 }}>
                🧪 {item.namaRacikan || "Racikan"}
                {item.jumlah && item.satuan && (
                  <span style={{ fontWeight: "normal", fontSize: 11, color: "#444", marginLeft: 6 }}>
                    — {item.jumlah} {item.satuan}
                  </span>
                )}
              </div>
              {/* Komponen racikan: render satu per baris */}
              <div style={{ background: "#f5f5f5", border: "0.5px solid #ddd", borderRadius: 3, padding: "4px 8px", marginBottom: 4 }}>
                <div style={{ fontSize: 10, color: "#666", marginBottom: 2, fontStyle: "italic" }}>Komposisi:</div>
                {(item.komponenRacikan || "").split("\n").filter(Boolean).map((line, j) => (
                  <div key={j} style={{ fontSize: 11, color: "#222", lineHeight: 1.6 }}>
                    <span style={{ color: "#888", marginRight: 4 }}>—</span>{line.trim()}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#222", marginTop: 2 }}>
                <em><strong>S.</strong></em> {item.signa || "-"}
              </div>
              {item.keterangan && (
                <div style={{ fontSize: 10.5, color: "#555", fontStyle: "italic", marginTop: 2 }}>{item.keterangan}</div>
              )}
            </>
          ) : (
            /* Obat tunggal */
            <>
              <div style={{ fontWeight: "bold", fontSize: 12 }}>
                {item.namaObat || "-"}
                {item.bentukSediaan && <span style={{ fontWeight: "normal", fontStyle: "italic", fontSize: 11 }}> – {item.bentukSediaan}</span>}
                {item.kekuatanDosis && <span style={{ fontWeight: "bold", fontSize: 11, color: "#333" }}> {item.kekuatanDosis}</span>}
              </div>
              <div style={{ fontSize: 11, color: "#222", marginTop: 2 }}>
                <em><strong>S.</strong></em> {item.signa || "-"}
                {item.jumlah && <strong style={{ marginLeft: 8 }}>#{item.jumlah}</strong>}
              </div>
              {item.keterangan && (
                <div style={{ fontSize: 10.5, color: "#555", fontStyle: "italic", marginTop: 2 }}>{item.keterangan}</div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        zIndex: 1000, display: "flex", alignItems: "flex-start",
        justifyContent: "center", padding: "16px", gap: 20, overflowY: "auto",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Action Panel */}
      <div style={{
        background: "var(--color-background-primary)", borderRadius: 12,
        border: "0.5px solid var(--color-border-tertiary)", width: 240, padding: 20,
        display: "flex", flexDirection: "column", gap: 10,
        position: "sticky", top: 16, flexShrink: 0,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: "var(--color-text-primary)" }}>
          🖨️ Cetak Salinan Resep
        </div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 4 }}>
          Ukuran kertas: <strong>A4 Portrait</strong><br />Margin: 10mm semua sisi
        </div>
        <div style={{ padding: "7px 10px", background: "#eff4ff", border: "0.5px solid #91b2ff", borderRadius: 6, fontSize: 11, color: "#1847b5", lineHeight: 1.5, marginBottom: 4 }}>
          ✏️ <strong>No. Salinan Resep</strong> dapat diedit langsung di dokumen sebelum cetak.
        </div>
        <button
          onClick={handlePrint}
          style={{ padding: "11px 0", background: "#1240ab", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}
        >
          🖨️ Cetak Sekarang
        </button>
        <button
          onClick={onClose}
          style={{ padding: "10px 0", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
        >
          ✕ Tutup
        </button>
        <div style={{ marginTop: 6, padding: "8px 10px", background: "#fbf1d9", border: "0.5px solid #ffd470", borderRadius: 6, fontSize: 11, color: "#8a6206", lineHeight: 1.5 }}>
          💡 Set ukuran kertas <strong>A4</strong>, margin <strong>10mm</strong>.
        </div>
      </div>

      {/* A4 Paper Preview */}
      <div style={{
        background: "#fff", border: "1px solid #ccc", boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        width: "210mm", minHeight: "297mm", padding: "10mm",
        fontFamily: "'Times New Roman', Times, serif", fontSize: "12px",
        color: "#000", lineHeight: 1.5, position: "relative", flexShrink: 0,
      }}>
        {/* Watermark */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%) rotate(-35deg)",
          fontSize: 72, fontWeight: 900, color: "rgba(0,0,0,0.06)",
          textTransform: "uppercase", letterSpacing: 6, pointerEvents: "none",
          zIndex: 0, whiteSpace: "nowrap", fontFamily: "Arial, sans-serif",
        }}>
          SALINAN RESEP
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* KOP */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: "2px solid #000", paddingBottom: 10, marginBottom: 14 }}>
            {logo && <div style={{ flexShrink: 0 }}><img src={logo} alt="logo" style={{ maxWidth: 70, maxHeight: 70 }} /></div>}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: "bold", color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Apotek</div>
              <div style={{ fontSize: 20, fontWeight: "bold", letterSpacing: 0.5, textTransform: "uppercase" }}>{pharmacyName}</div>
              {fullAddress && <div style={{ fontSize: 11, color: "#333", marginTop: 2 }}>{fullAddress}</div>}
              <div style={{ fontSize: 10.5, color: "#444", marginTop: 2, display: "flex", flexWrap: "wrap", gap: 10 }}>
                {pharmacyPhone && <span>📞 {pharmacyPhone}</span>}
                {pharmacyEmail && <span>✉ {pharmacyEmail}</span>}
                {pharmacyWebsite && <span>🌐 {pharmacyWebsite}</span>}
              </div>
            </div>
          </div>

          {/* Title Strip */}
          <div style={{ background: "#1a1a1a", color: "#fff", textAlign: "center", padding: "6px 0", fontSize: 15, fontWeight: "bold", letterSpacing: 4, textTransform: "uppercase", marginBottom: 14, borderRadius: 2 }}>
            SALINAN RESEP
          </div>

          {/* Meta */}
          <div style={{ marginBottom: 12 }}>
            {/* No. Salinan Resep — inline editable */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: "#555", minWidth: 130 }}>No. Salinan Resep</span>
              <span style={{ color: "#555" }}>:</span>
              <input
                value={editableNomor}
                onChange={(e) => setEditableNomor(e.target.value)}
                style={{
                  fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#000",
                  border: "1px dashed #aaa", borderRadius: 3, padding: "1px 6px",
                  background: "#fff8e7", outline: "none", minWidth: 160,
                }}
                title="Klik untuk edit nomor salinan resep sebelum cetak"
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, marginBottom: (namaDokter || tanggalResep) ? 4 : 0 }}>
              <span style={{ color: "#555", minWidth: 130 }}>Tanggal Salinan</span>
              <span style={{ color: "#555" }}>:</span>
              <strong>{formatDate(tanggal)}</strong>
            </div>
            {(namaDokter || tanggalResep) && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: "0.5px dashed #ccc" }}>
                {namaDokter && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: "#555", minWidth: 130 }}>Dari Dokter</span>
                    <span style={{ color: "#555" }}>:</span>
                    <strong>{namaDokter}</strong>
                  </div>
                )}
                {tanggalResep && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                    <span style={{ color: "#555", minWidth: 130 }}>Tanggal Resep Asli</span>
                    <span style={{ color: "#555" }}>:</span>
                    <strong>{formatDate(tanggalResep)}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Data Pasien */}
          <div style={{ border: "1px solid #999", borderRadius: 4, padding: "8px 12px", marginBottom: 14, background: "#fafafa" }}>
            <div style={{ fontSize: 10, fontWeight: "bold", color: "#555", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, borderBottom: "0.5px solid #ddd", paddingBottom: 3 }}>
              📋 Data Pasien
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 20px" }}>
              {[
                ["Nama Pasien", pasien.nama || "-"],
                ["Umur", pasien.umur ? `${pasien.umur} tahun` : "-"],
                ["Jenis Kelamin", pasien.jenisKelamin === "L" ? "Laki-laki" : pasien.jenisKelamin === "P" ? "Perempuan" : "-"],
                ["No. Rekam Medis", pasien.nomorRekamMedis || "-"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", gap: 6, fontSize: 11.5 }}>
                  <span style={{ color: "#555", minWidth: 80, fontSize: 11, flexShrink: 0 }}>{label}</span>
                  <span style={{ color: "#555", flexShrink: 0 }}>:</span>
                  <span style={{ fontWeight: 500 }}>{value}</span>
                </div>
              ))}
              {pasien.alamat && (
                <div style={{ display: "flex", gap: 6, fontSize: 11.5, gridColumn: "1 / -1" }}>
                  <span style={{ color: "#555", minWidth: 80, fontSize: 11, flexShrink: 0 }}>Alamat</span>
                  <span style={{ color: "#555", flexShrink: 0 }}>:</span>
                  <span style={{ fontWeight: 500 }}>{pasien.alamat}</span>
                </div>
              )}
            </div>
          </div>

          {/* Daftar Obat — tanpa header tulisan, langsung isi */}
          <div style={{ marginBottom: 14, borderTop: "1px solid #333", paddingTop: 8 }}>
            {obat.length === 0 ? (
              <div style={{ color: "#999", fontStyle: "italic", fontSize: 11, padding: "8px 0" }}>Tidak ada obat.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {obat.map((item, i) => renderObatItem(item, i))}
              </div>
            )}
          </div>

          {/* Keterangan */}
          {(keterangan || catatanTambahan) && (
            <div style={{ border: "0.8px solid #ccc", borderRadius: 4, padding: "8px 12px", marginBottom: 14, fontSize: 11.5, color: "#333" }}>
              {keterangan && <div><strong>Keterangan:</strong> {keterangan}</div>}
              {catatanTambahan && <div style={{ marginTop: 4 }}><strong>Catatan:</strong> {catatanTambahan}</div>}
            </div>
          )}

          {/* TTD Apoteker */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, paddingTop: 10, borderTop: "1px solid #999" }}>
            <div style={{ textAlign: "center", minWidth: 120 }}>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>{pharmacistTitle || "Apoteker"}</div>
              <div style={{ height: 40 }}></div>
              <div style={{ fontSize: 12, fontWeight: "bold", borderTop: "1px solid #000", paddingTop: 3 }}>
                {pharmacistName || "Apoteker"}
              </div>
              {pharmacistSIPA && <div style={{ fontSize: 10.5, color: "#555", marginTop: 1 }}>SIPA: {pharmacistSIPA}</div>}
            </div>
          </div>

          {/* Footer */}
          {(footerNote || footerLegal || footerExtra) && (
            <div style={{ marginTop: 14, paddingTop: 8, borderTop: "0.5px solid #ccc", textAlign: "center" }}>
              {footerNote && <div style={{ fontSize: 10.5, color: "#555", marginBottom: 2 }}>{footerNote}</div>}
              {footerLegal && <div style={{ fontSize: 10, color: "#777", fontStyle: "italic" }}>{footerLegal}</div>}
              {footerExtra && <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{footerExtra}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
