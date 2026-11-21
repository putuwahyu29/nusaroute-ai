import React, { useState } from "react";
import { SunIcon, MoonIcon, LogoutIcon, ShieldIcon, TruckIcon } from "./UiIcons";
import type { User } from "../types";

interface HeaderProps {
  backendStatus?: { status: string; firestore?: string; ai?: string } | null;
  user?: User | null;
  onLogout?: () => void;
  theme: string;
  toggleTheme: () => void;
}

export default function Header({
  user,
  onLogout,
  theme,
  toggleTheme,
}: HeaderProps) {
  const [showProfile, setShowProfile] = useState(false);
  const userName = user?.name || "Petugas Lapangan";
  const isDispatcher = user?.role === "dispatcher";

  return (
    <header className="sticky top-0 z-50 bg-nav-bg backdrop-blur-md border-b border-theme transition-colors">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand & Fleet Info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-surface border border-theme shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/icons/icon-192.png" alt="NusaRoute" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-text-main">
                NusaRoute
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-main border border-theme text-text-muted">
                {isDispatcher ? (
                  <>
                    <ShieldIcon className="w-3 h-3 text-sky-500" /> Dispatcher
                  </>
                ) : (
                  <>
                    <TruckIcon className="w-3 h-3 text-emerald-500" /> Kurir
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* User Menu & Settings */}
        <div className="flex items-center gap-2">

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface border border-theme hover:bg-main text-text-muted hover:text-text-main transition-colors shadow-sm"
            title={theme === "dark" ? "Ganti ke Mode Terang" : "Ganti ke Mode Gelap"}
            type="button"
          >
            {theme === "dark" ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>

          {/* User Profile Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-xl bg-surface border border-theme hover:bg-main transition-colors shadow-sm"
              type="button"
            >
              <div className="w-6 h-6 rounded-lg bg-primary text-white flex items-center justify-center text-xs font-bold font-mono">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-medium text-text-main max-w-[100px] truncate hidden md:inline-block">
                {userName}
              </span>
            </button>

            {showProfile && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfile(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-surface p-2 shadow-xl z-50 border border-theme rounded-xl animate-fade-in">
                  <div className="px-3 py-2 border-b border-theme/60 mb-1">
                    <p className="text-xs font-semibold text-text-main truncate">
                      {userName}
                    </p>
                    <p className="text-[11px] text-text-muted font-mono truncate">
                      {user?.email || "petugas@nusaroute.ai"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowProfile(false);
                      onLogout?.();
                    }}
                    className="w-full text-left px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
                    type="button"
                  >
                    <LogoutIcon className="w-4 h-4" /> Keluar Sesi
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
