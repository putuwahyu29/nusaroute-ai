import React, { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Cek apakah aplikasi sudah berjalan dalam mode standalone (terpasang di HP/Desktop)
    const checkIsStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes("android-app://");
      return isStandaloneMode;
    };

    if (checkIsStandalone()) {
      setIsInstalled(true);
      return;
    }

    // 2. Cek apakah pengguna baru saja menolak (cooldown 48 jam)
    const lastDismissed = localStorage.getItem("nusaroute_install_dismissed");
    if (lastDismissed) {
      const elapsed = Date.now() - parseInt(lastDismissed, 10);
      const fortyEightHours = 48 * 60 * 60 * 1000;
      if (elapsed < fortyEightHours) {
        return;
      }
    }

    // 3. Deteksi platform iOS (Safari)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !("MSStream" in window);
    setIsIos(isIosDevice);

    // 4. Tangkap event install native browser (Chromium / Chrome Android / Edge / Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Tampilkan banner dengan jeda 2 detik agar transisi halaman awal mulus
      setTimeout(() => setIsVisible(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Untuk iOS Safari yang tidak memiliki event beforeinstallprompt, tampilkan banner setelah delay
    if (isIosDevice) {
      const iosTimer = setTimeout(() => setIsVisible(true), 2500);
      return () => {
        clearTimeout(iosTimer);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      };
    }

    // Tangkap jika aplikasi berhasil diinstal
    const handleAppInstalled = () => {
      setIsVisible(false);
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) {
      // Jika browser tidak mendukung prompt langsung, tampilkan info singkat
      alert("Untuk memasang: Buka menu peramban (ikon titik tiga di kanan atas) lalu pilih 'Tambahkan ke Layar Utama' / 'Install App'.");
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setShowIosGuide(false);
    localStorage.setItem("nusaroute_install_dismissed", String(Date.now()));
  };

  // Jangan tampilkan jika sudah diinstal atau banner ditutup
  if (isInstalled || !isVisible) return null;

  return (
    <aside
      aria-label="Instalasi NusaRoute AI"
      className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:w-96 z-50 pointer-events-auto"
    >
      <div className="relative overflow-hidden rounded-2xl bg-white/95 dark:bg-[#111827]/95 backdrop-blur-xl border border-slate-200/90 dark:border-emerald-500/30 p-4 shadow-xl shadow-slate-900/10 dark:shadow-emerald-950/50 text-slate-800 dark:text-white animate-slide-up">
        {/* Dekorasi Aksen Halus */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-start gap-3">
          {/* Ikon Aplikasi NusaRoute */}
          <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 dark:bg-[#0d1e1a] border border-emerald-200/70 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
              <path d="M15 18H9" />
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
              <circle cx="17" cy="18" r="2" />
              <circle cx="7" cy="18" r="2" />
            </svg>
          </div>

          {/* Konten Teks */}
          <div className="flex-1 min-w-0 pr-6">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight mb-1">
              Instal NusaRoute AI
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Pasang di layar utama HP untuk navigasi layar penuh yang lebih cepat dan hemat kuota di jalan.
            </p>
          </div>

          {/* Tombol Close (✕) */}
          <button
            onClick={handleDismiss}
            aria-label="Tutup notifikasi instalasi"
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Panduan Khusus iOS Safari jika diaktifkan */}
        {showIosGuide && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/30 text-xs text-emerald-900 dark:text-emerald-200 space-y-1.5 animate-fade-in">
            <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
              <span>Cara Pasang di iPhone/iPad:</span>
            </div>
            <p className="flex items-center gap-2">
              <span className="w-4 h-4 shrink-0 rounded-full bg-emerald-200 dark:bg-emerald-500/30 text-center font-bold text-[10px] flex items-center justify-center">1</span>
              Ketuk ikon <b>Bagikan (Share)</b> <svg className="w-3.5 h-3.5 inline mx-1 text-emerald-600 dark:text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> di bilah bawah Safari.
            </p>
            <p className="flex items-center gap-2">
              <span className="w-4 h-4 shrink-0 rounded-full bg-emerald-200 dark:bg-emerald-500/30 text-center font-bold text-[10px] flex items-center justify-center">2</span>
              Pilih <b>"Tambah ke Layar Utama"</b> (<i>Add to Home Screen</i>).
            </p>
          </div>
        )}

        {/* Tombol Aksi */}
        <div className="mt-3 flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            Nanti Saja
          </button>
          <button
            onClick={handleInstallClick}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all duration-200 rounded-lg shadow-sm flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Pasang Sekarang</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
