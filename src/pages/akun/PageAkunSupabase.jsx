// src/pages/akun/PageAkunSupabase.jsx
// Pengganti PageAccount lama. TIDAK ADA input password di halaman ini —
// password sepenuhnya domain Supabase Auth. Halaman ini hanya mengelola
// metadata staf (nama, role, aktif/nonaktif) di tabel user_profiles.

import { useState, useEffect } from "react";
import {
  listStaff,
  registerStaffProfile,
  updateStaffProfile,
  deactivateStaff,
  reactivateStaff,
  sendPasswordReset,
} from "../../lib/auth";

const ROLE_LABELS = { dokter: "Dokter", apoteker: "Apoteker", admin: "Admin" };

export default function PageAkunSupabase({ currentUser, onLogout }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ authUserId: "", fullName: "", role: "dokter", sip: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const isAdmin = currentUser?.role === "admin";

  const refresh = async () => {
    setLoading(true);
    const { data } = await listStaff();
    setStaff(data);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const handleAdd = async () => {
    setError("");
    if (!addForm.authUserId.trim() || !addForm.fullName.trim()) {
      setError("UUID akun Supabase Auth dan nama wajib diisi.");
      return;
    }
    const { error: err } = await registerStaffProfile({
      authUserId: addForm.authUserId.trim(),
      fullName: addForm.fullName.trim(),
      role: addForm.role,
      sip: addForm.sip.trim(),
    });
    if (err) {
      setError("Gagal menambahkan staf: " + err.message + " — pastikan UUID sudah dibuat di Supabase Auth Dashboard terlebih dahulu.");
      return;
    }
    setAddForm({ authUserId: "", fullName: "", role: "dokter", sip: "" });
    setShowAddForm(false);
    refresh();
  };

  const handleSaveEdit = async (id) => {
    await updateStaffProfile(id, { full_name: editForm.full_name, role: editForm.role, sip: editForm.sip });
    setEditingId(null);
    refresh();
  };

  const handleToggleActive = async (s) => {
    const ok = window.confirm(
      s.active
        ? `Nonaktifkan akun "${s.full_name}"? Akun tidak bisa login lagi, tapi riwayat aksinya tetap tersimpan untuk audit.`
        : `Aktifkan kembali akun "${s.full_name}"?`
    );
    if (!ok) return;
    if (s.active) await deactivateStaff(s.id);
    else await reactivateStaff(s.id);
    refresh();
  };

  const handleResetPassword = async (email) => {
    const { error: err } = await sendPasswordReset(email);
    if (err) {
      setNotice("");
      setError("Gagal mengirim email reset: " + err.message);
    } else {
      setError("");
      setNotice(`Email reset password sudah dikirim ke ${email}.`);
      setTimeout(() => setNotice(""), 4000);
    }
  };

  const visibleStaff = isAdmin ? staff : staff.filter((s) => s.id === currentUser?.id);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>Akun & Staf</h2>
        {isAdmin && (
          <button className="kk-btn kk-btn-secondary kk-btn-sm" onClick={() => setShowAddForm((s) => !s)}>
            {showAddForm ? "Batal" : "+ Tambah Staf"}
          </button>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 20 }}>
        Login &amp; password dikelola lewat Supabase Auth — halaman ini hanya mengatur nama, role, dan status aktif staf.
      </div>

      {error && (
        <div style={{ background: "var(--red-bg)", border: "1.5px solid var(--red-border)", color: "var(--red-text)", borderRadius: "var(--r-sm)", padding: "10px 14px", fontSize: 12.5, marginBottom: 16, fontWeight: 500 }}>
          ⚠️ {error}
        </div>
      )}
      {notice && (
        <div style={{ background: "var(--green-bg, #eafbf2)", border: "1.5px solid var(--green-border, #9FE1CB)", color: "var(--green-text, #0f6e56)", borderRadius: "var(--r-sm)", padding: "10px 14px", fontSize: 12.5, marginBottom: 16, fontWeight: 500 }}>
          ✓ {notice}
        </div>
      )}

      {showAddForm && (
        <div className="kk-card" style={{ padding: 18, marginBottom: 18 }}>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 10 }}>
            1) Buat dulu akunnya di <strong>Supabase Dashboard → Authentication → Add user</strong> (email + password).<br />
            2) Tempel UUID user yang baru dibuat di sini untuk menautkan nama &amp; role-nya.
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <input className="kk-input" placeholder="UUID dari Supabase Auth" value={addForm.authUserId} onChange={(e) => setAddForm({ ...addForm, authUserId: e.target.value })} />
            <input className="kk-input" placeholder="Nama lengkap" value={addForm.fullName} onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })} />
            <div style={{ display: "flex", gap: 8 }}>
              <select className="kk-input" value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })} style={{ flex: 1 }}>
                <option value="dokter">Dokter</option>
                <option value="apoteker">Apoteker</option>
                <option value="admin">Admin</option>
              </select>
              <input className="kk-input" placeholder="No. SIP (untuk dokter)" value={addForm.sip} onChange={(e) => setAddForm({ ...addForm, sip: e.target.value })} style={{ flex: 1 }} />
            </div>
            <button className="kk-btn kk-btn-primary" onClick={handleAdd}>Simpan Staf</button>
          </div>
        </div>
      )}

      {loading && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Memuat...</div>}

      <div style={{ display: "grid", gap: 12 }}>
        {visibleStaff.map((s) => (
          <div key={s.id} className="kk-card" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, opacity: s.active ? 1 : 0.6 }}>
            <div style={{
              width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
              background: s.role === "dokter" ? "var(--blue-bg)" : s.role === "admin" ? "var(--purple-bg)" : "var(--purple-bg)",
              border: "1.5px solid var(--blue-border)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19,
            }}>
              {s.role === "dokter" ? "🩺" : s.role === "admin" ? "🛠️" : "⚗️"}
            </div>

            {editingId === s.id ? (
              <div style={{ flex: 1, display: "grid", gap: 8 }}>
                <input className="kk-input" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
                <select className="kk-input" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} disabled={!isAdmin}>
                  <option value="dokter">Dokter</option>
                  <option value="apoteker">Apoteker</option>
                  <option value="admin">Admin</option>
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="kk-btn kk-btn-primary kk-btn-sm" onClick={() => handleSaveEdit(s.id)}>Simpan</button>
                  <button className="kk-btn kk-btn-secondary kk-btn-sm" onClick={() => setEditingId(null)}>Batal</button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>{s.full_name}</span>
                  {s.id === currentUser?.id && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0f6e56", background: "#eafbf2", borderRadius: 20, padding: "1px 8px" }}>Anda</span>}
                  {!s.active && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--red-text)", background: "var(--red-bg)", borderRadius: 20, padding: "1px 8px" }}>Nonaktif</span>}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>{ROLE_LABELS[s.role]}{s.sip ? ` · SIP: ${s.sip}` : ""}</div>
              </div>
            )}

            {editingId !== s.id && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {(isAdmin || s.id === currentUser?.id) && (
                  <button className="kk-btn kk-btn-secondary kk-btn-sm" onClick={() => { setEditingId(s.id); setEditForm(s); }}>✏️ Ubah</button>
                )}
                {isAdmin && (
                  <button className="kk-btn kk-btn-secondary kk-btn-sm" onClick={() => handleToggleActive(s)} style={{ color: s.active ? "var(--red-text)" : undefined }}>
                    {s.active ? "🚫 Nonaktifkan" : "✓ Aktifkan"}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        {currentUser?.email && (
          <button className="kk-btn kk-btn-ghost kk-btn-sm" onClick={() => handleResetPassword(currentUser.email)}>
            🔑 Kirim Email Reset Password untuk Akun Saya
          </button>
        )}
        {onLogout && (
          <button onClick={onLogout} className="kk-btn kk-btn-ghost kk-btn-sm" style={{ color: "var(--red-text)" }}>🚪 Keluar dari Akun</button>
        )}
      </div>
    </div>
  );
}
