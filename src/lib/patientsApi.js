// src/lib/patientsApi.js
// Semua operasi rekam medis (pasien, alergi, kunjungan, riwayat resep,
// audit log) lewat tabel relasional Supabase — bukan blob JSON.
// Soft-delete & audit trail ditangani otomatis oleh trigger/RLS di DB
// (lihat MIGRATION-RME-V6.sql), jadi fungsi di sini sengaja TIDAK
// menyediakan hard-delete untuk data medis.

import { supabase, isSupabaseConfigured } from "./supabaseClient";

function notConfigured() {
  return new Error("Supabase belum dikonfigurasi (cek .env)");
}

function genRmNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RM-${y}${m}-${rand}`;
}

// ── PASIEN ──────────────────────────────────────────────────────
export async function searchPatients(query) {
  if (!isSupabaseConfigured) return { data: [], error: null };
  const q = (query || "").trim();
  let req = supabase.from("patients").select("*").is("deleted_at", null).order("name").limit(25);
  if (q) {
    req = req.or(`name.ilike.%${q}%,rm_number.ilike.%${q}%,nik.ilike.%${q}%`);
  }
  const { data, error } = await req;
  return { data: data || [], error };
}

export async function getPatient(id) {
  if (!isSupabaseConfigured) return { data: null, error: notConfigured() };
  return supabase.from("patients").select("*").eq("id", id).single();
}

export async function createPatient(payload) {
  if (!isSupabaseConfigured) return { data: null, error: notConfigured() };
  const row = {
    rm_number: payload.rmNumber?.trim() || genRmNumber(),
    nik: payload.nik?.trim() || null,
    name: payload.name?.trim(),
    gender: payload.gender || null,
    birth_date: payload.birthDate || null,
    phone: payload.phone?.trim() || null,
    address: payload.address?.trim() || null,
    chronic_conditions: payload.chronicConditions?.trim() || null,
    // Kelengkapan data registrasi (lihat MIGRATION-SOAP-V7.sql)
    kk_number: payload.kkNumber?.trim() || null,
    religion: payload.religion?.trim() || null,
    status: payload.status || null,                       // UMUM / BPJS / SKTM / GRATIS
    insurance_number: payload.insuranceNumber?.trim() || null,
    occupation: payload.occupation?.trim() || null,
  };
  const { data, error } = await supabase.from("patients").insert(row).select().single();
  return { data, error };
}

export async function updatePatient(id, payload) {
  if (!isSupabaseConfigured) return { error: notConfigured() };
  // Catatan: ini UPDATE biasa, BUKAN penggantian seluruh riwayat.
  // Audit trigger otomatis mencatat old/new value di audit_log.
  return supabase.from("patients").update(payload).eq("id", id);
}

// "Hapus" pasien = soft delete. Tidak ada hard-delete by design (lihat RLS).
export async function softDeletePatient(id) {
  if (!isSupabaseConfigured) return { error: notConfigured() };
  return supabase.from("patients").update({ deleted_at: new Date().toISOString() }).eq("id", id);
}

// ── ALERGI (riwayat, bukan field tunggal) ───────────────────────
export async function getAllergies(patientId, { includeResolved = false } = {}) {
  if (!isSupabaseConfigured) return { data: [], error: null };
  let req = supabase.from("allergies_log").select("*").eq("patient_id", patientId).order("reported_at", { ascending: false });
  if (!includeResolved) req = req.is("resolved_at", null);
  const { data, error } = await req;
  return { data: data || [], error };
}

export async function addAllergy(patientId, allergen, severity = "tidak diketahui", note = "") {
  if (!isSupabaseConfigured) return { error: notConfigured() };
  return supabase.from("allergies_log").insert({
    patient_id: patientId,
    allergen: allergen.trim(),
    severity,
    note: note?.trim() || null,
  });
}

// Alergi tidak pernah dihapus, hanya ditandai tidak lagi aktif/relevan.
export async function resolveAllergy(allergyId) {
  if (!isSupabaseConfigured) return { error: notConfigured() };
  return supabase.from("allergies_log").update({ resolved_at: new Date().toISOString() }).eq("id", allergyId);
}

// ── KUNJUNGAN (ENCOUNTER) — format SOAP ─────────────────────────
// `soap` mengikuti struktur formulir SOAP kertas klinik (lihat
// MIGRATION-SOAP-V7.sql): header kunjungan, S, O, A, P.
function soapToRow(soap = {}) {
  return {
    // Header
    room_destination: soap.roomDestination?.trim() || null,
    visit_date: soap.visitDate || undefined, // biarkan default now() kalau tidak diisi
    time_start: soap.timeStart || null,
    time_end: soap.timeEnd || null,
    // S — Subjective
    anamnesis: soap.chiefComplaint?.trim() || null,
    // O — Objective
    vs_td: soap.vsTd?.trim() || null,
    vs_rr: soap.vsRr?.trim() || null,
    vs_nadi: soap.vsNadi?.trim() || null,
    vs_suhu: soap.vsSuhu?.trim() || null,
    pf_bb: soap.pfBb?.trim() || null,
    pf_tb: soap.pfTb?.trim() || null,
    pf_lp: soap.pfLp?.trim() || null,
    supporting_exam: soap.supportingExam?.trim() || null,
    // A — Assessment
    diagnosis: soap.diagnosis?.trim() || null,
    icd10_code: soap.icd10Code?.trim() || null,
    differential_diagnosis: soap.differentialDiagnosis?.trim() || null,
    nursing_diagnosis: soap.nursingDiagnosis?.trim() || null,
    // P — Plan
    therapy_plan: soap.therapyPlan?.trim() || null,
    nursing_care: soap.nursingCare?.trim() || null,
    // TTD Petugas
    staff_name: soap.staffName?.trim() || null,
  };
}

export async function createEncounter({ patientId, doctorId, soap }) {
  if (!isSupabaseConfigured) return { data: null, error: notConfigured() };
  const row = { patient_id: patientId, doctor_id: doctorId || null, ...soapToRow(soap) };
  if (row.visit_date === undefined) delete row.visit_date;
  const { data, error } = await supabase.from("encounters").insert(row).select().single();
  return { data, error };
}

export async function updateEncounter(id, { doctorId, soap } = {}) {
  if (!isSupabaseConfigured) return { data: null, error: notConfigured() };
  const row = { ...soapToRow(soap) };
  if (row.visit_date === undefined) delete row.visit_date;
  if (doctorId !== undefined) row.doctor_id = doctorId || null;
  const { data, error } = await supabase.from("encounters").update(row).eq("id", id).select().single();
  return { data, error };
}

// Kunjungan/SOAP adalah rekam medis — tidak pernah hard-delete, hanya soft-delete.
export async function softDeleteEncounter(id) {
  if (!isSupabaseConfigured) return { error: notConfigured() };
  return supabase.from("encounters").update({ deleted_at: new Date().toISOString() }).eq("id", id);
}

// ── RIWAYAT GABUNGAN (untuk halaman Rekam Medis) ────────────────
export async function getPatientHistory(patientId) {
  if (!isSupabaseConfigured) return { encounters: [], prescriptions: [] };
  const [encRes, rxRes] = await Promise.all([
    supabase.from("encounters").select("*").eq("patient_id", patientId).is("deleted_at", null).order("visit_date", { ascending: false }),
    supabase.from("prescriptions").select("*, prescription_items(*)").eq("patient_id", patientId).is("deleted_at", null).order("created_at", { ascending: false }),
  ]);
  return { encounters: encRes.data || [], prescriptions: rxRes.data || [] };
}

// ── RESEP — soft delete pengganti tombol hapus permanen ─────────
export async function softDeletePrescription(id) {
  if (!isSupabaseConfigured) return { error: notConfigured() };
  return supabase.from("prescriptions").update({ deleted_at: new Date().toISOString() }).eq("id", id);
}

export async function insertPrescriptionRecord(rx) {
  if (!isSupabaseConfigured) return { error: notConfigured() };
  // Menyimpan resep ke tabel relasional (selain tetap disimpan di state
  // lokal untuk preview cetak). Dipanggil dari PageEResepDokter saat
  // pasien sudah dipilih lewat PatientSelector (punya patient_id valid).
  const { error: rxError } = await supabase.from("prescriptions").insert({
    id: rx.id,
    prescription_number: rx.prescriptionNumber,
    patient_id: rx.patientId,
    patient_name: rx.patientName,
    patient_age: rx.patientAge,
    patient_gender: rx.patientGender,
    patient_weight: rx.patientWeight,
    patient_rm: rx.patientRM,
    doctor_id: rx.doctorId,
    doctor_name: rx.selectedDoctor?.name || null,
    doctor_data: rx.selectedDoctor || null,
    encounter_id: rx.encounterId || null,
    date: rx.date,
    diagnosis: rx.diagnosis,
    allergies: rx.allergies,
    notes_for_pharmacist: rx.notesForPharmacist,
    status: rx.status,
    created_by: rx.createdBy || null,
  });
  if (rxError) return { error: rxError };

  if (rx.medicines?.length) {
    const items = rx.medicines.map((m, i) => ({
      prescription_id: rx.id,
      drug_name: m.text || "",
      compounded: !!m.compounded,
      sort_order: i,
    }));
    const { error: itemsError } = await supabase.from("prescription_items").insert(items);
    if (itemsError) return { error: itemsError };
  }
  return { error: null };
}

// ── AUDIT LOG (read-only, admin saja — ditegakkan oleh RLS) ─────
export async function getAuditLog(tableName, rowId) {
  if (!isSupabaseConfigured) return { data: [], error: null };
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("table_name", tableName)
    .eq("row_id", rowId)
    .order("changed_at", { ascending: false });
  return { data: data || [], error };
}
