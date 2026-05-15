import React from "react";
import { AlertIcon, MapPinIcon } from "./UiIcons.jsx";

/**
 * Congestion Heatmap Card — Visualizes real-time traffic zones
 * Shows which areas have predicted congestion levels
 */
export default function CongestionHeatmap({ zones = [] }) {
  if (!zones || zones.length === 0) {
    return (
      <div className="bg-surface border border-theme rounded-2xl p-4 text-center w-full">
        <p className="text-text-muted text-xs font-bold">
          Waiting for traffic data...
        </p>
      </div>
    );
  }

  // Group zones by congestion level
  const critical = zones.filter((z) => z.level === "critical");
  const high = zones.filter((z) => z.level === "high");
  const medium = zones.filter((z) => z.level === "medium");
  const low = zones.filter((z) => z.level === "low");

  const levelConfig = {
    critical: {
      label: "Macet Total",
      bg: "bg-red-500/20",
      border: "border-red-500/40",
      dot: "bg-red-500",
      text: "text-red-500",
    },
    high: {
      label: "Padat",
      bg: "bg-orange-500/20",
      border: "border-orange-500/40",
      dot: "bg-orange-500",
      text: "text-orange-500",
    },
    medium: {
      label: "Sedang",
      bg: "bg-yellow-500/20",
      border: "border-yellow-500/40",
      dot: "bg-yellow-500",
      text: "text-yellow-500",
    },
    low: {
      label: "Lancar",
      bg: "bg-green-500/20",
      border: "border-green-500/40",
      dot: "bg-green-500",
      text: "text-green-500",
    },
  };

  return (
    <div className="bg-surface border border-theme rounded-2xl p-4 shadow-md w-full h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <AlertIcon className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-black uppercase tracking-tight text-text-main">
          Peta Kemacetan Real-Time
        </h3>
        <span className="text-[10px] font-bold text-text-muted ml-auto">
          {zones.length} zona
        </span>
      </div>

      {/* Legend */}
      <div className="flex gap-2 mb-4 text-[10px] flex-wrap shrink-0">
        {["critical", "high", "medium", "low"].map((level) => {
          const count =
            level === "critical"
              ? critical.length
              : level === "high"
                ? high.length
                : level === "medium"
                  ? medium.length
                  : low.length;
          const cfg = levelConfig[level];
          return (
            <div
              key={level}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.border}`}
            >
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className={`font-bold ${cfg.text}`}>
                {cfg.label} ({count})
              </span>
            </div>
          );
        })}
      </div>

      {/* Zone Grid */}
      <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1 scrollbar-soft">
        {critical.length > 0 && (
          <ZoneSection
            title="🔴 Zona Kritis"
            zones={critical}
            config={levelConfig.critical}
          />
        )}
        {high.length > 0 && (
          <ZoneSection
            title="🟠 Zona Padat"
            zones={high}
            config={levelConfig.high}
          />
        )}
        {medium.length > 0 && (
          <ZoneSection
            title="🟡 Zona Sedang"
            zones={medium}
            config={levelConfig.medium}
          />
        )}
        {low.length > 0 && (
          <ZoneSection
            title="🟢 Zona Lancar"
            zones={low}
            config={levelConfig.low}
          />
        )}
      </div>

      {/* AI Insight */}
      <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-xl shrink-0">
        <p className="text-[10px] text-primary font-black uppercase mb-1">
          💡 AI Insight
        </p>
        <p className="text-[11px] text-text-muted leading-relaxed">
          {critical.length > 0
            ? `Hindari ${critical.map((z) => z.name).join(", ")}. Reroute via zone ${low[0]?.name || "alternatif"}.`
            : high.length > 0
              ? `Zone ${high[0]?.name} padat — pertimbangkan rute samping untuk efisiensi.`
              : "Semua zona dalam kondisi lancar. Pengiriman dapat berjalan optimal."}
        </p>
      </div>
    </div>
  );
}

function ZoneSection({ title, zones, config }) {
  return (
    <div>
      <p className={`text-[10px] font-black ${config.text} mb-2`}>{title}</p>
      <div className="space-y-1">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className={`flex items-start justify-between p-2 rounded-lg border ${config.bg} ${config.border}`}
          >
            <div className="flex-1">
              <p className="text-[11px] font-bold text-text-main flex items-center gap-1">
                <MapPinIcon className="w-3.5 h-3.5" />
                {zone.name}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">
                {zone.reason}
              </p>
            </div>
            <span
              className={`text-[9px] font-black px-2 py-1 rounded shrink-0 ${config.text}`}
            >
              {zone.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
