import React, { useState, useEffect, useCallback } from "react";
import {
  fetchAnalytics,
  fetchAgentStatus,
  startAgentAPI,
  stopAgentAPI,
} from "../services/api.js";
import {
  RobotIcon,
  RouteIcon,
  ClockIcon,
  LeafIcon,
  AlertIcon,
  CheckIcon,
  ActivityIcon,
  MapPinIcon,
  TruckIcon,
} from "../components/UiIcons.jsx";

// ── Metric Card Component ─────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, unit, color = "text-primary", subtext }) {
  return (
    <div className="bg-surface border border-theme rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-xl ${color.replace('text-', 'bg-')}/10 flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <span className="text-[9px] text-text-muted font-black uppercase tracking-widest">{label}</span>
      </div>
      <p className={`text-2xl font-black ${color} leading-none`}>
        {value}
        {unit && <span className="text-xs font-bold text-text-muted ml-1">{unit}</span>}
      </p>
      {subtext && <p className="text-[10px] text-text-muted mt-1 font-medium">{subtext}</p>}
    </div>
  );
}

// ── Agent Status Badge ────────────────────────────────────────────────────────
function AgentStatusBadge({ isRunning, tickCount, lastTick }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
      isRunning 
        ? "bg-green-500/5 border-green-500/20" 
        : "bg-red-500/5 border-red-500/20"
    }`}>
      <span className="relative flex h-3 w-3">
        {isRunning && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        )}
        <span className={`relative inline-flex rounded-full h-3 w-3 ${isRunning ? "bg-green-500" : "bg-red-500"}`}></span>
      </span>
      <div>
        <p className={`text-xs font-black ${isRunning ? "text-green-600" : "text-red-500"}`}>
          {isRunning ? "Agent Aktif" : "Agent Nonaktif"}
        </p>
        <p className="text-[9px] text-text-muted font-bold">
          {tickCount} siklus selesai
          {lastTick && ` • Terakhir: ${new Date(lastTick).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`}
        </p>
      </div>
    </div>
  );
}

// ── Decision Timeline ─────────────────────────────────────────────────────────
function DecisionTimeline({ decisions }) {
  if (!decisions || decisions.length === 0) {
    return (
      <div className="text-center py-10 opacity-40">
        <RobotIcon className="w-8 h-8 mx-auto mb-3 text-text-muted" />
        <p className="text-xs font-bold text-text-muted">Belum ada keputusan otonom</p>
        <p className="text-[10px] text-text-muted mt-1">Agent akan membuat keputusan saat mendeteksi ancaman.</p>
      </div>
    );
  }

  const typeConfig = {
    AUTONOMOUS_REROUTE: { icon: RouteIcon, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "Reroute Otomatis" },
    HUB_OPTIMIZATION: { icon: MapPinIcon, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Optimasi Hub" },
    TRAFFIC_ADVISORY: { icon: AlertIcon, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", label: "Advisory Traffic" },
    LOAD_BALANCE: { icon: TruckIcon, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20", label: "Load Balancing" },
    STUCK_COURIER: { icon: ClockIcon, color: "text-yellow-600", bg: "bg-yellow-500/10", border: "border-yellow-500/20", label: "Kurir Terjebak" },
  };

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-hide">
      {decisions.map((dec, idx) => {
        const config = typeConfig[dec.type] || typeConfig.TRAFFIC_ADVISORY;
        const Icon = config.icon;
        return (
          <div key={dec.id || idx} className={`p-3 rounded-xl border ${config.border} ${config.bg} animate-fade-in`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg ${config.bg} border ${config.border} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-[9px] font-black uppercase tracking-wider ${config.color}`}>
                    {config.label}
                  </span>
                  <span className="text-[9px] text-text-muted font-bold shrink-0">
                    {new Date(dec.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
                <p className="text-[11px] text-text-main font-bold leading-snug">{dec.summary}</p>
                {dec.estimatedSaving > 0 && (
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

// ── Congestion Chart (Simple Bar) ─────────────────────────────────────────────
function HourlyChart({ metrics }) {
  if (!metrics || metrics.length === 0) {
    return (
      <div className="text-center py-8 opacity-40">
        <ActivityIcon className="w-6 h-6 mx-auto mb-2 text-text-muted" />
        <p className="text-[10px] text-text-muted font-bold">Data per jam akan muncul setelah agent berjalan.</p>
      </div>
    );
  }

  const maxScore = Math.max(...metrics.map(m => m.congestionScore || 0), 1);

  return (
    <div className="flex items-end gap-1 h-32 px-2">
      {metrics.map((m, idx) => {
        const height = Math.max(8, ((m.congestionScore || 0) / maxScore) * 100);
        const color = m.congestionScore >= 12 ? "bg-red-500" : m.congestionScore >= 6 ? "bg-orange-500" : m.congestionScore >= 3 ? "bg-yellow-500" : "bg-green-500";
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

// ── Main Analytics Page ───────────────────────────────────────────────────────
export default function AnalyticsPage({ onBack }) {
  const [analytics, setAnalytics] = useState(null);
  const [agentStatus, setAgentStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [activeSection, setActiveSection] = useState("overview"); // overview, decisions, hourly

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
    const interval = setInterval(loadData, 15000); // Refresh every 15s
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
      // Refresh status
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
          <RobotIcon className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-sm font-black text-text-main">Memuat Analytics...</p>
        </div>
      </div>
    );
  }

  const summary = analytics?.summary || {};

  return (
    <div className="h-full overflow-y-auto bg-main">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-xl border-b border-theme px-4 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-xl bg-main border border-theme flex items-center justify-center text-text-main hover:bg-primary/10 transition-all"
            >
              ←
            </button>
            <div>
              <h1 className="text-lg font-black text-text-main tracking-tight">Analytics & Agent</h1>
              <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest">Dashboard Kecerdasan Operasional</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleAgent}
              disabled={isToggling}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 border ${
                agentStatus?.isRunning
                  ? "bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20"
                  : "bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20"
              } ${isToggling ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isToggling ? "..." : agentStatus?.isRunning ? "Hentikan Agent" : "Jalankan Agent"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
        {/* Agent Status */}
        <AgentStatusBadge
          isRunning={agentStatus?.isRunning}
          tickCount={agentStatus?.tickCount || 0}
          lastTick={agentStatus?.lastTick}
        />

        {/* Key Metrics Grid */}
        <section>
          <h2 className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] mb-3 ml-1">
            Dampak Pengurangan Operational Drag
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              icon={RouteIcon}
              label="Reroute Otomatis"
              value={summary.reroutesIssued || 0}
              color="text-orange-500"
              subtext="Keputusan tanpa intervensi manusia"
            />
            <MetricCard
              icon={ClockIcon}
              label="Waktu Dihemat"
              value={summary.minutesSaved || 0}
              unit="mnt"
              color="text-blue-500"
              subtext="Total estimasi penghematan"
            />
            <MetricCard
              icon={TruckIcon}
              label="Jarak Dihemat"
              value={summary.kmSaved || 0}
              unit="km"
              color="text-primary"
              subtext="Pengurangan jarak tempuh"
            />
            <MetricCard
              icon={LeafIcon}
              label="CO₂ Dikurangi"
              value={summary.co2Saved || 0}
              unit="kg"
              color="text-green-600"
              subtext="Kontribusi lingkungan"
            />
          </div>
        </section>

        {/* Secondary Metrics */}
        <section>
          <h2 className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] mb-3 ml-1">
            Performa Operasional
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              icon={CheckIcon}
              label="On-Time Rate"
              value={summary.onTimeRate || 100}
              unit="%"
              color="text-primary"
              subtext={`${summary.deliveriesCompleted || 0} pengiriman selesai`}
            />
            <MetricCard
              icon={RobotIcon}
              label="Total Keputusan AI"
              value={summary.totalDecisions || 0}
              color="text-purple-500"
              subtext="Keputusan otonom dibuat"
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

        {/* Operational Drag Reduction Score */}
        <section className="bg-surface border border-primary/20 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-black text-text-main">Skor Pengurangan Operational Drag</h2>
              <p className="text-[10px] text-text-muted font-bold mt-0.5">
                Estimasi efisiensi berdasarkan keputusan AI otonom
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-primary">{summary.operationalDragReduction || 0}%</p>
              <p className="text-[9px] text-text-muted font-bold uppercase">Reduksi</p>
            </div>
          </div>
          <div className="w-full h-3 bg-main rounded-full overflow-hidden border border-theme">
            <div
              className="h-full bg-gradient-to-r from-primary to-green-500 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, summary.operationalDragReduction || 0)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[9px] text-text-muted font-bold">0% (Tanpa AI)</span>
            <span className="text-[9px] text-text-muted font-bold">100% (Optimal)</span>
          </div>
        </section>

        {/* Section Tabs */}
        <div className="flex gap-2 border-b border-theme pb-2">
          {[
            { id: "overview", label: "Grafik Per Jam" },
            { id: "decisions", label: "Keputusan Agent" },
            { id: "learning", label: "AI Learning" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                activeSection === tab.id
                  ? "bg-primary text-white shadow-md"
                  : "bg-surface border border-theme text-text-muted hover:text-text-main"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Hourly Chart */}
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

        {/* Decision Timeline */}
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

        {/* Learning & Feedback Loop */}
        {activeSection === "learning" && (
          <section className="space-y-4">
            <div className="bg-surface border border-theme rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-black text-text-main mb-4 flex items-center gap-2">
                <RobotIcon className="w-4 h-4 text-purple-500" /> Feedback Loop & Akurasi Prediksi
              </h3>
              <p className="text-[10px] text-text-muted mb-4 font-medium">
                Agent belajar dari setiap keputusan. Zona dengan akurasi rendah akan mendapat bobot lebih rendah untuk mengurangi false positive.
              </p>

              {analytics?.learning ? (
                <div className="space-y-4">
                  {/* Overall Accuracy */}
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

                  {/* Zone Accuracy Table */}
                  {analytics.learning.zoneAccuracy?.length > 0 && (
                    <div>
                      <p className="text-[9px] text-text-muted font-black uppercase tracking-widest mb-2">Akurasi Per Zona</p>
                      <div className="space-y-1.5">
                        {analytics.learning.zoneAccuracy.map(zone => (
                          <div key={zone.zoneId} className="flex items-center gap-2 bg-main border border-theme rounded-lg px-3 py-2">
                            <span className="text-[10px] font-bold text-text-main flex-1 capitalize">{zone.zoneId}</span>
                            <div className="w-20 h-1.5 bg-surface rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${zone.accuracy >= 70 ? 'bg-green-500' : zone.accuracy >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${zone.accuracy}%` }}
                              />
                            </div>
                            <span className={`text-[9px] font-black ${zone.accuracy >= 70 ? 'text-green-600' : zone.accuracy >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
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
                  <RobotIcon className="w-8 h-8 mx-auto mb-2 text-text-muted" />
                  <p className="text-[10px] text-text-muted font-bold">Data learning akan muncul setelah agent membuat beberapa keputusan.</p>
                </div>
              )}
            </div>

            {/* Multi-Courier Coordination Info */}
            <div className="bg-surface border border-blue-500/20 rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-black text-text-main mb-3 flex items-center gap-2">
                <TruckIcon className="w-4 h-4 text-blue-500" /> Koordinasi Multi-Kurir
              </h3>
              <div className="space-y-3">
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3">
                  <p className="text-[9px] text-blue-500 font-black uppercase tracking-widest mb-1">Kemampuan Agent</p>
                  <ul className="text-[10px] text-text-muted space-y-1.5 font-medium">
                    <li className="flex items-start gap-2">
                      <CheckIcon className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                      <span>Deteksi ketidakseimbangan beban antar kurir</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckIcon className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                      <span>Saran reassignment paket otomatis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckIcon className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                      <span>Deteksi kurir yang terjebak (stuck detection)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckIcon className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                      <span>Notifikasi otomatis ke kurir yang membutuhkan bantuan</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Agent Architecture Explanation */}
        <section className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
          <h3 className="text-xs font-black text-primary mb-3 flex items-center gap-2">
            <RobotIcon className="w-4 h-4" /> Arsitektur Agentic AI
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { step: "1", label: "Monitor", desc: "Pantau traffic & posisi kurir" },
              { step: "2", label: "Evaluate", desc: "Analisis ancaman & peluang" },
              { step: "3", label: "Decide", desc: "Buat keputusan otonom" },
              { step: "4", label: "Act", desc: "Eksekusi & kirim notifikasi" },
            ].map(s => (
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
            Siklus berjalan otomatis setiap 3 menit tanpa intervensi manusia — inilah yang membedakan Agentic AI dari AI biasa.
          </p>
        </section>
      </div>
    </div>
  );
}
