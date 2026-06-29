// src/pages/rekam-medis/PageRekamMedis.jsx
// Pusat rekam medis pasien — SATU-SATUNYA tempat pasien didaftarkan,
// diubah, dan kunjungannya dicatat dalam format SOAP. Diakses dokter &
// apoteker. Menampilkan profil pasien, riwayat alergi (append-only), dan
// riwayat kunjungan SOAP/resep — semua ditarik dari tabel relasional
// Supabase, bukan dari blob JSON.

import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  searchPatients,
  getAllergies,
  addAllergy,
  resolveAllergy,
  getPatientHistory,
  updatePatient,
  softDeletePatient,
  softDeleteEncounter,
} from "../../lib/patientsApi";
import NewPatientModal from "../../components/rekam-medis/NewPatientModal";
import SoapEncounterModal from "../../components/rekam-medis/SoapEncounterModal";

const SEVERITY_STYLE = {
  ringan: { c: "#976d09", bg: "#fff9eb", b: "#ffc94a" },
  sedang: { c: "#9f730d", bg: "#fffaed", b: "#ffd572" },
  berat: { c: "#9e161d", bg: "#fef2f2", b: "#ffa2a7" },
  "tidak diketahui": { c: "#363e52", bg: "#f3f4f6", b: "#d1d4db" },
};

const STATUS_STYLE = {
  UMUM: { c: "#363e52", bg: "#f3f4f6", b: "#d1d4db" },
  BPJS: { c: "#1652df", bg: "#eff4ff", b: "#bed2ff" },
  SKTM: { c: "#9f730d", bg: "#fffaed", b: "#ffd572" },
  GRATIS: { c: "#136840", bg: "#effef7", b: "#b9f9db" },
};

const cardStyle = {
  background: "var(--bg-card)",
  border: "1.5px solid var(--border-mid)",
  borderRadius: "var(--r-lg)",
  padding: "18px 20px",
  boxShadow: "var(--shadow-sm)",
};

function calcAge(birthDate) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (isNaN(b)) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

function SoapRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 12.5, padding: "2px 0" }}>
      <span style={{ color: "var(--text-muted)", minWidth: 150, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function SoapBlock({ letter, color, bg, title, children, hidden }) {
  if (hidden) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{
          width: 20, height: 20, borderRadius: 5, background: bg, color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, flexShrink: 0,
        }}>{letter}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{title}</span>
      </div>
      <div style={{ paddingLeft: 26 }}>{children}</div>
    </div>
  );
}

function EncounterCard({ enc, onEdit, onDelete }) {
  const hasVitals = enc.vs_td || enc.vs_rr || enc.vs_nadi || enc.vs_suhu || enc.pf_bb || enc.pf_tb || enc.pf_lp;
  return (
    <div style={{ border: "1.5px solid var(--border-mid)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--brand)" }}>
          🗓️ {new Date(enc.visit_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          {enc.time_start && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · {enc.time_start}{enc.time_end ? `–${enc.time_end}` : ""}</span>}
          {enc.room_destination && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · {enc.room_destination}</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="kk-btn kk-btn-sm kk-btn-secondary" onClick={() => onEdit(enc)}>✏️ Ubah</button>
          <button className="kk-btn kk-btn-sm kk-btn-secondary" style={{ color: "var(--red-text)" }} onClick={() => onDelete(enc)}>🗑️</button>
        </div>
      </div>

      <SoapBlock letter="S" color="#1652df" bg="#eff4ff" title="Anamnesis" hidden={!enc.anamnesis}>
        <SoapRow label="Keluhan Utama" value={enc.anamnesis} />
      </SoapBlock>

      <SoapBlock letter="O" color="#9f730d" bg="#fffaed" title="Vital Sign & Pemeriksaan" hidden={!hasVitals && !enc.supporting_exam}>
        <SoapRow label="TD / RR / Nadi / Suhu" value={[enc.vs_td, enc.vs_rr && `${enc.vs_rr} x/mnt`, enc.vs_nadi && `${enc.vs_nadi} x/mnt`, enc.vs_suhu && `${enc.vs_suhu} °C`].filter(Boolean).join(" · ") || null} />
        <SoapRow label="BB / TB / LP" value={[enc.pf_bb && `${enc.pf_bb} kg`, enc.pf_tb && `${enc.pf_tb} cm`, enc.pf_lp && `${enc.pf_lp} cm`].filter(Boolean).join(" · ") || null} />
        <SoapRow label="Penunjang / Rujukan" value={enc.supporting_exam} />
      </SoapBlock>

      <SoapBlock letter="A" color="#136840" bg="#effef7" title="Diagnosis" hidden={!enc.diagnosis && !enc.differential_diagnosis && !enc.nursing_diagnosis}>
        <SoapRow label="Diagnosis" value={[enc.diagnosis, enc.icd10_code && `(${enc.icd10_code})`].filter(Boolean).join(" ") || null} />
        <SoapRow label="DD" value={enc.differential_diagnosis} />
        <SoapRow label="Diagnosis Keperawatan" value={enc.nursing_diagnosis} />
      </SoapBlock>

      <SoapBlock letter="P" color="#976d09" bg="#fff9eb" title="Rencana Asuhan" hidden={!enc.therapy_plan && !enc.nursing_care}>
        <SoapRow label="Terapi" value={enc.therapy_plan} />
        <SoapRow label="KIE / Asuhan Keperawatan" value={enc.nursing_care} />
      </SoapBlock>

      {enc.staff_name && (
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>TTD Petugas: {enc.staff_name}</div>
      )}
    </div>
  );
}

export default function PageRekamMedis({ onCreateRecipeFor, doctors, currentUser, settings }) {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [listLoading, setListLoading] = useState(false);

  const [selected, setSelected] = useState(null);
  const [allergies, setAllergies] = useState([]);
  const [history, setHistory] = useState({ encounters: [], prescriptions: [] });
  const [newAllergy, setNewAllergy] = useState({ allergen: "", severity: "sedang", note: "" });
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});

  const [showNewPatient, setShowNewPatient] = useState(false);
  const [soapModal, setSoapModal] = useState(null); // { encounter: null|obj }

  const refreshList = async (query) => {
    setListLoading(true);
    const { data } = await searchPatients(query);
    setList(data);
    setListLoading(false);
  };

  useEffect(() => { refreshList(""); }, []);
  useEffect(() => {
    const t = setTimeout(() => refreshList(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const openPatient = async (p) => {
    setSelected(p);
    setEditMode(false);
    setEditForm(p);
    const [{ data: al }, hist] = await Promise.all([getAllergies(p.id), getPatientHistory(p.id)]);
    setAllergies(al);
    setHistory(hist);
  };

  const refreshSelected = async () => {
    if (!selected) return;
    const { data: al } = await getAllergies(selected.id);
    setAllergies(al);
  };

  const refreshHistory = async () => {
    if (!selected) return;
    const hist = await getPatientHistory(selected.id);
    setHistory(hist);
  };

  const handleAddAllergy = async () => {
    if (!newAllergy.allergen.trim() || !selected) return;
    await addAllergy(selected.id, newAllergy.allergen, newAllergy.severity, newAllergy.note);
    setNewAllergy({ allergen: "", severity: "sedang", note: "" });
    refreshSelected();
  };

  const handleResolveAllergy = async (id) => {
    await resolveAllergy(id);
    refreshSelected();
  };

  const handleSaveEdit = async () => {
    const { error } = await updatePatient(selected.id, {
      name: editForm.name,
      phone: editForm.phone,
      address: editForm.address,
      nik: editForm.nik,
      birth_date: editForm.birth_date,
      gender: editForm.gender,
      chronic_conditions: editForm.chronic_conditions,
      kk_number: editForm.kk_number,
      religion: editForm.religion,
      status: editForm.status,
      insurance_number: editForm.insurance_number,
      occupation: editForm.occupation,
    });
    if (!error) {
      setSelected({ ...selected, ...editForm });
      setEditMode(false);
      refreshList(q);
    }
  };

  const handleDeactivate = async () => {
    if (!selected) return;
    const ok = window.confirm(
      `Nonaktifkan data pasien "${selected.name}"?\n\nData TIDAK dihapus — tetap tersimpan untuk keperluan rekam medis & audit, hanya disembunyikan dari pencarian aktif.`
    );
    if (!ok) return;
    await softDeletePatient(selected.id);
    setSelected(null);
    refreshList(q);
  };

  const handlePatientCreated = async (patient) => {
    setShowNewPatient(false);
    refreshList(q);
    // Buka data pasien terlebih dahulu, lalu langsung buka formulir SOAP
    // agar user bisa langsung input kunjungan pertama tanpa harus klik tombol
    await openPatient(patient);
    setSoapModal({ encounter: null });
  };

  const handleDeleteEncounter = async (enc) => {
    const ok = window.confirm("Hapus kunjungan ini? Data akan disembunyikan dari riwayat aktif, tapi tetap tersimpan untuk audit.");
    if (!ok) return;
    await softDeleteEncounter(enc.id);
    refreshHistory();
  };

  // ── Export Rekam Medis (PDF) ──────────────────────────────────────────────
  const handleExportPdf = () => {
    if (!selected) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const clinicName = settings?.clinicName || "Klinik";
    const clinicAddress = settings?.address || "";
    const clinicPhone = settings?.phone || "";
    const clinicLogo = settings?.logo || "";
    const BRAND = [27, 42, 82]; // navy — selaras tema Pancanaka
    let y = 15;

    const checkPageBreak = (needed = 20) => {
      if (y + needed > pageHeight - 15) {
        doc.addPage();
        y = 15;
      }
    };

    // Header klinik (kop)
    if (clinicLogo) {
      try {
        const fmtMatch = /^data:image\/(png|jpe?g|webp);base64,/i.exec(clinicLogo);
        const fmt = fmtMatch ? fmtMatch[1].toUpperCase().replace("JPG", "JPEG") : "PNG";
        const logoW = 18, logoH = 18;
        doc.addImage(clinicLogo, fmt, pageWidth / 2 - logoW / 2, y, logoW, logoH);
        y += logoH + 3;
      } catch (e) {
        // logo gagal dimuat (format tidak didukung) — lanjut tanpa logo
      }
    }
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

    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text("REKAM MEDIS PASIEN", pageWidth / 2, y, { align: "center" });
    y += 8;

    // Profil pasien
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Data Pasien", 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      theme: "grid",
      body: [
        ["Nama", selected.name || "-", "No. RM", selected.rm_number || "-"],
        ["NIK", selected.nik || "-", "No. KK", selected.kk_number || "-"],
        ["Jenis Kelamin", selected.gender === "L" ? "Laki-laki" : selected.gender === "P" ? "Perempuan" : "-", "Tgl Lahir / Umur", selected.birth_date ? `${selected.birth_date} (${calcAge(selected.birth_date)} thn)` : "-"],
        ["No. HP", selected.phone || "-", "Status", selected.status || "-"],
        ["Agama", selected.religion || "-", "Pekerjaan", selected.occupation || "-"],
        ["No. BPJS/SKTM", selected.insurance_number || "-", "", ""],
        ["Alamat", { content: selected.address || "-", colSpan: 3 }, "", ""],
        ["Riwayat Penyakit Kronis", { content: selected.chronic_conditions || "-", colSpan: 3 }, "", ""],
      ],
      styles: { fontSize: 8.5, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 38 }, 2: { fontStyle: "bold", cellWidth: 38 } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    // Riwayat alergi
    checkPageBreak(20);
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Riwayat Alergi", 14, y);
    y += 2;
    const allergyBody = allergies.length > 0
      ? allergies.map((a) => [a.allergen, a.severity, a.note || "-"])
      : [["Tidak ada alergi aktif tercatat.", "", ""]];
    autoTable(doc, {
      startY: y,
      head: [["Alergen", "Tingkat Keparahan", "Catatan"]],
      body: allergyBody,
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: BRAND },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    // Riwayat kunjungan SOAP
    checkPageBreak(25);
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Riwayat Kunjungan (SOAP)", 14, y);
    y += 7;

    if (history.encounters.length === 0) {
      doc.setFontSize(8.5);
      doc.setFont(undefined, "normal");
      doc.text("Belum ada kunjungan tercatat.", 14, y);
      y += 6;
    } else {
      history.encounters.forEach((enc) => {
        checkPageBreak(35);
        const tanggal = new Date(enc.visit_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
        const waktu = [enc.time_start && `${enc.time_start}${enc.time_end ? `–${enc.time_end}` : ""}`, enc.room_destination].filter(Boolean).join(" · ");
        doc.setFontSize(9);
        doc.setFont(undefined, "bold");
        doc.text(`${tanggal}${waktu ? "  ·  " + waktu : ""}`, 14, y);
        y += 4;

        const rows = [];
        if (enc.anamnesis) rows.push(["S — Anamnesis", enc.anamnesis]);
        const vitals = [enc.vs_td, enc.vs_rr && `${enc.vs_rr} x/mnt`, enc.vs_nadi && `${enc.vs_nadi} x/mnt`, enc.vs_suhu && `${enc.vs_suhu} °C`].filter(Boolean).join(" · ");
        const antro = [enc.pf_bb && `${enc.pf_bb} kg`, enc.pf_tb && `${enc.pf_tb} cm`, enc.pf_lp && `${enc.pf_lp} cm`].filter(Boolean).join(" · ");
        if (vitals) rows.push(["O — Vital Sign", vitals]);
        if (antro) rows.push(["O — BB/TB/LP", antro]);
        if (enc.supporting_exam) rows.push(["O — Penunjang", enc.supporting_exam]);
        if (enc.diagnosis) rows.push(["A — Diagnosis", [enc.diagnosis, enc.icd10_code && `(${enc.icd10_code})`].filter(Boolean).join(" ")]);
        if (enc.differential_diagnosis) rows.push(["A — DD", enc.differential_diagnosis]);
        if (enc.nursing_diagnosis) rows.push(["A — Dx Keperawatan", enc.nursing_diagnosis]);
        if (enc.therapy_plan) rows.push(["P — Terapi", enc.therapy_plan]);
        if (enc.nursing_care) rows.push(["P — KIE/Askep", enc.nursing_care]);
        if (enc.staff_name) rows.push(["Petugas", enc.staff_name]);

        autoTable(doc, {
          startY: y,
          theme: "grid",
          body: rows.length > 0 ? rows : [["-", "Tidak ada catatan SOAP"]],
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: { 0: { fontStyle: "bold", cellWidth: 38, textColor: BRAND } },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 6;
      });
    }

    // Riwayat resep
    checkPageBreak(25);
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Riwayat Resep", 14, y);
    y += 2;
    const rxBody = history.prescriptions.length > 0
      ? history.prescriptions.map((rx) => [
          new Date(rx.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
          rx.prescription_number || "-",
          rx.doctor_name || "-",
          rx.diagnosis || "-",
          rx.prescription_items?.length ? `${rx.prescription_items.length} item obat${rx.prescription_items.some((i) => i.compounded) ? " (racikan)" : ""}` : "-",
        ])
      : [["Tidak ada data", "", "", "", ""]];
    autoTable(doc, {
      startY: y,
      head: [["Tanggal", "No. Resep", "Dokter", "Diagnosis", "Item Obat"]],
      body: rxBody,
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: BRAND },
      margin: { left: 14, right: 14 },
    });

    // Footer cetak
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont(undefined, "normal");
      doc.setTextColor(120);
      doc.text(
        `Dicetak ${new Date().toLocaleString("id-ID")} · Halaman ${i}/${totalPages}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" }
      );
      doc.setTextColor(0);
    }

    const safeName = (selected.name || "Pasien").replace(/[^a-zA-Z0-9]+/g, "_");
    doc.save(`RekamMedis_${safeName}_${selected.rm_number || ""}.pdf`);
  };

  // ── Export Rekam Medis (Excel) ────────────────────────────────────────────
  const handleExportExcel = () => {
    if (!selected) return;
    const wb = XLSX.utils.book_new();

    // Sheet Data Pasien
    const wsProfil = XLSX.utils.aoa_to_sheet([
      ["Data Pasien"],
      [],
      ["Nama", selected.name || "-"],
      ["No. RM", selected.rm_number || "-"],
      ["NIK", selected.nik || "-"],
      ["No. KK", selected.kk_number || "-"],
      ["Jenis Kelamin", selected.gender === "L" ? "Laki-laki" : selected.gender === "P" ? "Perempuan" : "-"],
      ["Tanggal Lahir", selected.birth_date || "-"],
      ["Umur", selected.birth_date ? `${calcAge(selected.birth_date)} tahun` : "-"],
      ["No. HP", selected.phone || "-"],
      ["Alamat", selected.address || "-"],
      ["Status", selected.status || "-"],
      ["No. BPJS/SKTM", selected.insurance_number || "-"],
      ["Agama", selected.religion || "-"],
      ["Pekerjaan", selected.occupation || "-"],
      ["Riwayat Penyakit Kronis", selected.chronic_conditions || "-"],
    ]);
    XLSX.utils.book_append_sheet(wb, wsProfil, "Data Pasien");

    // Sheet Alergi
    const wsAlergi = XLSX.utils.aoa_to_sheet([
      ["Alergen", "Tingkat Keparahan", "Catatan"],
      ...(allergies.length > 0 ? allergies.map((a) => [a.allergen, a.severity, a.note || "-"]) : [["Tidak ada alergi aktif tercatat.", "", ""]]),
    ]);
    XLSX.utils.book_append_sheet(wb, wsAlergi, "Riwayat Alergi");

    // Sheet Kunjungan SOAP
    const soapHeader = ["Tanggal", "Waktu", "Ruang", "Anamnesis (S)", "Vital Sign (O)", "BB/TB/LP (O)", "Penunjang (O)", "Diagnosis (A)", "DD (A)", "Dx Keperawatan (A)", "Terapi (P)", "KIE/Askep (P)", "Petugas"];
    const soapRows = history.encounters.map((enc) => [
      new Date(enc.visit_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
      [enc.time_start, enc.time_end].filter(Boolean).join("–"),
      enc.room_destination || "-",
      enc.anamnesis || "-",
      [enc.vs_td, enc.vs_rr && `${enc.vs_rr} x/mnt`, enc.vs_nadi && `${enc.vs_nadi} x/mnt`, enc.vs_suhu && `${enc.vs_suhu} °C`].filter(Boolean).join(" · ") || "-",
      [enc.pf_bb && `${enc.pf_bb} kg`, enc.pf_tb && `${enc.pf_tb} cm`, enc.pf_lp && `${enc.pf_lp} cm`].filter(Boolean).join(" · ") || "-",
      enc.supporting_exam || "-",
      [enc.diagnosis, enc.icd10_code && `(${enc.icd10_code})`].filter(Boolean).join(" ") || "-",
      enc.differential_diagnosis || "-",
      enc.nursing_diagnosis || "-",
      enc.therapy_plan || "-",
      enc.nursing_care || "-",
      enc.staff_name || "-",
    ]);
    const wsSoap = XLSX.utils.aoa_to_sheet([soapHeader, ...(soapRows.length > 0 ? soapRows : [["Belum ada kunjungan tercatat."]])]);
    XLSX.utils.book_append_sheet(wb, wsSoap, "Riwayat Kunjungan");

    // Sheet Resep
    const rxHeader = ["Tanggal", "No. Resep", "Dokter", "Diagnosis", "Jumlah Item Obat", "Termasuk Racikan"];
    const rxRows = history.prescriptions.map((rx) => [
      new Date(rx.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
      rx.prescription_number || "-",
      rx.doctor_name || "-",
      rx.diagnosis || "-",
      rx.prescription_items?.length || 0,
      rx.prescription_items?.some((i) => i.compounded) ? "Ya" : "Tidak",
    ]);
    const wsRx = XLSX.utils.aoa_to_sheet([rxHeader, ...(rxRows.length > 0 ? rxRows : [["Belum ada resep tercatat."]])]);
    XLSX.utils.book_append_sheet(wb, wsRx, "Riwayat Resep");

    const safeName = (selected.name || "Pasien").replace(/[^a-zA-Z0-9]+/g, "_");
    XLSX.writeFile(wb, `RekamMedis_${safeName}_${selected.rm_number || ""}.xlsx`);
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 48 }}>
      <div style={{ marginBottom: 18, display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>📁 Rekam Medis</h2>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>
            Registrasi pasien & pencatatan kunjungan format SOAP — sumber data utama, terhubung ke E-Resep Dokter
          </div>
        </div>
        <button className="kk-btn kk-btn-primary" style={{ marginLeft: "auto" }} onClick={() => setShowNewPatient(true)}>
          + Pasien Baru
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start" }}>
        {/* LEFT: daftar pasien */}
        <div style={cardStyle}>
          <input
            className="kk-input"
            placeholder="🔍 Cari nama / RM / NIK..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "65vh", overflowY: "auto" }}>
            {listLoading && <div style={{ fontSize: 12.5, color: "var(--text-muted)", padding: 8 }}>Memuat...</div>}
            {!listLoading && list.length === 0 && (
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", padding: 8, textAlign: "center" }}>
                Belum ada pasien terdaftar. Klik <strong>+ Pasien Baru</strong> di atas untuk mendaftarkan.
              </div>
            )}
            {list.map((p) => (
              <div
                key={p.id}
                onClick={() => openPatient(p)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--r-md)",
                  cursor: "pointer",
                  border: `1.5px solid ${selected?.id === p.id ? "var(--brand)" : "var(--border-mid)"}`,
                  background: selected?.id === p.id ? "var(--blue-bg)" : "#fff",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  RM: {p.rm_number} · {p.gender === "L" ? "Laki-laki" : p.gender === "P" ? "Perempuan" : "-"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: detail pasien */}
        <div>
          {!selected && (
            <div style={{ ...cardStyle, textAlign: "center", padding: 50, color: "var(--text-muted)" }}>
              👈 Pilih pasien dari daftar, atau klik <strong>+ Pasien Baru</strong> untuk mendaftarkan pasien.
            </div>
          )}

          {selected && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Profil */}
              <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 17, fontWeight: 700 }}>{selected.name}</div>
                      {selected.status && (() => {
                        const s = STATUS_STYLE[selected.status] || STATUS_STYLE.UMUM;
                        return (
                          <span style={{ fontSize: 11, fontWeight: 700, color: s.c, background: s.bg, border: `1.5px solid ${s.b}`, borderRadius: 20, padding: "2px 10px" }}>
                            {selected.status}
                          </span>
                        );
                      })()}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                      RM: {selected.rm_number}{selected.nik ? ` · NIK: ${selected.nik}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                    {onCreateRecipeFor && (
                      <button className="kk-btn kk-btn-sm kk-btn-primary" onClick={() => onCreateRecipeFor(selected)}>
                        🩺 Buat Resep
                      </button>
                    )}
                    <button className="kk-btn kk-btn-sm kk-btn-secondary" onClick={handleExportPdf} title="Ekspor rekam medis lengkap ke PDF">
                      📄 Ekspor PDF
                    </button>
                    <button className="kk-btn kk-btn-sm kk-btn-secondary" onClick={handleExportExcel} title="Ekspor rekam medis lengkap ke Excel">
                      📊 Ekspor Excel
                    </button>
                    <button className="kk-btn kk-btn-sm kk-btn-secondary" onClick={() => setEditMode((e) => !e)}>
                      {editMode ? "Batal" : "✏️ Ubah"}
                    </button>
                    <button
                      className="kk-btn kk-btn-sm kk-btn-secondary"
                      onClick={handleDeactivate}
                      style={{ color: "var(--red-text)" }}
                    >
                      🚫 Nonaktifkan
                    </button>
                  </div>
                </div>

                {!editMode ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16, fontSize: 13 }}>
                    <div><div style={{ color: "var(--text-muted)", fontSize: 11 }}>Jenis Kelamin</div>{selected.gender === "L" ? "Laki-laki" : selected.gender === "P" ? "Perempuan" : "-"}</div>
                    <div><div style={{ color: "var(--text-muted)", fontSize: 11 }}>Tanggal Lahir / Umur</div>{selected.birth_date ? `${selected.birth_date} (${calcAge(selected.birth_date)} thn)` : "-"}</div>
                    <div><div style={{ color: "var(--text-muted)", fontSize: 11 }}>No. HP</div>{selected.phone || "-"}</div>
                    <div style={{ gridColumn: "1 / -1" }}><div style={{ color: "var(--text-muted)", fontSize: 11 }}>Alamat</div>{selected.address || "-"}</div>
                    <div><div style={{ color: "var(--text-muted)", fontSize: 11 }}>No. KK</div>{selected.kk_number || "-"}</div>
                    <div><div style={{ color: "var(--text-muted)", fontSize: 11 }}>Agama</div>{selected.religion || "-"}</div>
                    <div><div style={{ color: "var(--text-muted)", fontSize: 11 }}>Pekerjaan</div>{selected.occupation || "-"}</div>
                    <div><div style={{ color: "var(--text-muted)", fontSize: 11 }}>No. BPJS / SKTM</div>{selected.insurance_number || "-"}</div>
                    <div style={{ gridColumn: "1 / -1" }}><div style={{ color: "var(--text-muted)", fontSize: 11 }}>Riwayat Penyakit Kronis</div>{selected.chronic_conditions || "-"}</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
                    <input className="kk-input" value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Nama" />
                    <input className="kk-input" value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="No. HP" />
                    <input className="kk-input" type="date" value={editForm.birth_date || ""} onChange={(e) => setEditForm({ ...editForm, birth_date: e.target.value })} />
                    <select className="kk-input" value={editForm.gender || "L"} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                      <option value="L">Laki-laki</option>
                      <option value="P">Perempuan</option>
                    </select>
                    <input className="kk-input" style={{ gridColumn: "1 / -1" }} value={editForm.nik || ""} onChange={(e) => setEditForm({ ...editForm, nik: e.target.value })} placeholder="NIK" />
                    <input className="kk-input" style={{ gridColumn: "1 / -1" }} value={editForm.address || ""} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="Alamat" />
                    <input className="kk-input" value={editForm.kk_number || ""} onChange={(e) => setEditForm({ ...editForm, kk_number: e.target.value })} placeholder="No. KK" />
                    <input className="kk-input" value={editForm.religion || ""} onChange={(e) => setEditForm({ ...editForm, religion: e.target.value })} placeholder="Agama" />
                    <input className="kk-input" value={editForm.occupation || ""} onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })} placeholder="Pekerjaan" />
                    <select className="kk-input" value={editForm.status || "UMUM"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                      <option value="UMUM">UMUM</option>
                      <option value="BPJS">BPJS</option>
                      <option value="SKTM">SKTM</option>
                      <option value="GRATIS">GRATIS</option>
                    </select>
                    <input className="kk-input" style={{ gridColumn: "1 / -1" }} value={editForm.insurance_number || ""} onChange={(e) => setEditForm({ ...editForm, insurance_number: e.target.value })} placeholder="No. BPJS / SKTM" />
                    <textarea className="kk-input" style={{ gridColumn: "1 / -1", resize: "vertical" }} rows={2} value={editForm.chronic_conditions || ""} onChange={(e) => setEditForm({ ...editForm, chronic_conditions: e.target.value })} placeholder="Riwayat penyakit kronis" />
                    <button className="kk-btn kk-btn-primary" style={{ gridColumn: "1 / -1" }} onClick={handleSaveEdit}>💾 Simpan Perubahan</button>
                  </div>
                )}
              </div>

              {/* Alergi */}
              <div style={cardStyle}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>⚠️ Riwayat Alergi</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  {allergies.length === 0 && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Tidak ada alergi aktif tercatat.</span>}
                  {allergies.map((a) => {
                    const s = SEVERITY_STYLE[a.severity] || SEVERITY_STYLE["tidak diketahui"];
                    return (
                      <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: s.bg, border: `1.5px solid ${s.b}`, color: s.c, borderRadius: 20, padding: "4px 6px 4px 12px", fontSize: 12, fontWeight: 600 }}>
                        {a.allergen} <span style={{ fontWeight: 400 }}>({a.severity})</span>
                        <button
                          onClick={() => handleResolveAllergy(a.id)}
                          title="Tandai sudah tidak relevan (riwayat tetap tersimpan)"
                          style={{ border: "none", background: "rgba(0,0,0,0.06)", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", fontSize: 10, color: s.c, lineHeight: 1 }}
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="kk-input" placeholder="Nama alergen (cth: Penisilin)" value={newAllergy.allergen} onChange={(e) => setNewAllergy({ ...newAllergy, allergen: e.target.value })} style={{ flex: 2 }} />
                  <select className="kk-input" value={newAllergy.severity} onChange={(e) => setNewAllergy({ ...newAllergy, severity: e.target.value })} style={{ flex: 1 }}>
                    <option value="ringan">Ringan</option>
                    <option value="sedang">Sedang</option>
                    <option value="berat">Berat</option>
                    <option value="tidak diketahui">Tidak diketahui</option>
                  </select>
                  <button className="kk-btn kk-btn-secondary" onClick={handleAddAllergy}>+ Tambah</button>
                </div>
              </div>

              {/* Riwayat kunjungan SOAP */}
              <div style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>🗓️ Riwayat Kunjungan (SOAP)</div>
                  <button
                    className="kk-btn kk-btn-sm kk-btn-primary"
                    style={{ marginLeft: "auto" }}
                    onClick={() => setSoapModal({ encounter: null })}
                  >
                    + Tambah Kunjungan
                  </button>
                </div>
                {history.encounters.length === 0 && (
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Belum ada kunjungan tercatat untuk pasien ini.</div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {history.encounters.map((enc) => (
                    <EncounterCard
                      key={enc.id}
                      enc={enc}
                      onEdit={(e) => setSoapModal({ encounter: e })}
                      onDelete={handleDeleteEncounter}
                    />
                  ))}
                </div>
              </div>

              {/* Riwayat resep */}
              <div style={cardStyle}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📋 Riwayat Resep</div>
                {history.prescriptions.length === 0 && (
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Belum ada resep tercatat untuk pasien ini.</div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {history.prescriptions.map((rx) => (
                    <div key={rx.id} style={{ border: "1.5px solid var(--border-mid)", borderRadius: "var(--r-md)", padding: "10px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 12.5, color: "var(--brand)" }}>{rx.prescription_number}</span>
                        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                          {new Date(rx.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 3 }}>
                        {rx.diagnosis || "Diagnosis tidak diisi"} · {rx.doctor_name || "-"}
                      </div>
                      {rx.prescription_items?.length > 0 && (
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
                          {rx.prescription_items.length} item obat{rx.prescription_items.some((i) => i.compounded) ? " (termasuk racikan)" : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showNewPatient && (
        <NewPatientModal
          presetName={q && list.length === 0 ? q : ""}
          onClose={() => setShowNewPatient(false)}
          onCreated={handlePatientCreated}
        />
      )}

      {soapModal && selected && (
        <SoapEncounterModal
          patient={selected}
          encounter={soapModal.encounter}
          doctors={doctors}
          doctorId={currentUser?.id}
          onClose={() => setSoapModal(null)}
          onSaved={() => { setSoapModal(null); refreshHistory(); }}
        />
      )}
    </div>
  );
}
