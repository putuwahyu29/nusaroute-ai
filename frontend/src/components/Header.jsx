import React, { useState } from "react";
import { AppMarkIcon, SunIcon, MoonIcon, LogoutIcon } from "./UiIcons.jsx";

/**
 * Header component — top navigation bar with logo + connection status.
 */
export default function Header({
  backendStatus,
  user,
  onLogout,
  theme,
  toggleTheme,
}) {
  const isOnline = backendStatus?.status === "ok";
  const courierName = user?.name || "Kurir";
  const [showProfile, setShowProfile] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      <div className="bg-nav-bg backdrop-blur-xl border-b border-theme px-4 py-3 flex items-center justify-between transition-all">
        {/* Logo + Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-lg shadow-primary/20 overflow-hidden">
            <img src="/icons/icon-192.png" alt="NusaRoute Logo" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <h1 className="font-black text-base leading-none text-text-main tracking-tight">
              NusaRoute AI
            </h1>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 relative">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-primary/10 transition-all text-text-main"
            title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
          >
            {theme === "dark" ? (
              <SunIcon className="w-5 h-5" />
            ) : (
              <MoonIcon className="w-5 h-5" />
            )}
          </button>

          {/* Dashboard button removed for RBAC */}
          {/* Profile Avatar & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs border border-white/20 hover:scale-105 transition-all"
            >
              {courierName.charAt(0).toUpperCase()}
            </button>

            {showProfile && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfile(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-surface p-2 shadow-2xl z-50 border border-theme rounded-2xl animate-fade-in">
                  <div className="px-3 py-2 border-b border-theme mb-1">
                    <p className="text-xs font-black truncate text-text-main">
                      {courierName}
                    </p>
                  </div>
                  <button
                    onClick={onLogout}
                    className="w-full text-left px-3 py-2 text-red-500 hover:bg-red-500/10 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
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
