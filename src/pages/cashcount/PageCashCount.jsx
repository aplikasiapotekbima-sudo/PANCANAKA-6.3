/**
 * PageCashCount — Penghitung Uang / Closing Kas Harian
 * Versi 3.2.5 — Tambah: Modal Pagi, Uang Tunai Masuk, Omset Tunai Sistem,
 *               Selisih Kas, Setor Manajemen, indikator status closing
 */

import { useState, useCallback, useMemo } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DENOMINATIONS = [
  { value: 100000, label: "Rp 100.000" },
  { value:  50000, label: "Rp  50.000" },
  { value:  20000, label: "Rp  20.000" },
  { value:  10000, label: "Rp  10.000" },
  { value:   5000, label: "Rp   5.000" },
  { value:   2000, label: "Rp   2.000" },
  { value:   1000, label: "Rp   1.000" },
  { value:    500, label: "Rp     500" },
  { value:    200, label: "Rp     200" },
  { value:    100, label: "Rp     100" },
];

const OMSET_FIELDS = [
  { key: "omsetKonsulTunai",  label: "Omset Konsultasi Tunai",  group: "OMSET KONSULTASI", method: "Tunai" },
  { key: "omsetKonsulQris",   label: "Omset Konsultasi QRIS",   group: "OMSET KONSULTASI", method: "QRIS"  },
  { key: "omsetObatTunai",    label: "Omset Obat Tunai",         group: "OMSET OBAT",       method: "Tunai" },
  { key: "omsetObatQris",     label: "Omset Obat QRIS",          group: "OMSET OBAT",       method: "QRIS"  },
  { key: "totalTransfer",     label: "Total Transfer",           group: "TRANSFER",         method: ""      },
];

function formatRp(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

function pad(str, len, dir = "right") {
  const s = String(str);
  if (s.length >= len) return s;
  const spaces = " ".repeat(len - s.length);
  return dir === "left" ? spaces + s : s + spaces;
}

// ─── STATUS SELISIH ───────────────────────────────────────────────────────────
function getSelisihStatus(selisih) {
  if (selisih === 0) return { label: "SESUAI",        color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icon: "✅" };
  if (selisih > 0)   return { label: "SELISIH LEBIH", color: "#d97706", bg: "#fffbeb", border: "#fde68a", icon: "⬆️" };
  return               { label: "SELISIH KURANG",     color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: "⬇️" };
}

// ─── PRINT ────────────────────────────────────────────────────────────────────
function buildPrintHTML(record, settings) {
  const {
    tanggal, jam, kasir, pecahan, totalTunai, omset, catatanClosing,
    modalPagi = 0, uangTunaiMasuk = 0, omsetTunaiSistem = 0,
    selisihKas = 0, setorManajemen = 0, modalBesok = 0,
  } = record;
  const { clinicName = "Apotek Bima" } = settings || {};

  const denRows = DENOMINATIONS.map(({ value, label }) => {
    const qty = pecahan[value] || 0;
    const sub = value * qty;
    const valStr = pad(formatRp(value), 9, "left");
    const qtyStr = pad(String(qty), 2, "left");
    const subStr = pad(formatRp(sub), 11, "left");
    return `<div class="row">${valStr} x ${qtyStr} = ${subStr}</div>`;
  }).join("");

  const konsulTunai = omset.omsetKonsulTunai || 0;
  const konsulQris  = omset.omsetKonsulQris  || 0;
  const obatTunai   = omset.omsetObatTunai   || 0;
  const obatQris    = omset.omsetObatQris    || 0;
  const transfer    = omset.totalTransfer    || 0;
  const grandTotal  = totalTunai + konsulQris + obatQris + transfer;

  const status = getSelisihStatus(selisihKas);
  const selisihLabel = selisihKas >= 0
    ? `+Rp ${formatRp(selisihKas)}`
    : `-Rp ${formatRp(Math.abs(selisihKas))}`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<title>Closing Kas — ${tanggal}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 72mm;
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.55;
    color: #000;
    background: #fff;
  }
  .wrap { padding: 4mm 3mm; width: 72mm; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  .divider-solid { border-top: 1px solid #000; margin: 4px 0; }
  .row { white-space: pre; font-family: 'Courier New', Courier, monospace; font-size: 11px; }
  .row-label { display: flex; justify-content: space-between; }
  .gap { margin: 3px 0; }
  .total-row { display: flex; justify-content: space-between; font-weight: 700; font-size: 12px; }
  .grand-total { display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin: 4px 0; }
  .catatan { font-size: 10px; line-height: 1.4; }
  .kas-section { border: 1px solid #000; padding: 4px 6px; margin: 6px 0; }
  .kas-row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 11px; }
  .status-box { text-align: center; border: 1px solid #000; padding: 3px; margin: 4px 0; font-weight: 700; font-size: 12px; }
  @media print {
    body { margin: 0; }
    @page { margin: 0; size: 72mm auto; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="center bold" style="font-size:13px; letter-spacing:0.5px">${clinicName.toUpperCase()}</div>
  <div class="center" style="font-size:10px">CLOSING KAS HARIAN</div>
  <div class="divider-solid"></div>
  <div class="row-label gap"><span>Tanggal</span><span>${tanggal}</span></div>
  <div class="row-label gap"><span>Jam</span><span>${jam}</span></div>
  <div class="row-label gap"><span>Kasir</span><span>${kasir}</span></div>
  <div class="divider-solid"></div>
  <div class="bold gap" style="font-size:11px">RINCIAN PECAHAN</div>
  <div style="margin: 3px 0">
    ${denRows}
  </div>
  <div class="divider"></div>
  <div class="total-row"><span>TOTAL TUNAI FISIK</span><span>Rp ${formatRp(totalTunai)}</span></div>
  <div class="divider-solid"></div>
  <div class="bold gap">OMSET KONSULTASI</div>
  <div class="row-label gap"><span>  Tunai</span><span>Rp ${formatRp(konsulTunai)}</span></div>
  <div class="row-label gap"><span>  QRIS</span><span>Rp ${formatRp(konsulQris)}</span></div>
  <div class="bold gap" style="margin-top:4px">OMSET OBAT</div>
  <div class="row-label gap"><span>  Tunai</span><span>Rp ${formatRp(obatTunai)}</span></div>
  <div class="row-label gap"><span>  QRIS</span><span>Rp ${formatRp(obatQris)}</span></div>
  <div class="divider"></div>
  <div class="row-label gap"><span>TRANSFER</span><span>Rp ${formatRp(transfer)}</span></div>
  <div class="grand-total"><span>GRAND TOTAL</span><span>Rp ${formatRp(grandTotal)}</span></div>
  <div class="divider-solid"></div>
  <div class="bold gap" style="font-size:11px">REKAP KAS</div>
  <div class="kas-section">
    <div class="kas-row"><span>MODAL PAGI      </span><span>Rp ${formatRp(modalPagi)}</span></div>
    <div class="kas-row"><span>TUNAI MASUK     </span><span>Rp ${formatRp(uangTunaiMasuk)}</span></div>
    <div class="kas-row"><span>OMSET TUNAI     </span><span>Rp ${formatRp(omsetTunaiSistem)}</span></div>
    <div style="border-top:1px dashed #000; margin: 3px 0"></div>
    <div class="kas-row bold"><span>SELISIH KAS     </span><span>${selisihLabel}</span></div>
    <div style="border-top:1px dashed #000; margin: 3px 0"></div>
    <div class="kas-row"><span>SETOR MANAJEMEN </span><span>Rp ${formatRp(setorManajemen)}</span></div>
    <div class="kas-row"><span>MODAL BESOK PAGI</span><span>Rp ${formatRp(modalBesok)}</span></div>
  </div>
  <div class="status-box">STATUS: ${status.label}</div>
  ${selisihKas !== 0 ? `<div class="center" style="font-size:10px">⚠ Terdapat selisih kas. Mohon diperiksa.</div>` : ""}
  ${catatanClosing ? `<div class="gap"><div class="bold" style="font-size:10px">Catatan:</div><div class="catatan">${catatanClosing}</div></div>` : ""}
  <div class="divider-solid"></div>
  <div class="center gap">— TERIMA KASIH —</div>
</div>
</body>
</html>`;
}

function doPrint(record, settings) {
  const html = buildPrintHTML(record, settings);
  const win = window.open("", "_blank", "width=320,height=700");
  if (!win) { alert("Popup diblokir. Izinkan popup untuk halaman ini."); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); win.close(); };
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PageCashCount({ cashCounts, setCashCounts, settings }) {
  const initQty   = Object.fromEntries(DENOMINATIONS.map((d) => [d.value, ""]));
  const initOmset = Object.fromEntries(OMSET_FIELDS.map((f) => [f.key, ""]));

  const [qty, setQty]               = useState(initQty);
  const [omset, setOmset]           = useState(initOmset);
  const [catatan, setCatatan]       = useState("");
  const [kasir, setKasir]           = useState("Admin");
  const [view, setView]             = useState("form");
  const [saved, setSaved]           = useState(false);
  const [detailId, setDetailId]     = useState(null);
  const [modalPagi, setModalPagi]   = useState("");
  const [setorMgmt, setSetorMgmt]   = useState("");
  const [modalBesok, setModalBesok] = useState("");

  // ── Computed ──
  const totalTunai = useMemo(() =>
    DENOMINATIONS.reduce((s, d) => s + d.value * (parseInt(qty[d.value]) || 0), 0),
  [qty]);

  const omsetNum = useMemo(() =>
    Object.fromEntries(OMSET_FIELDS.map((f) => [f.key, parseInt(omset[f.key]) || 0])),
  [omset]);

  const grandTotal = useMemo(() =>
    totalTunai +
    (omsetNum.omsetKonsulQris || 0) +
    (omsetNum.omsetObatQris   || 0) +
    (omsetNum.totalTransfer   || 0),
  [totalTunai, omsetNum]);

  // ── Perhitungan lanjutan ──
  const modalPagiNum     = parseInt(modalPagi)   || 0;
  const setorMgmtNum     = parseInt(setorMgmt)   || 0;
  const modalBesokNum    = parseInt(modalBesok)  || 0;
  const uangTunaiMasuk   = totalTunai - modalPagiNum;
  const omsetTunaiSistem = (omsetNum.omsetKonsulTunai || 0) + (omsetNum.omsetObatTunai || 0);
  const selisihKas       = uangTunaiMasuk - omsetTunaiSistem;
  const totalOmsetSistem =
    (omsetNum.omsetKonsulTunai || 0) +
    (omsetNum.omsetKonsulQris  || 0) +
    (omsetNum.omsetObatTunai   || 0) +
    (omsetNum.omsetObatQris    || 0) +
    (omsetNum.totalTransfer    || 0);
  const statusClosing = getSelisihStatus(selisihKas);

  // ── Handlers ──
  const handleQty = useCallback((val, raw) => {
    const v = raw.replace(/[^0-9]/g, "");
    if (parseInt(v) < 0) return;
    setQty((prev) => ({ ...prev, [val]: v }));
    setSaved(false);
  }, []);

  const handleOmset = useCallback((key, raw) => {
    const v = raw.replace(/[^0-9]/g, "");
    setOmset((prev) => ({ ...prev, [key]: v }));
    setSaved(false);
  }, []);

  const handleReset = () => {
    setQty(initQty);
    setOmset(initOmset);
    setCatatan("");
    setModalPagi("");
    setSetorMgmt("");
    setModalBesok("");
    setSaved(false);
  };

  const handleSave = () => {
    const now = new Date();
    const record = {
      id: Date.now(),
      tanggal: now.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }),
      tanggalISO: now.toISOString().slice(0, 10),
      jam: now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      kasir,
      pecahan: Object.fromEntries(DENOMINATIONS.map((d) => [d.value, parseInt(qty[d.value]) || 0])),
      totalTunai,
      omset: omsetNum,
      grandTotal,
      catatanClosing: catatan,
      // ── Field baru ──
      modal_pagi:          modalPagiNum,
      uang_tunai_masuk:    uangTunaiMasuk,
      omset_tunai_sistem:  omsetTunaiSistem,
      total_omset_sistem:  totalOmsetSistem,
      selisih_kas:         selisihKas,
      setor_manajemen:     setorMgmtNum,
      modal_besok:         modalBesokNum,
      status_closing:      statusClosing.label,
      // alias ringkas untuk kompabilitas tampilan lama
      modalPagi:           modalPagiNum,
      uangTunaiMasuk,
      omsetTunaiSistem,
      selisihKas,
      setorManajemen:      setorMgmtNum,
      modalBesok:          modalBesokNum,
      statusClosing:       statusClosing.label,
      createdAt: now.toISOString(),
    };
    setCashCounts((prev) => [record, ...(prev || [])]);
    setSaved(true);
  };

  const handlePrint = () => {
    const now = new Date();
    const record = {
      tanggal: now.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }),
      jam: now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      kasir,
      pecahan: Object.fromEntries(DENOMINATIONS.map((d) => [d.value, parseInt(qty[d.value]) || 0])),
      totalTunai,
      omset: omsetNum,
      grandTotal,
      catatanClosing: catatan,
      modalPagi:          modalPagiNum,
      uangTunaiMasuk,
      omsetTunaiSistem,
      selisihKas,
      setorManajemen:     setorMgmtNum,
      modalBesok:          modalBesokNum,
    };
    doPrint(record, settings);
  };

  const handlePrintRecord = (rec) => doPrint(rec, settings);
  const detailRecord = detailId ? (cashCounts || []).find((r) => r.id === detailId) : null;

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", paddingBottom: 48 }}>

      {/* Header & sub-tabs */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
          🧮 Penghitung Uang / Closing Kas
        </h3>
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1.5px solid var(--border-strong)" }}>
          {[{ id: "form", label: "Input Closing" }, { id: "history", label: `Riwayat (${(cashCounts || []).length})` }].map((t) => (
            <button key={t.id} onClick={() => setView(t.id)} style={{
              padding: "7px 16px", border: "none", cursor: "pointer",
              background: view === t.id ? "var(--brand)" : "var(--bg-card)",
              color: view === t.id ? "#fff" : "var(--text-secondary)",
              fontSize: 13, fontWeight: view === t.id ? 600 : 400,
              fontFamily: "var(--font)",
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── FORM TAB ── */}
      {view === "form" && (
        <>
          {/* Kasir input */}
          <div style={{ background: "var(--bg-card)", borderRadius: 10, border: "1.5px solid var(--border-mid)", padding: 16, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={labelStyle}>Nama Kasir</label>
                <input className="kk-input" value={kasir} onChange={(e) => setKasir(e.target.value)} placeholder="Nama kasir..." style={{ fontSize: 13 }} />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={labelStyle}>Tanggal / Jam</label>
                <div style={{ padding: "9px 12px", background: "var(--bg-input)", borderRadius: 6, border: "1.5px solid var(--border-mid)", color: "var(--text-primary)", fontSize: 13 }}>
                  {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  {" — "}
                  {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          </div>

          {/* Modal Pagi */}
          <div style={{ background: "var(--bg-card)", borderRadius: 10, border: "1.5px solid var(--border-mid)", padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Kas Harian — Modal Awal</div>
            <div>
              <label style={labelStyle}>💰 Modal Pagi (uang awal kas)</label>
              <div style={{ position: "relative", maxWidth: 260 }}>
                <span style={rpPrefixStyle}>Rp</span>
                <input
                  type="number" min="0"
                  value={modalPagi}
                  onChange={(e) => { setModalPagi(e.target.value.replace(/[^0-9]/g, "")); setSaved(false); }}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="kk-input"
                  style={{ paddingLeft: 32, fontSize: 13, textAlign: "right" }}
                />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Uang yang ada di laci saat buka apotek</div>
            </div>
          </div>

          {/* Denomination table */}
          <div style={{ background: "var(--bg-card)", borderRadius: 10, border: "1.5px solid var(--border-mid)", overflow: "hidden", marginBottom: 14 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1.5px solid var(--border-mid)", background: "var(--bg-input)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Rincian Pecahan Uang</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-input)", borderBottom: "1px solid var(--border-mid)" }}>
                  <th style={th("left")}>Pecahan</th>
                  <th style={th("center", 100)}>Qty</th>
                  <th style={th("right")}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {DENOMINATIONS.map((d, i) => {
                  const q = parseInt(qty[d.value]) || 0;
                  const sub = d.value * q;
                  return (
                    <tr key={d.value} style={{ borderBottom: "1px solid var(--border-light)", background: q > 0 ? "var(--bg-selected)" : i % 2 === 0 ? "#fff" : "var(--bg-input)" }}>
                      <td style={td("left")}>
                        <span style={{ fontFamily: "'Courier New', monospace", fontSize: 13, fontWeight: q > 0 ? 700 : 400, color: q > 0 ? "var(--brand)" : "var(--text-primary)" }}>{d.label}</span>
                      </td>
                      <td style={td("center", 100)}>
                        <input
                          type="number" min="0"
                          value={qty[d.value]}
                          onChange={(e) => handleQty(d.value, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          placeholder="0"
                          style={{ width: 70, padding: "5px 8px", textAlign: "right", borderRadius: 6, border: "1.5px solid var(--border-strong)", background: "#fff", fontSize: 13, fontFamily: "var(--font)", color: "var(--text-primary)" }}
                        />
                      </td>
                      <td style={{ ...td("right"), fontFamily: "'Courier New', monospace", fontSize: 13, fontWeight: sub > 0 ? 600 : 400, color: sub > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                        {sub > 0 ? `Rp ${formatRp(sub)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--brand)", color: "#fff" }}>
                  <td colSpan={2} style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700 }}>TOTAL TUNAI FISIK</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 14, fontWeight: 700, fontFamily: "'Courier New', monospace" }}>
                    Rp {formatRp(totalTunai)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Omset section */}
          <div style={{ background: "var(--bg-card)", borderRadius: 10, border: "1.5px solid var(--border-mid)", overflow: "hidden", marginBottom: 14 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1.5px solid var(--border-mid)", background: "var(--bg-input)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Data Omset & Metode Pembayaran</span>
            </div>
            <div style={{ padding: 16, display: "grid", gap: 12 }}>
              <div>
                <div style={sectionLabelStyle}>Omset Konsultasi</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {OMSET_FIELDS.filter((f) => f.group === "OMSET KONSULTASI").map((f) => (
                    <OmsetInput key={f.key} field={f} value={omset[f.key]} onChange={handleOmset} />
                  ))}
                </div>
              </div>
              <div>
                <div style={sectionLabelStyle}>Omset Obat</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {OMSET_FIELDS.filter((f) => f.group === "OMSET OBAT").map((f) => (
                    <OmsetInput key={f.key} field={f} value={omset[f.key]} onChange={handleOmset} />
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", maxWidth: 280 }}>
                {OMSET_FIELDS.filter((f) => f.group === "TRANSFER").map((f) => (
                  <OmsetInput key={f.key} field={f} value={omset[f.key]} onChange={handleOmset} />
                ))}
              </div>
            </div>
          </div>

          {/* Catatan */}
          <div style={{ background: "var(--bg-card)", borderRadius: 10, border: "1.5px solid var(--border-mid)", padding: 16, marginBottom: 14 }}>
            <label style={labelStyle}>Catatan Closing</label>
            <textarea
              className="kk-input"
              value={catatan}
              onChange={(e) => { setCatatan(e.target.value); setSaved(false); }}
              placeholder="Mis: Closing shift malam, ada selisih Rp 5.000..."
              rows={3}
              style={{ resize: "vertical", fontSize: 13, lineHeight: 1.5 }}
            />
          </div>

          {/* Grand Total Summary */}
          <GrandTotalCard
            totalTunai={totalTunai}
            omsetNum={omsetNum}
            grandTotal={grandTotal}
            modalPagi={modalPagiNum}
            uangTunaiMasuk={uangTunaiMasuk}
            omsetTunaiSistem={omsetTunaiSistem}
            totalOmsetSistem={totalOmsetSistem}
            selisihKas={selisihKas}
            setorManajemen={setorMgmtNum}
            modalBesok={modalBesokNum}
            statusClosing={statusClosing}
          />

          {/* Selisih Warning */}
          {selisihKas !== 0 && (totalTunai > 0 || omsetTunaiSistem > 0) && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: statusClosing.bg, border: `1.5px solid ${statusClosing.border}`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>{statusClosing.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: statusClosing.color }}>
                  ⚠ {statusClosing.label}: Rp {formatRp(Math.abs(selisihKas))}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  Terdapat selisih kas. Periksa kembali sebelum menyimpan. Anda tetap dapat menyimpan data ini.
                </div>
              </div>
            </div>
          )}

          {/* Setor Manajemen + Modal Besok — last step closing */}
          <div style={{ background: "var(--bg-card)", borderRadius: 10, border: "2px solid #7c3aed", padding: 16, marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              🏁 Langkah Akhir Closing
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
              Isi setelah memastikan tidak ada selisih kas.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>🏦 Setor ke Manajemen</label>
                <div style={{ position: "relative" }}>
                  <span style={rpPrefixStyle}>Rp</span>
                  <input
                    type="number" min="0"
                    value={setorMgmt}
                    onChange={(e) => { setSetorMgmt(e.target.value.replace(/[^0-9]/g, "")); setSaved(false); }}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="kk-input"
                    style={{ paddingLeft: 32, fontSize: 13, textAlign: "right" }}
                  />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Nominal yang diserahkan ke manajemen</div>
              </div>
              <div>
                <label style={labelStyle}>🌅 Modal untuk Besok Pagi</label>
                <div style={{ position: "relative" }}>
                  <span style={rpPrefixStyle}>Rp</span>
                  <input
                    type="number" min="0"
                    value={modalBesok}
                    onChange={(e) => { setModalBesok(e.target.value.replace(/[^0-9]/g, "")); setSaved(false); }}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="kk-input"
                    style={{ paddingLeft: 32, fontSize: 13, textAlign: "right" }}
                  />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Uang yang ditinggal untuk modal besok</div>
              </div>
            </div>
            {(setorMgmtNum > 0 || modalBesokNum > 0) && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(124,58,237,0.05)", border: "1px solid #ddd6fe", borderRadius: 8, fontSize: 12.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Setor Manajemen</span>
                  <span style={{ fontFamily: "monospace", color: "#7c3aed", fontWeight: 600 }}>Rp {formatRp(setorMgmtNum)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Modal Besok Pagi</span>
                  <span style={{ fontFamily: "monospace", color: "#0284c7", fontWeight: 600 }}>Rp {formatRp(modalBesokNum)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #ddd6fe", paddingTop: 6, marginTop: 4 }}>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Total Keluar Kas</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: (setorMgmtNum + modalBesokNum) > 0 ? "#1f2937" : "var(--text-muted)" }}>Rp {formatRp(setorMgmtNum + modalBesokNum)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button className="kk-btn kk-btn-primary kk-btn-lg" onClick={handleSave} style={{ flex: 1, minWidth: 140 }}>
              💾 Simpan Closing
            </button>
            <button className="kk-btn kk-btn-secondary kk-btn-lg" onClick={handlePrint} style={{ flex: 1, minWidth: 140 }}>
              🖨️ Print Struk
            </button>
            <button className="kk-btn kk-btn-ghost" onClick={handleReset} style={{ padding: "12px 18px", fontSize: 13 }}>
              🔄 Reset
            </button>
          </div>

          {saved && (
            <div style={{ marginTop: 12, padding: "10px 16px", background: "var(--green-bg)", border: "1px solid var(--green-border)", borderRadius: 8, color: "var(--green-text)", fontSize: 13, fontWeight: 500 }}>
              ✅ Data closing berhasil disimpan ke riwayat.
            </div>
          )}
        </>
      )}

      {/* ── HISTORY TAB ── */}
      {view === "history" && (
        <HistoryView
          cashCounts={cashCounts || []}
          onPrint={handlePrintRecord}
          detailId={detailId}
          setDetailId={setDetailId}
          detailRecord={detailRecord}
          setCashCounts={setCashCounts}
        />
      )}
    </div>
  );
}

// ─── SUB COMPONENTS ───────────────────────────────────────────────────────────
function OmsetInput({ field, value, onChange }) {
  const isTunai = field.method === "Tunai";
  const isQris  = field.method === "QRIS";
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
        {isQris  && <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", border: "1px solid var(--amber-border)", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700, marginRight: 5 }}>QRIS</span>}
        {isTunai && <span style={{ background: "var(--green-bg)", color: "var(--green-text)", border: "1px solid var(--green-border)", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700, marginRight: 5 }}>TUNAI</span>}
        {field.group === "TRANSFER" && <span style={{ background: "var(--blue-bg)", color: "var(--blue-text)", border: "1px solid var(--blue-border)", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700, marginRight: 5 }}>TRANSFER</span>}
        {field.group !== "TRANSFER" ? (field.method === "Tunai" ? "Tunai" : "QRIS") : "Nominal"}
      </label>
      <div style={{ position: "relative" }}>
        <span style={rpPrefixStyle}>Rp</span>
        <input
          type="number" min="0"
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="0"
          className="kk-input"
          style={{ paddingLeft: 32, fontSize: 13, textAlign: "right" }}
        />
      </div>
    </div>
  );
}

function GrandTotalCard({
  totalTunai, omsetNum, grandTotal,
  modalPagi, uangTunaiMasuk, omsetTunaiSistem,
  totalOmsetSistem, selisihKas, setorManajemen, modalBesok, statusClosing,
}) {
  const rows = [
    { label: "Total Tunai Fisik",       val: totalTunai,                color: "#16a34a" },
    { label: "Omset Konsultasi QRIS",   val: omsetNum.omsetKonsulQris,  color: "#d97706" },
    { label: "Omset Obat QRIS",         val: omsetNum.omsetObatQris,    color: "#d97706" },
    { label: "Total Transfer",          val: omsetNum.totalTransfer,    color: "#185FA5" },
  ];

  const selisihSign = selisihKas >= 0 ? "+" : "-";
  const selisihAbs  = Math.abs(selisihKas);

  return (
    <div style={{ background: "var(--bg-card)", borderRadius: 10, border: "2px solid var(--brand)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "11px 16px", background: "var(--blue-bg)", borderBottom: "1.5px solid var(--blue-border)" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--blue-text)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Ringkasan Grand Total Closing</span>
      </div>
      <div style={{ padding: 16 }}>
        {/* Baris omset dasar */}
        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {rows.map((r) => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg-input)", borderRadius: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: r.val > 0 ? r.color : "var(--text-muted)", fontFamily: "'Courier New', monospace" }}>
                Rp {formatRp(r.val)}
              </span>
            </div>
          ))}
        </div>

        {/* Grand total bar */}
        <div style={{ background: "var(--brand)", borderRadius: 8, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>GRAND TOTAL</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Courier New', monospace" }}>
            Rp {formatRp(grandTotal)}
          </span>
        </div>

        {/* ── Seksi Rekap Kas Lanjutan ── */}
        <div style={{ borderTop: "1.5px solid var(--border-mid)", paddingTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            📊 Rekap Kas Lanjutan
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {/* Modal Pagi */}
            <KasRow label="Modal Pagi" value={modalPagi} color="#6366f1" note="Uang awal kas" />
            {/* Uang Tunai Masuk */}
            <KasRow label="Uang Tunai Masuk" value={uangTunaiMasuk} color="#16a34a" note="Tunai Fisik − Modal Pagi" highlight />
            {/* Omset Tunai Sistem */}
            <KasRow label="Omset Tunai Sistem" value={omsetTunaiSistem} color="#0284c7" note="Konsultasi Tunai + Obat Tunai" />
            {/* Total Omset Sistem */}
            <KasRow label="Total Omset Sistem" value={totalOmsetSistem} color="#0284c7" note="Semua metode pembayaran" />

            {/* Selisih Kas */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 12px",
              background: statusClosing.bg,
              border: `1.5px solid ${statusClosing.border}`,
              borderRadius: 8,
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: statusClosing.color }}>Selisih Kas</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Tunai Masuk − Omset Tunai Sistem</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Courier New', monospace", color: statusClosing.color }}>
                  {selisihSign}Rp {formatRp(selisihAbs)}
                </div>
                <div style={{ marginTop: 2 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 12,
                    background: statusClosing.color, color: "#fff",
                  }}>
                    {statusClosing.icon} {statusClosing.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Setor Manajemen + Modal Besok */}
            <KasRow label="Setor ke Manajemen" value={setorManajemen} color="#7c3aed" note="Diserahkan ke manajemen" />
            <KasRow label="Modal Besok Pagi" value={modalBesok} color="#0284c7" note="Uang yang ditinggal untuk besok" />
          </div>
        </div>
      </div>
    </div>
  );
}

function KasRow({ label, value, color, note, highlight }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "8px 12px",
      background: highlight ? "rgba(22,163,74,0.06)" : "var(--bg-input)",
      border: highlight ? "1px solid #bbf7d0" : "1px solid transparent",
      borderRadius: 6,
    }}>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: highlight ? 600 : 400 }}>{label}</div>
        {note && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{note}</div>}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: value > 0 ? color : "var(--text-muted)", fontFamily: "'Courier New', monospace" }}>
        Rp {formatRp(value)}
      </span>
    </div>
  );
}

function HistoryView({ cashCounts, onPrint, detailId, setDetailId, detailRecord, setCashCounts }) {
  if (cashCounts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
        <div>Belum ada data closing tersimpan.</div>
      </div>
    );
  }

  if (detailRecord) {
    const {
      pecahan, totalTunai, omset: o, grandTotal, catatanClosing, tanggal, jam, kasir,
      modalPagi = 0, uangTunaiMasuk = 0, omsetTunaiSistem = 0,
      selisihKas = 0, setorManajemen = 0, modalBesok = 0, statusClosing = "SESUAI",
    } = detailRecord;
    const stStatus = getSelisihStatus(selisihKas);
    return (
      <div>
        <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => setDetailId(null)} style={{ marginBottom: 14 }}>
          ← Kembali ke Riwayat
        </button>
        <div style={{ background: "var(--bg-card)", borderRadius: 10, border: "1.5px solid var(--border-mid)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: "var(--bg-input)", borderBottom: "1.5px solid var(--border-mid)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Closing {tanggal}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{jam} · {kasir}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12, background: stStatus.color, color: "#fff" }}>
                {stStatus.icon} {stStatus.label}
              </span>
              <button className="kk-btn kk-btn-secondary kk-btn-sm" onClick={() => onPrint(detailRecord)}>🖨️ Print Ulang</button>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            {/* Pecahan */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>Pecahan</div>
              {DENOMINATIONS.filter((d) => (pecahan[d.value] || 0) > 0).map((d) => (
                <div key={d.value} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
                  <span>{d.label} × {pecahan[d.value]}</span>
                  <span style={{ fontFamily: "monospace" }}>Rp {formatRp(d.value * pecahan[d.value])}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, fontSize: 14, color: "var(--brand)" }}>
                <span>Total Tunai Fisik</span>
                <span>Rp {formatRp(totalTunai)}</span>
              </div>
            </div>
            {/* Omset */}
            <div style={{ borderTop: "1.5px solid var(--border-mid)", paddingTop: 14, marginBottom: 14 }}>
              {[
                ["Konsultasi Tunai", o.omsetKonsulTunai],
                ["Konsultasi QRIS",  o.omsetKonsulQris],
                ["Obat Tunai",       o.omsetObatTunai],
                ["Obat QRIS",        o.omsetObatQris],
                ["Transfer",         o.totalTransfer],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, borderBottom: "1px solid var(--border-light)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                  <span>Rp {formatRp(val)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", marginTop: 10, background: "var(--brand)", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 15 }}>
                <span>GRAND TOTAL</span>
                <span>Rp {formatRp(grandTotal)}</span>
              </div>
            </div>
            {/* Rekap Kas Lanjutan */}
            <div style={{ borderTop: "1.5px solid var(--border-mid)", paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase" }}>📊 Rekap Kas</div>
              {[
                ["Modal Pagi",          modalPagi,         "#6366f1"],
                ["Uang Tunai Masuk",    uangTunaiMasuk,    "#16a34a"],
                ["Omset Tunai Sistem",  omsetTunaiSistem,  "#0284c7"],
                ["Setor Manajemen",     setorManajemen,    "#7c3aed"],
                ["Modal Besok Pagi",    modalBesok,        "#0284c7"],
              ].map(([label, val, color]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid var(--border-light)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                  <span style={{ fontFamily: "monospace", color }}>Rp {formatRp(val)}</span>
                </div>
              ))}
              {/* Selisih Kas */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", marginTop: 10, background: stStatus.bg, border: `1.5px solid ${stStatus.border}`, borderRadius: 8 }}>
                <span style={{ fontWeight: 700, color: stStatus.color }}>Selisih Kas</span>
                <span style={{ fontFamily: "monospace", fontWeight: 800, color: stStatus.color }}>
                  {selisihKas >= 0 ? "+" : "-"}Rp {formatRp(Math.abs(selisihKas))}
                </span>
              </div>
            </div>
            {catatanClosing && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: 8, fontSize: 13, color: "var(--amber-text)" }}>
                📝 {catatanClosing}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: "var(--bg-card)", borderRadius: 10, border: "1.5px solid var(--border-mid)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg-input)", borderBottom: "1.5px solid var(--border-mid)" }}>
              <th style={th("left")}>Tanggal</th>
              <th style={th("left")}>Kasir</th>
              <th style={th("right")}>Tunai Fisik</th>
              <th style={th("right")}>Selisih</th>
              <th style={th("center")}>Status</th>
              <th style={th("center", 120)}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {cashCounts.map((rec, i) => {
              const sk = rec.selisihKas ?? rec.selisih_kas ?? 0;
              const st = getSelisihStatus(sk);
              return (
                <tr key={rec.id} style={{ borderBottom: "1px solid var(--border-light)", background: i % 2 === 0 ? "#fff" : "var(--bg-input)" }}>
                  <td style={td("left")}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{rec.tanggal}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{rec.jam}</div>
                  </td>
                  <td style={{ ...td("left"), fontSize: 13 }}>{rec.kasir}</td>
                  <td style={{ ...td("right"), fontFamily: "monospace", fontSize: 13 }}>Rp {formatRp(rec.totalTunai)}</td>
                  <td style={{ ...td("right"), fontFamily: "monospace", fontSize: 13, color: st.color, fontWeight: 600 }}>
                    {sk >= 0 ? "+" : "-"}Rp {formatRp(Math.abs(sk))}
                  </td>
                  <td style={td("center")}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 10, background: st.color, color: "#fff", whiteSpace: "nowrap" }}>
                      {st.label}
                    </span>
                  </td>
                  <td style={{ ...td("center"), padding: "8px 10px" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      <button className="kk-btn kk-btn-secondary kk-btn-sm" onClick={() => setDetailId(rec.id)}>Detail</button>
                      <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => onPrint(rec)}>🖨️</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {cashCounts.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
          {cashCounts.length} data closing tersimpan
        </div>
      )}
    </div>
  );
}

// ─── STYLE HELPERS ────────────────────────────────────────────────────────────
const labelStyle = {
  fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
  display: "block", marginBottom: 4,
  textTransform: "uppercase", letterSpacing: "0.5px",
};

const sectionLabelStyle = {
  fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
  marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px",
};

const rpPrefixStyle = {
  position: "absolute", left: 10, top: "50%",
  transform: "translateY(-50%)",
  fontSize: 12, color: "var(--text-muted)", pointerEvents: "none",
};

function th(align = "left", width) {
  return {
    padding: "10px 14px",
    textAlign: align,
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    ...(width ? { width } : {}),
  };
}

function td(align = "left", width) {
  return {
    padding: "10px 14px",
    textAlign: align,
    fontSize: 13,
    verticalAlign: "middle",
    ...(width ? { width } : {}),
  };
}
