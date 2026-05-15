import React from "react";
import {
  PackageOpenIcon,
  PackageIcon,
  MapPinIcon,
  LockIcon,
  ClockIcon,
  CheckIcon,
} from "./UiIcons.jsx";

const STATUS_CONFIG = {
  in_transit: {
    label: "Dalam Perjalanan",
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
    dot: "bg-primary",
  },
  pending: {
    label: "Menunggu",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    dot: "bg-yellow-500",
  },
  delivered: {
    label: "Terkirim",
    color: "text-blue-500",
    bg: "bg-blue-500/10 border-blue-500/20",
    dot: "bg-blue-500",
  },
  rerouted: {
    label: "Dialihkan",
    color: "text-orange-500",
    bg: "bg-orange-500/10 border-orange-500/20",
    dot: "bg-orange-500",
  },
};

const PRIORITY_CONFIG = {
  high: { label: "Tinggi", color: "text-red-500" },
  medium: { label: "Sedang", color: "text-yellow-600" },
  low: { label: "Rendah", color: "text-primary" },
};

function formatDist(km) {
  if (km == null) return null;
  if (km < 0.1) return "< 100 m";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `~${Math.round(km)} km`;
}

function compareWithSchedule(etaDate, scheduledStr) {
  if (!etaDate || !scheduledStr) return null;
  const [h, m] = scheduledStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const scheduled = new Date();
  scheduled.setHours(h, m, 0, 0);
  return Math.round((etaDate.getTime() - scheduled.getTime()) / 60_000);
}

function formatScheduleDiff(diff) {
  if (diff == null) return null;
  const abs = Math.abs(diff);
  if (abs <= 3) return { label: "Tepat Waktu", color: "text-primary" };
  if (diff > 0) return { label: `+${diff} mnt`, color: "text-red-500" };
  return { label: `-${abs} mnt`, color: "text-primary" };
}

export default function DeliveryList({
  deliveries = [],
  onMarkDelivered,
  activeDeliveryId,
  canMarkDelivered = false,
  markDeliveredReason,
  distancesMap = {},
  etasMap = {},
}) {
  if (!deliveries.length) {
    return (
      <div className="bg-surface border border-theme rounded-3xl p-8 text-center">
        <PackageOpenIcon className="w-10 h-10 mx-auto mb-3 text-text-muted" />
        <p className="text-text-main font-bold">
          Tidak ada pengiriman hari ini
        </p>
        <p className="text-text-muted text-xs">Jadwal Anda sudah kosong.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-text-main font-bold text-sm uppercase tracking-wider">
          Daftar Pengiriman
        </h2>
        <span className="text-primary text-xs font-bold">
          {deliveries.length} Titik
        </span>
      </div>

      {deliveries.map((delivery, idx) => {
        const st = STATUS_CONFIG[delivery.status] || STATUS_CONFIG.pending;
        const pr = PRIORITY_CONFIG[delivery.priority] || PRIORITY_CONFIG.medium;
        const isActive = delivery.id === activeDeliveryId;

        return (
          <div
            key={delivery.id}
            className={`bg-surface border transition-all duration-300 rounded-3xl p-5 ${isActive ? "border-primary shadow-lg ring-1 ring-primary/20" : "border-theme"}`}
          >
            <div className="flex items-start gap-4">
              {/* Index */}
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 transition-colors
                ${isActive ? "bg-primary text-white" : "bg-main text-text-muted border border-theme"}`}
              >
                {String(idx + 1).padStart(2, "0")}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p
                      className="text-text-main font-bold text-sm truncate-2-lines"
                      title={delivery.recipient}
                      aria-label={delivery.recipient}
                    >
                      {delivery.recipient}
                    </p>
                    <p
                      className="text-text-muted text-[11px] leading-snug truncate-2-lines"
                      title={delivery.address}
                      aria-label={delivery.address}
                    >
                      {delivery.address}
                    </p>
                  </div>
                  <span
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${st.bg} ${st.color} text-[10px] font-bold shrink-0`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${st.dot} ${delivery.status === "in_transit" ? "animate-pulse" : ""}`}
                    />
                    {st.label}
                  </span>
                </div>

                {/* Notes */}
                {delivery.notes && (
                  <p className="text-[10px] text-primary font-bold italic mb-2 flex items-start gap-1">
                    <PackageIcon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                    <span
                      className="text-text-main truncate-2-lines"
                      title={delivery.notes}
                      aria-label={delivery.notes}
                    >
                      {delivery.notes}
                    </span>
                  </p>
                )}

                {/* Pickup Hub Badge */}
                {delivery.pickupHub && (
                  <div className="mb-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
                    <MapPinIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[9px] text-blue-500 font-black uppercase tracking-wider leading-none">Hub Konsolidasi</p>
                      <p className="text-[10px] text-text-main font-bold truncate">{delivery.pickupHub.label}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2">
                  <div className="flex items-center gap-1.5">
                    <svg
                      className="w-3.5 h-3.5 text-text-muted"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      viewBox="0 0 24 24"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="text-text-muted text-xs font-medium">
                      {delivery.estimatedArrival ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg
                      className="w-3.5 h-3.5 text-text-muted"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      viewBox="0 0 24 24"
                    >
                      <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
                      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                    </svg>
                    <span className="text-text-muted text-xs font-medium">
                      {delivery.packageCount ?? "—"} paket
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-tighter ${pr.color}`}
                  >
                    Prio: {pr.label}
                  </span>
                  {delivery.timeSlot && (
                    <span className="text-[10px] text-text-muted font-medium">
                      🕐 {delivery.timeSlot}
                    </span>
                  )}
                  {/* Dynamic ETA chip */}
                  {etasMap[delivery.id] && delivery.status !== "delivered" && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-primary">
                      <ClockIcon className="w-3.5 h-3.5" />{" "}
                      {etasMap[delivery.id].timeString}
                      <span className="font-normal text-text-muted">
                        ({etasMap[delivery.id].minutes} mnt)
                      </span>
                    </span>
                  )}
                  {/* Distance chip */}
                  {distancesMap[delivery.id] != null &&
                    delivery.status !== "delivered" && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-text-muted">
                        <MapPinIcon className="w-3.5 h-3.5" />{" "}
                        {formatDist(distancesMap[delivery.id])}
                      </span>
                    )}
                  {/* Schedule compliance badge */}
                  {(() => {
                    const eta = etasMap[delivery.id];
                    if (!eta || delivery.status === "delivered") return null;
                    const diff = compareWithSchedule(
                      eta.date,
                      delivery.estimatedArrival,
                    );
                    const badge = formatScheduleDiff(diff);
                    return badge ? (
                      <span className={`text-[9px] font-black ${badge.color}`}>
                        {badge.label}
                      </span>
                    ) : null;
                  })()}
                </div>

                {delivery.status !== "delivered" && (
                  <div className="mt-4">
                    {delivery.id === activeDeliveryId ? (
                      // Active delivery — full clickable button
                      <button
                        disabled={!canMarkDelivered}
                        onClick={() => onMarkDelivered?.(delivery.id)}
                        title={
                          canMarkDelivered
                            ? "Tandai pengiriman ini sebagai terkirim"
                            : markDeliveredReason
                        }
                        className={`w-full py-2.5 rounded-xl text-xs font-black
                                   transition-all active:scale-95 flex items-center justify-center gap-2
                                   ${
                                     canMarkDelivered
                                       ? "bg-primary hover:opacity-90 text-white shadow-md shadow-primary/20"
                                       : "bg-surface border-2 border-theme text-text-muted shadow-none cursor-not-allowed"
                                   }`}
                      >
                        {canMarkDelivered ? (
                          <>
                            <span>✓</span>
                            <span className="ml-1">Tandai Terkirim</span>
                          </>
                        ) : (
                          <>
                            <LockIcon className="w-3.5 h-3.5" />
                            <span className="ml-2 text-[11px] font-bold whitespace-normal break-words text-left">
                              {markDeliveredReason || "Belum di lokasi"}
                            </span>
                          </>
                        )}
                      </button>
                    ) : (
                      // Not yet active — locked with queue info
                      <div
                        className="w-full py-2.5 rounded-xl border border-theme bg-main
                                      text-text-muted text-[10px] font-bold uppercase tracking-wider
                                      flex items-center justify-center gap-2 cursor-not-allowed select-none"
                      >
                        <LockIcon className="w-3.5 h-3.5 opacity-60" />
                        <span>Dalam Antrian</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
