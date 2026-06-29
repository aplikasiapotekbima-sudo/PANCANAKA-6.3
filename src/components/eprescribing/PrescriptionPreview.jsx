import { printPrescription } from "../../utils/print/printPrescription";

function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function PrescriptionPreview({ prescription, printSettings, onClose }) {
  const handlePrint = () => {
    printPrescription(prescription, printSettings);
  };

  const {
    patientName,
    patientAge,
    patientGender,
    patientWeight,
    diagnosis,
    allergies,
    doctorNotes,
    medicines = [],
    prescriptionNumber,
    date,
    selectedDoctor,
  } = prescription;

  const {
    clinicName = "Klinik",
    clinicAddress = "",
    clinicPhone = "",
    doctorName = "",
    doctorSIP = "",
    logo = "",
    footer = "",
    fontSize = 11,
  } = printSettings || {};

  const doctorDisplay = selectedDoctor?.name || doctorName;
  const sipDisplay = selectedDoctor?.sip || doctorSIP;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        gap: 20,
        flexWrap: "wrap",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Action Panel */}
      <div
        style={{
          background: "var(--color-background-primary)",
          borderRadius: 12,
          border: "0.5px solid var(--color-border-tertiary)",
          width: 240,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignSelf: "flex-start",
          marginTop: 40,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: "var(--color-text-primary)" }}>
          🖨️ Cetak Resep
        </div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 4 }}>
          Ukuran kertas: <strong>10.5 × 16.5 cm</strong>
          <br />
          Pastikan pilih ukuran kertas yang sesuai di dialog cetak.
        </div>

        <button
          onClick={handlePrint}
          style={{
            padding: "11px 0",
            background: "#1240ab",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          🖨️ Cetak Sekarang
        </button>

        <button
          onClick={onClose}
          style={{
            padding: "10px 0",
            background: "var(--color-background-secondary)",
            color: "var(--color-text-primary)",
            border: "0.5px solid var(--color-border-secondary)",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          ✕ Tutup
        </button>

        <div
          style={{
            marginTop: 6,
            padding: "8px 10px",
            background: "#fbf1d9",
            border: "0.5px solid #ffd470",
            borderRadius: 6,
            fontSize: 11,
            color: "#8a6206",
            lineHeight: 1.5,
          }}
        >
          💡 Gunakan <strong>Ctrl+P</strong> atau tombol Cetak di atas. Set margin printer ke <strong>None/Minimal</strong>.
        </div>
      </div>

      {/* Prescription Paper Preview */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #ccc",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          width: "10.5cm",
          minHeight: "16.5cm",
          padding: `${printSettings?.marginTop || 8}mm ${printSettings?.marginRight || 8}mm ${printSettings?.marginBottom || 8}mm ${printSettings?.marginLeft || 8}mm`,
          fontFamily: "'Times New Roman', Times, serif",
          fontSize: `${fontSize || 11}px`,
          color: "#000",
          lineHeight: 1.4,
          position: "relative",
          overflowHidden: "hidden",
        }}
      >
        {/* KOP */}
        <div style={{ textAlign: "center", borderBottom: "1.5px solid #000", paddingBottom: 5, marginBottom: 5 }}>
          {logo && (
            <img src={logo} alt="logo" style={{ maxWidth: 55, maxHeight: 40, display: "block", margin: "0 auto 3px" }} />
          )}
          <div style={{ fontSize: Math.round(fontSize * 1.3), fontWeight: "bold", letterSpacing: 0.5, textTransform: "uppercase" }}>
            {clinicName}
          </div>
          {clinicAddress && (
            <div style={{ fontSize: Math.round(fontSize * 0.9), color: "#333", marginTop: 1 }}>{clinicAddress}</div>
          )}
          {clinicPhone && (
            <div style={{ fontSize: Math.round(fontSize * 0.9), color: "#333" }}>Telp: {clinicPhone}</div>
          )}
          {doctorDisplay && (
            <div style={{ fontSize: Math.round(fontSize * 1.05), fontWeight: "bold", marginTop: 3 }}>{doctorDisplay}</div>
          )}
          {sipDisplay && (
            <div style={{ fontSize: Math.round(fontSize * 0.85), color: "#444" }}>SIP: {sipDisplay}</div>
          )}
        </div>

        {/* No Resep + Tanggal */}
        {prescriptionNumber && (
          <div style={{ fontSize: Math.round(fontSize * 0.82), color: "#888", textAlign: "right", marginBottom: 2 }}>
            No. Resep: {prescriptionNumber}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", fontSize: Math.round(fontSize * 0.9), marginBottom: 4, color: "#444" }}>
          {formatDate(date)}
        </div>

        {/* Pasien */}
        <div style={{ border: "0.8px solid #999", borderRadius: 3, padding: "4px 6px", marginBottom: 6, background: "#fafafa" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 2, fontSize: Math.round(fontSize * 0.9) }}>
            <span style={{ color: "#555", minWidth: 60 }}>Nama</span>
            <span>:</span>
            <span style={{ fontWeight: 500 }}>{patientName || "-"}</span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", gap: 4, flex: 1, fontSize: Math.round(fontSize * 0.9) }}>
              <span style={{ color: "#555", minWidth: 40 }}>Umur</span>
              <span>:</span>
              <span style={{ fontWeight: 500 }}>{patientAge ? `${patientAge} thn` : "-"}</span>
            </div>
            {patientWeight && (
              <div style={{ display: "flex", gap: 4, flex: 1, fontSize: Math.round(fontSize * 0.9) }}>
                <span style={{ color: "#555", minWidth: 20 }}>BB</span>
                <span>:</span>
                <span style={{ fontWeight: 500 }}>{patientWeight} kg</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 2, fontSize: Math.round(fontSize * 0.9) }}>
            <span style={{ color: "#555", minWidth: 85 }}>Jenis Kelamin</span>
            <span>:</span>
            <span style={{ fontWeight: 500 }}>{patientGender === "L" ? "Laki-laki" : patientGender === "P" ? "Perempuan" : "-"}</span>
          </div>
          {allergies && (
            <div style={{ display: "flex", gap: 4, marginTop: 2, fontSize: Math.round(fontSize * 0.9), color: "#cc000a" }}>
              <span style={{ minWidth: 60 }}>Alergi</span>
              <span>:</span>
              <span style={{ fontWeight: 500 }}>{allergies}</span>
            </div>
          )}
        </div>

        {/* Diagnosis */}
        {diagnosis && (
          <div style={{ fontSize: Math.round(fontSize * 0.9), borderLeft: "2px solid #333", paddingLeft: 6, background: "#f5f5f5", padding: "3px 6px", marginBottom: 4 }}>
            <strong>Dx:</strong> {diagnosis}
          </div>
        )}

        {/* Daftar Obat */}
        <div style={{ minHeight: 50, marginBottom: 6 }}>
          {medicines.length === 0 && (
            <div style={{ color: "#999", fontStyle: "italic", fontSize: 10, padding: "4px 0" }}>Belum ada obat.</div>
          )}
          {medicines.map((med, i) => (
            <div key={i} style={{ display: "flex", gap: 4, marginBottom: 6, paddingBottom: 4, borderBottom: i < medicines.length - 1 ? "0.5px dashed #ccc" : "none" }}>
              <div style={{ fontWeight: "bold", minWidth: 20, fontSize: Math.round(fontSize * 0.95) }}>R/</div>
              <div style={{ flex: 1 }}>
                {med.text ? (
                  /* Format freestyle */
                  <pre style={{ margin: 0, fontFamily: "inherit", fontSize: Math.round(fontSize * 0.95), lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#111" }}>
                    {med.text}
                  </pre>
                ) : (
                  /* Format lama terstruktur */
                  <>
                    <div style={{ fontWeight: "bold", fontSize: Math.round(fontSize * 1.0) }}>
                      {med.name}{med.strength ? ` ${med.strength}` : ""}
                    </div>
                    <div style={{ fontSize: Math.round(fontSize * 0.9), color: "#222", marginTop: 1 }}>
                      <em><strong>S.</strong></em> {med.signa || "-"}
                      {med.quantity && <strong style={{ marginLeft: 6 }}>#{med.quantity}</strong>}
                    </div>
                    {med.notes && (
                      <div style={{ fontSize: Math.round(fontSize * 0.82), color: "#555", fontStyle: "italic", marginTop: 1 }}>
                        {med.notes}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Catatan Dokter */}
        {doctorNotes && (
          <div style={{ fontSize: Math.round(fontSize * 0.9), borderTop: "0.5px dashed #999", paddingTop: 4, marginTop: 4, color: "#333", fontStyle: "italic" }}>
            <strong>Catatan:</strong> {doctorNotes}
          </div>
        )}

        {/* TTD */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, borderTop: "0.8px solid #999", paddingTop: 5 }}>
          <div style={{ textAlign: "center", minWidth: 80 }}>
            <div style={{ height: 28 }}></div>
            <div style={{ fontSize: Math.round(fontSize * 0.88), fontWeight: "bold", borderTop: "0.8px solid #000", paddingTop: 2 }}>
              {doctorDisplay || "Dokter"}
            </div>
            {sipDisplay && (
              <div style={{ fontSize: Math.round(fontSize * 0.8), color: "#555" }}>SIP: {sipDisplay}</div>
            )}
          </div>
        </div>

        {/* Footer */}
        {footer && (
          <div style={{ textAlign: "center", marginTop: 5, fontSize: Math.round(fontSize * 0.82), color: "#666", borderTop: "0.5px solid #ccc", paddingTop: 3 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
