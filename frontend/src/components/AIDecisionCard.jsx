import React from "react";
import {
  RobotIcon,
  RouteIcon,
  HubIcon,
  ClockIcon,
  AlertIcon,
  CheckIcon,
} from "./UiIcons.jsx";

// ── Severity Config ──────────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  critical: {
    color: "text-red-400",
    bg: "bg-red-500/15 border-red-500/30",
    dot: "bg-red-400",
    label: "Critical",
    labelId: "Kritis",
  },
  high: {
    color: "text-orange-400",
    bg: "bg-orange-500/15 border-orange-500/30",
    dot: "bg-orange-400",
    label: "High",
    labelId: "Tinggi",
  },
  medium: {
    color: "text-yellow-400",
    bg: "bg-yellow-500/15 border-yellow-500/30",
    dot: "bg-yellow-400",
    label: "Medium",
    labelId: "Sedang",
  },
  low: {
    color: "text-sage-400",
    bg: "bg-sage-500/15 border-sage-500/30",
    dot: "bg-sage-400",
    label: "Low",
    labelId: "Rendah",
  },
};

const ACTION_CONFIG = {
  REROUTE: { icon: RouteIcon, label: "Ubah Rute", color: "text-sage-300" },
  WAIT: { icon: ClockIcon, label: "Tunggu", color: "text-yellow-300" },
  REDIRECT_TO_HUB: {
    icon: HubIcon,
    label: "Alihkan ke Hub",
    color: "text-orange-300",
  },
  ESCALATE: { icon: AlertIcon, label: "Eskalasi", color: "text-red-300" },
};

/**
 * AIDecisionCard — displays the AI's incident analysis and routing recommendation.
 */
export default function AIDecisionCard({ decision, onDismiss, onAccept }) {
  if (!decision) return null;

  const sev = SEVERITY_CONFIG[decision.severity] || SEVERITY_CONFIG.medium;
  const act = ACTION_CONFIG[decision.action] || ACTION_CONFIG.REROUTE;

  return (
    <div className="animate-slide-up-mobile">
      <div className={`bg-surface p-5 border rounded-3xl shadow-xl ${sev.bg}`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xl shadow-inner">
              <RobotIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">
                {decision.isMock
                  ? "Simulasi Kecerdasan AI"
                  : `Analisis Gemini AI`}
              </p>
              <h3 className="text-text-main font-black text-sm leading-tight uppercase">
                Rekomendasi AI
              </h3>
            </div>
          </div>
          {/* Severity Badge */}
          <span
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${sev.bg} ${sev.color} text-[10px] font-bold uppercase`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${sev.dot} animate-pulse`}
            />
            {sev.labelId}
          </span>
        </div>

        {/* Incident Type */}
        <div className="mb-3 p-3 rounded-2xl bg-main/50 border border-theme">
          <p className="text-[10px] text-text-muted mb-1 uppercase tracking-wider font-bold">
            Jenis Hambatan
          </p>
          <p className="text-text-main font-bold text-sm">
            {decision.incidentTypeLabelId ||
              decision.incidentTypeLabel ||
              decision.incidentType}
          </p>
        </div>

        {/* Analysis */}
        <div className="mb-3 px-1">
          <p className="text-[10px] text-text-muted mb-1.5 uppercase tracking-wider font-bold">
            Analisis Situasi
          </p>
          <p className="text-text-main text-sm leading-relaxed">
            {decision.analysisId || decision.analysis}
          </p>
        </div>

        {/* Recommendation */}
        <div className="mb-4 p-4 rounded-2xl bg-primary/5 border border-primary/20">
          <p className="text-[10px] text-primary mb-1.5 uppercase tracking-wider font-bold">
            Saran Tindakan
          </p>
          <p className="text-text-main text-sm leading-relaxed font-medium">
            {decision.recommendationId || decision.recommendation}
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="p-3 rounded-2xl bg-main/50 border border-theme text-center">
            <p className="text-[10px] text-text-muted font-bold uppercase mb-1">
              Estimasi Delay
            </p>
            <p className="text-text-main font-black text-xl">
              {decision.estimatedDelay ?? "—"}
              <span className="text-xs font-normal text-text-muted ml-1">
                menit
              </span>
            </p>
          </div>
          <div className={`p-3 rounded-2xl border text-center ${sev.bg}`}>
            <p className={`text-[10px] font-bold uppercase mb-1 ${sev.color}`}>
              Keputusan
            </p>
            <p
              className={`font-black text-sm uppercase flex items-center justify-center gap-2 ${act.color}`}
            >
              <act.icon className="w-4 h-4" /> {act.label}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 py-3 rounded-xl border border-theme text-text-muted text-xs font-bold
                       hover:bg-main active:scale-95 transition-all"
          >
            Abaikan
          </button>
          <button
            onClick={onAccept}
            className="flex-[2] py-3 bg-primary text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
          >
            ✓ Terapkan Rute Baru
          </button>
        </div>
      </div>
    </div>
  );
}
