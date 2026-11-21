import React, { useState } from "react";
import { login, loginWithGoogle } from "../services/api";
import { isGoogleAuthAvailable, signInWithGooglePopup } from "../firebase";
import { SunIcon, MoonIcon, AlertIcon, LockIcon } from "../components/UiIcons";
import { User } from "../types";

interface LoginPageProps {
  onLogin: (user: User) => void;
  theme: string;
  toggleTheme: () => void;
}

function GoogleLogoIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a21.8 21.8 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a21.8 21.8 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function LoginPage({ onLogin, theme, toggleTheme }: LoginPageProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setIsLoading(true);
    setError("");

    try {
      const result = await login(identifier.trim(), password);
      onLogin(result.user);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Username/email atau kata sandi tidak valid. Silakan coba lagi."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError("");

    try {
      const idToken = await signInWithGooglePopup();
      const result = await loginWithGoogle(idToken);
      onLogin(result.user);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Autentikasi Google gagal. Silakan coba lagi."
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const isBusy = isLoading || isGoogleLoading;

  return (
    <div className="min-h-screen bg-main flex flex-col items-center justify-between p-6 relative transition-colors duration-200">
      {/* Top Bar */}
      <div className="w-full max-w-md flex items-center justify-end pt-2">
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface border border-theme text-text-muted hover:text-text-main transition-colors shadow-sm"
        >
          {theme === "dark" ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Authentication Box */}
      <div className="w-full max-w-md my-auto py-8">
        {/* Brand Identity */}
        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-surface border border-theme shadow-md flex items-center justify-center mx-auto mb-4 overflow-hidden">
            <img src="/icons/icon-192.png" alt="NusaRoute AI" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-main">Masuk ke NusaRoute AI</h1>
          <p className="text-xs text-text-muted mt-1.5">
            Akses dasbor kurir dan dispatcher sesuai peran akun Anda
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-surface border border-theme rounded-2xl p-6 sm:p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-xs font-medium text-text-muted mb-1.5"
              >
                Username atau Email
              </label>
              <input
                id="login-identifier"
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Masukkan username atau email"
                className="w-full bg-main border border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-text-muted mb-1.5"
              >
                Kata Sandi
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="w-full bg-main border border-theme rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-dim hover:text-text-main transition-colors"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2"
              >
                <AlertIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className="w-full btn-sage py-2.5 mt-1 text-sm flex items-center justify-center gap-2 font-semibold disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Memverifikasi...
                </>
              ) : (
                <>
                  <LockIcon className="w-4 h-4" />
                  Masuk
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-theme/70" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
              <span className="bg-surface px-3 text-text-dim font-medium">atau</span>
            </div>
          </div>

          {/* Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isBusy || !isGoogleAuthAvailable}
            title={
              !isGoogleAuthAvailable
                ? "Konfigurasi Firebase Auth Web SDK (VITE_FIREBASE_*) belum aktif"
                : "Masuk menggunakan akun Google terdaftar"
            }
            className="w-full py-2.5 px-4 rounded-xl bg-main hover:bg-main/80 border border-theme text-text-main text-sm font-medium flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isGoogleLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Menghubungkan ke Google...
              </>
            ) : (
              <>
                <GoogleLogoIcon className="w-4 h-4" />
                Masuk dengan Google
              </>
            )}
          </button>

          <p className="mt-4 text-[11px] text-center text-text-dim leading-relaxed">
            Akses hanya tersedia bagi akun petugas yang terdaftar oleh administrator.
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <footer className="text-center text-[11px] text-text-muted font-medium pb-2">
        NusaRoute AI &bull; Platform Manajemen &amp; Navigasi Pengiriman
      </footer>
    </div>
  );
}
