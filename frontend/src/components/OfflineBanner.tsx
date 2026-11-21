import React, { useState, useEffect } from "react";

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      const timer = setTimeout(() => {
        setJustReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 1. Kondisi Saat Offline (Merah Mengambang Persis Indikator GPS)
  if (!isOnline) {
    return (
      <aside
        aria-label="Status Koneksi Internet"
        className="sticky top-0 z-[60] w-full bg-rose-600 text-white px-4 py-2.5 shadow-lg shadow-rose-950/20 border-b border-rose-700 animate-slide-down"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Ikon Sinyal Terputus */}
            <div className="w-7 h-7 shrink-0 rounded-lg bg-rose-700/60 border border-white/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-white animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-black tracking-wide uppercase">Koneksi Internet Terputus</p>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-white text-rose-700 tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping inline-block" />
                  OFFLINE
                </span>
              </div>
              <p className="text-[11px] text-white/90 leading-tight truncate sm:whitespace-normal">
                Aplikasi beralih ke Mode Offline. Data rute & paket tetap dapat digunakan dari memori lokal.
              </p>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // 2. Kondisi Saat Kembali Terhubung (Hijau Emerald Sementara)
  if (justReconnected) {
    return (
      <aside
        aria-label="Status Koneksi Internet"
        className="sticky top-0 z-[60] w-full bg-emerald-600 text-white px-4 py-2 shadow-lg shadow-emerald-950/20 border-b border-emerald-700 animate-fade-in"
      >
        <div className="max-w-7xl mx-auto flex items-center gap-2.5">
          <div className="w-6 h-6 shrink-0 rounded-lg bg-emerald-700/60 border border-white/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="text-xs font-bold leading-tight">
            <span>Terhubung Kembali ke Internet</span>
            <span className="text-[11px] font-normal text-emerald-100 ml-1.5 hidden sm:inline">
              — Sinkronisasi cloud Cloud Firestore & status AI aktif kembali.
            </span>
          </div>
        </div>
      </aside>
    );
  }

  return null;
}
