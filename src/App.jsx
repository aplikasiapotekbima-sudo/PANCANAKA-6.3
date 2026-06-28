import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import PageEPrescribing from "./pages/eprescribing/PageEPrescribing";
import PagePrescriptionSettings from "./pages/eprescribing/PagePrescriptionSettings";
import PageEResepDokter from "./pages/eprescribing-dokter/PageEResepDokter";
import PageEResepApoteker from "./pages/eprescribing-apoteker/PageEResepApoteker";
import PageCashCount from "./pages/cashcount/PageCashCount";
import PageCopyResep from "./pages/copyresep/PageCopyResep";
import PageCopyResepSettings from "./pages/copyresep/PageCopyResepSettings";
import { getSharedSetting, isSupabaseConfigured, saveSharedSetting, subscribeRealtime } from "./lib/supabase";
import PageRekamMedis from "./pages/rekam-medis/PageRekamMedis";
import LoginPageSupabase from "./pages/auth/LoginPageSupabase";
import PageAkunSupabase from "./pages/akun/PageAkunSupabase";
import PatientSelector from "./components/patients/PatientSelector";
import { restoreSession, signOut as supabaseSignOut } from "./lib/auth";
import { logoSm } from "./lib/logoAssets";
import PageDevPanel from "./pages/dev/PageDevPanel";

// ─── STORAGE KEYS ────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  doctors: "pos_doctors",
  transactions: "pos_transactions",
  settings: "pos_settings",
  invoiceCounter: "pos_invoice_counter",
  prescriptions: "pos_prescriptions",
  prescriptionCounter: "pos_prescription_counter",
  printSettings: "pos_print_settings",
  cashCounts: "pos_cash_counts",
  otcSales: "pos_otc_sales",
  otcCounter: "pos_otc_counter",
  copyResepList: "pos_copy_resep_list",
  copyResepCounter: "pos_copy_resep_counter",
  copyResepSettings: "pos_copy_resep_settings",
  users: "pos_users",
  // authSession SENGAJA tidak ada di sini —
  // session disimpan di sessionStorage (per browser tab, tidak di-sync ke Supabase)
};

const defaultSettings = {
  clinicName: "Apotek Bima",
  address: "Jl. BIMA, NGAGLIK SLEMAN",
  phone: "0821-4612-9602",
  footer: "Terima kasih atas kepercayaan Anda. Semoga lekas sembuh!",
  logo: "",
};

const defaultPrintSettings = {
  clinicName: "Apotek Bima",
  clinicAddress: "Jl. BIMA, NGAGLIK SLEMAN",
  clinicPhone: "0821-4612-9602",
  doctorName: "dr. Dokter Klinik",
  doctorSIP: "",
  logo: "",
  footer: "Obat tidak boleh diganti tanpa sepengetahuan dokter",
  fontSize: 11,
  marginTop: 8,
  marginRight: 8,
  marginBottom: 8,
  marginLeft: 8,
};

const defaultCopyResepSettings = {
  pharmacyName: "Apotek Bima",
  pharmacyAddress: "Jl. BIMA, NGAGLIK SLEMAN",
  pharmacyCity: "Sleman, Yogyakarta",
  pharmacyPhone: "0821-4612-9602",
  pharmacyEmail: "",
  pharmacyWebsite: "",
  logo: "",
  pharmacistName: "Apt. Apoteker, S.Farm",
  pharmacistSIPA: "",
  pharmacistTitle: "Apoteker Penanggung Jawab",
  footerNote: "Copy resep ini merupakan salinan resep yang sah.",
  footerLegal: "",
  footerExtra: "",
};

const defaultDoctors = [
  { id: "1", name: "Dr. dr. Niken Indrastuti SpKK(K)", active: true, sip: "" },
];

const ROLE_LABELS = { dokter: "Dokter", apoteker: "Apoteker", admin: "Admin" };

// ─── HOOKS ───────────────────────────────────────────────────────────────────
function readLocalStorageValue(key, initialValue) {
  try {
    const savedValue = window.localStorage.getItem(key);
    return {
      hasCache: savedValue !== null,
      value: savedValue === null ? initialValue : JSON.parse(savedValue),
    };
  } catch (error) {
    console.warn(`Gagal membaca data ${key} dari localStorage`, error);
    return { hasCache: false, value: initialValue };
  }
}

function useStorage(key, initialValue) {
  const [initialStorage] = useState(() => readLocalStorageValue(key, initialValue));
  const hasLocalCacheRef = useRef(initialStorage.hasCache);
  const [value, setValue] = useState(initialStorage.value);
  const valueRef = useRef(value);

  useEffect(() => {
    hasLocalCacheRef.current = initialStorage.hasCache;
  }, [initialStorage.hasCache]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    let cancelled = false;

    const syncFromSupabase = async ({ seedIfMissing = false } = {}) => {
      if (!isSupabaseConfigured) return;

      const { data, error } = await getSharedSetting(key);
      if (cancelled) return;

      if (error) {
        console.warn(`Gagal membaca data ${key} dari Supabase`, error);
        return;
      }

      if (data === null) {
        if (seedIfMissing && hasLocalCacheRef.current) {
          const { error: saveError } = await saveSharedSetting(key, valueRef.current);
          if (saveError) {
            console.warn(`Gagal membuat data awal ${key} di Supabase`, saveError);
          }
        }
        return;
      }

      const remoteValue = data;
      if (JSON.stringify(remoteValue) !== JSON.stringify(valueRef.current)) {
        valueRef.current = remoteValue;
        setValue(remoteValue);
        try {
          window.localStorage.setItem(key, JSON.stringify(remoteValue));
        } catch (storageError) {
          console.warn(`Gagal menyimpan cache ${key} ke localStorage`, storageError);
        }
      }
    };

    syncFromSupabase({ seedIfMissing: true });
    // Polling 2s sebagai fallback jika Realtime terputus
    const intervalId = window.setInterval(syncFromSupabase, 2000);
    window.addEventListener("focus", syncFromSupabase);
    // Juga sync saat tab kembali visible (user switch tab)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncFromSupabase();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // ── Realtime subscribe (WebSocket) — update instan tanpa polling ──────────
    // Hanya untuk data bersama yang kritis untuk multi-user
    const REALTIME_KEYS = [
      "pos_prescriptions",
      "pos_transactions",
      "pos_copy_resep_list",
      "pos_cash_counts",
    ];
    let unsubRealtime = () => {};
    if (REALTIME_KEYS.includes(key)) {
      unsubRealtime = subscribeRealtime(key, (remoteValue) => {
        if (cancelled) return;
        if (JSON.stringify(remoteValue) !== JSON.stringify(valueRef.current)) {
          valueRef.current = remoteValue;
          setValue(remoteValue);
          try { window.localStorage.setItem(key, JSON.stringify(remoteValue)); } catch {}
        }
      });
    }

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncFromSupabase);
      document.removeEventListener("visibilitychange", handleVisibility);
      unsubRealtime();
    };
  }, [key]);

  // Keys yang butuh sync segera ke Supabase (multi-user critical)
  const PRIORITY_KEYS = [
    "pos_prescriptions", "pos_transactions",
    "pos_copy_resep_list", "pos_cash_counts",
  ];

  const setStoredValue = (nextValue) => {
    setValue((currentValue) => {
      const resolvedValue =
        typeof nextValue === "function" ? nextValue(currentValue) : nextValue;
      valueRef.current = resolvedValue;
      hasLocalCacheRef.current = true;

      try {
        window.localStorage.setItem(key, JSON.stringify(resolvedValue));
      } catch (error) {
        console.warn(`Gagal menyimpan data ${key} ke localStorage`, error);
      }

      // Priority keys: langsung save tanpa menunggu (fire immediately)
      if (PRIORITY_KEYS.includes(key)) {
        // Sinkron immmediate — tidak di-batch/debounce
        saveSharedSetting(key, resolvedValue).then(({ error }) => {
          if (error) console.warn(`Gagal menyimpan data ${key} ke Supabase`, error);
        });
      } else {
        saveSharedSetting(key, resolvedValue).then(({ error }) => {
          if (error) console.warn(`Gagal menyimpan data ${key} ke Supabase`, error);
        });
      }

      return resolvedValue;
    });
  };

  return [value, setStoredValue];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function formatRupiah(n) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(d) {
  return new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(d) {
  return formatDate(d) + " " + formatTime(d);
}

function getInvoiceNumber(counter) {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `INV/${y}${m}/${String(counter).padStart(4, "0")}`;
}

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────
function Badge({ color, children }) {
  const colors = {
    green: { bg: "#EAF3DE", text: "#3B6D11", border: "#C0DD97" },
    red: { bg: "#FCEBEB", text: "#A32D2D", border: "#F7C1C1" },
    blue: { bg: "#E6F1FB", text: "#185FA5", border: "#B5D4F4" },
    amber: { bg: "#FAEEDA", text: "#854F0B", border: "#FAC775" },
    gray: { bg: "#F1EFE8", text: "#5F5E5A", border: "#D3D1C7" },
    teal: { bg: "#E1F5EE", text: "#0F6E56", border: "#9FE1CB" },
    purple: { bg: "#F3EEFF", text: "#6B35B8", border: "#C9A8F5" },
  };
  const c = colors[color] || colors.gray;
  return (
    <span style={{ background: c.bg, color: c.text, border: `0.5px solid ${c.border}`, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function Modal({ open, onClose, title, children, width = 560 }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "var(--color-background-primary)", borderRadius: 16, border: "0.5px solid var(--color-border-tertiary)", width: "100%", maxWidth: width, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--color-text-secondary)", fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: "20px" }}>{children}</div>
      </div>
    </div>
  );
}

function InputField({ label, required, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 6, fontWeight: 500 }}>{label}{required && " *"}</label>}
      {props.type === "textarea" ? (
        <textarea {...props} type={undefined} style={{ width: "100%", minHeight: 80, padding: "8px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 14, resize: "vertical", boxSizing: "border-box", ...props.style }} />
      ) : props.as === "select" ? (
        <select {...props} as={undefined} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 14, boxSizing: "border-box", ...props.style }}>
          {props.children}
        </select>
      ) : (
        <input {...props} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 14, boxSizing: "border-box", ...props.style }} />
      )}
    </div>
  );
}

// ─── PRINT RECEIPT ─────────────────────────────────────────────────────────
function PrintReceipt({ tx, settings, onClose }) {
  const printRef = useRef();

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const w = window.open("", "_blank", "width=380,height=600");
    w.document.write(`
      <html><head><title>Nota - ${tx.invoice}</title>
      <style>
        body{font-family:monospace;font-size:12px;width:300px;margin:0 auto;padding:10px;}
        .center{text-align:center;} .bold{font-weight:bold;} .line{border-top:1px dashed #000;margin:6px 0;}
        .row{display:flex;justify-content:space-between;} .logo{max-width:80px;max-height:60px;}
      </style></head><body>${content}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  const payMethod = { cash: "Tunai", transfer: "Transfer", qris: "QRIS" };
  const pharmacyFeeNum = typeof tx.pharmacyFee === "number" ? tx.pharmacyFee : 0;
  const grandTotal = tx.fee + pharmacyFeeNum;
  const change = tx.paid - grandTotal;

  return (
    <Modal open onClose={onClose} title="Preview Nota" width={420}>
      <div ref={printRef} style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}>
        <div className="center" style={{ textAlign: "center", marginBottom: 8 }}>
          {settings.logo && <img src={settings.logo} alt="logo" style={{ maxWidth: 80, maxHeight: 60, display: "block", margin: "0 auto 8px" }} />}
          <div style={{ fontWeight: 700, fontSize: 15 }}>{settings.clinicName}</div>
          <div style={{ fontSize: 11, color: "#666" }}>{settings.address}</div>
          {settings.phone && <div style={{ fontSize: 11, color: "#666" }}>Telp: {settings.phone}</div>}
        </div>
        <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
          <span>No: {tx.invoice}</span>
          <span>{formatDateTime(tx.date)}</span>
        </div>
        <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
        {tx.patientName && (
          <div style={{ fontSize: 12 }}>Pasien: <strong>{tx.patientName}</strong></div>
        )}
        <div style={{ fontSize: 12 }}>Dokter: <strong>{tx.doctorName}</strong></div>
        <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Jasa Konsultasi Dokter</span>
          <span>{formatRupiah(tx.fee)}</span>
        </div>
        {tx.pharmacyFee === null ? (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span>Biaya Obat</span>
            <span style={{ fontStyle: "italic", fontSize: 11 }}>Tertera pada nota apotek</span>
          </div>
        ) : tx.pharmacyFee > 0 ? (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span>Biaya Obat</span>
            <span>{formatRupiah(tx.pharmacyFee)}</span>
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 4 }}>
          <span>Total{tx.pharmacyFee > 0 ? " (Konsultasi + Obat)" : ""}</span>
          <span>{formatRupiah(grandTotal)}</span>
        </div>
        <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Metode</span><span>{payMethod[tx.method]}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Bayar</span><span>{formatRupiah(tx.paid)}</span>
        </div>
        {tx.method === "cash" && change >= 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Kembali</span><span>{formatRupiah(change)}</span>
          </div>
        )}
        {settings.footer && (
          <>
            <div style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
            <div style={{ textAlign: "center", fontSize: 11, color: "#666" }}>{settings.footer}</div>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={handlePrint} style={{ flex: 1, padding: "10px 0", background: "#185FA5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500, fontSize: 14 }}>
          🖨️ Cetak
        </button>
        <button onClick={onClose} style={{ flex: 1, padding: "10px 0", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
          Tutup
        </button>
      </div>
    </Modal>
  );
}

// ─── PAGE: CASHIER ───────────────────────────────────────────────────────────
function PageCashier({ doctors, setTransactions, invoiceCounter, setInvoiceCounter, settings, onNavigateToRekamMedis }) {
  const activeDoctors = doctors.filter((d) => d.active);
  const [selectedDoc, setSelectedDoc] = useState(activeDoctors.length === 1 ? activeDoctors[0].id : "");
  const [patientName, setPatientName] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [method, setMethod] = useState("cash");
  const [paid, setPaid] = useState("");
  const [feeInput, setFeeInput] = useState("");
  const [pharmacyFeeMode, setPharmacyFeeMode] = useState("none"); // "none" | "manual" | "nota"
  const [pharmacyFeeInput, setPharmacyFeeInput] = useState("");
  const [success, setSuccess] = useState(null);
  const [printTx, setPrintTx] = useState(null);
  const [error, setError] = useState("");

  const doctor = doctors.find((d) => d.id === selectedDoc);
  const fee = parseInt(feeInput.replace(/\D/g, "")) || 0;
  const pharmacyFeeNum = pharmacyFeeMode === "manual" ? (parseInt(pharmacyFeeInput.replace(/\D/g, "")) || 0) : 0;
  const paidNum = parseInt(paid.replace(/\D/g, "")) || 0;
  const totalBayar = fee + pharmacyFeeNum;
  const change = method === "cash" ? paidNum - totalBayar : 0;

  const handleSubmit = () => {
    if (!selectedDoc) return setError("Pilih dokter terlebih dahulu.");
    if (fee === 0) return setError("Masukkan biaya konsultasi.");
    if (method === "cash" && paidNum < totalBayar) return setError("Nominal bayar kurang dari total tagihan.");
    if (method !== "cash" && paidNum === 0) return setError("Masukkan nominal bayar.");
    setError("");
    const counter = invoiceCounter + 1;
    setInvoiceCounter(counter);
    const tx = {
      id: Date.now().toString(),
      invoice: getInvoiceNumber(counter),
      doctorId: selectedDoc,
      doctorName: doctor.name,
      patientName: patientName.trim(),
      patientId: selectedPatient?.id || null,
      fee,
      pharmacyFee: pharmacyFeeMode === "nota" ? null : pharmacyFeeMode === "manual" ? pharmacyFeeNum : 0,
      method,
      paid: method === "cash" ? paidNum : totalBayar,
      date: new Date().toISOString(),
    };
    setTransactions((prev) => [tx, ...prev]);
    setSuccess(tx);
    setPrintTx(tx);
    setPatientName("");
    setSelectedPatient(null);
    setPaid("");
    setFeeInput("");
    setPharmacyFeeMode("none");
    setPharmacyFeeInput("");
    setMethod("cash");
  };

  const handlePaidInput = (v) => {
    const num = v.replace(/\D/g, "");
    setPaid(num ? parseInt(num).toLocaleString("id-ID") : "");
  };

  const handleFeeInput = (v) => {
    const num = v.replace(/\D/g, "");
    setFeeInput(num ? parseInt(num).toLocaleString("id-ID") : "");
  };

  const handlePharmacyFeeInput = (v) => {
    const num = v.replace(/\D/g, "");
    setPharmacyFeeInput(num ? parseInt(num).toLocaleString("id-ID") : "");
  };

  const methodBtns = [
    { id: "cash", label: "💵 Tunai", color: "#3B6D11", bg: "#EAF3DE", border: "#9FE1CB" },
    { id: "transfer", label: "🏦 Transfer", color: "#185FA5", bg: "#E6F1FB", border: "#B5D4F4" },
    { id: "qris", label: "📱 QRIS", color: "#854F0B", bg: "#FAEEDA", border: "#FAC775" },
  ];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 0 40px" }}>
      <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 500 }}>Transaksi Kasir</h2>

      {success && (
        <div style={{ background: "#EAF3DE", border: "0.5px solid #9FE1CB", borderRadius: 10, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <div>
            <div style={{ fontWeight: 500, color: "#3B6D11", fontSize: 14 }}>Transaksi berhasil disimpan!</div>
            <div style={{ color: "#0F6E56", fontSize: 13 }}>Invoice: {success.invoice}</div>
          </div>
          <button onClick={() => setSuccess(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#3B6D11", fontSize: 18 }}>✕</button>
        </div>
      )}

      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 12 }}>Dokter</div>
        {activeDoctors.length === 0 ? (
          <div style={{ color: "var(--color-text-secondary)", fontSize: 13, padding: "12px 0" }}>Tidak ada dokter aktif.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {activeDoctors.map((d) => (
              <button key={d.id} onClick={() => setSelectedDoc(d.id)} style={{
                padding: "14px 18px", borderRadius: 10, border: `2px solid ${selectedDoc === d.id ? "#185FA5" : "var(--color-border-tertiary)"}`,
                background: selectedDoc === d.id ? "#E6F1FB" : "var(--color-background-secondary)",
                cursor: "pointer", textAlign: "left", transition: "all 0.15s",
              }}>
                <div style={{ fontWeight: 500, fontSize: 15, color: selectedDoc === d.id ? "#185FA5" : "var(--color-text-primary)" }}>{d.name}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>Dermatologi & Venereologi</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 10 }}>Pasien <span style={{ fontWeight: 400 }}>(opsional)</span></div>
        <PatientSelector
          value={selectedPatient}
          onChange={(p) => { setSelectedPatient(p); setPatientName(p?.name || ""); }}
          onNavigateToRekamMedis={onNavigateToRekamMedis}
        />
      </div>

      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 8 }}>Biaya Konsultasi *</div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--color-text-secondary)", fontWeight: 500 }}>Rp</span>
          <input value={feeInput} onChange={(e) => handleFeeInput(e.target.value)} placeholder="0"
            style={{ width: "100%", padding: "12px 14px 12px 38px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 18, fontWeight: 600, boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {[
            { label: "A · Gratis",   value: 0      },
            { label: "B · 50.000",   value: 50000  },
            { label: "C · 80.000",   value: 80000  },
            { label: "D · 100.000",  value: 100000 },
            { label: "E · 120.000",  value: 120000 },
            { label: "F · 130.000",  value: 130000 },
            { label: "G · 140.000",  value: 140000 },
            { label: "H · 150.000",  value: 150000 },
            { label: "I · 180.000",  value: 180000 },
          ].map(({ label, value }) => (
            <button key={label} onClick={() => setFeeInput(value === 0 ? "0" : value.toLocaleString("id-ID"))} style={{ padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Biaya Obat (Apotek) ─────────────────────────────── */}
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 }}>Biaya Obat <span style={{ fontWeight: 400 }}>(opsional)</span></div>
          {pharmacyFeeMode !== "none" && (
            <button onClick={() => { setPharmacyFeeMode("none"); setPharmacyFeeInput(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#A32D2D", padding: 0 }}>
              ✕ Hapus
            </button>
          )}
        </div>
        {pharmacyFeeMode === "none" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setPharmacyFeeMode("manual")} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)" }}>
              ✏️ Input Nominal
            </button>
            <button onClick={() => setPharmacyFeeMode("nota")} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)" }}>
              📋 Tertera pada Nota Apotek
            </button>
          </div>
        )}
        {pharmacyFeeMode === "manual" && (
          <>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--color-text-secondary)", fontWeight: 500 }}>Rp</span>
              <input value={pharmacyFeeInput} onChange={(e) => handlePharmacyFeeInput(e.target.value)} placeholder="0"
                style={{ width: "100%", padding: "12px 14px 12px 38px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 18, fontWeight: 600, boxSizing: "border-box" }} />
            </div>
          </>
        )}
        {pharmacyFeeMode === "nota" && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "#FAEEDA", border: "0.5px solid #FAC775", fontSize: 13, color: "#854F0B", fontStyle: "italic" }}>
            📋 Tertera pada nota apotek — tidak dihitung ke total pembayaran
          </div>
        )}
      </div>

      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 12 }}>Metode Pembayaran</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {methodBtns.map((b) => (
            <button key={b.id} onClick={() => setMethod(b.id)} style={{
              padding: "14px 8px", borderRadius: 10, border: `2px solid ${method === b.id ? b.border : "var(--color-border-tertiary)"}`,
              background: method === b.id ? b.bg : "var(--color-background-secondary)",
              cursor: "pointer", fontWeight: method === b.id ? 600 : 400, fontSize: 14,
              color: method === b.id ? b.color : "var(--color-text-primary)",
            }}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {fee > 0 && (
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, marginBottom: 10, borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
            <span style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>Biaya Konsultasi</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)" }}>{formatRupiah(fee)}</span>
          </div>
          {pharmacyFeeMode === "manual" && pharmacyFeeNum > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, marginBottom: 10, borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
              <span style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>Biaya Obat</span>
              <span style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)" }}>{formatRupiah(pharmacyFeeNum)}</span>
            </div>
          )}
          {pharmacyFeeMode === "nota" && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, marginBottom: 10, borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
              <span style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>Biaya Obat</span>
              <span style={{ fontSize: 13, color: "#854F0B", fontStyle: "italic" }}>Tertera pada nota apotek</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 16, borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
            <span style={{ fontSize: 15, color: "var(--color-text-secondary)", fontWeight: 500 }}>Total Tagihan</span>
            <span style={{ fontSize: 20, fontWeight: 600, color: "var(--color-text-primary)" }}>{formatRupiah(totalBayar)}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 8 }}>
            {method === "cash" ? "Nominal Bayar (Tunai)" : method === "transfer" ? "Nominal Transfer" : "Nominal QRIS"}
          </div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--color-text-secondary)", fontWeight: 500 }}>Rp</span>
            <input value={paid} onChange={(e) => handlePaidInput(e.target.value)} placeholder="0"
              style={{ width: "100%", padding: "12px 14px 12px 38px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 18, fontWeight: 600, boxSizing: "border-box" }} />
          </div>
          {method === "cash" && paid && (
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: change >= 0 ? "#EAF3DE" : "#FCEBEB", border: `0.5px solid ${change >= 0 ? "#9FE1CB" : "#F7C1C1"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: change >= 0 ? "#3B6D11" : "#A32D2D", fontWeight: 600 }}>
                <span>{change >= 0 ? "Kembalian" : "Kurang"}</span>
                <span>{formatRupiah(Math.abs(change))}</span>
              </div>
            </div>
          )}
          {method === "cash" && totalBayar > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {[totalBayar, ...([50000, 100000, 200000].map(d => Math.ceil(totalBayar / d) * d).filter(v => v >= totalBayar && v !== totalBayar).slice(0, 3))].map((v, i) => (
                <button key={i} onClick={() => setPaid(v.toLocaleString("id-ID"))} style={{ padding: "6px 12px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {formatRupiah(v)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ background: "#FCEBEB", border: "0.5px solid #F7C1C1", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#A32D2D", fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={!selectedDoc} style={{
        width: "100%", padding: "16px", borderRadius: 12, border: "none",
        background: selectedDoc ? "#185FA5" : "var(--color-background-secondary)",
        color: selectedDoc ? "#fff" : "var(--color-text-secondary)",
        fontSize: 16, fontWeight: 600, cursor: selectedDoc ? "pointer" : "not-allowed", transition: "all 0.15s",
      }}>
        💾 Simpan Transaksi
      </button>

      {printTx && <PrintReceipt tx={printTx} settings={settings} onClose={() => setPrintTx(null)} />}
    </div>
  );
}

// ─── EXCEL EXPORT ─────────────────────────────────────────────────────────────
function handleExportExcel(filtered) {
  const payLabel = { cash: "Tunai", transfer: "Transfer", qris: "QRIS" };
  const rows = filtered.map((tx, idx) => {
    const kembalian = tx.method === "cash" ? Math.max(0, tx.paid - tx.fee) : 0;
    const pharmacyFeeVal = tx.pharmacyFee === null
      ? "Tertera pada nota apotek"
      : tx.pharmacyFee > 0
        ? formatRupiah(tx.pharmacyFee)
        : "-";
    return {
      "No": idx + 1,
      "Invoice": tx.invoice,
      "Tanggal": formatDate(tx.date),
      "Jam": formatTime(tx.date),
      "Nama Pasien": tx.patientName || "-",
      "Dokter": tx.doctorName,
      "Metode Pembayaran": payLabel[tx.method] || tx.method,
      "Biaya Konsultasi": formatRupiah(tx.fee),
      "Biaya Obat": pharmacyFeeVal,
      "Nominal Bayar": formatRupiah(tx.paid),
      "Kembalian": formatRupiah(kembalian),
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 5 }, { wch: 18 }, { wch: 16 }, { wch: 8 }, { wch: 22 }, { wch: 36 }, { wch: 20 }, { wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Riwayat Transaksi");
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `riwayat-transaksi-${today}.xlsx`);
}

// ─── PAGE: HISTORY ───────────────────────────────────────────────────────────
function PageHistory({ transactions, setTransactions, doctors, settings }) {
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [printTx, setPrintTx] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editForm, setEditForm] = useState({ patientName: "", method: "cash", fee: "", paid: "", pharmacyFeeMode: "none", pharmacyFeeInput: "" });

  const filtered = transactions.filter((tx) => {
    const matchSearch = !search || tx.invoice.toLowerCase().includes(search.toLowerCase()) || (tx.patientName || "").toLowerCase().includes(search.toLowerCase());
    const matchDate = !filterDate || tx.date.startsWith(filterDate);
    const matchDoc = !filterDoctor || tx.doctorId === filterDoctor;
    return matchSearch && matchDate && matchDoc;
  });

  const payLabel = { cash: "Tunai", transfer: "Transfer", qris: "QRIS" };
  const payColor = { cash: "green", transfer: "blue", qris: "amber" };

  const openEdit = (tx) => {
    setEditTx(tx);
    const pharmacyFeeMode = tx.pharmacyFee === null ? "nota" : tx.pharmacyFee > 0 ? "manual" : "none";
    const pharmacyFeeInput = tx.pharmacyFee > 0 ? tx.pharmacyFee.toLocaleString("id-ID") : "";
    setEditForm({ patientName: tx.patientName || "", method: tx.method, fee: tx.fee.toLocaleString("id-ID"), paid: tx.paid.toLocaleString("id-ID"), pharmacyFeeMode, pharmacyFeeInput });
  };

  const handleEditSave = () => {
    const fee = parseInt(editForm.fee.replace(/\D/g, "")) || 0;
    const paid = parseInt(editForm.paid.replace(/\D/g, "")) || 0;
    const editPharmacyFeeNum = parseInt((editForm.pharmacyFeeInput || "").replace(/\D/g, "")) || 0;
    const pharmacyFee = editForm.pharmacyFeeMode === "nota" ? null : editForm.pharmacyFeeMode === "manual" ? editPharmacyFeeNum : 0;
    if (fee === 0) return;
    setTransactions((prev) => prev.map((tx) => tx.id === editTx.id ? { ...tx, patientName: editForm.patientName.trim(), method: editForm.method, fee, paid: editForm.method === "cash" ? paid : fee, pharmacyFee } : tx));
    setEditTx(null);
  };

  const handleDelete = (id) => { setTransactions((prev) => prev.filter((tx) => tx.id !== id)); setDeleteConfirm(null); };

  const handleEditFeeInput = (v) => {
    const num = v.replace(/\D/g, "");
    setEditForm((f) => ({ ...f, fee: num ? parseInt(num).toLocaleString("id-ID") : "" }));
  };

  const handleEditPaidInput = (v) => {
    const num = v.replace(/\D/g, "");
    setEditForm((f) => ({ ...f, paid: num ? parseInt(num).toLocaleString("id-ID") : "" }));
  };

  const handleEditPharmacyFeeInput = (v) => {
    const num = v.replace(/\D/g, "");
    setEditForm((f) => ({ ...f, pharmacyFeeInput: num ? parseInt(num).toLocaleString("id-ID") : "" }));
  };

  const editFeeNum = parseInt(editForm.fee.replace(/\D/g, "")) || 0;
  const editPaidNum = parseInt(editForm.paid.replace(/\D/g, "")) || 0;
  const editChange = editForm.method === "cash" ? editPaidNum - editFeeNum : 0;

  const methodBtns = [
    { id: "cash", label: "💵 Tunai", color: "#3B6D11", bg: "#EAF3DE", border: "#9FE1CB" },
    { id: "transfer", label: "🏦 Transfer", color: "#185FA5", bg: "#E6F1FB", border: "#B5D4F4" },
    { id: "qris", label: "📱 QRIS", color: "#854F0B", bg: "#FAEEDA", border: "#FAC775" },
  ];

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", paddingBottom: 40 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 500 }}>Riwayat Transaksi</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Invoice / nama pasien..."
          style={{ flex: "1 1 180px", minWidth: 160, padding: "9px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 14 }} />
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
          style={{ flex: "0 0 auto", padding: "9px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 14 }} />
        <select value={filterDoctor} onChange={(e) => setFilterDoctor(e.target.value)}
          style={{ flex: "1 1 140px", minWidth: 130, padding: "9px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 14 }}>
          <option value="">Semua Dokter</option>
          {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button onClick={() => handleExportExcel(filtered)} disabled={filtered.length === 0}
          style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, border: "none", background: filtered.length > 0 ? "#185FA5" : "var(--color-background-secondary)", color: filtered.length > 0 ? "#fff" : "var(--color-text-secondary)", cursor: filtered.length > 0 ? "pointer" : "not-allowed", fontWeight: 500, fontSize: 14, whiteSpace: "nowrap" }}>
          📥 Export Excel
        </button>
      </div>

      <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12 }}>
        Menampilkan {filtered.length} transaksi
        {(search || filterDate || filterDoctor) && (
          <button onClick={() => { setSearch(""); setFilterDate(""); setFilterDoctor(""); }} style={{ marginLeft: 10, background: "none", border: "none", cursor: "pointer", color: "#A32D2D", fontSize: 12 }}>
            ✕ Reset filter
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--color-text-secondary)", fontSize: 15 }}>Tidak ada transaksi ditemukan.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((tx) => (
            <div key={tx.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#185FA5" }}>{tx.invoice}</span>
                    <Badge color={payColor[tx.method]}>{payLabel[tx.method]}</Badge>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--color-text-primary)", marginBottom: 2 }}>{tx.doctorName}</div>
                  {tx.patientName && <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Pasien: {tx.patientName}</div>}
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{formatDateTime(tx.date)}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "var(--color-text-primary)" }}>{formatRupiah(tx.fee)}</div>
                  {tx.method === "cash" && tx.paid > tx.fee && (
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>Kembali {formatRupiah(tx.paid - tx.fee)}</div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setPrintTx(tx)} style={{ padding: "5px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary)" }}>🖨️</button>
                    <button onClick={() => openEdit(tx)} style={{ padding: "5px 10px", borderRadius: 6, border: "0.5px solid #B5D4F4", background: "#E6F1FB", cursor: "pointer", fontSize: 12, color: "#185FA5" }}>✏️ Edit</button>
                    <button onClick={() => setDeleteConfirm(tx)} style={{ padding: "5px 10px", borderRadius: 6, border: "0.5px solid #F7C1C1", background: "#FCEBEB", cursor: "pointer", fontSize: 12, color: "#A32D2D" }}>🗑️ Hapus</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {printTx && <PrintReceipt tx={printTx} settings={settings} onClose={() => setPrintTx(null)} />}

      <Modal open={!!editTx} onClose={() => setEditTx(null)} title="Edit Transaksi" width={460}>
        {editTx && (
          <>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "var(--color-text-secondary)" }}>
              <span style={{ fontWeight: 600, color: "#185FA5" }}>{editTx.invoice}</span> · {editTx.doctorName}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 6 }}>Nama Pasien</label>
              <input value={editForm.patientName} onChange={(e) => setEditForm({ ...editForm, patientName: e.target.value })} placeholder="Masukkan nama pasien..."
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 8 }}>Metode Pembayaran</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {methodBtns.map((b) => (
                  <button key={b.id} onClick={() => setEditForm({ ...editForm, method: b.id })} style={{ padding: "10px 8px", borderRadius: 8, border: `2px solid ${editForm.method === b.id ? b.border : "var(--color-border-tertiary)"}`, background: editForm.method === b.id ? b.bg : "var(--color-background-secondary)", cursor: "pointer", fontWeight: editForm.method === b.id ? 600 : 400, fontSize: 13, color: editForm.method === b.id ? b.color : "var(--color-text-primary)" }}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 6 }}>Biaya Konsultasi *</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--color-text-secondary)", fontWeight: 500 }}>Rp</span>
                <input value={editForm.fee} onChange={(e) => handleEditFeeInput(e.target.value)} placeholder="0"
                  style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 16, fontWeight: 600, boxSizing: "border-box" }} />
              </div>
            </div>
            {/* ── Biaya Obat (Edit) ────────────────────────────── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 }}>Biaya Obat <span style={{ fontWeight: 400 }}>(opsional)</span></label>
                {editForm.pharmacyFeeMode !== "none" && (
                  <button onClick={() => setEditForm({ ...editForm, pharmacyFeeMode: "none", pharmacyFeeInput: "" })}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#A32D2D", padding: 0 }}>
                    ✕ Hapus
                  </button>
                )}
              </div>
              {editForm.pharmacyFeeMode === "none" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditForm({ ...editForm, pharmacyFeeMode: "manual" })} style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary)" }}>
                    ✏️ Input Nominal
                  </button>
                  <button onClick={() => setEditForm({ ...editForm, pharmacyFeeMode: "nota", pharmacyFeeInput: "" })} style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary)" }}>
                    📋 Nota Apotek
                  </button>
                </div>
              )}
              {editForm.pharmacyFeeMode === "manual" && (
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--color-text-secondary)", fontWeight: 500 }}>Rp</span>
                  <input value={editForm.pharmacyFeeInput} onChange={(e) => handleEditPharmacyFeeInput(e.target.value)} placeholder="0"
                    style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 16, fontWeight: 600, boxSizing: "border-box" }} />
                </div>
              )}
              {editForm.pharmacyFeeMode === "nota" && (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: "#FAEEDA", border: "0.5px solid #FAC775", fontSize: 12, color: "#854F0B", fontStyle: "italic" }}>
                  📋 Tertera pada nota apotek
                </div>
              )}
            </div>
            {editForm.method === "cash" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 6 }}>Nominal Bayar (Tunai)</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--color-text-secondary)", fontWeight: 500 }}>Rp</span>
                  <input value={editForm.paid} onChange={(e) => handleEditPaidInput(e.target.value)} placeholder="0"
                    style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 16, fontWeight: 600, boxSizing: "border-box" }} />
                </div>
                {editForm.paid && editFeeNum > 0 && (
                  <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: editChange >= 0 ? "#EAF3DE" : "#FCEBEB", border: `0.5px solid ${editChange >= 0 ? "#9FE1CB" : "#F7C1C1"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: editChange >= 0 ? "#3B6D11" : "#A32D2D", fontWeight: 600, fontSize: 13 }}>
                      <span>{editChange >= 0 ? "Kembalian" : "Kurang"}</span>
                      <span>{formatRupiah(Math.abs(editChange))}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={handleEditSave} disabled={editFeeNum === 0} style={{ flex: 1, padding: "10px 0", background: editFeeNum > 0 ? "#185FA5" : "var(--color-background-secondary)", color: editFeeNum > 0 ? "#fff" : "var(--color-text-secondary)", border: "none", borderRadius: 8, cursor: editFeeNum > 0 ? "pointer" : "not-allowed", fontWeight: 500, fontSize: 14 }}>
                💾 Simpan Perubahan
              </button>
              <button onClick={() => setEditTx(null)} style={{ flex: 1, padding: "10px 0", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
                Batal
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Hapus Transaksi" width={400}>
        {deleteConfirm && (
          <>
            <div style={{ textAlign: "center", padding: "8px 0 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Yakin ingin menghapus transaksi ini?</div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>Invoice: <strong style={{ color: "#185FA5" }}>{deleteConfirm.invoice}</strong></div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{deleteConfirm.doctorName}</div>
              {deleteConfirm.patientName && <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Pasien: {deleteConfirm.patientName}</div>}
              <div style={{ fontSize: 14, fontWeight: 600, color: "#A32D2D", marginTop: 8 }}>{formatRupiah(deleteConfirm.fee)}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#A32D2D", background: "#FCEBEB", border: "0.5px solid #F7C1C1", borderRadius: 8, padding: "8px 12px" }}>
                ⚠️ Tindakan ini tidak dapat dibatalkan.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => handleDelete(deleteConfirm.id)} style={{ flex: 1, padding: "10px 0", background: "#A32D2D", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500, fontSize: 14 }}>Ya, Hapus</button>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "10px 0", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>Batal</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

// ─── PAGE: DOCTORS ────────────────────────────────────────────────────────────
function PageDoctors({ doctors, setDoctors }) {
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: "", sip: "", active: true });

  const openAdd = () => { setEdit(null); setForm({ name: "", sip: "", active: true }); setModal(true); };
  const openEdit = (d) => { setEdit(d); setForm({ name: d.name, sip: d.sip || "", active: d.active }); setModal(true); };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (edit) {
      setDoctors((prev) => prev.map((d) => d.id === edit.id ? { ...d, name: form.name.trim(), sip: form.sip.trim(), active: form.active } : d));
    } else {
      setDoctors((prev) => [...prev, { id: Date.now().toString(), name: form.name.trim(), sip: form.sip.trim(), active: form.active }]);
    }
    setModal(false);
  };

  const toggleActive = (id) => setDoctors((prev) => prev.map((d) => d.id === id ? { ...d, active: !d.active } : d));
  const handleDelete = (id) => { if (window.confirm("Hapus dokter ini?")) setDoctors((prev) => prev.filter((d) => d.id !== id)); };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>Master Dokter</h2>
        <button onClick={openAdd} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#185FA5", color: "#fff", cursor: "pointer", fontWeight: 500, fontSize: 14 }}>
          + Tambah Dokter
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {doctors.map((d) => (
          <div key={d.id} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, opacity: d.active ? 1 : 0.6 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: d.active ? "#E6F1FB" : "#F1EFE8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>👨‍⚕️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 15 }}>{d.name}</div>
              {d.sip && <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 1 }}>SIP: {d.sip}</div>}
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 1 }}>Biaya konsultasi diinput per transaksi</div>
            </div>
            <Badge color={d.active ? "green" : "gray"}>{d.active ? "Aktif" : "Nonaktif"}</Badge>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => toggleActive(d.id)} title={d.active ? "Nonaktifkan" : "Aktifkan"} style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 13 }}>
                {d.active ? "🔴" : "🟢"}
              </button>
              <button onClick={() => openEdit(d)} style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 13 }}>✏️</button>
              <button onClick={() => handleDelete(d.id)} style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 13 }}>🗑️</button>
            </div>
          </div>
        ))}
        {doctors.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-text-secondary)" }}>Belum ada dokter.</div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={edit ? "Edit Dokter" : "Tambah Dokter"} width={420}>
        <InputField label="Nama Dokter" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="dr. Nama Dokter, Sp.X" />
        <InputField label="No. SIP (opsional)" value={form.sip} onChange={(e) => setForm({ ...form, sip: e.target.value })} placeholder="123/SIP/DKK/2024" />
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 14 }}>Status Aktif</span>
          </label>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleSave} style={{ flex: 1, padding: "10px 0", background: "#185FA5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>Simpan</button>
          <button onClick={() => setModal(false)} style={{ flex: 1, padding: "10px 0", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, cursor: "pointer" }}>Batal</button>
        </div>
      </Modal>
    </div>
  );
}

// ─── PAGE: SETTINGS ───────────────────────────────────────────────────────────
function PageSettings({ settings, setSettings }) {
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);

  const handleSave = () => { setSettings(form); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm({ ...form, logo: ev.target.result });
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", paddingBottom: 40 }}>
      <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 500 }}>Pengaturan Kop Nota</h2>
      {saved && (<div style={{ background: "#EAF3DE", border: "0.5px solid #9FE1CB", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "#3B6D11", fontSize: 14 }}>✅ Pengaturan berhasil disimpan!</div>)}
      <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 10 }}>Logo Klinik</div>
          {form.logo && (<div style={{ marginBottom: 10 }}><img src={form.logo} alt="logo" style={{ maxWidth: 120, maxHeight: 80, borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)" }} /></div>)}
          <div style={{ display: "flex", gap: 8 }}>
            <label style={{ padding: "8px 16px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)" }}>
              📁 Upload Logo
              <input type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
            </label>
            {form.logo && (<button onClick={() => setForm({ ...form, logo: "" })} style={{ padding: "8px 16px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 13, color: "#A32D2D" }}>Hapus Logo</button>)}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 6 }}>Nama Klinik / Apotek *</label>
          <input value={form.clinicName} onChange={(e) => setForm({ ...form, clinicName: e.target.value })} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 6 }}>Alamat</label>
          <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 6 }}>Nomor Telepon</label>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", color: "var(--color-text-primary)", fontSize: 14, boxSizing: "border-box", background: "var(--color-background-secondary)" }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500, marginBottom: 6 }}>Catatan / Footer Nota</label>
          <textarea value={form.footer} onChange={(e) => setForm({ ...form, footer: e.target.value })} rows={2} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
        </div>
        <button onClick={handleSave} style={{ width: "100%", padding: "12px 0", background: "#185FA5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500, fontSize: 15 }}>💾 Simpan Pengaturan</button>
      </div>
      <div style={{ marginTop: 24, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: "var(--color-text-secondary)" }}>Preview Kop Nota</div>
        <div style={{ textAlign: "center", fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, color: "var(--color-text-primary)" }}>
          {form.logo && <img src={form.logo} alt="logo" style={{ maxWidth: 60, maxHeight: 45, display: "block", margin: "0 auto 6px" }} />}
          <div style={{ fontWeight: 700, fontSize: 14 }}>{form.clinicName || "Nama Klinik"}</div>
          {form.address && <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{form.address}</div>}
          {form.phone && <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Telp: {form.phone}</div>}
          <div style={{ borderTop: "1px dashed var(--color-border-secondary)", margin: "6px 0", fontSize: 11, color: "var(--color-text-secondary)" }}>{form.footer || "Footer nota..."}</div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: REPORTS ──────────────────────────────────────────────────────────────
function PageReports({ transactions, doctors, cashCounts, setCashCounts, settings, otcSales, setOtcSales, otcCounter, setOtcCounter }) {
  const [reportTab, setReportTab] = useState("resep");

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", paddingBottom: 40 }}>
      <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 500 }}>Laporan</h2>

      {/* ── Sub-tab navigation ── */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, overflow: "hidden" }}>
        {[
          { id: "resep",     label: "📋 Laporan Resep" },
          { id: "nonresep",  label: "🏪 Penjualan Non Resep" },
          { id: "keuangan",  label: "💰 Laporan Keuangan" },
          { id: "cashcount", label: "🧮 Penghitung Uang" },
        ].map((t) => (
          <button key={t.id} onClick={() => setReportTab(t.id)} style={{
            flex: 1, padding: "11px 8px", border: "none", cursor: "pointer",
            background: reportTab === t.id ? "#185FA5" : "transparent",
            color: reportTab === t.id ? "#fff" : "var(--color-text-secondary)",
            fontSize: 12.5, fontWeight: reportTab === t.id ? 600 : 400,
            fontFamily: "var(--font)", borderRight: "0.5px solid var(--color-border-tertiary)",
            transition: "background 0.15s, color 0.15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {reportTab === "resep"    && <ReportResep    transactions={transactions} doctors={doctors} settings={settings} />}
      {reportTab === "nonresep" && <ReportNonResep otcSales={otcSales} setOtcSales={setOtcSales} otcCounter={otcCounter} setOtcCounter={setOtcCounter} />}
      {reportTab === "keuangan" && <ReportKeuangan cashCounts={cashCounts} />}
      {reportTab === "cashcount" && (
        <PageCashCount
          cashCounts={cashCounts}
          setCashCounts={setCashCounts}
          settings={settings}
        />
      )}
    </div>
  );
}

// ─── REPORT: RESEP ─────────────────────────────────────────────────────────────
function ReportResep({ transactions, doctors, settings }) {
  const [mode, setMode] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [intervalStart, setIntervalStart] = useState(new Date().toISOString().slice(0, 10));
  const [intervalEnd, setIntervalEnd] = useState(new Date().toISOString().slice(0, 10));
  const [intervalApplied, setIntervalApplied] = useState(false);
  const [intervalError, setIntervalError] = useState("");

  // ── Filter logic ──────────────────────────────────────────────────────────
  const filtered = transactions.filter((tx) => {
    if (mode === "daily") return tx.date.startsWith(selectedDate);
    if (mode === "monthly") return tx.date.startsWith(selectedMonth);
    if (mode === "interval" && intervalApplied) {
      const d = tx.date.slice(0, 10);
      return d >= intervalStart && d <= intervalEnd;
    }
    return false;
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalKonsultasi = filtered.reduce((s, tx) => s + tx.fee, 0);
  const txDenganObat = filtered.filter((tx) => typeof tx.pharmacyFee === "number" && tx.pharmacyFee > 0);
  const totalObat = txDenganObat.reduce((s, tx) => s + tx.pharmacyFee, 0);
  const totalGrand = totalKonsultasi + totalObat;

  // Rata-rata harian penghasilan dokter = total konsultasi / jumlah hari dalam periode
  const getJumlahHari = () => {
    if (mode === "daily") return 1;
    if (mode === "monthly") {
      const [y, m] = selectedMonth.split("-").map(Number);
      return new Date(y, m, 0).getDate();
    }
    if (mode === "interval" && intervalApplied) {
      const d1 = new Date(intervalStart);
      const d2 = new Date(intervalEnd);
      return Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
    }
    return 1;
  };
  const jumlahHari = getJumlahHari();
  const rataHarianDokter = totalKonsultasi / jumlahHari;

  // ── Per Dokter ────────────────────────────────────────────────────────────
  const byDoctor = doctors.map((d) => {
    const txs = filtered.filter((tx) => tx.doctorId === d.id);
    const obatTxs = txs.filter((tx) => typeof tx.pharmacyFee === "number" && tx.pharmacyFee > 0);
    return {
      ...d,
      count: txs.length,
      totalKonsultasi: txs.reduce((s, tx) => s + tx.fee, 0),
      totalObat: obatTxs.reduce((s, tx) => s + tx.pharmacyFee, 0),
      countObat: obatTxs.length,
    };
  }).filter((d) => d.count > 0);

  // ── Per Metode ────────────────────────────────────────────────────────────
  const byMethod = ["cash", "transfer", "qris"].map((m) => {
    const txs = filtered.filter((tx) => tx.method === m);
    const obatTxs = txs.filter((tx) => typeof tx.pharmacyFee === "number" && tx.pharmacyFee > 0);
    return {
      method: m,
      count: txs.length,
      totalKonsultasi: txs.reduce((s, tx) => s + tx.fee, 0),
      totalObat: obatTxs.reduce((s, tx) => s + tx.pharmacyFee, 0),
      total: txs.reduce((s, tx) => s + tx.fee, 0) + obatTxs.reduce((s, tx) => s + tx.pharmacyFee, 0),
    };
  });
  const methodLabel = { cash: "Tunai", transfer: "Transfer", qris: "QRIS" };
  const methodColor = { cash: "green", transfer: "blue", qris: "amber" };
  const methodAccent = { cash: "#16a34a", transfer: "#185FA5", qris: "#d97706" };
  const methodBg = { cash: "rgba(22,163,74,0.07)", transfer: "rgba(24,95,165,0.07)", qris: "rgba(217,119,6,0.07)" };

  // ── Rekap Harian ──────────────────────────────────────────────────────────
  const rekapHarian = (() => {
    const map = {};
    filtered.forEach((tx) => {
      const d = tx.date.slice(0, 10);
      if (!map[d]) map[d] = { tanggal: d, count: 0, konsultasi: 0, obat: 0 };
      map[d].count++;
      map[d].konsultasi += tx.fee;
      if (typeof tx.pharmacyFee === "number" && tx.pharmacyFee > 0) {
        map[d].obat += tx.pharmacyFee;
      }
    });
    return Object.values(map).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  })();

  // ── Periode label ─────────────────────────────────────────────────────────
  const getPeriodeLabel = () => {
    if (mode === "daily") return formatDate(selectedDate + "T00:00:00");
    if (mode === "monthly") {
      const [y, m] = selectedMonth.split("-");
      const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
      return `${monthNames[parseInt(m) - 1]} ${y}`;
    }
    if (mode === "interval" && intervalApplied) {
      return `${formatDate(intervalStart + "T00:00:00")} s/d ${formatDate(intervalEnd + "T00:00:00")}`;
    }
    return "-";
  };

  // ── Interval handler ──────────────────────────────────────────────────────
  const handleTampilkanInterval = () => {
    if (intervalEnd < intervalStart) {
      setIntervalError("Tanggal akhir harus lebih besar atau sama dengan tanggal awal");
      setIntervalApplied(false);
    } else {
      setIntervalError("");
      setIntervalApplied(true);
    }
  };

  // ── Export Excel ──────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const periodeLabel = getPeriodeLabel();
    const fileName = `Laporan_Resep_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx`;

    // Sheet Ringkasan
    const ringkasanData = [
      ["Laporan Resep - " + (settings?.clinicName || "Klinik")],
      [],
      ["Periode", periodeLabel],
      ["Total Transaksi", filtered.length],
      ["Total Pemasukan", totalGrand],
      ["Total Biaya Konsultasi", totalKonsultasi],
      ["Total Biaya Obat", totalObat],
      ["Rata-rata Harian Penghasilan Dokter", rataHarianDokter],
    ];
    const wsRingkasan = XLSX.utils.aoa_to_sheet(ringkasanData);
    XLSX.utils.book_append_sheet(wb, wsRingkasan, "Ringkasan");

    // Sheet Detail
    const detailHeader = ["Tanggal", "No Resep", "Nama Pasien", "Konsultasi", "Obat", "Total"];
    const detailRows = filtered.map((tx) => [
      tx.date.slice(0, 10),
      tx.invoice || "-",
      tx.patientName || "-",
      tx.fee,
      typeof tx.pharmacyFee === "number" && tx.pharmacyFee > 0 ? tx.pharmacyFee : 0,
      tx.fee + (typeof tx.pharmacyFee === "number" && tx.pharmacyFee > 0 ? tx.pharmacyFee : 0),
    ]);
    const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]);
    XLSX.utils.book_append_sheet(wb, wsDetail, "Detail Transaksi");

    // Sheet Rekap Harian
    const rekapHeader = ["Tanggal", "Jumlah Transaksi", "Pendapatan Dokter", "Penjualan Obat", "Total Pemasukan"];
    const rekapRows = rekapHarian.map((r) => [
      r.tanggal,
      r.count,
      r.konsultasi,
      r.obat,
      r.konsultasi + r.obat,
    ]);
    const wsRekap = XLSX.utils.aoa_to_sheet([rekapHeader, ...rekapRows]);
    XLSX.utils.book_append_sheet(wb, wsRekap, "Rekap Harian");

    XLSX.writeFile(wb, fileName);
  };

  // ── Export PDF ────────────────────────────────────────────────────────────
  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const clinicName = settings?.clinicName || "Klinik";
    const clinicAddress = settings?.address || "";
    const clinicPhone = settings?.phone || "";
    const periodeLabel = getPeriodeLabel();
    const fileName = `Laporan_Resep_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.pdf`;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header klinik
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text(clinicName, pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    if (clinicAddress) { doc.text(clinicAddress, pageWidth / 2, y, { align: "center" }); y += 5; }
    if (clinicPhone) { doc.text("Telp: " + clinicPhone, pageWidth / 2, y, { align: "center" }); y += 5; }
    doc.setLineWidth(0.5);
    doc.line(14, y, pageWidth - 14, y);
    y += 6;

    // Judul & Periode
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text("LAPORAN RESEP", pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text("Periode: " + periodeLabel, pageWidth / 2, y, { align: "center" });
    y += 8;

    // Ringkasan
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Ringkasan", 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [["Keterangan", "Nilai"]],
      body: [
        ["Total Transaksi", filtered.length.toString()],
        ["Total Pemasukan", formatRupiah(totalGrand)],
        ["Total Biaya Konsultasi", formatRupiah(totalKonsultasi)],
        ["Total Biaya Obat", formatRupiah(totalObat)],
        ["Rata-rata Harian Penghasilan Dokter", formatRupiah(Math.round(rataHarianDokter))],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [24, 95, 165] },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    // Detail Transaksi
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Detail Transaksi", 14, y);
    y += 2;
    const detailBody = filtered.length > 0
      ? filtered.map((tx) => [
          tx.date.slice(0, 10),
          tx.invoice || "-",
          tx.patientName || "-",
          formatRupiah(tx.fee),
          typeof tx.pharmacyFee === "number" && tx.pharmacyFee > 0 ? formatRupiah(tx.pharmacyFee) : "-",
          formatRupiah(tx.fee + (typeof tx.pharmacyFee === "number" && tx.pharmacyFee > 0 ? tx.pharmacyFee : 0)),
        ])
      : [["Tidak ada data", "", "", "", "", ""]];
    autoTable(doc, {
      startY: y,
      head: [["Tanggal", "No Resep", "Pasien", "Konsultasi", "Obat", "Total"]],
      body: detailBody,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [24, 95, 165] },
      margin: { left: 14, right: 14 },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    });
    y = doc.lastAutoTable.finalY + 8;

    // Rekap Harian
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Rekap Harian", 14, y);
    y += 2;
    const rekapBody = rekapHarian.length > 0
      ? rekapHarian.map((r) => [
          r.tanggal,
          r.count.toString(),
          formatRupiah(r.konsultasi),
          formatRupiah(r.obat),
          formatRupiah(r.konsultasi + r.obat),
        ])
      : [["Tidak ada data", "", "", "", ""]];
    autoTable(doc, {
      startY: y,
      head: [["Tanggal", "Jml Transaksi", "Pendapatan Dokter", "Penjualan Obat", "Total"]],
      body: rekapBody,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [24, 95, 165] },
      margin: { left: 14, right: 14 },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    });

    doc.save(fileName);
  };

  // ── Shared input style ────────────────────────────────────────────────────
  const inputStyle = { padding: "8px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 14 };

  const showData = mode !== "interval" || intervalApplied;
  const noData = showData && filtered.length === 0;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 40 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 500 }}>Laporan Resep</h2>

      {/* ── Mode Tabs ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "0.5px solid var(--color-border-secondary)" }}>
          {[
            { id: "daily", label: "Harian" },
            { id: "monthly", label: "Bulanan" },
            { id: "interval", label: "Interval" },
          ].map((m) => (
            <button key={m.id} onClick={() => { setMode(m.id); setIntervalApplied(false); setIntervalError(""); }}
              style={{ padding: "8px 18px", border: "none", background: mode === m.id ? "#185FA5" : "var(--color-background-secondary)", color: mode === m.id ? "#fff" : "var(--color-text-secondary)", cursor: "pointer", fontSize: 14, fontWeight: mode === m.id ? 500 : 400, fontFamily: "var(--font)" }}>
              {m.label}
            </button>
          ))}
        </div>

        {mode === "daily" && (
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={inputStyle} />
        )}
        {mode === "monthly" && (
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={inputStyle} />
        )}
        {mode === "interval" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>Tanggal Awal</span>
                <input type="date" value={intervalStart} onChange={(e) => { setIntervalStart(e.target.value); setIntervalApplied(false); }} style={inputStyle} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>Tanggal Akhir</span>
                <input type="date" value={intervalEnd} onChange={(e) => { setIntervalEnd(e.target.value); setIntervalApplied(false); }} style={inputStyle} />
              </div>
              <button onClick={handleTampilkanInterval}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#185FA5", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 500, fontFamily: "var(--font)" }}>
                🔍 Tampilkan
              </button>
            </div>
            {intervalError && (
              <div style={{ fontSize: 12, color: "#A32D2D", background: "#FCEBEB", border: "0.5px solid #F7C1C1", borderRadius: 6, padding: "6px 10px" }}>
                ⚠️ {intervalError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Export buttons (always visible) ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={handleExportExcel}
          style={{ padding: "8px 16px", borderRadius: 8, border: "0.5px solid #16a34a", background: "#EAF3DE", color: "#3B6D11", cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "var(--font)" }}>
          📊 Export Excel
        </button>
        <button onClick={handleExportPdf}
          style={{ padding: "8px 16px", borderRadius: 8, border: "0.5px solid #185FA5", background: "#E6F1FB", color: "#185FA5", cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "var(--font)" }}>
          📄 Export PDF
        </button>
      </div>

      {/* ── Waiting for interval input ── */}
      {mode === "interval" && !intervalApplied && !intervalError && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-text-secondary)", fontSize: 14 }}>
          Pilih tanggal awal dan akhir, lalu klik Tampilkan.
        </div>
      )}

      {/* ── No data message ── */}
      {noData && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-text-secondary)", fontSize: 14 }}>
          Tidak ada transaksi pada periode yang dipilih.
        </div>
      )}

      {/* ── Summary cards ── */}
      {showData && !intervalError && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>Total Transaksi</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1 }}>{filtered.length}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{txDenganObat.length} transaksi include obat</div>
            </div>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>Total Pemasukan</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)" }}>{formatRupiah(totalGrand)}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>Rata-rata {filtered.length ? formatRupiah(Math.round(totalGrand / filtered.length)) : "Rp 0"} / transaksi</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>Biaya Konsultasi</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)" }}>{formatRupiah(totalKonsultasi)}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{filtered.length} transaksi</div>
            </div>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>Biaya Obat</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: totalObat > 0 ? "#185FA5" : "var(--color-text-primary)" }}>{formatRupiah(totalObat)}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{txDenganObat.length} transaksi ada obat</div>
            </div>
          </div>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "14px 16px", marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>Rata-rata Harian Penghasilan Dokter</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#185FA5" }}>{formatRupiah(Math.round(rataHarianDokter))}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>Total Konsultasi ÷ {jumlahHari} hari</div>
          </div>

          {filtered.length > 0 && (
            <>
              {/* ── Per Dokter ── */}
              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Per Dokter</div>
                <div style={{ display: "grid", gap: 10 }}>
                  {byDoctor.map((d) => (
                    <div key={d.id} style={{ padding: "12px 14px", background: "var(--color-background-secondary)", borderRadius: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{d.name}</div>
                          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                            {d.count} transaksi{d.countObat > 0 ? ` · ${d.countObat} include obat` : ""}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{formatRupiah(d.totalKonsultasi + d.totalObat)}</div>
                          {d.totalObat > 0 && (
                            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
                              Konsul {formatRupiah(d.totalKonsultasi)} + Obat {formatRupiah(d.totalObat)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Per Metode Pembayaran ── */}
              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Per Metode Pembayaran</div>

                {/* Header kolom */}
                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 1fr", gap: 0, marginBottom: 6 }}>
                  <div></div>
                  {["Tunai", "Transfer", "QRIS"].map((label, i) => {
                    const colors = ["#16a34a", "#185FA5", "#d97706"];
                    return (
                      <div key={label} style={{ textAlign: "center", paddingBottom: 8 }}>
                        <Badge color={["green","blue","amber"][i]}>{label}</Badge>
                      </div>
                    );
                  })}
                </div>

                {/* Baris Omset Konsultasi */}
                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 1fr", gap: 0, background: "rgba(24,95,165,0.05)", borderRadius: 8, padding: "10px 8px", marginBottom: 6, alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#185FA5" }}>🩺 Konsultasi</div>
                  {byMethod.map((m) => (
                    <div key={m.method} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: m.totalKonsultasi > 0 ? methodAccent[m.method] : "var(--color-text-secondary)" }}>
                        {formatRupiah(m.totalKonsultasi)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
                        {m.count} trx
                      </div>
                    </div>
                  ))}
                </div>

                {/* Baris Omset Obat */}
                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 1fr", gap: 0, background: "rgba(124,58,237,0.05)", borderRadius: 8, padding: "10px 8px", marginBottom: 6, alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#7c3aed" }}>💊 Obat</div>
                  {byMethod.map((m) => (
                    <div key={m.method} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: m.totalObat > 0 ? methodAccent[m.method] : "var(--color-text-secondary)" }}>
                        {formatRupiah(m.totalObat)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
                        {m.totalObat > 0 ? "ada obat" : "—"}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Baris Total per metode */}
                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 1fr", gap: 0, borderTop: "1.5px solid var(--color-border-secondary)", paddingTop: 10, marginTop: 4, alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-primary)" }}>TOTAL</div>
                  {byMethod.map((m) => (
                    <div key={m.method} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: m.total > 0 ? methodAccent[m.method] : "var(--color-text-secondary)" }}>
                        {formatRupiah(m.total)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Detail Transaksi ── */}
              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Detail Transaksi</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--color-background-secondary)" }}>
                        {["Tanggal", "No Resep", "Nama Pasien", "Konsultasi", "Obat", "Total"].map((h) => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: h === "Tanggal" || h === "No Resep" || h === "Nama Pasien" ? "left" : "right", fontWeight: 600, fontSize: 12, color: "var(--color-text-secondary)", borderBottom: "0.5px solid var(--color-border-secondary)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((tx, i) => {
                        const obat = typeof tx.pharmacyFee === "number" && tx.pharmacyFee > 0 ? tx.pharmacyFee : 0;
                        const total = tx.fee + obat;
                        return (
                          <tr key={tx.id || i} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                            <td style={{ padding: "8px 10px", whiteSpace: "nowrap", fontSize: 12, color: "var(--color-text-secondary)" }}>{tx.date.slice(0, 10)}</td>
                            <td style={{ padding: "8px 10px", whiteSpace: "nowrap", fontWeight: 500, color: "#185FA5" }}>{tx.invoice || "-"}</td>
                            <td style={{ padding: "8px 10px" }}>{tx.patientName || "-"}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap" }}>{formatRupiah(tx.fee)}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap", color: obat > 0 ? "#185FA5" : "var(--color-text-secondary)" }}>{obat > 0 ? formatRupiah(obat) : "-"}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap", fontWeight: 600 }}>{formatRupiah(total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Rekap Harian ── */}
              <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Rekap Harian</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--color-background-secondary)" }}>
                        {["Tanggal", "Jml Transaksi", "Pendapatan Dokter", "Penjualan Obat", "Total Pemasukan"].map((h) => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: h === "Tanggal" ? "left" : "right", fontWeight: 600, fontSize: 12, color: "var(--color-text-secondary)", borderBottom: "0.5px solid var(--color-border-secondary)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rekapHarian.map((r) => (
                        <tr key={r.tanggal} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                          <td style={{ padding: "8px 10px", whiteSpace: "nowrap", fontWeight: 500 }}>{r.tanggal}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>{r.count}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap" }}>{formatRupiah(r.konsultasi)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap", color: r.obat > 0 ? "#185FA5" : "var(--color-text-secondary)" }}>{formatRupiah(r.obat)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap", fontWeight: 600 }}>{formatRupiah(r.konsultasi + r.obat)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── REPORT: NON RESEP ────────────────────────────────────────────────────────
// Penjualan obat bebas / OTC tanpa resep dokter.
// Data disimpan di localStorage + Supabase via useStorage("pos_otc_sales").
// Setiap sale: { id, noSale, date, items:[{nama,qty,harga}], subtotal, method, catatan }

const OTC_INVOICE_PREFIX = "OTC";

function getOtcInvoiceNumber(counter) {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${OTC_INVOICE_PREFIX}/${y}${m}/${String(counter).padStart(4, "0")}`;
}

const EMPTY_ITEM = { nama: "", qty: 1, harga: "" };

function makeEmptyForm() {
  return {
    date: new Date().toISOString().slice(0, 10),
    items: [{ ...EMPTY_ITEM, _key: Date.now() }],
    method: "cash",
    catatan: "",
  };
}

function calcSubtotal(items) {
  return items.reduce((s, it) => {
    const h = parseInt(String(it.harga || "").replace(/\D/g, "")) || 0;
    const q = parseInt(it.qty) || 0;
    return s + h * q;
  }, 0);
}

// ── UI helpers shared within this section ──────────────────────────────────
const S = {
  card: {
    background: "var(--color-background-primary)",
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  label: {
    display: "block",
    fontSize: 13,
    color: "var(--color-text-secondary)",
    fontWeight: 500,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "0.5px solid var(--color-border-secondary)",
    background: "var(--color-background-secondary)",
    color: "var(--color-text-primary)",
    fontSize: 14,
    boxSizing: "border-box",
    fontFamily: "var(--font)",
  },
  btn: (primary) => ({
    padding: "9px 18px",
    borderRadius: 8,
    border: primary ? "none" : "0.5px solid var(--color-border-secondary)",
    background: primary ? "#185FA5" : "var(--color-background-secondary)",
    color: primary ? "#fff" : "var(--color-text-secondary)",
    cursor: "pointer",
    fontWeight: 500,
    fontSize: 14,
    fontFamily: "var(--font)",
  }),
  dangerBtn: {
    padding: "5px 10px",
    borderRadius: 6,
    border: "0.5px solid #F7C1C1",
    background: "#FCEBEB",
    cursor: "pointer",
    fontSize: 12,
    color: "#A32D2D",
  },
};

const METHOD_BTNS = [
  { id: "cash",     label: "💵 Tunai",    color: "#3B6D11", bg: "#EAF3DE", border: "#9FE1CB" },
  { id: "transfer", label: "🏦 Transfer",  color: "#185FA5", bg: "#E6F1FB", border: "#B5D4F4" },
  { id: "qris",     label: "📱 QRIS",      color: "#854F0B", bg: "#FAEEDA", border: "#FAC775" },
];
const METHOD_LABEL = { cash: "Tunai", transfer: "Transfer", qris: "QRIS" };
const METHOD_COLOR = { cash: "green", transfer: "blue", qris: "amber" };

// ── Form Item Row ──────────────────────────────────────────────────────────
function OtcItemRow({ item, idx, onChange, onRemove, canRemove }) {
  const hargaNum = parseInt(String(item.harga || "").replace(/\D/g, "")) || 0;
  const subtotal = hargaNum * (parseInt(item.qty) || 0);

  const handleHarga = (v) => {
    const num = v.replace(/\D/g, "");
    onChange(idx, "harga", num ? parseInt(num).toLocaleString("id-ID") : "");
  };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 64px 120px auto",
      gap: 8,
      alignItems: "center",
      padding: "10px 12px",
      background: "var(--color-background-secondary)",
      borderRadius: 8,
      border: "0.5px solid var(--color-border-tertiary)",
    }}>
      <input
        value={item.nama}
        onChange={(e) => onChange(idx, "nama", e.target.value)}
        placeholder={`Item ${idx + 1} (nama produk)`}
        style={{ ...S.input, padding: "7px 10px", fontSize: 13 }}
      />
      <input
        type="number"
        min="1"
        value={item.qty}
        onChange={(e) => onChange(idx, "qty", Math.max(1, parseInt(e.target.value) || 1))}
        style={{ ...S.input, padding: "7px 8px", fontSize: 13, textAlign: "center" }}
      />
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--color-text-secondary)" }}>Rp</span>
        <input
          value={item.harga}
          onChange={(e) => handleHarga(e.target.value)}
          placeholder="0"
          style={{ ...S.input, padding: "7px 8px 7px 26px", fontSize: 13, textAlign: "right" }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, color: "var(--color-text-secondary)", whiteSpace: "nowrap", minWidth: 70, textAlign: "right" }}>
          {subtotal > 0 ? formatRupiah(subtotal) : "—"}
        </span>
        {canRemove && (
          <button onClick={() => onRemove(idx)} style={{ ...S.dangerBtn, padding: "4px 8px", fontSize: 14, lineHeight: 1 }}>✕</button>
        )}
      </div>
    </div>
  );
}

// ── Main ReportNonResep ────────────────────────────────────────────────────
function ReportNonResep({ otcSales, setOtcSales, otcCounter, setOtcCounter }) {
  const [view, setView] = useState("list"); // "list" | "add" | "edit" | "stats"
  const [form, setForm] = useState(makeEmptyForm);
  const [editId, setEditId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const sales = otcSales || [];

  // ── Filtered list ──
  const filtered = sales.filter((s) => {
    const matchSearch = !search ||
      s.noSale.toLowerCase().includes(search.toLowerCase()) ||
      s.items.some((it) => (it.nama || "").toLowerCase().includes(search.toLowerCase())) ||
      (s.catatan || "").toLowerCase().includes(search.toLowerCase());
    const matchDate   = !filterDate   || s.date === filterDate;
    const matchMonth  = !filterMonth  || s.date.startsWith(filterMonth);
    const matchMethod = !filterMethod || s.method === filterMethod;
    return matchSearch && matchDate && matchMonth && matchMethod;
  });

  // ── Stats (for the period shown in filtered, or all) ──
  const statBase = (filterDate || filterMonth || filterMethod || search) ? filtered : sales;
  const totalOmset = statBase.reduce((s, r) => s + r.subtotal, 0);
  const byMethod = ["cash", "transfer", "qris"].map((m) => ({
    method: m,
    total: statBase.filter((r) => r.method === m).reduce((s, r) => s + r.subtotal, 0),
    count: statBase.filter((r) => r.method === m).length,
  }));
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOmset = sales.filter((s) => s.date === todayStr).reduce((s, r) => s + r.subtotal, 0);

  // ── Form helpers ──
  const updateItem = (idx, field, val) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: val };
      return { ...f, items };
    });
    setSaved(false);
  };

  const addItem = () => {
    setForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_ITEM, _key: Date.now() }] }));
  };

  const removeItem = (idx) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const validateForm = () => {
    const hasItem = form.items.some((it) => it.nama.trim() && (parseInt(String(it.harga).replace(/\D/g, "")) || 0) > 0);
    if (!hasItem) return "Masukkan minimal 1 item dengan nama dan harga.";
    return "";
  };

  // ── Save new ──
  const handleSave = () => {
    const err = validateForm();
    if (err) { setError(err); return; }
    setError("");
    const cnt = otcCounter + 1;
    setOtcCounter(cnt);
    const cleanItems = form.items
      .filter((it) => it.nama.trim())
      .map((it) => ({
        nama: it.nama.trim(),
        qty: parseInt(it.qty) || 1,
        harga: parseInt(String(it.harga || "").replace(/\D/g, "")) || 0,
      }));
    const subtotal = cleanItems.reduce((s, it) => s + it.harga * it.qty, 0);
    const record = {
      id: Date.now().toString(),
      noSale: getOtcInvoiceNumber(cnt),
      date: form.date,
      items: cleanItems,
      subtotal,
      method: form.method,
      catatan: form.catatan.trim(),
      createdAt: new Date().toISOString(),
    };
    setOtcSales((prev) => [record, ...(prev || [])]);
    setSaved(true);
    setForm(makeEmptyForm());
    setView("list");
  };

  // ── Edit ──
  const openEdit = (sale) => {
    setEditId(sale.id);
    setForm({
      date: sale.date,
      items: sale.items.map((it) => ({
        nama: it.nama,
        qty: it.qty,
        harga: it.harga.toLocaleString("id-ID"),
        _key: Math.random(),
      })),
      method: sale.method,
      catatan: sale.catatan || "",
    });
    setError("");
    setView("edit");
  };

  const handleEditSave = () => {
    const err = validateForm();
    if (err) { setError(err); return; }
    setError("");
    const cleanItems = form.items
      .filter((it) => it.nama.trim())
      .map((it) => ({
        nama: it.nama.trim(),
        qty: parseInt(it.qty) || 1,
        harga: parseInt(String(it.harga || "").replace(/\D/g, "")) || 0,
      }));
    const subtotal = cleanItems.reduce((s, it) => s + it.harga * it.qty, 0);
    setOtcSales((prev) => prev.map((s) =>
      s.id === editId
        ? { ...s, date: form.date, items: cleanItems, subtotal, method: form.method, catatan: form.catatan.trim(), updatedAt: new Date().toISOString() }
        : s
    ));
    setEditId(null);
    setView("list");
  };

  const handleDelete = (id) => {
    setOtcSales((prev) => prev.filter((s) => s.id !== id));
    setDeleteConfirm(null);
  };

  const cancelForm = () => {
    setForm(makeEmptyForm());
    setError("");
    setEditId(null);
    setView("list");
  };

  const formSubtotal = calcSubtotal(form.items);

  // ── Render ──
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 40 }}>

      {/* ── Top summary strip ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        <SummaryCard label="Omset Hari Ini" value={formatRupiah(todayOmset)} sub={`${sales.filter(s => s.date === todayStr).length} transaksi`} color="#185FA5" />
        <SummaryCard label="Total Transaksi" value={sales.length} sub="semua waktu" />
        <SummaryCard label="Omset Keseluruhan" value={formatRupiah(totalOmset)} sub={filterDate || filterMonth ? "filter aktif" : "semua waktu"} color="#3B6D11" />
      </div>

      {/* ── Sub nav ── */}
      {(view === "list" || view === "stats") && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setView("list")} style={{ ...S.btn(view === "list"), padding: "8px 14px", fontSize: 13 }}>📋 Daftar Penjualan</button>
            <button onClick={() => setView("stats")} style={{ ...S.btn(view === "stats"), padding: "8px 14px", fontSize: 13 }}>📊 Statistik</button>
          </div>
          <button onClick={() => { setForm(makeEmptyForm()); setError(""); setView("add"); }} style={{ ...S.btn(true), display: "flex", alignItems: "center", gap: 6 }}>
            + Tambah Penjualan
          </button>
        </div>
      )}

      {/* ─────────────── LIST VIEW ─────────────── */}
      {view === "list" && (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 No. penjualan / nama item..."
              style={{ ...S.input, flex: "1 1 160px", minWidth: 140 }}
            />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setFilterMonth(""); }}
              style={{ ...S.input, flex: "0 0 auto", width: "auto" }}
            />
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => { setFilterMonth(e.target.value); setFilterDate(""); }}
              style={{ ...S.input, flex: "0 0 auto", width: "auto" }}
              title="Filter bulan"
            />
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              style={{ ...S.input, flex: "0 0 auto", width: "auto" }}
            >
              <option value="">Semua Metode</option>
              <option value="cash">Tunai</option>
              <option value="transfer">Transfer</option>
              <option value="qris">QRIS</option>
            </select>
            {(search || filterDate || filterMonth || filterMethod) && (
              <button
                onClick={() => { setSearch(""); setFilterDate(""); setFilterMonth(""); setFilterMethod(""); }}
                style={{ ...S.btn(false), padding: "8px 12px", fontSize: 12, color: "#A32D2D", border: "0.5px solid #F7C1C1", background: "#FCEBEB" }}
              >
                ✕ Reset
              </button>
            )}
          </div>

          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>
            {filtered.length} penjualan ditemukan
            {filtered.length > 0 && ` · Total: ${formatRupiah(filtered.reduce((s, r) => s + r.subtotal, 0))}`}
          </div>

          {saved && (
            <div style={{ background: "#EAF3DE", border: "0.5px solid #9FE1CB", borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: "#3B6D11", fontSize: 13, fontWeight: 500 }}>
              ✅ Penjualan berhasil disimpan.
            </div>
          )}

          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--color-text-secondary)" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🏪</div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>
                {sales.length === 0 ? "Belum ada data penjualan non resep." : "Tidak ada data yang cocok dengan filter."}
              </div>
              {sales.length === 0 && (
                <button onClick={() => { setForm(makeEmptyForm()); setError(""); setView("add"); }} style={{ ...S.btn(true), marginTop: 12 }}>
                  + Tambah Penjualan Pertama
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filtered.map((sale) => (
                <OtcSaleCard
                  key={sale.id}
                  sale={sale}
                  onEdit={() => openEdit(sale)}
                  onDelete={() => setDeleteConfirm(sale)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ─────────────── ADD / EDIT FORM ─────────────── */}
      {(view === "add" || view === "edit") && (
        <OtcSaleForm
          form={form}
          setForm={setForm}
          formSubtotal={formSubtotal}
          error={error}
          isEdit={view === "edit"}
          onSave={view === "edit" ? handleEditSave : handleSave}
          onCancel={cancelForm}
          updateItem={updateItem}
          addItem={addItem}
          removeItem={removeItem}
        />
      )}

      {/* ─────────────── STATS VIEW ─────────────── */}
      {view === "stats" && (
        <OtcStats sales={sales} byMethod={byMethod} totalOmset={totalOmset} />
      )}

      {/* ─────────────── DELETE MODAL ─────────────── */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Hapus Penjualan" width={400}>
        {deleteConfirm && (
          <>
            <div style={{ textAlign: "center", padding: "8px 0 20px" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🗑️</div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Yakin hapus penjualan ini?</div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>
                No. <strong style={{ color: "#185FA5" }}>{deleteConfirm.noSale}</strong>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#A32D2D", margin: "6px 0" }}>
                {formatRupiah(deleteConfirm.subtotal)}
              </div>
              <div style={{ fontSize: 12, color: "#A32D2D", background: "#FCEBEB", border: "0.5px solid #F7C1C1", borderRadius: 8, padding: "8px 12px" }}>
                ⚠️ Tindakan ini tidak dapat dibatalkan.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => handleDelete(deleteConfirm.id)} style={{ flex: 1, padding: "10px 0", background: "#A32D2D", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500, fontSize: 14 }}>Ya, Hapus</button>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "10px 0", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>Batal</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

// ── OTC Sale Card ──────────────────────────────────────────────────────────
function OtcSaleCard({ sale, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "#185FA5" }}>{sale.noSale}</span>
            <Badge color={METHOD_COLOR[sale.method]}>{METHOD_LABEL[sale.method]}</Badge>
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 2 }}>
            {new Date(sale.date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text-primary)", marginTop: 2 }}>
            {sale.items.length} item: {sale.items.map((it) => it.nama).join(", ").slice(0, 60)}{sale.items.map((it) => it.nama).join(", ").length > 60 ? "…" : ""}
          </div>
          {sale.catatan && (
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 3, fontStyle: "italic" }}>📝 {sale.catatan}</div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--color-text-primary)" }}>{formatRupiah(sale.subtotal)}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setExpanded((v) => !v)} style={{ padding: "4px 9px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", cursor: "pointer", fontSize: 12 }}>
              {expanded ? "▲" : "▼"} Detail
            </button>
            <button onClick={onEdit} style={{ padding: "4px 9px", borderRadius: 6, border: "0.5px solid #B5D4F4", background: "#E6F1FB", cursor: "pointer", fontSize: 12, color: "#185FA5" }}>✏️ Edit</button>
            <button onClick={onDelete} style={{ ...S.dangerBtn }}>🗑️ Hapus</button>
          </div>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", padding: "12px 16px", background: "var(--color-background-secondary)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                <th style={{ textAlign: "left", padding: "4px 8px 6px 0", fontWeight: 600, color: "var(--color-text-secondary)", fontSize: 11 }}>NAMA ITEM</th>
                <th style={{ textAlign: "center", padding: "4px 8px 6px", fontWeight: 600, color: "var(--color-text-secondary)", fontSize: 11, width: 50 }}>QTY</th>
                <th style={{ textAlign: "right", padding: "4px 0 6px 8px", fontWeight: 600, color: "var(--color-text-secondary)", fontSize: 11 }}>HARGA</th>
                <th style={{ textAlign: "right", padding: "4px 0 6px 8px", fontWeight: 600, color: "var(--color-text-secondary)", fontSize: 11 }}>SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((it, i) => (
                <tr key={i} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                  <td style={{ padding: "5px 8px 5px 0" }}>{it.nama}</td>
                  <td style={{ padding: "5px 8px", textAlign: "center" }}>{it.qty}</td>
                  <td style={{ padding: "5px 0 5px 8px", textAlign: "right", fontFamily: "monospace" }}>{formatRupiah(it.harga)}</td>
                  <td style={{ padding: "5px 0 5px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{formatRupiah(it.harga * it.qty)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ padding: "8px 0 0", textAlign: "right", fontWeight: 700, fontSize: 14, paddingRight: 8 }}>Total</td>
                <td style={{ padding: "8px 0 0 8px", textAlign: "right", fontWeight: 700, fontSize: 14, color: "#185FA5", fontFamily: "monospace" }}>{formatRupiah(sale.subtotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── OTC Sale Form ──────────────────────────────────────────────────────────
function OtcSaleForm({ form, setForm, formSubtotal, error, isEdit, onSave, onCancel, updateItem, addItem, removeItem }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--color-text-secondary)", padding: 0 }}>←</button>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{isEdit ? "✏️ Edit Penjualan" : "➕ Tambah Penjualan Non Resep"}</h3>
      </div>

      {/* Tanggal */}
      <div style={S.card}>
        <label style={S.label}>Tanggal Penjualan *</label>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          style={{ ...S.input, width: "auto" }}
        />
      </div>

      {/* Items */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <label style={{ ...S.label, margin: 0 }}>Item Penjualan *</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 120px auto", gap: 8, fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", padding: "0 12px" }}>
            <span>NAMA PRODUK</span>
            <span style={{ textAlign: "center" }}>QTY</span>
            <span style={{ textAlign: "right" }}>HARGA SATUAN</span>
            <span style={{ textAlign: "right", paddingRight: 28 }}>SUBTOTAL</span>
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {form.items.map((item, idx) => (
            <OtcItemRow
              key={item._key || idx}
              item={item}
              idx={idx}
              onChange={updateItem}
              onRemove={removeItem}
              canRemove={form.items.length > 1}
            />
          ))}
        </div>
        <button
          onClick={addItem}
          style={{ marginTop: 10, padding: "7px 14px", borderRadius: 8, border: "0.5px dashed var(--color-border-secondary)", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--color-text-secondary)", width: "100%" }}
        >
          + Tambah Item
        </button>
        {formSubtotal > 0 && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--color-background-secondary)", borderRadius: 8, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Total</span>
            <span style={{ color: "#185FA5", fontFamily: "monospace", fontSize: 16 }}>{formatRupiah(formSubtotal)}</span>
          </div>
        )}
      </div>

      {/* Metode Pembayaran */}
      <div style={S.card}>
        <label style={S.label}>Metode Pembayaran *</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {METHOD_BTNS.map((b) => (
            <button
              key={b.id}
              onClick={() => setForm((f) => ({ ...f, method: b.id }))}
              style={{
                padding: "12px 8px",
                borderRadius: 10,
                border: `2px solid ${form.method === b.id ? b.border : "var(--color-border-tertiary)"}`,
                background: form.method === b.id ? b.bg : "var(--color-background-secondary)",
                cursor: "pointer",
                fontWeight: form.method === b.id ? 600 : 400,
                fontSize: 14,
                color: form.method === b.id ? b.color : "var(--color-text-primary)",
                fontFamily: "var(--font)",
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Catatan */}
      <div style={S.card}>
        <label style={S.label}>Catatan <span style={{ fontWeight: 400 }}>(opsional)</span></label>
        <textarea
          value={form.catatan}
          onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))}
          placeholder="Catatan tambahan penjualan..."
          rows={2}
          style={{ ...S.input, resize: "vertical", minHeight: 60 }}
        />
      </div>

      {error && (
        <div style={{ background: "#FCEBEB", border: "0.5px solid #F7C1C1", borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: "#A32D2D", fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onSave} style={{ flex: 1, padding: "14px 0", background: "#185FA5", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 15, fontFamily: "var(--font)" }}>
          💾 {isEdit ? "Simpan Perubahan" : "Simpan Penjualan"}
        </button>
        <button onClick={onCancel} style={{ flex: 1, padding: "14px 0", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 10, cursor: "pointer", fontSize: 15, fontFamily: "var(--font)" }}>
          Batal
        </button>
      </div>
    </div>
  );
}

// ── OTC Stats ──────────────────────────────────────────────────────────────
// ─── LAPORAN KEUANGAN ──────────────────────────────────────────────────────────────
function ReportKeuangan({ cashCounts }) {
  const [periodeMonth, setPeriodeMonth] = useState(new Date().toISOString().slice(0, 7));
  const records = (cashCounts || []).filter((r) => (r.tanggalISO || "").startsWith(periodeMonth));

  function fmtRp(n) {
    return "Rp " + Number(n || 0).toLocaleString("id-ID");
  }

  // Aggregate per metode dari field omset
  const agg = {
    konsulTunai: 0, konsulQris: 0, konsulTotal: 0,
    obatTunai: 0,   obatQris: 0,   obatTotal: 0,
    transfer: 0,
    grandTotal: 0,
  };

  records.forEach((r) => {
    const o = r.omset || {};
    agg.konsulTunai += o.omsetKonsulTunai || 0;
    agg.konsulQris  += o.omsetKonsulQris  || 0;
    agg.obatTunai   += o.omsetObatTunai   || 0;
    agg.obatQris    += o.omsetObatQris    || 0;
    agg.transfer    += o.totalTransfer    || 0;
  });
  agg.konsulTotal = agg.konsulTunai + agg.konsulQris;
  agg.obatTotal   = agg.obatTunai   + agg.obatQris;
  agg.grandTotal  = agg.konsulTotal + agg.obatTotal + agg.transfer;

  // Harian
  const harian = {};
  records.forEach((r) => {
    const tgl = r.tanggalISO || "";
    if (!tgl) return;
    if (!harian[tgl]) harian[tgl] = { konsul: 0, obat: 0, transfer: 0, total: 0 };
    const o = r.omset || {};
    harian[tgl].konsul   += (o.omsetKonsulTunai || 0) + (o.omsetKonsulQris || 0);
    harian[tgl].obat     += (o.omsetObatTunai   || 0) + (o.omsetObatQris   || 0);
    harian[tgl].transfer += (o.totalTransfer || 0);
    harian[tgl].total    += (o.omsetKonsulTunai || 0) + (o.omsetKonsulQris || 0)
                          + (o.omsetObatTunai   || 0) + (o.omsetObatQris   || 0)
                          + (o.totalTransfer    || 0);
  });
  const harianRows = Object.entries(harian).sort(([a], [b]) => b.localeCompare(a));

  const cardStyle = {
    background: "var(--color-background-primary)",
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: 12, padding: "16px 20px", marginBottom: 16,
  };
  const methodBadge = (label, bg, color) => (
    <span style={{ background: bg, color, borderRadius: 4, padding: "1px 7px", fontSize: 10, fontWeight: 700, marginLeft: 6 }}>{label}</span>
  );

  return (
    <div>
      {/* Filter periode */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <label style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 }}>Periode:</label>
        <input type="month" value={periodeMonth} onChange={(e) => setPeriodeMonth(e.target.value)}
          style={{ padding: "7px 12px", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, fontSize: 13, fontFamily: "var(--font)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          {records.length} hari closing
        </span>
      </div>

      {records.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--color-text-secondary)", fontSize: 13 }}>
          Belum ada data closing untuk periode ini. Input data via menu Penghitung Uang.
        </div>
      ) : (
        <>
          {/* Grand Total */}
          <div style={{ ...cardStyle, background: "#185FA5", border: "none" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Grand Total Bulan Ini</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "monospace" }}>{fmtRp(agg.grandTotal)}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>Konsultasi + Obat + Transfer</div>
          </div>

          {/* Omset Konsultasi per metode */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              🩺 Omset Konsultasi
              <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 800, color: "#185FA5", fontFamily: "monospace" }}>{fmtRp(agg.konsulTotal)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", marginBottom: 6 }}>
                  {methodBadge("TUNAI", "#bbf7d0", "#166534")} Tunai
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a", fontFamily: "monospace" }}>{fmtRp(agg.konsulTunai)}</div>
              </div>
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
                  {methodBadge("QRIS", "#fde68a", "#92400e")} QRIS
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#d97706", fontFamily: "monospace" }}>{fmtRp(agg.konsulQris)}</div>
              </div>
            </div>
          </div>

          {/* Omset Obat per metode */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              💊 Omset Obat
              <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 800, color: "#7c3aed", fontFamily: "monospace" }}>{fmtRp(agg.obatTotal)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", marginBottom: 6 }}>
                  {methodBadge("TUNAI", "#bbf7d0", "#166534")} Tunai
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a", fontFamily: "monospace" }}>{fmtRp(agg.obatTunai)}</div>
              </div>
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
                  {methodBadge("QRIS", "#fde68a", "#92400e")} QRIS
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#d97706", fontFamily: "monospace" }}>{fmtRp(agg.obatQris)}</div>
              </div>
            </div>
          </div>

          {/* Transfer */}
          <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>🏦 Transfer</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>Total seluruh transfer bulan ini</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#185FA5", fontFamily: "monospace" }}>{fmtRp(agg.transfer)}</div>
          </div>

          {/* Rekapitulasi per hari */}
          {harianRows.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>📅 Rincian Per Hari</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1.5px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>Tanggal</th>
                      <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#185FA5", textTransform: "uppercase" }}>Konsultasi</th>
                      <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase" }}>Obat</th>
                      <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#185FA5", textTransform: "uppercase" }}>Transfer</th>
                      <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {harianRows.map(([tgl, d], i) => (
                      <tr key={tgl} style={{ borderBottom: "1px solid var(--color-border-tertiary)", background: i % 2 === 0 ? "#fff" : "var(--color-background-secondary)" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 600 }}>
                          {new Date(tgl + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", color: d.konsul > 0 ? "#185FA5" : "var(--color-text-secondary)" }}>
                          {fmtRp(d.konsul)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", color: d.obat > 0 ? "#7c3aed" : "var(--color-text-secondary)" }}>
                          {fmtRp(d.obat)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", color: d.transfer > 0 ? "#185FA5" : "var(--color-text-secondary)" }}>
                          {fmtRp(d.transfer)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                          {fmtRp(d.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)", fontWeight: 700 }}>
                      <td style={{ padding: "10px 12px", fontSize: 12 }}>TOTAL</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", color: "#185FA5" }}>{fmtRp(agg.konsulTotal)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", color: "#7c3aed" }}>{fmtRp(agg.obatTotal)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", color: "#185FA5" }}>{fmtRp(agg.transfer)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontSize: 14 }}>{fmtRp(agg.grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OtcStats({ sales, byMethod, totalOmset }) {
  const [statsMonth, setStatsMonth] = useState(new Date().toISOString().slice(0, 7));

  const monthly = sales.filter((s) => s.date.startsWith(statsMonth));
  const monthTotal = monthly.reduce((s, r) => s + r.subtotal, 0);

  // Top items by revenue
  const itemMap = {};
  monthly.forEach((sale) => {
    sale.items.forEach((it) => {
      if (!itemMap[it.nama]) itemMap[it.nama] = { nama: it.nama, qty: 0, total: 0 };
      itemMap[it.nama].qty += it.qty;
      itemMap[it.nama].total += it.harga * it.qty;
    });
  });
  const topItems = Object.values(itemMap).sort((a, b) => b.total - a.total).slice(0, 10);

  // Daily breakdown for the month
  const dailyMap = {};
  monthly.forEach((sale) => {
    if (!dailyMap[sale.date]) dailyMap[sale.date] = 0;
    dailyMap[sale.date] += sale.subtotal;
  });
  const dailyRows = Object.entries(dailyMap).sort(([a], [b]) => b.localeCompare(a));

  const methodTotalsMonthly = ["cash", "transfer", "qris"].map((m) => ({
    method: m,
    total: monthly.filter((s) => s.method === m).reduce((s, r) => s + r.subtotal, 0),
    count: monthly.filter((s) => s.method === m).length,
  }));
  const methodColors = { cash: "#3B6D11", transfer: "#185FA5", qris: "#854F0B" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <label style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 }}>Periode:</label>
        <input
          type="month"
          value={statsMonth}
          onChange={(e) => setStatsMonth(e.target.value)}
          style={{ ...S.input, width: "auto" }}
        />
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          {monthly.length} transaksi · <strong>{formatRupiah(monthTotal)}</strong>
        </span>
      </div>

      {/* Per metode */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        {methodTotalsMonthly.map((m) => (
          <div key={m.method} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
            <Badge color={METHOD_COLOR[m.method]}>{METHOD_LABEL[m.method]}</Badge>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 10, color: m.total > 0 ? methodColors[m.method] : "var(--color-text-secondary)" }}>
              {formatRupiah(m.total)}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>{m.count} transaksi</div>
          </div>
        ))}
      </div>

      {/* Top items */}
      {topItems.length > 0 && (
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Top Item Terlaris (Bulan Ini)</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                <th style={{ textAlign: "left", padding: "4px 0 8px", color: "var(--color-text-secondary)", fontSize: 11, fontWeight: 600 }}>NAMA ITEM</th>
                <th style={{ textAlign: "center", padding: "4px 0 8px", color: "var(--color-text-secondary)", fontSize: 11, fontWeight: 600, width: 60 }}>QTY</th>
                <th style={{ textAlign: "right", padding: "4px 0 8px", color: "var(--color-text-secondary)", fontSize: 11, fontWeight: 600 }}>OMSET</th>
              </tr>
            </thead>
            <tbody>
              {topItems.map((it, i) => (
                <tr key={it.nama} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                  <td style={{ padding: "7px 0" }}>
                    <span style={{ fontWeight: i < 3 ? 700 : 400, color: i < 3 ? "#185FA5" : "var(--color-text-primary)" }}>
                      {i < 3 ? ["🥇 ", "🥈 ", "🥉 "][i] : `${i + 1}. `}{it.nama}
                    </span>
                  </td>
                  <td style={{ padding: "7px 0", textAlign: "center" }}>{it.qty}</td>
                  <td style={{ padding: "7px 0", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{formatRupiah(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Daily breakdown */}
      {dailyRows.length > 0 && (
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Penjualan Harian</div>
          <div style={{ display: "grid", gap: 6 }}>
            {dailyRows.map(([date, total]) => {
              const pct = monthTotal > 0 ? Math.round((total / monthTotal) * 100) : 0;
              return (
                <div key={date} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, color: "var(--color-text-secondary)", width: 90, flexShrink: 0 }}>
                    {new Date(date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                  </span>
                  <div style={{ flex: 1, height: 8, background: "var(--color-background-secondary)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "#185FA5", borderRadius: 4, transition: "width 0.3s" }} />
                  </div>
                  <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, width: 100, textAlign: "right" }}>{formatRupiah(total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {monthly.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--color-text-secondary)", fontSize: 13 }}>
          Tidak ada data penjualan untuk bulan ini.
        </div>
      )}
    </div>
  );
}

// ── Summary Card helper ────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color }) {
  return (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || "var(--color-text-primary)", lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── REALTIME INDICATOR ──────────────────────────────────────────────────────
// Menampilkan status koneksi Realtime WebSocket di topbar
function RealtimeIndicator() {
  const [status, setStatus] = useState("connecting"); // connecting | live | polling | offline

  useEffect(() => {
    const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { setStatus("offline"); return; }

    const wsUrl = SUPABASE_URL.replace("https://", "wss://").replace("http://", "ws://")
      + `/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;

    let ws;
    let reconnectTimer;
    let connected = false;

    const connect = () => {
      setStatus("connecting");
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => { connected = true; setStatus("live"); };
        ws.onclose = () => {
          connected = false;
          setStatus("polling");
          reconnectTimer = setTimeout(connect, 5000);
        };
        ws.onerror = () => { setStatus("polling"); };
      } catch { setStatus("polling"); }
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  const config = {
    live:       { dot: "#22c55e", label: "Live", title: "Realtime aktif — update instan antar pengguna" },
    polling:    { dot: "#f59e0b", label: "Sync", title: "Mode polling 2 detik — Realtime tidak tersedia" },
    connecting: { dot: "#94a3b8", label: "...",  title: "Menghubungkan ke Supabase Realtime..." },
    offline:    { dot: "#ef4444", label: "Offline", title: "Supabase tidak dikonfigurasi" },
  }[status];

  const statusImg = {
    live:       "/icons/status-live.png",
    polling:    "/icons/status-live-sync.png",
    connecting: "/icons/status-live-sync.png",
    offline:    "/icons/status-offline.png",
  }[status];

  return (
    <div title={config.title} style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 20, marginRight: 8,
      background: status === "live" ? "#f0fdf4" : status === "polling" ? "#fef3c7" : "#f8fafc",
      border: `1px solid ${status === "live" ? "#bbf7d0" : status === "polling" ? "#fcd34d" : "#e2e8f0"}`,
      cursor: "default", flexShrink: 0,
    }}>
      <img
        src={statusImg}
        alt={config.label}
        style={{
          width: 28, height: 28, objectFit: "contain",
          animation: status === "live" ? "rtpulse 2s infinite" : "none",
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))",
        }}
      />
      <span style={{ fontSize: 11, fontWeight: 600, color: status === "live" ? "#166534" : status === "polling" ? "#92400e" : "#64748b" }}>
        {config.label}
      </span>
      <style>{`@keyframes rtpulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("cashier");
  const [doctors, setDoctors] = useStorage(STORAGE_KEYS.doctors, defaultDoctors);
  const [transactions, setTransactions] = useStorage(STORAGE_KEYS.transactions, []);
  const [settings, setSettings] = useStorage(STORAGE_KEYS.settings, defaultSettings);
  const [invoiceCounter, setInvoiceCounter] = useStorage(STORAGE_KEYS.invoiceCounter, 0);
  const [prescriptions, setPrescriptions] = useStorage(STORAGE_KEYS.prescriptions, []);
  const [prescriptionCounter, setPrescriptionCounter] = useStorage(STORAGE_KEYS.prescriptionCounter, 0);
  const [printSettings, setPrintSettings] = useStorage(STORAGE_KEYS.printSettings, defaultPrintSettings);
  const [cashCounts, setCashCounts] = useStorage(STORAGE_KEYS.cashCounts, []);
  const [otcSales, setOtcSales] = useStorage(STORAGE_KEYS.otcSales, []);
  const [otcCounter, setOtcCounter] = useStorage(STORAGE_KEYS.otcCounter, 0);
  const [copyResepList, setCopyResepList] = useStorage(STORAGE_KEYS.copyResepList, []);
  const [copyResepCounter, setCopyResepCounter] = useStorage(STORAGE_KEYS.copyResepCounter, 0);
  const [copyResepSettings, setCopyResepSettings] = useStorage(STORAGE_KEYS.copyResepSettings, defaultCopyResepSettings);

  // ── AUTH — Supabase Auth, role dari tabel user_profiles ──────────
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [pendingPatient, setPendingPatient] = useState(null);

  useEffect(() => {
    restoreSession().then((profile) => {
      setCurrentUser(profile);
      setAuthChecked(true);
    });
  }, []);

  const handleLogin = (profile) => setCurrentUser(profile);
  const handleLogout = async () => {
    await supabaseSignOut();
    setCurrentUser(null);
    setPage("cashier");
  };

  if (!authChecked) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Memuat sesi…</div>;
  }

  if (!currentUser) {
    return <LoginPageSupabase onLogin={handleLogin} clinicName={settings.clinicName} />;
  }

  const isDokter = currentUser.role === "dokter";

  const fullNav = [
    { id: "cashier", label: "Kasir", icon: null, iconImg: "/icons/nav-kasir.png" },
    { id: "eresep-dokter", label: "E-Resep Dokter", icon: null, iconImg: "/icons/nav-eresep-dokter.png" },
    { id: "rekam-medis", label: "Rekam Medis", icon: null, iconImg: "/icons/nav-rekam-medis.png" },
    { id: "eresep-apoteker", label: "E-Resep Apoteker", icon: null, iconImg: "/icons/nav-eresep-apoteker.png" },
    { id: "copy-resep", label: "Salinan Resep", icon: null, iconImg: "/icons/nav-salinan-resep.png" },
    { id: "history", label: "Riwayat", icon: null, iconImg: "/icons/nav-riwayat.png" },
    { id: "doctors", label: "Dokter", icon: null, iconImg: "/icons/nav-dokter.png" },
    { id: "reports", label: "Laporan", icon: null, iconImg: "/icons/nav-laporan.png" },
    { id: "settings", label: "Nota", icon: null, iconImg: "/icons/nav-nota.png" },
    { id: "prescription-settings", label: "Kop Resep", icon: null, iconImg: "/icons/nav-kop-resep.png" },
    { id: "copy-resep-settings", label: "Kop Salinan Resep", icon: null, iconImg: "/icons/nav-kop-salinan-resep.png" },
    { id: "account", label: "Akun", icon: null, iconImg: "/icons/nav-user.png" },
    ...(currentUser?.email === "dev@bima.local"
      ? [{ id: "dev-panel", label: "Dev Panel", icon: "🛠️", iconImg: null }]
      : []),
  ];

  // Doctor role is restricted to E-Resep Dokter + Rekam Medis; pharmacist sees everything.
  const nav = isDokter
    ? fullNav.filter((n) => n.id === "eresep-dokter" || n.id === "rekam-medis")
    : fullNav;
  const effectivePage = nav.some((n) => n.id === page) ? page : nav[0].id;

  const today = transactions.filter((tx) => tx.date.startsWith(new Date().toISOString().slice(0, 10)));
  const todayTotal = today.reduce((s, tx) => s + tx.fee, 0);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", fontFamily: "var(--font)" }}>

      {/* ── Top Bar ───────────────────────────────────────────── */}
      <div style={{
        background: "#ffffff",
        borderBottom: "1.5px solid var(--border-mid)",
        padding: "0 28px",
        display: "flex", alignItems: "stretch",
        position: "sticky", top: 0, zIndex: 200,
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
      }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", marginRight: 24, borderRight: "1.5px solid var(--border-mid)", paddingRight: 24 }}>
          <img src={logoSm} alt="PANCANAKA" style={{ height: 34, width: "auto", objectFit: "contain", flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text-primary)", lineHeight: 1.2, letterSpacing: 0.5 }}>PANCANAKA</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Kasir & E-Resep</div>
          </div>
        </div>

        {/* Realtime status indicator */}
        <div style={{ display: "flex", alignItems: "center", paddingLeft: 8 }}>
          <RealtimeIndicator />
        </div>

        {/* Navigation tabs */}
        <div style={{ display: "flex", gap: 0, flex: 1, overflowX: "auto" }}>
          {nav.map((n) => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{
              padding: "4px 16px", border: "none", background: "none", cursor: "pointer",
              fontSize: 13.5, fontFamily: "var(--font)",
              color: effectivePage === n.id ? "var(--brand)" : "var(--text-secondary)",
              borderBottom: `2.5px solid ${effectivePage === n.id ? "var(--brand)" : "transparent"}`,
              borderTop: "2.5px solid transparent",
              fontWeight: effectivePage === n.id ? 600 : 400,
              whiteSpace: "nowrap", transition: "color 0.15s, border-color 0.15s",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {n.iconImg
                ? <img src={n.iconImg} alt="" style={{ width: 26, height: 26, objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.18))" }} />
                : <span style={{ fontSize: 14 }}>{n.icon}</span>
              }
              {n.label}
              {n.id === "eresep-apoteker" && (() => { const w = prescriptions.filter(rx => rx.status === "MENUNGGU_DISPENSING").length; return w > 0 ? (<span style={{ background: "#f59e0b", color: "#fff", fontSize: 10, borderRadius: 10, padding: "1px 6px", fontWeight: 700 }}>{w}</span>) : null; })()}
              {n.id === "copy-resep" && copyResepList.length > 0 && (
                <span style={{ background: "var(--brand)", color: "#fff", fontSize: 10, borderRadius: 10, padding: "1px 6px", fontWeight: 700 }}>
                  {copyResepList.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Right: user + date + logout */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingLeft: 16, borderLeft: "1.5px solid var(--border-mid)", marginLeft: 8, whiteSpace: "nowrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img
              src={isDokter ? "/icons/nav-eresep-dokter.png" : "/icons/nav-apoteker.png"}
              alt={isDokter ? "Dokter" : "Apoteker"}
              style={{ width: 28, height: 28, objectFit: "contain", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.18))" }}
            />
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>{currentUser.full_name}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{ROLE_LABELS[currentUser.role]}</div>
            </div>
          </div>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {new Date().toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
          </span>
          <button
            onClick={() => { if (window.confirm("Keluar dari akun ini?")) handleLogout(); }}
            className="kk-btn kk-btn-ghost kk-btn-sm"
            title="Keluar"
            style={{ color: "var(--red-text)" }}
          >
            🚪
          </button>
        </div>
      </div>

      {/* ── Cashier day summary strip ─────────────────────────── */}
      {effectivePage === "cashier" && (
        <div style={{ background: "var(--blue-bg)", borderBottom: "1.5px solid var(--blue-border)", padding: "7px 28px", display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontSize: 12.5, color: "var(--blue-text)", fontWeight: 500 }}>📅 Hari ini:</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>{today.length} transaksi</span>
          <span style={{ color: "var(--blue-border)", fontSize: 12 }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>{formatRupiah(todayTotal)}</span>
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--blue-text)", background: "#fff", border: "1.5px solid var(--blue-border)", borderRadius: 20, padding: "2px 10px", fontWeight: 600 }}>
            💊 {prescriptions.length} Resep
          </span>
        </div>
      )}

      {/* ── Page Content ──────────────────────────────────────── */}
      <div style={{ padding: "24px 28px 0", maxWidth: "100%" }}>
        {effectivePage === "cashier" && <PageCashier doctors={doctors} transactions={transactions} setTransactions={setTransactions} invoiceCounter={invoiceCounter} setInvoiceCounter={setInvoiceCounter} settings={settings} onNavigateToRekamMedis={() => setPage("rekam-medis")} />}
        {effectivePage === "eprescribing" && <PageEPrescribing doctors={doctors} prescriptions={prescriptions} setPrescriptions={setPrescriptions} prescriptionCounter={prescriptionCounter} setPrescriptionCounter={setPrescriptionCounter} printSettings={printSettings} />}
        {effectivePage === "eresep-dokter" && (
          <PageEResepDokter
            doctors={doctors}
            prescriptions={prescriptions}
            setPrescriptions={setPrescriptions}
            prescriptionCounter={prescriptionCounter}
            setPrescriptionCounter={setPrescriptionCounter}
            printSettings={printSettings}
            initialPatient={pendingPatient}
            onPatientConsumed={() => setPendingPatient(null)}
            currentUser={currentUser}
            onNavigateToRekamMedis={() => setPage("rekam-medis")}
          />
        )}
        {effectivePage === "rekam-medis" && (
          <PageRekamMedis
            doctors={doctors}
            currentUser={currentUser}
            onCreateRecipeFor={(patient) => { setPendingPatient(patient); setPage("eresep-dokter"); }}
          />
        )}
        {effectivePage === "eresep-apoteker" && <PageEResepApoteker prescriptions={prescriptions} setPrescriptions={setPrescriptions} doctors={doctors} printSettings={printSettings} />}
        {effectivePage === "copy-resep" && <PageCopyResep copyResepList={copyResepList} setCopyResepList={setCopyResepList} copyResepCounter={copyResepCounter} setCopyResepCounter={setCopyResepCounter} copyResepSettings={copyResepSettings} />}
        {effectivePage === "history" && <PageHistory transactions={transactions} setTransactions={setTransactions} doctors={doctors} settings={settings} />}
        {effectivePage === "doctors" && <PageDoctors doctors={doctors} setDoctors={setDoctors} />}
        {effectivePage === "reports" && <PageReports transactions={transactions} doctors={doctors} cashCounts={cashCounts} setCashCounts={setCashCounts} settings={settings} otcSales={otcSales} setOtcSales={setOtcSales} otcCounter={otcCounter} setOtcCounter={setOtcCounter} />}
        {effectivePage === "settings" && <PageSettings settings={settings} setSettings={setSettings} />}
        {effectivePage === "prescription-settings" && <PagePrescriptionSettings printSettings={printSettings} setPrintSettings={setPrintSettings} />}
        {effectivePage === "copy-resep-settings" && <PageCopyResepSettings copyResepSettings={copyResepSettings} setCopyResepSettings={setCopyResepSettings} />}
        {effectivePage === "account" && <PageAkunSupabase currentUser={currentUser} onLogout={handleLogout} />}
        {effectivePage === "dev-panel" && <PageDevPanel currentUser={currentUser} />}
      </div>
    </div>
  );
}
