import React, { useState, useEffect, useCallback } from "react";
import {
  fetchAnalytics,
  fetchAgentStatus,
  startAgentAPI,
  stopAgentAPI,
} from "../services/api";
import {
  CompassIcon,
  RouteIcon,
  ClockIcon,
  LeafIcon,
  AlertIcon,
  CheckIcon,
  ActivityIcon,
  MapPinIcon,
  TruckIcon,
  ArrowLeftIcon,
} from "../components/UiIcons";
import { AgentDecision } from "../types";

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  subtext?: string;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  subtext,
}: MetricCardProps) {
  return (
    <div className="bg-surface border border-theme rounded-xl p-3.5 shadow-sm transition-all">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-main border border-theme flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="text-xs font-semibold text-text-muted truncate">{label}</span>
      </div>
      <p className="text-xl font-bold font-mono text-text-main leading-tight">
        {value}
        {unit && <span className="text-xs font-medium text-text-dim ml-1">{unit}</span>}
      </p>
      {subtext && <p className="text-[11px] text-text-dim mt-1 font-medium truncate">{subtext}</p>}
    </div>
  );
}

interface AgentStatusBadgeProps {
  isRunning?: boolean;
  tickCount: number;
  lastTick?: string;
}

function AgentStatusBadge({ isRunning, tickCount, lastTick }: AgentStatusBadgeProps) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
        isRunning ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
      }`}
    >
      <span className="relative flex h-3 w-3">
        {isRunning && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        )}
        <span
          className={`relative inline-flex rounded-full h-3 w-3 ${
            isRunning ? "bg-green-500" : "bg-red-500"
          }`}
        ></span>
      </span>
      <div>
        <p className={`text-xs font-black ${isRunning ? "text-green-600" : "text-red-500"}`}>
          {isRunning ? "Agent Aktif" : "Agent Nonaktif"}
        </p>
        <p className="text-[9px] text-text-muted font-bold">
          {tickCount} siklus selesai
          {lastTick &&
            ` • Terakhir: ${new Date(lastTick).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })}`}
        </p>
      </div>
    </div>
  );
}

interface DecisionTimelineProps {
  decisions: AgentDecision[];
}

function DecisionTimeline({ decisions }: DecisionTimelineProps) {
  if (!decisions || decisions.length === 0) {
    return (
      <div className="text-center py-10 opacity-40">
        <CompassIcon className="w-8 h-8 mx-auto mb-3 text-text-muted" />
        <p className="text-xs font-bold text-text-muted">Belum ada tindakan reroute</p>
        <p className="text-[10px] text-text-muted mt-1">Sistem telematika akan mengambil tindakan saat mendeteksi hambatan rute.</p>
      </div>
    );
  }

  const typeConfig: Record<
    string,
    {
      icon: React.ComponentType<{ className?: string }>;
      color: string;
      bg: string;
      border: string;
      label: string;
    }
  > = {
    AUTONOMOUS_REROUTE: {
      icon: RouteIcon,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      label: "Reroute Otomatis",
    },
    HUB_OPTIMIZATION: {
      icon: MapPinIcon,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      label: "Optimasi Hub",
    },
    TRAFFIC_ADVISORY: {
      icon: AlertIcon,
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      label: "Advisory Traffic",
    },
    LOAD_BALANCE: {
      icon: TruckIcon,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
      label: "Load Balancing",
    },
    STUCK_COURIER: {
      icon: ClockIcon,
      color: "text-yellow-600",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      label: "Kurir Terjebak",
    },
  };

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-hide">
      {decisions.map((dec, idx) => {
        const config = typeConfig[dec.type] || typeConfig.TRAFFIC_ADVISORY;
        const Icon = config.icon;
        return (
          <div
            key={dec.id || idx}
            className={`p-3 rounded-xl border ${config.border} ${config.bg} animate-fade-in`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-lg ${config.bg} border ${config.border} flex items-center justify-center shrink-0`}
              >
                <Icon className={`w-4 h-4 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-[9px] font-black uppercase tracking-wider ${config.color}`}>
                    {config.label}
                  </span>
                  <span className="text-[9px] text-text-muted font-bold shrink-0">
                    {new Date(dec.timestamp).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-[11px] text-text-main font-bold leading-snug">{dec.summary}</p>
                {dec.estimatedSaving != null && dec.estimatedSaving > 0 && (
                  <p className="text-[9px] text-primary font-bold mt-1">
                    Estimasi hemat: ~{dec.estimatedSaving} menit
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface HourlyMetric {
  hour: string;
  congestionScore: number;
}

function HourlyChart({ metrics }: { metrics: HourlyMetric[] }) {
  if (!metrics || metrics.length === 0) {
    return (
      <div className="text-center py-8 opacity-40">
        <ActivityIcon className="w-6 h-6 mx-auto mb-2 text-text-muted" />
        <p className="text-[10px] text-text-muted font-bold">
          Data per jam akan muncul setelah agent berjalan.
        </p>
      </div>
    );
  }

  const maxScore = Math.max(...metrics.map((m) => m.congestionScore || 0), 1);

  return (
    <div className="flex items-end gap-1 h-32 px-2">
      {metrics.map((m, idx) => {
        const height = Math.max(8, ((m.congestionScore || 0) / maxScore) * 100);
        const color =
          m.congestionScore >= 12
            ? "bg-red-500"
            : m.congestionScore >= 6
            ? "bg-orange-500"
            : m.congestionScore >= 3
            ? "bg-yellow-500"
            : "bg-green-500";
        return (
          <div key={idx} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-t-lg ${color} transition-all duration-500 min-w-[8px]`}
              style={{ height: `${height}%` }}
              title={`Jam ${m.hour}: Skor ${m.congestionScore}`}
            />
            <span className="text-[8px] text-text-muted font-bold">{m.hour}</span>
          </div>
        );
      })}
    </div>
  );
}

interface AnalyticsPageProps {
  onBack: () => void;
}

interface AnalyticsState {
  summary?: {
    reroutesIssued?: number;
    minutesSaved?: number;
    kmSaved?: number;
    co2Saved?: number;
    onTimeRate?: number;
    deliveriesCompleted?: number;
    totalDecisions?: number;
    hubsAssigned?: number;
    alertsSent?: number;
    operationalDragReduction?: number;
  };
  hourlyMetrics?: HourlyMetric[];
  recentDecisions?: AgentDecision[];
  learning?: {
    overallAccuracy: number;
    totalPredictions: number;
    rerouteSuccessRate: number;
    zoneAccuracy?: Array<{
      zoneId: string;
      accuracy: number;
      sampleSize: number;
    }>;
  };
}

interface AgentStatusState {
  isRunning: boolean;
  tickCount: number;
  lastTick?: string;
  recentDecisions?: AgentDecision[];
}

export default function AnalyticsPage({ onBack }: AnalyticsPageProps) {
  const [analytics, setAnalytics] = useState<AnalyticsState | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatusState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [activeSection, setActiveSection] = useState<"overview" | "decisions" | "learning">("overview");

  const loadData = useCallback(async () => {
    try {
      const [analyticsRes, statusRes] = await Promise.all([
        fetchAnalytics(),
        fetchAgentStatus(),
      ]);
      setAnalytics(analyticsRes);
      setAgentStatus(statusRes);
    } catch (err) {
      console.error("Analytics load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleToggleAgent = async () => {
    setIsToggling(true);
    try {
      if (agentStatus?.isRunning) {
        await stopAgentAPI();
      } else {
        await startAgentAPI();
      }
      const statusRes = await fetchAgentStatus();
      setAgentStatus(statusRes);
    } catch (err) {
      console.error("Agent toggle error:", err);
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <ActivityIcon className="w-10 h-10 mx-auto mb-4 text-primary animate-spin" />
          <p className="text-sm font-black text-text-main">Memuat Telematika Armada...</p>
        </div>
      </div>
    );
  }

  const summary = analytics?.summary || {};

  return (
    <div className="h-full overflow-y-auto bg-main">
      <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-xl border-b border-theme px-4 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              aria-label="Kembali"
              className="w-9 h-9 rounded-xl bg-main border border-theme flex items-center justify-center text-text-main hover:bg-primary/10 transition-all"
            >
              <ArrowLeftIcon className="w-4 h-4 text-text-main" />
            </button>
            <div>
              <h1 className="text-base font-bold text-text-main tracking-tight">Telematika & Analytics Armada</h1>
              <p className="text-xs text-text-muted">
                Monitoring Efisiensi & Rekomendasi Rute
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleAgent}
              disabled={isToggling}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 border ${
                agentStatus?.isRunning
                  ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
              } ${isToggling ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isToggling ? "Memproses..." : agentStatus?.isRunning ? "Nonaktifkan Agent" : "Aktifkan Agent"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
        <AgentStatusBadge
          isRunning={agentStatus?.isRunning}
          tickCount={agentStatus?.tickCount || 0}
          lastTick={agentStatus?.lastTick}
        />

        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Efisiensi Operasional & Penghematan
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              icon={RouteIcon}
              label="Reroute Otomatis"
              value={summary.reroutesIssued || 0}
              subtext="Keputusan penyesuaian rute"
            />
            <MetricCard
              icon={ClockIcon}
              label="Waktu Dihemat"
              value={summary.minutesSaved || 0}
              unit="mnt"
              subtext="Total estimasi penghematan"
            />
            <MetricCard
              icon={TruckIcon}
              label="Jarak Dihemat"
              value={summary.kmSaved || 0}
              unit="km"
              subtext="Pengurangan jarak tempuh"
            />
            <MetricCard
              icon={LeafIcon}
              label="CO₂ Dikurangi"
              value={summary.co2Saved || 0}
              unit="kg"
              subtext="Kontribusi lingkungan"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Performa Armada
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              icon={CheckIcon}
              label="On-Time Rate"
              value={summary.onTimeRate ?? 0}
              unit="%"
              color="text-primary"
              subtext={`${summary.deliveriesCompleted || 0} pengiriman selesai`}
            />
            <MetricCard
              icon={RouteIcon}
              label="Penyesuaian Rute Otomatis"
              value={summary.totalDecisions || 0}
              color="text-primary"
              subtext="Reroute terverifikasi"
            />
            <MetricCard
              icon={MapPinIcon}
              label="Hub Dioptimasi"
              value={summary.hubsAssigned || 0}
              color="text-blue-500"
              subtext="Titik konsolidasi aktif"
            />
            <MetricCard
              icon={AlertIcon}
              label="Alert Dikirim"
              value={summary.alertsSent || 0}
              color="text-red-500"
              subtext="Peringatan proaktif"
            />
          </div>
        </section>

        <section className="bg-surface border border-theme rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-text-main">Skor Efisiensi Rute (Drag Reduction)</h2>
              <p className="text-xs text-text-muted mt-0.5">
                Estimasi pengurangan waktu dan jarak dibanding rute statis tanpa pemantauan macet
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold font-mono text-primary">{summary.operationalDragReduction || 0}%</p>
              <p className="text-[10px] text-text-muted font-medium uppercase">Tingkat Efisiensi</p>
            </div>
          </div>
          <div className="w-full h-2.5 bg-main rounded-full overflow-hidden border border-theme">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, summary.operationalDragReduction || 0)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-text-muted">
            <span>0% (Rute Konvensional)</span>
            <span>100% (Optimal Maksimal)</span>
          </div>
        </section>

        <div className="flex gap-2 border-b border-theme pb-2">
          {[
            { id: "overview" as const, label: "Grafik Per Jam" },
            { id: "decisions" as const, label: "Riwayat Reroute" },
            { id: "learning" as const, label: "Akurasi Prediksi" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeSection === tab.id
                  ? "bg-primary text-white shadow-sm"
                  : "bg-surface border border-theme text-text-muted hover:text-text-main"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeSection === "overview" && (
          <section className="bg-surface border border-theme rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-black text-text-main">Skor Kemacetan Per Jam</h3>
                <p className="text-[9px] text-text-muted font-bold">Tingkat kepadatan yang dideteksi agent</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-[8px] text-text-muted font-bold">Rendah</span>
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                <span className="text-[8px] text-text-muted font-bold">Sedang</span>
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-[8px] text-text-muted font-bold">Tinggi</span>
              </div>
            </div>
            <HourlyChart metrics={analytics?.hourlyMetrics || []} />
          </section>
        )}

        {activeSection === "decisions" && (
          <section className="bg-surface border border-theme rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-black text-text-main">Timeline Keputusan Otonom</h3>
                <p className="text-[9px] text-text-muted font-bold">
                  Riwayat tindakan yang diambil agent secara mandiri
                </p>
              </div>
              <span className="text-[9px] bg-primary/10 text-primary px-2 py-1 rounded-lg font-black">
                {analytics?.recentDecisions?.length || 0} keputusan
              </span>
            </div>
            <DecisionTimeline decisions={analytics?.recentDecisions || agentStatus?.recentDecisions || []} />
          </section>
        )}

        {activeSection === "learning" && (
          <section className="space-y-4">
            <div className="bg-surface border border-theme rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-black text-text-main mb-4 flex items-center gap-2">
                <ActivityIcon className="w-4 h-4 text-purple-500" /> Akurasi Model & Prediksi Jalur
              </h3>
              <p className="text-[10px] text-text-muted mb-4 font-medium">
                Sistem mengevaluasi efektivitas setiap rekomendasi rute. Jalur dengan akurasi rendah disesuaikan untuk meminimalkan keterlambatan armada.
              </p>

              {analytics?.learning ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-main border border-theme rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-purple-500">{analytics.learning.overallAccuracy}%</p>
                      <p className="text-[9px] text-text-muted font-bold uppercase">Akurasi Prediksi</p>
                      <p className="text-[8px] text-text-muted">{analytics.learning.totalPredictions} sampel</p>
                    </div>
                    <div className="bg-main border border-theme rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-green-600">{analytics.learning.rerouteSuccessRate}%</p>
                      <p className="text-[9px] text-text-muted font-bold uppercase">Reroute Berhasil</p>
                      <p className="text-[8px] text-text-muted">Pengiriman tepat waktu setelah reroute</p>
                    </div>
                  </div>

                  {analytics.learning.zoneAccuracy && analytics.learning.zoneAccuracy.length > 0 && (
                    <div>
                      <p className="text-[9px] text-text-muted font-black uppercase tracking-widest mb-2">
                        Akurasi Per Zona
                      </p>
                      <div className="space-y-1.5">
                        {analytics.learning.zoneAccuracy.map((zone) => (
                          <div
                            key={zone.zoneId}
                            className="flex items-center gap-2 bg-main border border-theme rounded-lg px-3 py-2"
                          >
                            <span className="text-[10px] font-bold text-text-main flex-1 capitalize">
                              {zone.zoneId}
                            </span>
                            <div className="w-20 h-1.5 bg-surface rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  zone.accuracy >= 70
                                    ? "bg-green-500"
                                    : zone.accuracy >= 40
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                                }`}
                                style={{ width: `${zone.accuracy}%` }}
                              />
                            </div>
                            <span
                              className={`text-[9px] font-black ${
                                zone.accuracy >= 70
                                  ? "text-green-600"
                                  : zone.accuracy >= 40
                                  ? "text-yellow-600"
                                  : "text-red-500"
                              }`}
                            >
                              {zone.accuracy}%
                            </span>
                            <span className="text-[8px] text-text-muted">({zone.sampleSize})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 opacity-40">
                  <ActivityIcon className="w-8 h-8 mx-auto mb-2 text-text-muted" />
                  <p className="text-[10px] text-text-muted font-bold">
                    Data telematika akan terakumulasi seiring bertambahnya trip pengiriman armada.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-surface border border-blue-500/20 rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-black text-text-main mb-3 flex items-center gap-2">
                <TruckIcon className="w-4 h-4 text-blue-500" /> Koordinasi Multi-Kurir
              </h3>
              <div className="space-y-3">
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3">
                  <p className="text-[9px] text-blue-500 font-black uppercase tracking-widest mb-1">
                    Fitur Otomasi
                  </p>
                  <ul className="text-[10px] text-text-muted space-y-1.5 font-medium">
                    <li className="flex items-start gap-2">
                      <CheckIcon className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                      <span>Deteksi ketidakseimbangan beban antar kurir</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckIcon className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                      <span>Saran penugasan ulang paket otomatis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckIcon className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                      <span>Deteksi kurir yang tertahan macet di lapangan</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckIcon className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                      <span>Notifikasi otomatis ke armada terdekat</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
          <h3 className="text-xs font-black text-primary mb-3 flex items-center gap-2">
            <ActivityIcon className="w-4 h-4" /> Alur Otomasi Dispatch & Telematika
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { step: "1", label: "Monitor", desc: "Pantau traffic & posisi kurir" },
              { step: "2", label: "Evaluate", desc: "Analisis hambatan & bottleneck" },
              { step: "3", label: "Decide", desc: "Kalkulasi opsi rute tercepat" },
              { step: "4", label: "Act", desc: "Notifikasi penyesuaian ke kurir" },
            ].map((s) => (
              <div key={s.step} className="bg-surface border border-theme rounded-xl p-3 text-center">
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-2">
                  <span className="text-[10px] font-black text-primary">{s.step}</span>
                </div>
                <p className="text-[10px] font-black text-text-main uppercase tracking-wider">{s.label}</p>
                <p className="text-[9px] text-text-muted mt-0.5">{s.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-text-muted mt-3 text-center font-medium italic">
            Sistem bekerja secara otomatis memantau posisi dan kepadatan jalur untuk menjaga SLA waktu pengiriman armada.
          </p>
        </section>
      </div>
    </div>
  );
}
