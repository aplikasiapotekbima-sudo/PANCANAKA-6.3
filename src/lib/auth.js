// src/lib/auth.js
// Menggantikan login custom (cek username/password di JSON blob `users`)
// dengan Supabase Auth. Identitas role/nama staf disimpan di tabel
// user_profiles (lihat MIGRATION-RME-V6.sql Bagian 1).

import { supabase, isSupabaseConfigured } from "./supabaseClient";

export async function signIn(email, password) {
  if (!isSupabaseConfigured) {
    return { error: new Error("Supabase belum dikonfigurasi (cek .env)") };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error };

  const profile = await fetchOwnProfile();
  return { data, profile, error: null };
}

export async function signOut() {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}

export async function getSession() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Ambil baris user_profiles milik user yang sedang login.
// Mengembalikan null jika user login di Supabase Auth tapi BELUM
// didaftarkan sebagai staf klinik (admin lupa insert ke user_profiles).
export async function fetchOwnProfile() {
  if (!isSupabaseConfigured) return null;
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", uid)
    .single();

  if (error) return null;
  // user_profiles tidak menyimpan email (itu domain auth.users) — tempelkan
  // di sini supaya komponen UI (mis. tombol reset password) bisa memakainya
  // tanpa perlu query tambahan ke auth.users.
  return { ...data, email: userData.user.email };
}

// Dipanggil saat app pertama kali load, untuk restore sesi yang masih aktif
// (misal user refresh halaman) tanpa perlu login ulang.
export async function restoreSession() {
  const session = await getSession();
  if (!session) return null;
  const profile = await fetchOwnProfile();
  if (!profile || !profile.active) return null;
  return profile;
}

// Subscribe ke perubahan status auth (login/logout/token refresh dari tab lain)
export function onAuthChange(callback) {
  if (!isSupabaseConfigured) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

// ── Manajemen staf (menggantikan kelola username/password di JSON blob) ──
// Password staf TIDAK PERNAH ditulis/dibaca lewat fungsi-fungsi ini — itu
// sepenuhnya domain Supabase Auth (dashboard, atau alur reset-password
// email di bawah). Yang dikelola di sini hanya metadata: nama, role, aktif.

// Daftar staf. RLS membatasi: non-admin hanya melihat baris dirinya sendiri,
// admin melihat semua (lihat policy "self read" di MIGRATION-RME-V6.sql).
export async function listStaff() {
  if (!isSupabaseConfigured) return { data: [], error: null };
  const { data, error } = await supabase.from("user_profiles").select("*").order("created_at");
  return { data: data || [], error };
}

// Mendaftarkan staf yang akun Supabase Auth-nya SUDAH dibuat admin lewat
// dashboard (Authentication → Add user). Fungsi ini hanya menambahkan baris
// metadata yang menautkan UUID tersebut ke nama & role di klinik.
export async function registerStaffProfile({ authUserId, fullName, role, sip }) {
  if (!isSupabaseConfigured) return { error: new Error("Supabase belum dikonfigurasi") };
  return supabase.from("user_profiles").insert({
    id: authUserId,
    full_name: fullName,
    role,
    sip: sip || null,
  });
}

export async function updateStaffProfile(id, payload) {
  if (!isSupabaseConfigured) return { error: new Error("Supabase belum dikonfigurasi") };
  return supabase.from("user_profiles").update(payload).eq("id", id);
}

// Nonaktifkan akses staf TANPA menghapus akun (sesuai prinsip soft-delete —
// riwayat siapa yang pernah menjadi staf tetap ada untuk audit).
export async function deactivateStaff(id) {
  return updateStaffProfile(id, { active: false });
}

export async function reactivateStaff(id) {
  return updateStaffProfile(id, { active: true });
}

// Kirim email reset password — pengganti fitur "ubah password" lama yang
// menulis password baru langsung ke JSON blob. Supabase yang mengirim email
// berisi link reset; tidak ada password yang melewati server aplikasi kita.
export async function sendPasswordReset(email) {
  if (!isSupabaseConfigured) return { error: new Error("Supabase belum dikonfigurasi") };
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
}
