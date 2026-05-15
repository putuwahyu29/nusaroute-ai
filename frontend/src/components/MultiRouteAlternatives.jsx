import React, { useState, useMemo } from "react";
import { RouteIcon, MapPinIcon, ClockIcon, AlertIcon } from "./UiIcons.jsx";

function parseDurationMinutes(durationText) {
  if (!durationText) return null;
  const match = String(durationText).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * MultiRouteAlternatives — Displays AI-optimized route alternatives
 * Shows 2-3 different routes with ETA, distance, and congestion predictions
 */
export default function MultiRouteAlternatives({
  currentRoute = null,
  alternatives = [],
  onSelectRoute = null,
  onApplyRoute = null,
  selectedRouteId = null, // The one being previewed/clicked
  appliedRouteId = null,  // The one currently active on map
}) {
  if (!currentRoute && (!alternatives || alternatives.length === 0)) {
    return null;
  }

  const allRoutes = currentRoute
    ? [currentRoute, ...(alternatives || [])]
    : alternatives || [];

  const handleSelect = (route) => {
    onSelectRoute?.(route);
  };

  const activePreviewId = selectedRouteId || allRoutes[0]?.id;
  const currentAppliedId = appliedRouteId || allRoutes[0]?.id;

  // Calculate relative delays
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
    <div className="bg-surface border border-theme rounded-2xl p-4 shadow-md">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <RouteIcon className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-black uppercase tracking-tight text-text-main">
          Alternatif Rute (AI)
        </h3>
        <span className="text-[10px] font-bold text-text-muted ml-auto">
          {allRoutes.length} opsi
        </span>
      </div>

      {/* Routes Grid */}
      <div className="space-y-3">
        {routesWithStats.map((route, idx) => {
          const isSelected = activePreviewId === route.id;
          const isApplied = currentAppliedId === route.id;
          const isMain = idx === 0;
          const delayMinutes = route.delayMinutes || 0;
          const delayLabel =
            delayMinutes > 0 ? `+${delayMinutes} mnt` : "Tercepat";
          const delayColor =
            delayMinutes > 10
              ? "text-red-500"
              : delayMinutes > 5
                ? "text-orange-500"
                : "text-green-500";

          return (
            <div
              key={route.id || idx}
              onClick={() => handleSelect(route)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-md shadow-primary/20"
                  : "border-theme hover:border-primary/30"
              } ${isMain && !appliedRouteId ? "ring-2 ring-green-500/30" : ""}`}
            >
              {/* Badge */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${
                      isMain
                        ? "bg-green-500/20 text-green-500"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {isMain ? "Rute Utama" : `Alternatif ${idx}`}
                  </span>
                  {isApplied && (
                    <span className="text-[9px] font-black px-2 py-1 rounded-lg bg-primary text-white uppercase animate-pulse">
                      ✓ Digunakan
                    </span>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {/* Distance */}
                <div className="bg-main rounded-lg p-2 border border-theme">
                  <p className="text-[9px] text-text-muted font-bold uppercase mb-1">
                    Jarak
                  </p>
                  <p className="text-sm font-black text-text-main">
                    {route.distance}
                  </p>
                </div>

                {/* ETA */}
                <div className="bg-main rounded-lg p-2 border border-theme">
                  <p className="text-[9px] text-text-muted font-bold uppercase mb-1">
                    Durasi
                  </p>
                  <p className="text-sm font-black text-text-main">
                    {route.duration}
                  </p>
                </div>

                {/* Delay */}
                <div className="bg-main rounded-lg p-2 border border-theme">
                  <p className="text-[9px] text-text-muted font-bold uppercase mb-1">
                    vs Tercepat
                  </p>
                  <p className={`text-sm font-black ${delayColor}`}>
                    {delayLabel}
                  </p>
                </div>
              </div>

              {/* Route Description */}
              <div className="flex items-start gap-2 mb-3 p-2 bg-main rounded-lg border border-theme">
                <MapPinIcon className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-text-main font-bold leading-snug truncate">
                    {route.name ||
                      `Rute via ${route.primaryZone || "Alternatif"}`}
                  </p>
                  {route.highlights && (
                    <p className="text-[9px] text-text-muted mt-1 italic">
                      {route.highlights}
                    </p>
                  )}
                </div>
              </div>

              {/* Congestion Alert */}
              {route.congestedZones && route.congestedZones.length > 0 && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-orange-500/5 border border-orange-500/20">
                  <AlertIcon className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-[9px] text-orange-500 font-bold">
                    Rawan macet: {route.congestedZones.join(", ")}
                  </p>
                </div>
              )}

              {/* AI Reason */}
              {route.reason && (
                <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-[9px] font-black text-primary uppercase mb-0.5">
                    Alasan AI
                  </p>
                  <p className="text-[10px] text-text-muted leading-relaxed">
                    {route.reason}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action */}
      {activePreviewId !== currentAppliedId && (
        <button
          onClick={() =>
            onApplyRoute?.(allRoutes.find((r) => r.id === activePreviewId))
          }
          className="w-full mt-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-primary/20"
        >
          Gunakan {activePreviewId === allRoutes[0]?.id ? "Rute Utama" : "Rute Alternatif"}
        </button>
      )}
    </div>
  );
}
