import React from "react";
import { AlertIcon, MapPinIcon, RouteIcon } from "./UiIcons";
import type { TrafficZone } from "../types";

interface CongestionHeatmapProps {
  zones?: TrafficZone[];
}

interface LevelConfig {
  label: string;
  bg: string;
  border: string;
  dot: string;
  text: string;
}

export default function CongestionHeatmap({ zones = [] }: CongestionHeatmapProps) {
  if (!zones || zones.length === 0) {
    return (
      <div className="bg-surface border border-theme rounded-xl p-6 text-center w-full">
        <p className="text-text-muted text-xs font-medium">Menunggu data lalu lintas...</p>
      </div>
    );
  }

  const critical = zones.filter((z) => z.level === "critical");
  const high = zones.filter((z) => z.level === "high");
  const medium = zones.filter((z) => z.level === "medium");
  const low = zones.filter((z) => z.level === "low");

  const levelConfig: Record<string, LevelConfig> = {
    critical: {
      label: "Macet Total",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      dot: "bg-red-500",
      text: "text-red-500",
    },
    high: {
      label: "Padat",
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      dot: "bg-orange-500",
      text: "text-orange-500",
    },
    medium: {
      label: "Sedang",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      dot: "bg-amber-500",
      text: "text-amber-500",
    },
    low: {
      label: "Lancar",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      dot: "bg-emerald-500",
      text: "text-emerald-500",
    },
  };

  return (
    <div className="bg-surface border border-theme rounded-xl p-4 shadow-sm w-full h-full flex flex-col min-h-0">
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <AlertIcon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-text-main">
          Status Kemacetan Real-Time
        </h3>
        <span className="text-xs font-mono text-text-muted ml-auto">
          {zones.length} zona
        </span>
      </div>

      <div className="flex gap-1.5 mb-3 text-xs flex-wrap shrink-0">
        {(["critical", "high", "medium", "low"] as const).map((level) => {
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
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] ${cfg.bg} ${cfg.border}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              <span className={`font-semibold ${cfg.text}`}>
                {cfg.label} ({count})
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1 scrollbar-soft">
        {critical.length > 0 && (
          <ZoneSection title="Zona Kritis" zones={critical} config={levelConfig.critical} />
        )}
        {high.length > 0 && (
          <ZoneSection title="Zona Padat" zones={high} config={levelConfig.high} />
        )}
        {medium.length > 0 && (
          <ZoneSection title="Zona Sedang" zones={medium} config={levelConfig.medium} />
        )}
        {low.length > 0 && (
          <ZoneSection title="Zona Lancar" zones={low} config={levelConfig.low} />
        )}
      </div>

      <div className="mt-3 p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl shrink-0">
        <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 mb-1 flex items-center gap-1.5">
          <RouteIcon className="w-3.5 h-3.5" /> Rekomendasi Mitigasi Jalur
        </p>
        <p className="text-xs text-text-muted leading-relaxed">
          {critical.length > 0
            ? `Hindari ${critical.map((z) => z.name).join(", ")}. Prioritaskan reroute via zone ${low[0]?.name || "alternatif"}.`
            : high.length > 0
            ? `Zona ${high[0]?.name} padat — pertimbangkan jalur samping untuk efisiensi.`
            : "Semua zona dalam kondisi lancar. Pengiriman armada dapat berlangsung optimal."}
        </p>
      </div>
    </div>
  );
}

function ZoneSection({
  title,
  zones,
  config,
}: {
  title: string;
  zones: TrafficZone[];
  config: LevelConfig;
}) {
  return (
    <div>
      <p className={`text-xs font-semibold ${config.text} mb-1.5 flex items-center gap-1.5`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {title}
      </p>
      <div className="space-y-1.5">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className={`flex items-start justify-between p-2.5 rounded-lg border bg-main ${config.border}`}
          >
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs font-semibold text-text-main flex items-center gap-1 truncate">
                <MapPinIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{zone.name}</span>
              </p>
              <p className="text-[11px] text-text-muted mt-0.5 leading-snug">{zone.reason}</p>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0 ${config.bg} ${config.border} ${config.text}`}>
              {zone.label || config.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
