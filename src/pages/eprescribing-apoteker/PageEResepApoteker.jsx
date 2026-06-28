import { useState, useEffect } from "react";
import PrescriptionPreview from "../../components/eprescribing/PrescriptionPreview";
import { RxStatusBadge } from "../eprescribing-dokter/PageEResepDokter";
import { softDeletePrescription } from "../../lib/patientsApi";

// ── helpers ──────────────────────────────────────────────────────
function fmtDateTime(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_FLOW = [
  { key: "MENUNGGU_DISPENSING", label: "Menunggu Dispensing", icon: "⏳" },
  { key: "SEDANG_DISIAPKAN",    label: "Sedang Disiapkan",    icon: "⚗️" },
  { key: "SIAP_DIAMBIL",        label: "Siap Diambil",        icon: "✅" },
  { key: "SUDAH_DISERAHKAN",    label: "Sudah Diserahkan",    icon: "🤝" },
];

// ── Detail Modal ─────────────────────────────────────────────────
function DetailModal({ rx, onClose, onStatusChange, printSettings }) {
  const [showPrint, setShowPrint] = useState(false);

  const currentIdx = STATUS_FLOW.findIndex(s => s.key === rx.status);
  const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;

  const handleStatusChange = (newStatus) => {
    onStatusChange(rx.id, newStatus);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 20,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#fff", borderRadius: 14, width: "100%", maxWidth: 680,
        maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        {/* Modal Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1.5px solid var(--border-mid)", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, background: "#fff", zIndex: 10, borderRadius: "14px 14px 0 0" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: "var(--brand)" }}>{rx.prescriptionNumber}</span>
              <RxStatusBadge status={rx.status} />
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>{fmtDateTime(rx.createdAt)}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "var(--text-muted)", padding: "0 4px", lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Data Pasien */}
          <section>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>👤 Data Pasien</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                ["Nama Pasien", rx.patientName, true],
                ["Dokter", rx.selectedDoctor?.name || "-"],
                ["Umur", rx.patientAge ? `${rx.patientAge} tahun` : "-"],
                ["Jenis Kelamin", rx.patientGender === "L" ? "Laki-laki" : "Perempuan"],
                ["Berat Badan", rx.patientWeight ? `${rx.patientWeight} kg` : "-"],
                ["No. RM", rx.patientRM || "-"],
                ["Tanggal Resep", rx.date || "-"],
                ["Diagnosis", rx.diagnosis || "-", false, true],
              ].map(([label, val, bold, wide]) => (
                <div key={label} style={wide ? { gridColumn: "1 / -1" } : {}}>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13.5, fontWeight: bold ? 700 : 500, color: "var(--text-primary)" }}>{val || "-"}</div>
                </div>
              ))}
            </div>

            {rx.allergies && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--red-bg)", border: "1.5px solid var(--red-border)", borderRadius: "var(--r-sm)" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--red-text)" }}>⚠️ Alergi: </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#b91c1c" }}>{rx.allergies}</span>
              </div>
            )}
          </section>

          {/* Daftar Obat */}
          <section>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>💊 Daftar Obat ({rx.medicines?.length || 0})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(rx.medicines || []).map((med, i) => (
                <div key={i} style={{ background: "var(--bg-input)", border: "1.5px solid var(--border-mid)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
                  {/* Header: nomor + racikan badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderBottom: "1px solid var(--border-mid)", background: "#f8fafc" }}>
                    <span style={{ width: 22, height: 22, background: "var(--brand)", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    {med.compounded && (
                      <span style={{ fontSize: 11, background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e", borderRadius: 10, padding: "1px 8px", fontWeight: 600 }}>🧪 Racikan</span>
                    )}
                  </div>
                  {/* Isi resep — freestyle text atau format lama */}
                  <div style={{ padding: "10px 14px" }}>
                    {med.text ? (
                      /* Format baru: freestyle */
                      <pre style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, fontFamily: "var(--font)", color: "var(--text-primary)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {med.text}
                      </pre>
                    ) : (
                      /* Format lama: field terstruktur */
                      <>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 4 }}>
                          {med.name}{med.strength ? ` ${med.strength}` : ""}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
                          {med.quantity && <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>📦 <strong>{med.quantity} {med.unit || ""}</strong></span>}
                          {med.signa && <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>📝 {med.signa}</span>}
                          {med.notes && <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>💬 {med.notes}</span>}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Catatan Dokter */}
          {rx.notesForPharmacist && (
            <section>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>💬 Catatan Dokter untuk Apoteker</div>
              <div style={{ padding: "14px 16px", background: "#fffbeb", border: "2px solid #f59e0b", borderRadius: "var(--r-sm)", fontSize: 13.5, lineHeight: 1.7, color: "#78350f", whiteSpace: "pre-wrap" }}>
                {rx.notesForPharmacist}
              </div>
            </section>
          )}

          {/* Status workflow */}
          <section>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>🔄 Status Dispensing</div>
            {/* Progress bar */}
            <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
              {STATUS_FLOW.map((s, i) => {
                const idx = STATUS_FLOW.findIndex(x => x.key === rx.status);
                const done = i <= idx;
                const current = i === idx;
                return (
                  <div key={s.key} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {i > 0 && <div style={{ flex: 1, height: 3, background: done ? "var(--brand)" : "var(--border-mid)", transition: "background 0.3s" }} />}
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                        background: done ? "var(--brand)" : "var(--bg-input)",
                        border: `2.5px solid ${current ? "var(--brand)" : done ? "var(--brand)" : "var(--border-mid)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, transition: "all 0.3s",
                        boxShadow: current ? "0 0 0 4px var(--brand-light)" : "none",
                      }}>
                        {done ? (i < idx ? "✓" : s.icon) : <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>{i + 1}</span>}
                      </div>
                      {i < STATUS_FLOW.length - 1 && <div style={{ flex: 1, height: 3, background: i < idx ? "var(--brand)" : "var(--border-mid)", transition: "background 0.3s" }} />}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: current ? 700 : 500, color: current ? "var(--brand)" : "var(--text-muted)", marginTop: 6, lineHeight: 1.3 }}>{s.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Status buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {nextStatus && (
                <button
                  onClick={() => handleStatusChange(nextStatus.key)}
                  className="kk-btn kk-btn-primary kk-btn-lg kk-btn-block"
                >
                  {nextStatus.icon} Tandai: {nextStatus.label}
                </button>
              )}
              {rx.status === "SUDAH_DISERAHKAN" && (
                <div style={{ textAlign: "center", padding: "10px", fontSize: 13, color: "var(--text-muted)" }}>✅ Resep sudah selesai diserahkan</div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                {STATUS_FLOW.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => handleStatusChange(s.key)}
                    style={{
                      padding: "6px 8px", border: `1.5px solid ${rx.status === s.key ? "var(--brand)" : "var(--border-mid)"}`,
                      borderRadius: "var(--r-sm)", background: rx.status === s.key ? "var(--blue-bg)" : "#fff",
                      cursor: "pointer", fontSize: 11, fontWeight: rx.status === s.key ? 700 : 400,
                      color: rx.status === s.key ? "var(--brand)" : "var(--text-secondary)",
                      transition: "all 0.15s",
                    }}
                  >
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Footer buttons */}
        <div style={{ padding: "14px 24px", borderTop: "1.5px solid var(--border-mid)", display: "flex", gap: 8, background: "#fafafa", borderRadius: "0 0 14px 14px", flexWrap: "wrap" }}>
          <button className="kk-btn kk-btn-primary" onClick={() => setShowPrint(true)}>🖨️ Print Resep</button>
          <button className="kk-btn kk-btn-secondary" style={{ marginLeft: "auto" }} onClick={onClose}>Tutup</button>
        </div>
      </div>

      {showPrint && <PrescriptionPreview prescription={rx} printSettings={printSettings} onClose={() => setShowPrint(false)} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
export default function PageEResepApoteker({
  prescriptions,
  setPrescriptions,
  doctors,
  printSettings,
}) {
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterDate, setFilterDate] = useState("today");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [selectedRx, setSelectedRx] = useState(null);
  const [newCount, setNewCount] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleDelete = async (id) => {
    await softDeletePrescription(id); // tetap ada di DB (deleted_at terisi) + tercatat di audit_log
    setPrescriptions((prev) => prev.filter((p) => p.id !== id));
    setDeleteConfirm(null);
    setSelectedRx((prev) => (prev && prev.id === id ? null : prev));
  };

  // Hitung resep baru (menunggu dispensing)
  const waitingCount = prescriptions.filter(rx => (rx.status || "MENUNGGU_DISPENSING") === "MENUNGGU_DISPENSING").length;

  // Auto refresh badge effect
  useEffect(() => {
    setNewCount(waitingCount);
  }, [waitingCount]);

  // Filter
  const today = new Date().toISOString().slice(0, 10);
  // Normalisasi: resep lama tanpa status → MENUNGGU_DISPENSING
  const normalizeStatus = (rx) => ({ ...rx, status: rx.status || "MENUNGGU_DISPENSING" });
  const normalizedPrescriptions = prescriptions.map(normalizeStatus);

  const filtered = normalizedPrescriptions.filter((rx) => {
    // Date filter
    if (filterDate === "today") {
      if (!rx.createdAt?.startsWith(today)) return false;
    }
    // Status filter
    if (filterStatus !== "ALL" && rx.status !== filterStatus) return false;
    // Doctor filter
    if (filterDoctor && rx.selectedDoctor?.id !== filterDoctor && rx.doctorId !== filterDoctor) return false;
    // Search
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (
        !rx.patientName?.toLowerCase().includes(q) &&
        !rx.prescriptionNumber?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const handleStatusChange = (rxId, newStatus) => {
    setPrescriptions((prev) =>
      prev.map((rx) =>
        rx.id === rxId
          ? { ...rx, status: newStatus, updatedAt: new Date().toISOString() }
          : rx
      )
    );
    // Update selected modal data too
    setSelectedRx((prev) => prev ? { ...prev, status: newStatus, updatedAt: new Date().toISOString() } : null);
  };

  const statusCounts = STATUS_FLOW.reduce((acc, s) => {
    acc[s.key] = normalizedPrescriptions.filter(rx => rx.status === s.key).length;
    return acc;
  }, {});

  const cardStyle = {
    background: "var(--bg-card)",
    border: "1.5px solid var(--border-mid)",
    borderRadius: "var(--r-lg)",
    padding: "18px 20px",
    boxShadow: "var(--shadow-sm)",
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 48 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            ⚗️ Dashboard Apoteker
          </h2>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>
            Kelola resep masuk dari dokter — siapkan &amp; update status dispensing
          </div>
        </div>
        {waitingCount > 0 && (
          <div style={{ marginLeft: "auto", padding: "8px 16px", background: "#fef3c7", border: "2px solid #f59e0b", borderRadius: "var(--r-md)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>⏳</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#92400e" }}>{waitingCount} Resep Menunggu</div>
              <div style={{ fontSize: 11.5, color: "#b45309" }}>Perlu segera disiapkan</div>
            </div>
          </div>
        )}
      </div>

      {/* Status summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {STATUS_FLOW.map((s) => {
          const count = statusCounts[s.key] || 0;
          const isActive = filterStatus === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setFilterStatus(isActive ? "ALL" : s.key)}
              style={{
                ...cardStyle,
                cursor: "pointer",
                textAlign: "left",
                border: `2px solid ${isActive ? "var(--brand)" : "var(--border-mid)"}`,
                background: isActive ? "var(--blue-bg)" : "var(--bg-card)",
                transition: "all 0.15s",
                padding: "14px 16px",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: isActive ? "var(--brand)" : count > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>{count}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: isActive ? "var(--brand)" : "var(--text-secondary)", marginTop: 2 }}>{s.label}</div>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <input
            className="kk-input"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="🔍 Nama pasien / no. resep..."
            style={{ fontSize: 13, minWidth: 200, flex: 1 }}
          />

          {/* Date filter */}
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { key: "today", label: "Hari Ini" },
              { key: "all",   label: "Semua" },
            ].map((d) => (
              <button
                key={d.key}
                onClick={() => setFilterDate(d.key)}
                style={{
                  padding: "7px 14px", borderRadius: "var(--r-sm)",
                  border: `1.5px solid ${filterDate === d.key ? "var(--brand)" : "var(--border-mid)"}`,
                  background: filterDate === d.key ? "var(--brand)" : "#fff",
                  color: filterDate === d.key ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer", fontSize: 13, fontWeight: 600,
                  transition: "all 0.15s",
                }}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Doctor filter */}
          <select
            className="kk-input"
            value={filterDoctor}
            onChange={(e) => setFilterDoctor(e.target.value)}
            style={{ fontSize: 13, minWidth: 150 }}
          >
            <option value="">Semua Dokter</option>
            {doctors.filter(d => d.active).map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <div style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            {filtered.length} resep
          </div>
        </div>
      </div>

      {/* Prescription table */}
      <div style={cardStyle}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Tidak ada resep ditemukan</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Coba ubah filter atau kata kunci pencarian</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-mid)" }}>
                  {["No. Resep", "Waktu", "Nama Pasien", "Dokter", "Obat", "Status", "Aksi"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((rx, i) => {
                  const isNew = rx.status === "MENUNGGU_DISPENSING";
                  return (
                    <tr
                      key={rx.id}
                      style={{
                        borderBottom: "1.5px solid var(--border-mid)",
                        background: isNew ? "#fffbeb" : i % 2 === 0 ? "#fafafa" : "#fff",
                        transition: "background 0.15s",
                        cursor: "pointer",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                      onMouseLeave={e => e.currentTarget.style.background = isNew ? "#fffbeb" : i % 2 === 0 ? "#fafafa" : "#fff"}
                    >
                      <td style={{ padding: "12px 12px" }}>
                        <div style={{ fontWeight: 700, color: "var(--brand)", fontSize: 13 }}>{rx.prescriptionNumber}</div>
                        {rx.patientRM && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{rx.patientRM}</div>}
                      </td>
                      <td style={{ padding: "12px 12px", color: "var(--text-secondary)", whiteSpace: "nowrap", fontSize: 12.5 }}>
                        {fmtDateTime(rx.createdAt)}
                      </td>
                      <td style={{ padding: "12px 12px" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{rx.patientName}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
                          {rx.patientAge ? `${rx.patientAge} thn` : ""}
                          {rx.patientGender ? ` · ${rx.patientGender === "L" ? "L" : "P"}` : ""}
                          {rx.patientWeight ? ` · ${rx.patientWeight}kg` : ""}
                        </div>
                        {rx.allergies && (
                          <div style={{ fontSize: 11, color: "#b91c1c", fontWeight: 600, marginTop: 2 }}>⚠️ {rx.allergies}</div>
                        )}
                      </td>
                      <td style={{ padding: "12px 12px", color: "var(--text-secondary)", fontSize: 13 }}>
                        {rx.selectedDoctor?.name || "-"}
                      </td>
                      <td style={{ padding: "12px 12px", textAlign: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{rx.medicines?.length || 0}</span>
                        {rx.medicines?.some(m => m.compounded) && (
                          <div style={{ fontSize: 10.5, color: "#92400e", fontWeight: 600 }}>🧪 ada racikan</div>
                        )}
                      </td>
                      <td style={{ padding: "12px 12px" }}>
                        <RxStatusBadge status={rx.status} />
                        {rx.notesForPharmacist && (
                          <div style={{ fontSize: 10.5, color: "#b45309", marginTop: 3, display: "flex", alignItems: "center", gap: 3 }}>
                            <span>💬</span> ada catatan dokter
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 12px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
                          <button
                            onClick={() => setSelectedRx(rx)}
                            className="kk-btn kk-btn-sm kk-btn-primary"
                          >
                            👁️ Detail
                          </button>
                          {/* Quick next status */}
                          {(() => {
                            const idx = STATUS_FLOW.findIndex(s => s.key === rx.status);
                            const next = idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
                            return next ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleStatusChange(rx.id, next.key); }}
                                className="kk-btn kk-btn-sm kk-btn-secondary"
                                title={`Tandai: ${next.label}`}
                              >
                                {next.icon}
                              </button>
                            ) : null;
                          })()}
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(rx); }}
                            className="kk-btn kk-btn-sm kk-btn-secondary"
                            title="Hapus resep ini"
                            style={{ color: "var(--red-text)" }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRx && (
        <DetailModal
          rx={prescriptions.find(rx => rx.id === selectedRx.id) || selectedRx}
          onClose={() => setSelectedRx(null)}
          onStatusChange={handleStatusChange}
          printSettings={printSettings}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1100, padding: 16,
        }} onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 400, padding: 22, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ textAlign: "center", paddingBottom: 18 }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>🗑️</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Yakin ingin menghapus resep ini?</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                <strong style={{ color: "var(--brand)" }}>{deleteConfirm.prescriptionNumber}</strong> · {deleteConfirm.patientName}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--red-text)", background: "var(--red-bg)", border: "1.5px solid var(--red-border)", borderRadius: "var(--r-sm)", padding: "8px 12px" }}>
                ⚠️ Tindakan ini tidak dapat dibatalkan.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="kk-btn kk-btn-danger" style={{ flex: 1 }}>Ya, Hapus</button>
              <button onClick={() => setDeleteConfirm(null)} className="kk-btn kk-btn-secondary" style={{ flex: 1 }}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export STATUS_FLOW for use in other files
export { STATUS_FLOW };
