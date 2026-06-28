// src/pages/auth/LoginPageSupabase.jsx

import { useState } from "react";
import { signIn } from "../../lib/auth";
import { logoMd } from "../../lib/logoAssets";

export default function LoginPageSupabase({ onLogin, clinicName }) {
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

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
    if (err) { setError("Email atau password salah."); return; }
    if (!profile) {
      setError("Akun ini belum terdaftar sebagai staf klinik. Hubungi admin untuk didaftarkan di user_profiles.");
      return;
    }
    if (!profile.active) { setError("Akun ini sudah tidak aktif. Hubungi admin."); return; }
    onLogin(profile);
  };

  return (
    <div style={{
      minHeight: "100svh", width: "100%",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg, #f0fdf4 0%, #eff6ff 50%, #faf5ff 100%)",
      fontFamily: "var(--font)", padding: "20px 16px",
    }}>
      <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>

        {/* ── Logo — di atas card, tidak menyatu/menutupi ── */}
        <div style={{
          width: "100%", display: "flex", justifyContent: "center",
          marginBottom: 8,
          // Drop shadow samar supaya logo terlihat HD di background terang
          filter: "drop-shadow(0 4px 16px rgba(0,80,40,0.13))",
        }}>
          <img
            src={logoMd}
            alt="PANCANAKA"
            style={{
              width: "100%",
              maxWidth: 420,
              height: "auto",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>

        {/* ── Nama klinik ── */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500, letterSpacing: 0.3 }}>
            {clinicName || "Apotek Bima — Sistem Kasir & E-Resep"}
          </div>
        </div>

        {/* ── Login card ── */}
        <div style={{
          width: "100%",
          background: "#ffffff",
          borderRadius: 16,
          border: "1.5px solid #e5e7eb",
          boxShadow: "0 4px 24px rgba(0,0,0,0.09)",
          padding: "28px 28px 24px",
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1f2937", marginBottom: 20, textAlign: "center" }}>
            🔐 Masuk ke Akun
          </div>

          <form onSubmit={handleSubmit}>
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
                style={{
                  position: "absolute", right: 4, top: 4, bottom: 4, width: 32,
                  border: "none", background: "transparent", cursor: "pointer",
                  fontSize: 15, color: "var(--text-muted)",
                }}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {error && (
              <div style={{
                background: "var(--red-bg)", border: "1.5px solid var(--red-border)",
                color: "var(--red-text)", borderRadius: "var(--r-sm)", padding: "8px 12px",
                fontSize: 12.5, marginBottom: 14, fontWeight: 500,
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="kk-btn kk-btn-primary kk-btn-block kk-btn-lg"
              style={{ marginTop: 10, opacity: loading ? 0.75 : 1 }}
            >
              {loading ? "Memeriksa…" : "🔓 Masuk"}
            </button>
          </form>
        </div>

        {/* ── Footer kecil ── */}
        <div style={{ marginTop: 18, fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
          PANCANAKA V 6.3 · Kasir & E-Resep Klinik
        </div>

      </div>
    </div>
  );
}
