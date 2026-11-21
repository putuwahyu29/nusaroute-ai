import React from "react";
import {
  RouteIcon,
  HubIcon,
  ClockIcon,
  AlertIcon,
  CheckIcon,
} from "./UiIcons";
import type { AIDecision } from "../types";

interface AIDecisionCardProps {
  decision: AIDecision | null;
  onDismiss: () => void;
  onAccept: () => void;
  showActions?: boolean;
}

const SEVERITY_CONFIG: Record<
  string,
  { badge: string; border: string; label: string }
> = {
  critical: {
    badge: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    border: "border-red-500/40",
    label: "Kritis",
  },
  high: {
    badge: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
    border: "border-orange-500/40",
    label: "Tinggi",
  },
  medium: {
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    border: "border-amber-500/40",
    label: "Sedang",
  },
  low: {
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    border: "border-emerald-500/40",
    label: "Rendah",
  },
};

const ACTION_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  REROUTE: { icon: RouteIcon, label: "Pengalihan Rute Otomatis" },
  WAIT: { icon: ClockIcon, label: "Tunggu Normalisasi Jalur" },
  REDIRECT_TO_HUB: { icon: HubIcon, label: "Alihkan ke Hub Drop-off" },
  ESCALATE: { icon: AlertIcon, label: "Eskalasi ke Dispatcher" },
};

export default function AIDecisionCard({
  decision,
  onDismiss,
  onAccept,
  showActions = true,
}: AIDecisionCardProps) {
  if (!decision) return null;

  const sev = SEVERITY_CONFIG[decision.severity] || SEVERITY_CONFIG.medium;
  const act = ACTION_CONFIG[decision.action] || ACTION_CONFIG.REROUTE;
  const ActionIcon = act.icon;

  return (
    <div className="bg-surface border border-theme rounded-2xl p-5 shadow-lg space-y-4">
      {/* Header Alert Bar */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-theme/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <RouteIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-main">
              Rekomendasi Reroute Operasional
            </h3>
            <p className="text-[11px] text-text-muted">
              {decision.isMock
                ? "Mode Simulasi (USE_MOCK_AI=true)"
                : `Analisis Live (${decision.model || "Gemini AI"})`}
            </p>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium border ${sev.badge}`}
        >
          Tingkat: {sev.label}
        </span>
      </div>

      {/* Incident Description */}
      <div className="p-3 rounded-xl bg-main border border-theme/80 space-y-1">
        <p className="text-xs font-medium text-text-muted">Hambatan Terdeteksi</p>
        <p className="text-sm font-semibold text-text-main">
          {decision.incidentTypeLabelId || decision.incidentTypeLabel || decision.incidentType}
        </p>
        <p className="text-xs text-text-muted leading-relaxed pt-1">
          {decision.analysisId || decision.analysis}
        </p>
      </div>

      {/* Solution & Metrics */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-main border border-theme/80">
          <span className="text-text-muted block text-[11px] mb-0.5">Potensi Keterlambatan</span>
          <span className="text-base font-bold font-mono text-red-600 dark:text-red-400">
            +{decision.estimatedDelay ?? 0} menit
          </span>
        </div>
        <div className="p-3 rounded-xl bg-main border border-theme/80">
          <span className="text-text-muted block text-[11px] mb-0.5">Tindakan Sistem</span>
          <span className="font-semibold text-text-main flex items-center gap-1.5 mt-0.5">
            <ActionIcon className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">{act.label}</span>
          </span>
        </div>
      </div>

      {/* Recommendation Note */}
      <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs leading-relaxed text-text-main">
        <span className="font-semibold text-sky-600 dark:text-sky-400 block mb-0.5">
          Instruksi Rekomendasi:
        </span>
        {decision.recommendationId || decision.recommendation}
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 px-4 rounded-xl border border-theme bg-surface hover:bg-main text-text-muted text-xs font-semibold transition-colors"
            type="button"
          >
            Abaikan
          </button>
          <button
            onClick={onAccept}
            className="flex-[2] py-2.5 px-4 btn-sage text-xs font-semibold flex items-center justify-center gap-2"
            type="button"
          >
            <CheckIcon className="w-4 h-4" />
            Terapkan Rute Alternatif
          </button>
        </div>
      )}
    </div>
  );
}
