import React from "react";
import {
  HubIcon,
  MapPinIcon,
  PackageIcon,
  CheckIcon,
  TruckIcon,
  ArrowRightIcon,
} from "./UiIcons";
import type { Delivery, PickupHub } from "../types";

interface SmartHubAssignmentProps {
  hubs?: Array<PickupHub & { deliveries?: Delivery[]; count?: number; savingMinutes?: number; timeSavings?: number }>;
  isLoading?: boolean;
  onApplyHub?: ((hub: PickupHub) => void) | null;
  loadingHubId?: string | null;
  appliedHubIds?: string[];
  courierNameMap?: Record<string, string>;
}

export default function SmartHubAssignment({
  hubs = [],
  isLoading = false,
  onApplyHub = null,
  loadingHubId = null,
  appliedHubIds = [],
  courierNameMap = {},
}: SmartHubAssignmentProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-text-muted font-medium ml-3">Menganalisis kluster konsolidasi hub...</p>
      </div>
    );
  }

  if (!hubs || hubs.length === 0) {
    return (
      <div className="bg-surface border border-theme rounded-xl p-6 text-center">
        <PackageIcon className="w-8 h-8 mx-auto mb-2 text-text-muted opacity-50" />
        <p className="text-text-main text-xs font-semibold">Tidak ada konsolidasi hub aktif</p>
        <p className="text-text-muted text-[11px] mt-1 leading-relaxed">
          Seluruh titik pengiriman telah tersebar optimal atau jarak antar titik melebihi radius kluster.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Information Header */}
      <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3.5">
        <div className="flex items-start gap-2.5">
          <HubIcon className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-sky-600 dark:text-sky-400 mb-0.5">
              Konsolidasi Hub Drop-off
            </p>
            <p className="text-text-muted leading-relaxed">
              Mengelompokkan paket dalam radius padat (1.5 km). Kurir cukup parkir di 1 titik hub sentral untuk mengantarkan paket dengan berjalan kaki, menghemat BBM dan waktu parkir.
            </p>
          </div>
        </div>
      </div>

      {/* Operational Flow */}
      <div className="bg-surface border border-theme rounded-xl p-3">
        <div className="flex items-center justify-between text-xs text-text-muted px-2">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-5 h-5 rounded-md bg-main border border-theme flex items-center justify-center text-[10px] font-mono">1</span>
            <span>Kluster Terdeteksi</span>
          </div>
          <ArrowRightIcon className="w-3.5 h-3.5 text-text-dim shrink-0" />
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-5 h-5 rounded-md bg-main border border-theme flex items-center justify-center text-[10px] font-mono">2</span>
            <span>Delegasi Dispatcher</span>
          </div>
          <ArrowRightIcon className="w-3.5 h-3.5 text-text-dim shrink-0" />
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-5 h-5 rounded-md bg-main border border-theme flex items-center justify-center text-[10px] font-mono">3</span>
            <span>Kurir Eksekusi</span>
          </div>
        </div>
      </div>

      {/* Hub Cards */}
      {hubs.map((hub, idx) => {
        const isApplied = hub.id ? appliedHubIds.includes(hub.id) : false;
        const courierIds = [...new Set((hub.deliveries || []).map((d) => d.courierId).filter(Boolean))];
        const courierNames = courierIds.map((id) => courierNameMap[id as string] || id);

        return (
          <div
            key={hub.id || idx}
            className={`rounded-xl p-4 transition-all border shadow-sm ${
              isApplied
                ? "bg-emerald-500/5 border-emerald-500/30"
                : "bg-surface border-theme hover:border-primary/40"
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-2.5">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                    isApplied
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-primary/10 border-primary/20 text-primary"
                  }`}
                >
                  <HubIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text-main">
                    {hub.label || `Titik Hub ${idx + 1}`}
                  </h4>
                  {courierNames.length > 0 && (
                    <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                      <TruckIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>Kurir: {courierNames.join(", ")}</span>
                    </p>
                  )}
                </div>
              </div>

              {isApplied ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckIcon className="w-3 h-3" /> Diterapkan
                </span>
              ) : null}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs mb-3 font-mono">
              <div className="p-2.5 bg-main rounded-lg border border-theme">
                <span className="text-[11px] text-text-muted block font-sans">Konsolidasi</span>
                <span className="text-sm font-bold text-text-main">
                  {hub.deliveries?.length || hub.count || 0} paket
                </span>
              </div>
              <div className="p-2.5 bg-main rounded-lg border border-theme">
                <span className="text-[11px] text-text-muted block font-sans">Estimasi Efisiensi</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  ~{hub.savingMinutes || hub.timeSavings || 15} menit
                </span>
              </div>
            </div>

            {hub.reason && (
              <div className="p-2.5 bg-main border border-theme/80 rounded-lg text-xs leading-relaxed text-text-muted mb-3">
                <span className="font-semibold text-text-main flex items-center gap-1 mb-0.5">
                  <MapPinIcon className="w-3.5 h-3.5 text-primary" /> Analisis Geografis:
                </span>
                {hub.reason}
              </div>
            )}

            {hub.deliveries && hub.deliveries.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-theme/60 text-xs">
                <span className="text-[11px] font-medium text-text-muted block mb-1">
                  Daftar Penerima Terkait:
                </span>
                {hub.deliveries.slice(0, 3).map((del, dIdx) => (
                  <div key={dIdx} className="flex items-center gap-1.5 text-text-main">
                    <PackageIcon className="w-3 h-3 text-text-dim shrink-0" />
                    <span className="truncate flex-1">{del.recipient}</span>
                  </div>
                ))}
                {hub.deliveries.length > 3 && (
                  <span className="text-[11px] text-text-dim block pl-4">
                    + {hub.deliveries.length - 3} penerima lainnya
                  </span>
                )}
              </div>
            )}

            {/* Action Button */}
            {!isApplied && (
              <button
                onClick={() => onApplyHub?.(hub)}
                disabled={loadingHubId !== null}
                className="w-full mt-3 btn-sage py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
                type="button"
              >
                {loadingHubId === hub.id ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Menerapkan ke Kurir...</span>
                  </>
                ) : (
                  <>
                    <MapPinIcon className="w-3.5 h-3.5" />
                    <span>Instruksikan Hub ke Kurir</span>
                  </>
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
