// src/pages/auth/LoginPageSupabase.jsx
// Pengganti LoginPage lama (cek username/password di JSON blob `users`).
// Login sekarang lewat Supabase Auth (email + password), lalu role/nama
// staf diambil dari tabel user_profiles.

import { useState } from "react";
import { signIn } from "../../lib/auth";
import { logoMd } from "../../lib/logoAssets";

export default function LoginPageSupabase({ onLogin, clinicName }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email dan password wajib diisi.");
      return;
    }
    setLoading(true);
    const { error: err, profile } = await signIn(email.trim(), password);
    setLoading(false);

    if (err) {
      setError("Email atau password salah.");
      return;
    }
    if (!profile) {
      setError("Akun ini belum terdaftar sebagai staf klinik. Hubungi admin untuk didaftarkan di user_profiles.");
      return;
    }
    if (!profile.active) {
      setError("Akun ini sudah tidak aktif. Hubungi admin.");
      return;
    }
    onLogin(profile);
  };

  return (
    <div style={{
      minHeight: "100svh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#ffffff",
      fontFamily: "var(--font)", padding: 20,
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 0 }}>
          <img
            src={logoMd}
            alt="PANCANAKA"
            style={{ width: "100%", maxWidth: 360, height: "auto", margin: "0 auto", display: "block", objectFit: "contain" }}
          />
        </div>

        <form onSubmit={handleSubmit} className="kk-card" style={{ padding: 26, borderTop: "none", borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          <div className="kk-field-label">Email</div>
          <input
            className="kk-input"
            type="email"
            style={{ marginBottom: 16 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="username@bima.local"
            autoFocus
            autoCapitalize="none"
            autoComplete="username"
          />

          <div className="kk-field-label">Password</div>
          <div style={{ position: "relative", marginBottom: error ? 12 : 6 }}>
            <input
              className="kk-input"
              style={{ paddingRight: 40 }}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              style={{ position: "absolute", right: 4, top: 4, bottom: 4, width: 32, border: "none", background: "transparent", cursor: "pointer", fontSize: 15, color: "var(--text-muted)" }}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          {error && (
            <div style={{ background: "var(--red-bg)", border: "1.5px solid var(--red-border)", color: "var(--red-text)", borderRadius: "var(--r-sm)", padding: "8px 12px", fontSize: 12.5, marginBottom: 14, fontWeight: 500 }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="kk-btn kk-btn-primary kk-btn-block kk-btn-lg" style={{ marginTop: 6, opacity: loading ? 0.75 : 1 }}>
            {loading ? "Memeriksa…" : "🔓 Masuk"}
          </button>
        </form>

      </div>
    </div>
  );
}
