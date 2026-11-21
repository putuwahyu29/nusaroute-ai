import React from "react";
import {
  PackageOpenIcon,
  PackageIcon,
  MapPinIcon,
  LockIcon,
  ClockIcon,
  CheckIcon,
} from "./UiIcons";
import type { Delivery } from "../types";

interface DeliveryListProps {
  deliveries?: Delivery[];
  onMarkDelivered?: (deliveryId: string) => void;
  activeDeliveryId?: string | null;
  canMarkDelivered?: boolean;
  markDeliveredReason?: string;
  distancesMap?: Record<string, number | null>;
  etasMap?: Record<string, { minutes: number; timeString: string; date: Date } | null>;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string }
> = {
  in_transit: {
    label: "Sedang Dituju",
    badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  },
  pending: {
    label: "Menunggu",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  delivered: {
    label: "Terkirim",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  rerouted: {
    label: "Rute Dialihkan",
    badge: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  },
};

const PRIORITY_CONFIG: Record<string, { label: string; text: string }> = {
  high: { label: "Prioritas Tinggi", text: "text-red-500 font-semibold" },
  medium: { label: "Standar", text: "text-text-muted" },
  low: { label: "Rendah", text: "text-text-dim" },
};

function formatDist(km: number | null | undefined): string | null {
  if (km == null) return null;
  if (km < 0.1) return "< 100 m";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `~${Math.round(km)} km`;
}

function compareWithSchedule(etaDate: Date | undefined, scheduledStr?: string | null): number | null {
  if (!etaDate || !scheduledStr) return null;
  const [h, m] = scheduledStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const scheduled = new Date();
  scheduled.setHours(h, m, 0, 0);
  return Math.round((etaDate.getTime() - scheduled.getTime()) / 60_000);
}

function formatScheduleDiff(diff: number | null): { label: string; color: string } | null {
  if (diff == null) return null;
  const abs = Math.abs(diff);
  if (abs <= 3) return { label: "Tepat Waktu", color: "text-emerald-600 dark:text-emerald-400" };
  if (diff > 0) return { label: `+${diff} mnt`, color: "text-red-600 dark:text-red-400" };
  return { label: `-${abs} mnt`, color: "text-emerald-600 dark:text-emerald-400" };
}

export default function DeliveryList({
  deliveries = [],
  onMarkDelivered,
  activeDeliveryId,
  canMarkDelivered = false,
  markDeliveredReason,
  distancesMap = {},
  etasMap = {},
}: DeliveryListProps) {
  if (!deliveries.length) {
    return (
      <div className="bg-surface border border-theme rounded-2xl p-8 text-center">
        <PackageOpenIcon className="w-10 h-10 mx-auto mb-3 text-text-muted opacity-60" />
        <p className="text-text-main font-semibold text-sm">Tidak ada jadwal pengiriman</p>
        <p className="text-text-muted text-xs mt-1">Seluruh titik tugas hari ini telah diselesaikan.</p>
      </div>
    );
  }

  const completedCount = deliveries.filter((d) => d.status === "delivered").length;
  const progressPercent = Math.round((completedCount / deliveries.length) * 100);

  return (
    <div className="space-y-4">
      {/* Fleet Progress Header */}
      <div className="bg-surface border border-theme rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-bold text-text-main">
              Roster Pengiriman Hari Ini
            </h2>
            <p className="text-xs text-text-muted">
              {completedCount} dari {deliveries.length} paket terkirim
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-primary px-2.5 py-1 rounded-lg bg-main border border-theme">
            {progressPercent}% SELESAI
          </span>
        </div>
        <div className="w-full h-2 bg-main rounded-full overflow-hidden border border-theme/60">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Stop Cards List */}
      <div className="space-y-3">
        {deliveries.map((delivery, idx) => {
          const st = STATUS_CONFIG[delivery.status] || STATUS_CONFIG.pending;
          const pr = PRIORITY_CONFIG[delivery.priority] || PRIORITY_CONFIG.medium;
          const isActive = delivery.id === activeDeliveryId;
          const isDelivered = delivery.status === "delivered";
          const distKm = distancesMap[delivery.id] ?? null;
          const eta = etasMap[delivery.id] ?? null;
          const diff = eta ? compareWithSchedule(eta.date, delivery.estimatedArrival) : null;
          const diffBadge = formatScheduleDiff(diff);

          return (
            <div
              key={delivery.id}
              className={`bg-surface border rounded-xl p-4 transition-all duration-150 ${
                isActive
                  ? "border-primary shadow-md ring-1 ring-primary/20"
                  : isDelivered
                  ? "opacity-60 bg-main/50"
                  : "border-theme hover:border-theme/80"
              }`}
            >
              <div className="flex items-start gap-3.5">
                {/* Stop Number Badge */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-mono shrink-0 transition-colors ${
                    isDelivered
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : isActive
                      ? "bg-primary text-white shadow-sm"
                      : "bg-main text-text-muted border border-theme"
                  }`}
                >
                  {isDelivered ? <CheckIcon className="w-4 h-4" /> : String(idx + 1).padStart(2, "0")}
                </div>

                {/* Main Stop Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-text-main leading-snug line-clamp-2" title={delivery.recipient}>
                      {delivery.recipient}
                    </h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${st.badge} shrink-0`}>
                      {st.label}
                    </span>
                  </div>

                  <p className="text-xs text-text-muted leading-snug line-clamp-2 mb-2" title={delivery.address}>
                    {delivery.address}
                  </p>

                  {/* Operational Notes / Instructions */}
                  {delivery.notes && (
                    <div className="flex items-center gap-1.5 text-xs text-text-muted bg-main px-2.5 py-1.5 rounded-lg border border-theme/60 mb-2">
                      <PackageIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{delivery.notes}</span>
                    </div>
                  )}

                  {/* Consolidated Hub Assignment Tag */}
                  {delivery.pickupHub && (
                    <div className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2.5 py-1.5 rounded-lg border border-sky-500/20 mb-2 font-medium">
                      <MapPinIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Hub Drop-off: {delivery.pickupHub.label}</span>
                    </div>
                  )}

                  {/* Telematics Metrics Bar */}
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs text-text-muted pt-1 border-t border-theme/40 font-mono">
                    {delivery.estimatedArrival && (
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-3 h-3 text-text-dim" />
                        <span>Jadwal: {delivery.estimatedArrival}</span>
                      </span>
                    )}

                    {distKm != null && !isDelivered && (
                      <span className="flex items-center gap-1">
                        <MapPinIcon className="w-3 h-3 text-text-dim" />
                        <span>{formatDist(distKm)}</span>
                      </span>
                    )}

                    {eta && !isDelivered && (
                      <span className="flex items-center gap-1">
                        <span>ETA: <strong className="text-text-main">{eta.timeString}</strong></span>
                        {diffBadge && (
                          <span className={`text-[11px] font-medium ml-1 ${diffBadge.color}`}>
                            ({diffBadge.label})
                          </span>
                        )}
                      </span>
                    )}

                    <span className={`ml-auto text-[11px] font-sans ${pr.text}`}>
                      {pr.label}
                    </span>
                  </div>

                  {/* Active Delivery Confirmation Action */}
                  {isActive && !isDelivered && onMarkDelivered && (
                    <div className="mt-3 pt-3 border-t border-theme/60 space-y-1.5">
                      <button
                        onClick={() => onMarkDelivered(delivery.id)}
                        disabled={!canMarkDelivered}
                        className={`w-full min-h-[48px] px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                          canMarkDelivered
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                            : "bg-main text-text-dim border border-theme cursor-not-allowed opacity-75"
                        }`}
                        type="button"
                      >
                        {canMarkDelivered ? (
                          <>
                            <CheckIcon className="w-4 h-4" />
                            <span>Selesaikan Pengiriman Ini</span>
                          </>
                        ) : (
                          <>
                            <LockIcon className="w-4 h-4 shrink-0" />
                            <span>Konfirmasi Penerimaan Paket</span>
                          </>
                        )}
                      </button>
                      {!canMarkDelivered && (
                        <p className="text-[11px] text-text-dim text-center leading-tight">
                          {markDeliveredReason || "Dekati lokasi (< 200m) untuk mengaktifkan tombol konfirmasi"}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
