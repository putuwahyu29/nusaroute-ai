import React, { useState } from "react";
import { login } from "../services/api.js";
import {
  AppMarkIcon,
  SunIcon,
  MoonIcon,
  AlertIcon,
} from "../components/UiIcons.jsx";

/**
 * LoginPage — Premium entry point for NusaRoute AI.
 * Handles courier authentication.
 */
export default function LoginPage({ onLogin, theme, toggleTheme }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await login(email, password);
      onLogin(result.user);
    } catch (err) {
      setError(
        err.message || "Email atau kata sandi salah. Silakan coba lagi.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-main flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
      {/* Theme Toggle on Login Page */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="w-12 h-12 flex items-center justify-center rounded-2xl bg-surface border border-theme shadow-xl hover:scale-105 active:scale-95 transition-all text-xl"
        >
          {theme === "dark" ? (
            <SunIcon className="w-5 h-5 text-text-main" />
          ) : (
            <MoonIcon className="w-5 h-5 text-text-main" />
          )}
        </button>
      </div>
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sage-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-md animate-scale-in relative z-10">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center mx-auto mb-6 transform -rotate-6 shadow-2xl overflow-hidden border-2 border-primary/10">
            <img src="/icons/icon-512.png" alt="NusaRoute Logo" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-3xl font-black text-text-main mb-2 tracking-tight">
            NusaRoute AI
          </h1>
          <p className="text-text-muted uppercase tracking-[0.2em] text-[10px] font-bold">
            Kecerdasan Logistik Perkotaan
          </p>
        </div>

        <div className="glass-card-sage p-8 border-theme shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-0"></div>
          <h2 className="text-xl font-bold text-text-main mb-6 relative z-10">
            Masuk Petugas{" "}
            <span className="text-text-muted font-normal">/ Login</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2 ml-1">
                Alamat Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kurir@nusaroute.ai"
                className="w-full bg-surface border border-theme rounded-xl px-4 py-3 text-text-main placeholder:text-text-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-text-muted mb-2 ml-1">
                Kata Sandi
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface border border-theme rounded-xl px-4 py-3 text-text-main placeholder:text-text-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] py-2 px-4 rounded-lg flex items-center gap-2">
                <AlertIcon className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-sage py-4 rounded-xl text-white font-bold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
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
                "Masuk ke Dashboard"
              )}
            </button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-8 pt-6 border-t border-theme">
              <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-3 text-center">
                Akses Produksi (Staging)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail("budi@nusaroute.ai");
                    setPassword("nusaroute2026");
                  }}
                  className="py-2.5 bg-surface hover:bg-main border border-theme rounded-xl text-[10px] text-text-main font-bold transition-all"
                >
                  Kurir: Budi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("dispatcher@nusaroute.ai");
                    setPassword("nusaroute2026");
                  }}
                  className="py-2.5 bg-surface hover:bg-main border border-theme rounded-xl text-[10px] text-text-main font-bold transition-all"
                >
                  Dispatcher
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center mt-8 text-text-muted/40 text-xs font-medium">
          Hak Cipta © 2026{" "}
          <span className="text-text-muted">Awd</span>
        </p>
      </div>
    </div>
  );
}
