import React, { useMemo } from "react";
import { RouteIcon, MapPinIcon, AlertIcon, CheckIcon } from "./UiIcons";

interface RouteItem {
  id?: string;
  name?: string;
  via?: string;
  distance?: string;
  duration?: string;
  primaryZone?: string;
  highlights?: string;
  congestedZones?: string[];
  reason?: string;
  mins?: number;
  delayMinutes?: number;
}

interface MultiRouteAlternativesProps {
  currentRoute?: RouteItem | null;
  alternatives?: RouteItem[];
  onSelectRoute?: ((route: RouteItem) => void) | null;
  onApplyRoute?: ((route: RouteItem) => void) | null;
  selectedRouteId?: string | null;
  appliedRouteId?: string | null;
}

function parseDurationMinutes(durationText?: string): number | null {
  if (!durationText) return null;
  const match = String(durationText).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export default function MultiRouteAlternatives({
  currentRoute = null,
  alternatives = [],
  onSelectRoute = null,
  onApplyRoute = null,
  selectedRouteId = null,
  appliedRouteId = null,
}: MultiRouteAlternativesProps) {
  if (!currentRoute && (!alternatives || alternatives.length === 0)) {
    return null;
  }

  const allRoutes = currentRoute
    ? [currentRoute, ...(alternatives || [])]
    : alternatives || [];

  const activePreviewId = selectedRouteId || allRoutes[0]?.name;
  const currentAppliedId = appliedRouteId || allRoutes[0]?.name;

  const routesWithStats = useMemo(() => {
    const parsed = allRoutes.map((r) => ({
      ...r,
      mins: parseDurationMinutes(r.duration) || 999,
    }));
    const fastestMins = Math.min(...parsed.map((r) => r.mins));

    return parsed.map((r) => ({
      ...r,
      delayMinutes: r.mins - fastestMins,
    }));
  }, [allRoutes]);

  return (
    <div className="bg-surface border border-theme rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-theme/60">
        <div className="flex items-center gap-2">
          <RouteIcon className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold text-text-main">
            Pilihan Alternatif Jalur Navigasi
          </h3>
        </div>
        <span className="text-xs font-mono text-text-muted">
          {allRoutes.length} opsi rute
        </span>
      </div>

      <div className="space-y-2.5">
        {routesWithStats.map((route, idx) => {
          const isSelected = activePreviewId === (route.name || route.id);
          const isApplied = currentAppliedId === (route.name || route.id);
          const isMain = idx === 0;
          const delayMinutes = route.delayMinutes || 0;
          const delayLabel = delayMinutes > 0 ? `+${delayMinutes} mnt` : "Tercepat";
          const delayColor =
            delayMinutes > 10
              ? "text-red-500 font-semibold"
              : delayMinutes > 5
              ? "text-amber-500 font-semibold"
              : "text-emerald-500 font-semibold";

          return (
            <div
              key={route.id || route.name || idx}
              onClick={() => onSelectRoute?.(route)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-theme hover:border-theme/80 bg-surface"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                    isMain
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-main text-text-main border border-theme"
                  }`}
                >
                  {isMain ? "Rute Utama" : `Jalur Alternatif ${idx}`}
                </span>

                {isApplied && (
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <CheckIcon className="w-3 h-3" /> Aktif di Peta
                  </span>
                )}
              </div>

              {/* Metrics Bar */}
              <div className="grid grid-cols-3 gap-2 text-xs font-mono mb-2">
                <div className="p-2 bg-main rounded-lg border border-theme/80">
                  <span className="text-[10px] text-text-muted block font-sans">Jarak</span>
                  <span className="font-bold text-text-main">{route.distance || "-"}</span>
                </div>
                <div className="p-2 bg-main rounded-lg border border-theme/80">
                  <span className="text-[10px] text-text-muted block font-sans">Durasi</span>
                  <span className="font-bold text-text-main">{route.duration || "-"}</span>
                </div>
                <div className="p-2 bg-main rounded-lg border border-theme/80">
                  <span className="text-[10px] text-text-muted block font-sans">Selisih</span>
                  <span className={delayColor}>{delayLabel}</span>
                </div>
              </div>

              <div className="flex items-start gap-1.5 text-xs text-text-muted">
                <MapPinIcon className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span className="font-medium text-text-main truncate">
                  {route.name || `Via ${route.primaryZone || "Jalur Alternatif"}`}
                </span>
              </div>

              {route.congestedZones && route.congestedZones.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 font-medium">
                  <AlertIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Area padat: {route.congestedZones.join(", ")}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {activePreviewId !== currentAppliedId && (
        <button
          onClick={() => {
            const found = allRoutes.find((r) => (r.name || r.id) === activePreviewId);
            if (found && onApplyRoute) onApplyRoute(found);
          }}
          className="w-full btn-sage py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
          type="button"
        >
          <RouteIcon className="w-4 h-4" />
          <span>Terapkan Rute Terpilih ke Navigasi</span>
        </button>
      )}
    </div>
  );
}
