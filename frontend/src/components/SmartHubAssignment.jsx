import React from "react";
import { HubIcon, MapPinIcon, PackageIcon, RobotIcon, CheckIcon, TruckIcon } from "./UiIcons.jsx";

/** Map courier IDs to names */
const COURIER_NAMES = {
  "sby-c01": "Budi Santoso",
  "sby-c02": "Agus Setiawan",
  "sby-c03": "Eko Prasetyo",
};

/**
 * SmartHubAssignment — Visualizes AI-powered pickup hub selection.
 * 
 * Konsep: AI mengelompokkan paket-paket yang berdekatan dan menyarankan
 * satu titik parkir (hub) agar kurir bisa distribusi jalan kaki.
 * Dispatcher klik "Terapkan" → instruksi dikirim ke kurir.
 */
export default function SmartHubAssignment({
  hubs = [],
  isLoading = false,
  onApplyHub = null,
  loadingHubId = null,
  appliedHubIds = [],  // IDs of hubs that have been applied
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RobotIcon className="w-5 h-5 animate-spin text-primary" />
        <p className="text-xs text-text-muted font-bold ml-3">
          Mengoptimalkan hub pickup...
        </p>
      </div>
    );
  }

  if (!hubs || hubs.length === 0) {
    return (
      <div className="bg-surface border border-theme rounded-2xl p-4 text-center">
        <PackageIcon className="w-8 h-8 mx-auto mb-2 text-text-muted opacity-50" />
        <p className="text-text-muted text-xs font-bold">
          Tidak ada konsolidasi pickup
        </p>
        <p className="text-text-muted text-[10px] mt-1">
          Semua pengiriman sudah optimal — jarak antar titik terlalu jauh untuk dikonsolidasi.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Explanation Card */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <HubIcon className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-wider mb-1">
              Apa itu Smart Pickup Hub?
            </p>
            <p className="text-[11px] text-text-muted leading-relaxed">
              AI menemukan paket-paket yang <span className="font-bold text-text-main">lokasinya berdekatan</span> (radius 1.5 km). 
              Daripada kurir parkir berkali-kali, cukup parkir <span className="font-bold text-text-main">1x di titik hub</span> lalu 
              distribusikan paket dengan jalan kaki. Hemat waktu & BBM.
            </p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-surface border border-theme rounded-2xl p-3">
        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-2 text-center">Cara Kerja</p>
        <div className="flex items-center justify-between gap-1 px-2">
          <div className="text-center flex-1">
            <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-1">
              <RobotIcon className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <p className="text-[8px] text-text-muted font-bold">AI Analisis</p>
          </div>
          <span className="text-text-muted text-[10px]">→</span>
          <div className="text-center flex-1">
            <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-1">
              <MapPinIcon className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <p className="text-[8px] text-text-muted font-bold">Anda Terapkan</p>
          </div>
          <span className="text-text-muted text-[10px]">→</span>
          <div className="text-center flex-1">
            <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-1">
              <TruckIcon className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <p className="text-[8px] text-text-muted font-bold">Kurir Terima</p>
          </div>
        </div>
      </div>

      {/* Hub Cards */}
      {hubs.map((hub, idx) => {
        const isApplied = appliedHubIds.includes(hub.id);
        const courierIds = [...new Set((hub.deliveries || []).map(d => d.courierId).filter(Boolean))];
        const courierNames = courierIds.map(id => COURIER_NAMES[id] || id);

        return (
          <div
            key={hub.id || idx}
            className={`rounded-2xl p-4 relative overflow-hidden transition-all shadow-md ${
              isApplied 
                ? "bg-green-500/5 border-2 border-green-500/30" 
                : "bg-main border border-theme hover:border-blue-500/30"
            }`}
          >
            {/* Applied badge */}
            {isApplied && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-500 text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase">
                <CheckIcon className="w-3 h-3" /> Diterapkan
              </div>
            )}

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  isApplied 
                    ? "bg-green-500/20 border-green-500/30" 
                    : "bg-blue-500/20 border-blue-500/30"
                }`}>
                  {isApplied 
                    ? <CheckIcon className="w-5 h-5 text-green-500" />
                    : <HubIcon className="w-5 h-5 text-blue-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-text-main truncate">
                    {hub.label || `Hub ${idx + 1}`}
                  </p>
                  {courierNames.length > 0 && (
                    <p className="text-[10px] text-text-muted mt-0.5 flex items-center gap-1">
                      <TruckIcon className="w-3 h-3 shrink-0" />
                      Kurir: {courierNames.join(", ")}
                    </p>
                  )}
                </div>
              </div>

              {/* Cluster Info */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-surface rounded-lg p-2 border border-theme">
                  <p className="text-[9px] text-text-muted font-bold uppercase">
                    Paket Digabung
                  </p>
                  <p className="text-sm font-black text-primary mt-1">
                    {hub.deliveries?.length || hub.count || 0} paket
                  </p>
                </div>
                <div className="bg-surface rounded-lg p-2 border border-theme">
                  <p className="text-[9px] text-text-muted font-bold uppercase">
                    Estimasi Hemat
                  </p>
                  <p className="text-sm font-black text-blue-500 mt-1">
                    ~{hub.savingMinutes || hub.timeSavings || 15} mnt
                  </p>
                </div>
              </div>

              {/* Reason */}
              {hub.reason && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg mb-3">
                  <p className="text-[9px] font-black text-primary uppercase tracking-wider mb-1">
                    💡 Alasan AI
                  </p>
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    {hub.reason}
                  </p>
                </div>
              )}

              {/* Delivery list */}
              {hub.deliveries && hub.deliveries.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-theme">
                  <p className="text-[9px] font-bold text-text-muted uppercase">
                    Paket yang akan dikonsolidasi
                  </p>
                  {hub.deliveries.slice(0, 4).map((del, delIdx) => (
                    <div
                      key={delIdx}
                      className="flex items-center gap-2 text-[10px]"
                    >
                      <PackageIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span className="text-text-main truncate flex-1">
                        {del.recipient || del.id}
                      </span>
                      {isApplied && (
                        <span className="text-[8px] text-green-500 font-bold shrink-0">✓ Terkirim</span>
                      )}
                    </div>
                  ))}
                  {hub.deliveries.length > 4 && (
                    <p className="text-[9px] text-text-muted italic pl-5">
                      + {hub.deliveries.length - 4} paket lainnya
                    </p>
                  )}
                </div>
              )}

              {/* Action Button or Applied Status */}
              {isApplied ? (
                <div className="mt-3 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                  <p className="text-[10px] text-green-600 font-black uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <CheckIcon className="w-3.5 h-3.5" />
                    Instruksi telah dikirim ke kurir
                  </p>
                  <p className="text-[9px] text-text-muted mt-0.5">
                    Kurir akan melihat instruksi hub di aplikasi mereka
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => onApplyHub?.(hub)}
                  disabled={loadingHubId !== null}
                  className="w-full mt-3 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  {loadingHubId === hub.id ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Mengirim ke kurir...
                    </>
                  ) : (
                    <>
                      <MapPinIcon className="w-4 h-4" />
                      Terapkan & Kirim ke Kurir
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
