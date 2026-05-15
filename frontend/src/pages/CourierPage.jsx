import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import Header from "../components/Header.jsx";
import IncidentReporter from "../components/IncidentReporter.jsx";
import AIDecisionCard from "../components/AIDecisionCard.jsx";
import DeliveryList from "../components/DeliveryList.jsx";
import GoogleMap from "../components/GoogleMap.jsx";
import RouteOverviewMap from "../components/RouteOverviewMap.jsx";
import MultiRouteAlternatives from "../components/MultiRouteAlternatives.jsx";
import AIChatAssistant from "../components/AIChatAssistant.jsx";
import {
  analyzeIncident,
  fetchDeliveries,
  updateDeliveryStatus,
  checkHealth,
  optimizeRoute,
  fetchTrafficPrediction,
  fetchProactiveAlert,
  fetchRouteAlternatives,
  saveFcmToken,
} from "../services/api.js";
import { messaging, getToken, onMessage } from "../firebase.js";
import {
  TruckIcon,
  CheckIcon,
  MapPinIcon,
  PackageIcon,
  AlertIcon,
  RobotIcon,
  RouteIcon,
  ClockIcon,
  LockIcon,
} from "../components/UiIcons.jsx";

// ── Distance Utilities ────────────────────────────────────────────────────
/** Haversine great-circle distance in kilometres */
function haversineKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Format a km distance for display */
function formatDist(km) {
  if (km == null) return null;
  if (km < 0.1) return "< 100 m";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `~${Math.round(km)} km`;
}

// ── ETA Utilities ────────────────────────────────────────────────────
/** Average urban delivery speed in Surabaya with traffic buffer */
const AVG_SPEED_KMH = 25; // base: ~30 km/h city
const TRAFFIC_BUFFER = 1.25; // +25% for traffic, finding address, etc.

const TRAFFIC_IMPACT = {
  critical: 0.6,
  high: 0.35,
  medium: 0.15,
  low: 0,
};

/**
 * Estimate travel time in minutes from a distance.
 * Applies realistic traffic buffer for urban Surabaya.
 */
function estimateTravelMinutes(distanceKm) {
  if (distanceKm == null) return null;
  return Math.max(
    1,
    Math.ceil((distanceKm / AVG_SPEED_KMH) * 60 * TRAFFIC_BUFFER),
  );
}

/**
 * Estimate a traffic multiplier for a delivery from nearby predicted zones.
 * Returns a multiplier >= 1.0.
 */
function getTrafficMultiplierForDelivery(delivery, trafficZones = []) {
  if (
    !delivery ||
    delivery.lat == null ||
    delivery.lng == null ||
    !trafficZones.length
  ) {
    return 1;
  }

  const matchedZones = trafficZones
    .map((zone) => {
      const distanceKm = haversineKm(
        delivery.lat,
        delivery.lng,
        zone.lat,
        zone.lng,
      );
      return distanceKm <= (zone.radius || 2.0)
        ? { ...zone, distanceKm }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (matchedZones.length === 0) return 1;

  const strongestZone = matchedZones.reduce((best, zone) => {
    if (!best) return zone;
    const bestImpact = TRAFFIC_IMPACT[best.level] || 0;
    const zoneImpact = TRAFFIC_IMPACT[zone.level] || 0;
    if (zoneImpact !== bestImpact) return zoneImpact > bestImpact ? zone : best;
    return zone.distanceKm < best.distanceKm ? zone : best;
  }, null);

  const baseImpact = TRAFFIC_IMPACT[strongestZone.level] || 0;
  const proximityBoost =
    Math.max(
      0,
      ((strongestZone.radius || 2.0) - strongestZone.distanceKm) /
        (strongestZone.radius || 2.0),
    ) * 0.25;

  return 1 + baseImpact + proximityBoost;
}

/**
 * Compute dynamic ETA from a distance, relative to NOW.
 * @returns {{ minutes: number, timeString: string, date: Date } | null}
 */
function computeETA(distanceKm, trafficMultiplier = 1) {
  if (distanceKm == null) return null;
  const minutes = Math.max(
    1,
    Math.ceil(estimateTravelMinutes(distanceKm) * trafficMultiplier),
  );
  const date = new Date(Date.now() + minutes * 60_000);
  const timeString = date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { minutes, timeString, date };
}

function parseDurationMinutes(durationText) {
  if (!durationText) return null;
  const text = String(durationText).toLowerCase();
  let totalMinutes = 0;
  let found = false;

  // Match hours: "2 hours", "3 jam", "1h"
  const hourMatch = text.match(/(\d+)\s*(h|hour|jam)/);
  if (hourMatch) {
    totalMinutes += parseInt(hourMatch[1]) * 60;
    found = true;
  }

  // Match minutes: "45 mins", "10 mnt", "5m"
  // Note: we use a more specific lookbehind/lookahead logic to avoid matching 'm' in 'jam'
  const minMatch = text.match(/(\d+)\s*(m|min|mnt)/);
  if (minMatch) {
    totalMinutes += parseInt(minMatch[1]);
    found = true;
  }

  // Fallback: if no units but has numbers (e.g. "45")
  if (!found) {
    const match = text.match(/(\d+)/);
    if (match) return Number(match[1]);
  }

  return totalMinutes > 0 ? totalMinutes : null;
}

/** Format minutes into "X jam Y mnt" or "X mnt" */
function formatDuration(minutes) {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} mnt`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} mnt`;
}

/**
 * Compare dynamic ETA against the scheduled arrival string ("HH:MM").
 * @returns {number | null} positive = late (minutes), negative = early
 */
function compareWithSchedule(etaDate, scheduledStr) {
  if (!etaDate || !scheduledStr) return null;
  const [h, m] = scheduledStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const scheduled = new Date();
  scheduled.setHours(h, m, 0, 0);
  return Math.round((etaDate.getTime() - scheduled.getTime()) / 60_000);
}

/** Format a delay/early number into a label */
function formatScheduleDiff(diffMinutes) {
  if (diffMinutes == null) return null;
  const abs = Math.abs(diffMinutes);
  if (abs <= 3) return { label: "Tepat Waktu", color: "text-primary" };
  if (diffMinutes > 0) {
    // Sanity check: if delay > 6 hours, it's likely a data mismatch or stale schedule
    if (diffMinutes > 360) return null;
    return { label: `+${formatDuration(diffMinutes)}`, color: "text-red-500" };
  }
  return { label: `-${formatDuration(abs)}`, color: "text-primary" };
}

const DELIVERY_MARK_RADIUS_KM = 0.2;

// ── Active Route Card ────────────────────────────────────────────────────────
function ActiveRouteCard({
  delivery,
  onReportIncident,
  onMarkDelivered,
  rerouted,
  distanceKm,
  canMarkDelivered,
  markDeliveredReason,
  eta,
  isNavigating,
  onStartNav,
  hasAlert,
  onAcceptAlert,
  onDismissAlert,
}) {
  const [confirming, setConfirming] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [deliveryNote, setDeliveryNote] = React.useState("");

  if (!delivery) return null;

  const isDelivered = delivery.status === "delivered";

  const priorityConfig = {
    high: {
      label: "Prio: Tinggi",
      color: "text-red-500 bg-red-500/10 border-red-500/20",
    },
    medium: {
      label: "Prio: Sedang",
      color: "text-yellow-600 bg-yellow-500/10 border-yellow-500/20",
    },
    low: {
      label: "Prio: Rendah",
      color: "text-primary bg-primary/10 border-primary/20",
    },
  };
  const prio = priorityConfig[delivery.priority] || priorityConfig.medium;

  const handleConfirmDelivery = () => {
    if (!canMarkDelivered) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    onMarkDelivered(delivery.id, deliveryNote.trim() || null);
    setConfirming(false);
    setDeliveryNote("");
  };

  // Dynamic ETA comparison with schedule
  const scheduleDiff = eta
    ? compareWithSchedule(eta.date, delivery.estimatedArrival)
    : null;
  const diffLabel = formatScheduleDiff(scheduleDiff);

  return (
    <div className="glass-card-sage shadow-xl overflow-hidden">
      {/* ── Collapsed Header (always visible, clickable) ── */}
      <div
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-3 p-3 cursor-pointer select-none active:bg-primary/5 transition-colors"
      >
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-theme flex items-center justify-center shrink-0 text-base">
          {isDelivered ? (
            <CheckIcon className="w-4.5 h-4.5 text-primary" />
          ) : (
            <TruckIcon className="w-4.5 h-4.5 text-primary" />
          )}
        </div>

        {/* Name + address snippet */}
        <div className="flex-1 min-w-0">
          <p className="text-[9px] text-text-muted uppercase tracking-wider font-bold leading-none mb-0.5">
            {isDelivered
              ? "Selesai Dikirim"
              : rerouted
                ? "Tujuan Aktif (Dialihkan)"
                : "Tujuan Aktif"}
          </p>
          <p className="font-black text-sm text-text-main leading-tight line-clamp-2">
            {delivery.recipient}
          </p>
          {!expanded && (
            <p className="text-[10px] text-text-muted truncate mt-0.5">
              {delivery.address}
            </p>
          )}
        </div>

        {/* ETA + chevron */}
        <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
          {eta ? (
            <>
              <p className="text-primary font-black text-sm leading-none">
                {eta.timeString}
              </p>
              <p className="text-[9px] text-text-muted font-bold">
                ~{formatDuration(eta.minutes)}
                {distanceKm != null && (
                  <>
                    {" "}
                    ·{" "}
                    {typeof distanceKm === "string"
                      ? distanceKm
                      : formatDist(distanceKm)}
                  </>
                )}
              </p>
              {diffLabel && (
                <p className={`text-[9px] font-black ${diffLabel.color}`}>
                  {diffLabel.label}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-primary font-black text-sm leading-none">
                {delivery.estimatedArrival ?? "—"}
              </p>
              {distanceKm != null && (
                <p className="text-[10px] text-text-muted font-bold flex items-center justify-end gap-1">
                  <MapPinIcon className="w-3 h-3" /> {formatDist(distanceKm)}
                </p>
              )}
            </>
          )}
          <span
            className={`text-text-muted text-[10px] mt-0.5 inline-block transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          >
            ▼
          </span>
        </div>
      </div>

      {/* ── Expanded Detail Section ── */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-theme/60 pt-3 flex flex-col gap-2.5 animate-fade-in">
          {/* Address */}
          <div className="flex items-start gap-2">
            <svg
              className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <p className="text-text-muted text-xs leading-snug">
              {delivery.address}
            </p>
          </div>

          {/* Meta Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[9px] font-black px-2 py-0.5 rounded-lg border uppercase ${prio.color}`}
            >
              {prio.label}
            </span>
            {delivery.packageCount && (
              <span className="text-[9px] font-bold text-text-muted bg-main border border-theme px-2 py-0.5 rounded-lg">
                <span className="inline-flex items-center gap-1">
                  <PackageIcon className="w-3 h-3" /> {delivery.packageCount}{" "}
                  paket
                </span>
              </span>
            )}
            {delivery.timeSlot && (
              <span className="text-[9px] font-bold text-text-muted bg-main border border-theme px-2 py-0.5 rounded-lg">
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="w-3 h-3" /> {delivery.timeSlot}
                </span>
              </span>
            )}
            {rerouted && (
              <span className="text-[9px] font-black text-orange-500 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-lg">
                <span className="inline-flex items-center gap-1">
                  <RouteIcon className="w-3 h-3" /> Rute Dialihkan
                </span>
              </span>
            )}
          </div>

          {/* Notes */}
          {delivery.notes && (
            <p className="text-[10px] text-primary font-bold italic flex items-start gap-1 bg-primary/5 border border-primary/10 px-3 py-2 rounded-xl">
              <PackageIcon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
              <span className="text-text-main">{delivery.notes}</span>
            </p>
          )}

          {/* Pickup Hub */}
          {delivery.pickupHub && (
            <div className="p-3 bg-blue-500/10 border-2 border-blue-500/30 rounded-xl shadow-md animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-bl-full pointer-events-none" />
              <div className="flex items-start gap-2.5 relative z-10">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <MapPinIcon className="w-4.5 h-4.5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] text-blue-500 font-black uppercase tracking-widest mb-0.5">
                    📦 Instruksi Dispatcher — Titik Hub
                  </p>
                  <p className="text-sm font-black text-text-main leading-tight mb-1.5">
                    {delivery.pickupHub.label}
                  </p>
                  <p className="text-[11px] text-text-muted leading-relaxed italic border-l-2 border-blue-500/30 pl-2">
                    "{delivery.pickupHub.reason}"
                  </p>
                  <p className="text-[9px] text-blue-400 font-bold mt-2">
                    💡 Parkir di titik ini dan distribusikan paket dengan berjalan kaki.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Action Buttons ── */}
      <div className="px-3 pb-3">
        {!isDelivered ? (
          <>
            {hasAlert ? (
              <div className="flex gap-2 animate-scale-in">
                <button
                  onClick={onAcceptAlert}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <RouteIcon className="w-4 h-4" /> Terima Reroute
                </button>
                <button
                  onClick={onDismissAlert}
                  className="px-4 py-2.5 rounded-xl border border-theme bg-surface text-text-muted text-xs font-black uppercase tracking-wider hover:bg-main active:scale-95 transition-all"
                >
                  Abaikan
                </button>
              </div>
            ) : isNavigating ? (
              <div className="space-y-2 animate-scale-in">
                {/* Delivery Note Input (appears when confirming) */}
                {confirming && canMarkDelivered && (
                  <div className="animate-fade-in">
                    <input
                      type="text"
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder="Catatan (opsional): cth. diterima satpam, titip resepsionis..."
                      className="w-full bg-surface border border-green-500/30 rounded-xl px-3 py-2.5 text-[11px] text-text-main font-medium placeholder:text-text-muted/40 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all"
                      autoFocus
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    disabled={!canMarkDelivered}
                    onClick={handleConfirmDelivery}
                    title={
                      canMarkDelivered
                        ? "Tandai pengiriman ini sebagai terkirim"
                        : markDeliveredReason
                    }
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-start justify-center gap-2
                      ${
                        !canMarkDelivered
                          ? "bg-surface border-2 border-theme text-text-muted shadow-none cursor-not-allowed"
                          : confirming
                            ? "bg-green-500 text-white shadow-md shadow-green-500/30 scale-105 animate-pulse"
                            : "bg-primary text-white shadow-md shadow-primary/30 hover:opacity-90"
                      }`}
                  >
                    {!canMarkDelivered ? (
                      <>
                        <LockIcon className="w-4 h-4 mt-0.5 shrink-0" />
                        <span className="text-[11px] font-black whitespace-normal break-words text-left">
                          {markDeliveredReason || "Belum di lokasi"}
                        </span>
                      </>
                    ) : confirming ? (
                      <>
                        <span>✓</span> Konfirmasi Kirim
                      </>
                    ) : (
                      <>
                        <span>✓</span> Tandai Terkirim
                      </>
                    )}
                  </button>
                  {confirming && (
                    <button
                      onClick={() => { setConfirming(false); setDeliveryNote(""); }}
                      className="px-3 py-2.5 rounded-xl border border-theme bg-surface text-text-muted text-xs font-black hover:bg-main active:scale-95 transition-all"
                    >
                      Batal
                    </button>
                  )}
                  {!confirming && (
                    <button
                      onClick={onReportIncident}
                      className="px-3 py-2.5 rounded-xl border border-orange-400/30 bg-orange-500/10 text-orange-400
                                 text-xs font-black hover:bg-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                      title="Laporkan Hambatan"
                    >
                      <AlertIcon className="w-4 h-4" /> Lapor
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={onStartNav}
                className="w-full bg-primary text-white py-2.5 rounded-xl font-black uppercase tracking-wider shadow-md flex items-center justify-center gap-2 border border-white/10 active:scale-95 transition-all animate-pulse-subtle text-xs"
              >
                <TruckIcon className="w-4 h-4" /> Mulai Perjalanan
              </button>
            )}
          </>
        ) : (
          <div className="py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 text-xs font-black uppercase text-center tracking-wider">
            <span className="inline-flex items-center justify-center gap-1">
              <CheckIcon className="w-4 h-4" /> Pengiriman Selesai
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({ deliveries }) {
  const total = deliveries.length;
  const done = deliveries.filter((d) => d.status === "delivered").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="bg-surface/90 backdrop-blur border border-theme rounded-2xl px-4 py-2 shadow-sm flex items-center gap-3">
      <span className="text-text-muted text-[10px] uppercase tracking-wider font-bold shrink-0">
        Progres
      </span>
      <div className="flex-1 h-1.5 bg-main rounded-full overflow-hidden border border-theme">
        <div
          className="h-full bg-primary rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-primary font-black text-xs shrink-0">
        {done}/{total}
      </span>
    </div>
  );
}

// ── Toast Notification ──────────────────────────────────────────────────
function Toast({ message, type = "info", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  // Solid backgrounds — guaranteed readable in dark & light mode
  const styles = {
    success: "border-green-400/50 bg-green-600 text-white shadow-green-900/30",
    error: "border-red-400/50   bg-red-600   text-white shadow-red-900/30",
    info: "border-primary/30   bg-surface   text-text-main",
  };
  const icons = { success: "✅", error: "❌", info: "ℹ️" };

  return (
    <div
      className={`fixed top-20 left-4 right-4 z-50 animate-slide-up rounded-2xl border shadow-xl p-4 flex items-center gap-3 ${styles[type]}`}
    >
      <span className="text-base shrink-0">
        {type === "success" ? (
          <CheckIcon className="w-5 h-5" />
        ) : type === "error" ? (
          <AlertIcon className="w-5 h-5" />
        ) : (
          <ClockIcon className="w-5 h-5" />
        )}
      </span>
      <p className="flex-1 text-sm font-semibold leading-snug">{message}</p>
      <button
        onClick={onClose}
        className="opacity-60 hover:opacity-100 text-lg leading-none shrink-0"
      >
        ×
      </button>
    </div>
  );
}

// ── Turn-by-Turn Navigation UI ──────────────────────────────────────────────
function TurnByTurnNav({ directions, isNavigating }) {
  const [expanded, setExpanded] = useState(false);

  if (!directions || !directions.steps || directions.steps.length === 0)
    return null;

  const nextStep = directions.steps[0];
  const remainingSteps = directions.steps.slice(1);

  // Map maneuver to simple emoji
  const getIcon = (maneuver) => {
    if (maneuver.includes("right")) return "↪";
    if (maneuver.includes("left")) return "↩";
    if (maneuver.includes("uturn")) return "⤵";
    return "⬆";
  };

  return (
    <div
      className={`bg-main border rounded-3xl shadow-xl overflow-hidden mt-3 transition-all duration-500 ${isNavigating ? "border-primary ring-4 ring-primary/20" : "border-theme"}`}
    >
      {/* Top Banner: Next Step */}
      <div
        onClick={() => setExpanded(!expanded)}
        className={`px-4 py-4 flex items-center gap-4 cursor-pointer select-none transition-colors ${isNavigating ? "bg-primary" : "bg-surface border-b border-theme"}`}
      >
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-lg ${isNavigating ? "bg-white/20 text-white" : "bg-primary text-white"}`}
        >
          {getIcon(nextStep.maneuver)}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-black leading-tight truncate-2-lines ${isNavigating ? "text-white" : "text-text-main"}`}
            dangerouslySetInnerHTML={{ __html: nextStep.instructions }}
          />
          <p
            className={`text-[11px] font-bold mt-1 ${isNavigating ? "text-white/80" : "text-primary"}`}
          >
            {nextStep.distance}
          </p>
        </div>
        <div
          className={isNavigating ? "text-white opacity-60" : "text-text-muted"}
        >
          {expanded ? "▲" : "▼"}
        </div>
      </div>

      {/* Expanded Steps List */}
      {expanded && remainingSteps.length > 0 && (
        <div className="max-h-60 overflow-y-auto p-2 bg-surface">
          {remainingSteps.map((step, idx) => (
            <div
              key={idx}
              className="flex gap-3 items-center p-3 border-b border-theme last:border-0 hover:bg-main rounded-xl transition-colors"
            >
              <div className="w-6 h-6 rounded-lg bg-surface text-text-main border border-theme flex items-center justify-center text-xs shrink-0">
                {getIcon(step.maneuver)}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-text-main text-[11px] font-bold leading-snug"
                  dangerouslySetInnerHTML={{ __html: step.instructions }}
                />
              </div>
              <span className="text-[10px] text-text-muted font-black shrink-0 bg-main px-2 py-1 rounded-md">
                {step.distance}
              </span>
            </div>
          ))}
          <div className="p-3 text-center">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-xl">
              📍 Tujuan: {directions.distance}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab Bar ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: "route", icon: RouteIcon, label: "Rute" },
  { id: "report", icon: AlertIcon, label: "Lapor" },
  { id: "deliveries", icon: PackageIcon, label: "Paket" },
];

// ── Main Courier Page ────────────────────────────────────────────────────────
export default function CourierPage({ user, onLogout, theme, toggleTheme }) {
  const [activeTab, setActiveTab] = useState("route");
  const [deliveries, setDeliveries] = useState([]);
  const [aiDecision, setAiDecision] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aiRouteInsight, setAiRouteInsight] = useState(null);
  const [backendStatus, setBackendStatus] = useState(null);
  const [toast, setToast] = useState(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [rerouted, setRerouted] = useState(false);
  const [routeDirections, setRouteDirections] = useState(null);
  const [courierLocation, setCourierLocation] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [followUser, setFollowUser] = useState(true);
  const [trafficZones, setTrafficZones] = useState([]);
  const [routeAlternatives, setRouteAlternatives] = useState({
    currentRoute: null,
    alternatives: [],
  });
  const [isRouteAlternativesLoading, setIsRouteAlternativesLoading] =
    useState(false);
  const [isApplyingProactiveRoute, setIsApplyingProactiveRoute] =
    useState(false);
  const [selectedAlternativeRoute, setSelectedAlternativeRoute] =
    useState(null);
  const [previewRouteId, setPreviewRouteId] = useState(null);
  const [showSimMenu, setShowSimMenu] = useState(false);
  const [mockLocation, setMockLocation] = useState(null);
  const [proactiveWarning, setProactiveWarning] = useState(null);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [showTrafficLayer, setShowTrafficLayer] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [locationStatus, setLocationStatus] = useState("loading"); // "loading" | "active" | "denied"
  const mapRef = useRef(null);

  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type, key: Date.now() });
  }, []);

  // ── Default sort: status → priority → estimatedArrival ──────────────────
  const sortDeliveries = useCallback((list) => {
    const statusOrder = {
      in_transit: 0,
      pending: 1,
      rerouted: 2,
      delivered: 3,
    };
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return [...list].sort((a, b) => {
      const sDiff = (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
      if (sDiff !== 0) return sDiff;
      const pDiff =
        (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
      if (pDiff !== 0) return pDiff;
      return (a.estimatedArrival ?? "").localeCompare(b.estimatedArrival ?? "");
    });
  }, []);

  // Real-time GPS tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!mockLocation) {
          setCourierLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setLocationStatus("active");
        }
      },
      (err) => {
        console.warn("Geolocation watch error:", err);
        setCourierLocation(null);
        setLocationStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [mockLocation]);

  // When navigation starts, enable follow so the map follows the courier by default
  useEffect(() => {
    if (isNavigating) setFollowUser(true);
  }, [isNavigating]);

  // Initialize FCM & Listen for Push Notifications
  useEffect(() => {
    if (!user?.id || !messaging) return;

    const initFCM = async () => {
      try {
        // Skip FCM entirely if notifications are not supported or already denied
        if (!("Notification" in window)) return;
        if (Notification.permission === "denied") return;

        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
          if (!vapidKey) return; // Silent — VAPID key not configured
          const token = await getToken(messaging, { vapidKey });
          if (token) {
            await saveFcmToken(user.id, token);
          }
        }
        // If "denied" or "default" — silently skip, polling handles updates
      } catch {
        // Silent — FCM is optional, polling is the primary update mechanism
      }
    };

    initFCM();

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("📨 FCM Foreground Message received:", payload);
      setToast({
        key: Date.now(),
        message:
          payload.notification?.body ||
          "Anda mendapat instruksi baru dari Dispatcher.",
        type: "info",
      });

      // Auto-refresh deliveries when hub instruction arrives
      fetchDeliveries(user.id)
        .then((res) => {
          if (res.deliveries) setDeliveries(sortDeliveries(res.deliveries));
        })
        .catch(console.error);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id, sortDeliveries]);

  const handleLocateMe = () => {
    if (navigator.geolocation && mapRef.current) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          // Enable follow mode when user explicitly requests 'Locate Me'
          setFollowUser(true);
          mapRef.current.panToLocation(latitude, longitude);
        },
        (err) => {
          console.warn("Locate me failed", err);
          showToast(
            "Tidak dapat mengambil lokasi saat ini. Pastikan GPS aktif dan beri izin lokasi.",
            "warning",
          );
        },
      );
    } else {
      showToast("Perangkat ini tidak mendukung GPS/Geolocation.", "warning");
    }
  };

  const handleRouteFetched = useCallback((data) => {
    setRouteDirections(data);
    if (data.allRoutes) {
      setRouteAlternatives({
        currentRoute: data.allRoutes[0],
        alternatives: data.allRoutes.slice(1),
      });
    }
  }, []);

  const activeDelivery =
    deliveries.find((d) => d.status === "in_transit") ||
    deliveries.find((d) => d.status === "pending") ||
    deliveries[0];
  const allDelivered =
    deliveries.length > 0 && deliveries.every((d) => d.status === "delivered");

  // \u2500\u2500 Compute distance from courier to every delivery stop \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const distancesMap = useMemo(() => {
    const map = {};
    deliveries.forEach((d) => {
      if (
        d.lat != null &&
        d.lng != null &&
        courierLocation &&
        courierLocation.lat != null
      ) {
        map[d.id] = haversineKm(
          courierLocation.lat,
          courierLocation.lng,
          d.lat,
          d.lng,
        );
      }
    });
    return map;
  }, [deliveries, courierLocation]);

  const activeDistanceKm = activeDelivery
    ? (distancesMap[activeDelivery.id] ?? null)
    : null;
  const activeDeliveryDistanceLabel =
    activeDistanceKm != null ? formatDist(activeDistanceKm) : null;
  const canMarkDelivered =
    !!activeDelivery &&
    activeDelivery.status !== "delivered" &&
    activeDistanceKm != null &&
    activeDistanceKm <= DELIVERY_MARK_RADIUS_KM;
  const markDeliveredReason = !activeDelivery
    ? "Tidak ada tujuan aktif"
    : activeDelivery.status === "delivered"
      ? "Pengiriman sudah selesai"
      : activeDistanceKm == null
        ? "Lokasi kurir belum tersedia"
        : activeDistanceKm > DELIVERY_MARK_RADIUS_KM
          ? `Masih ${activeDeliveryDistanceLabel} dari lokasi tujuan`
          : "Siap ditandai terkirim";

  // \u2500\u2500 60-second tick — ensures ETA updates even when courier is stationary \u2500\u2500\u2500\u2500
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // \u2500\u2500 Dynamic ETAs for all deliveries \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const etasMap = useMemo(() => {
    const map = {};
    Object.entries(distancesMap).forEach(([id, km]) => {
      const delivery = deliveries.find((item) => item.id === id);
      const isActive = delivery?.id === activeDelivery?.id;

      // If this is the active delivery, prioritize the live route duration from Google Maps
      if (isActive && (selectedAlternativeRoute || routeDirections)) {
        const durationText = selectedAlternativeRoute
          ? selectedAlternativeRoute.duration
          : routeDirections.duration;

        const liveMinutes = parseDurationMinutes(durationText);
        if (liveMinutes) {
          const date = new Date(Date.now() + liveMinutes * 60_000);
          map[id] = {
            minutes: liveMinutes,
            date,
            timeString: date.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
          };
          return;
        }
      }

      const trafficMultiplier = getTrafficMultiplierForDelivery(
        delivery,
        trafficZones,
      );
      map[id] = computeETA(km, trafficMultiplier);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    distancesMap,
    deliveries,
    trafficZones,
    tick,
    selectedAlternativeRoute,
    activeDelivery?.id,
    routeDirections,
  ]); // tick dependency = recalculate every minute

  const lastFetchLocation = useRef({ lat: null, lng: null });

  // ── Effect: Fetch Route Alternatives whenever active delivery changes ────────
  useEffect(() => {
    // Only fetch route alternatives when there's an active delivery, courier location,
    // and the courier has started navigation (avoid calling AI API before trip starts).
    // IMPORTANT: Only suggest routes for deliveries that are IN_TRANSIT (being delivered now),
    // NOT for pending deliveries that haven't started yet.
    if (
      !activeDelivery ||
      activeDelivery.status !== 'in_transit' ||
      !isNavigating ||
      !courierLocation?.lat ||
      !courierLocation?.lng
    )
      return;

    // Check if movement is significant (> 200m) or if active delivery changed
    const distFromLastFetch = lastFetchLocation.current.lat
      ? haversineKm(
          courierLocation.lat,
          courierLocation.lng,
          lastFetchLocation.current.lat,
          lastFetchLocation.current.lng,
        )
      : 999;

    const deliveryChanged =
      activeDelivery.id !== lastFetchLocation.current.activeId;

    if (!deliveryChanged && distFromLastFetch < 0.2) {
      // Skip fetch if moved less than 200m and target is the same
      return;
    }

    const fetchAlts = async () => {
      setIsRouteAlternativesLoading(true);
      try {
        const res = await fetchRouteAlternatives({
          delivery: activeDelivery,
          trafficZones,
          baseDistanceKm: distancesMap[activeDelivery.id] ?? null,
          baseDurationMinutes: routeDirections?.duration
            ? parseDurationMinutes(routeDirections.duration)
            : null,
        });
        if (res.currentRoute) {
          setRouteAlternatives({
            currentRoute: res.currentRoute,
            alternatives: res.alternatives || [],
          });
          lastFetchLocation.current = {
            lat: courierLocation.lat,
            lng: courierLocation.lng,
            activeId: activeDelivery.id,
          };
        }
      } catch (err) {
        console.error("Failed to fetch route alternatives:", err);
      } finally {
        setIsRouteAlternativesLoading(false);
      }
    };

    fetchAlts();
  }, [activeDelivery?.id, courierLocation?.lat, courierLocation?.lng]);

  const activeEta = activeDelivery
    ? (etasMap[activeDelivery.id] ?? null)
    : null;
  const effectiveActiveEta = activeEta;

  const mapRoutePreferenceIndex = useMemo(() => {
    if (!selectedAlternativeRoute?.id) return 0;
    const match = String(selectedAlternativeRoute.id).match(/alt-(\d+)/i);
    if (!match) return 0;
    const altNumber = Number(match[1]);
    if (!Number.isFinite(altNumber) || altNumber < 1) return 0;
    return altNumber;
  }, [selectedAlternativeRoute]);

  const activeRouteIndicator = useMemo(() => {
    const isMain = !selectedAlternativeRoute || mapRoutePreferenceIndex === 0;

    if (!isMain) {
      return {
        label: selectedAlternativeRoute.name || "Alternatif Aktif",
        note: `Alternatif ${mapRoutePreferenceIndex}`,
        tone: "text-orange-500 bg-orange-500/10 border-orange-500/30",
      };
    }

    return {
      label:
        selectedAlternativeRoute?.name ||
        routeAlternatives.currentRoute?.name ||
        "Rute Utama",
      note: "Utama",
      tone: "text-primary bg-primary/10 border-primary/30",
    };
  }, [
    selectedAlternativeRoute,
    routeAlternatives.currentRoute,
    mapRoutePreferenceIndex,
  ]);

  useEffect(() => {
    if (!activeDelivery || activeDelivery.status === "delivered") {
      setRouteAlternatives({ currentRoute: null, alternatives: [] });
      setSelectedAlternativeRoute(null);
      setPreviewRouteId(null);
      setRerouted(false);
    }
  }, [activeDelivery]);

  useEffect(() => {
    if (!deliveries.length) return;
    let isMounted = true;

    const refreshProactiveWarning = async () => {
      try {
        // Don't overwrite simulation alerts
        if (proactiveWarning?.id === "mock-1") return;

        const trafficRes = await fetchTrafficPrediction().catch(() => ({
          zones: [],
        }));
        const zones = trafficRes.zones || [];

        if (!isMounted) return;

        setTrafficZones(zones);

        if (zones.length === 0) {
          setProactiveWarning(null);
          return;
        }

        const res = await fetchProactiveAlert(deliveries, zones);
        if (!isMounted) return;

        if (res.affected && res.affected.length > 0) {
          // Get alert for active delivery or any pending delivery
          const alert =
            res.affected.find((a) => a.deliveryId === activeDelivery?.id) ||
            res.affected[0];
          setProactiveWarning(alert || null);
        } else {
          setProactiveWarning(null);
        }
      } catch (err) {
        if (isMounted) console.error(err);
      }
    };

    refreshProactiveWarning();
    const intervalId = setInterval(refreshProactiveWarning, 180000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [deliveries, activeDelivery]);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    checkHealth().then(setBackendStatus);
    if (user?.id) {
      fetchDeliveries(user.id)
        .then((res) => {
          const sorted = sortDeliveries(res.deliveries || []);
          setDeliveries(sorted);

          // Restore reroute state if the active delivery has it persisted
          const active =
            sorted.find((d) => d.status === "in_transit") ||
            sorted.find((d) => d.status === "pending") ||
            sorted[0];

          if (active?.isRerouted) {
            if (active.selectedAlternativeRoute) {
              setSelectedAlternativeRoute(active.selectedAlternativeRoute);
              setRerouted(true);
            } else {
              setRerouted(false);
            }
          }
        })
        .catch(() => showToast("Server tidak terhubung — menggunakan data lokal", "info"))
        .finally(() => setIsPageLoading(false));
    } else {
      setIsPageLoading(false);
    }
  }, [user, sortDeliveries, showToast]);

  // ── Periodic delivery refresh (picks up hub assignments, status changes) ──
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetchDeliveries(user.id);
        if (res.deliveries) {
          setDeliveries((prev) => {
            const updated = sortDeliveries(res.deliveries);
            // Only update if something actually changed (avoid unnecessary re-renders)
            const prevJSON = JSON.stringify(prev.map(d => ({ id: d.id, status: d.status, pickupHub: d.pickupHub })));
            const newJSON = JSON.stringify(updated.map(d => ({ id: d.id, status: d.status, pickupHub: d.pickupHub })));
            if (prevJSON !== newJSON) {
              // Check if a new hub was assigned
              const newHubs = updated.filter(
                (d) => d.pickupHub && !prev.find((p) => p.id === d.id && p.pickupHub)
              );
              if (newHubs.length > 0) {
                showToast(
                  `📦 Instruksi baru dari Dispatcher: Hub "${newHubs[0].pickupHub.label}" diterapkan.`,
                  "info",
                );
              }
              return updated;
            }
            return prev;
          });
        }
      } catch {
        // Silent fail — don't spam errors on polling
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [user?.id, sortDeliveries, showToast]);

  const handleApplyAlternativeRoute = useCallback(
    async (route) => {
      const isMain = !route || route.id === "alt-0";
      setRerouted(!isMain);
      setSelectedAlternativeRoute(isMain ? null : route);
      setIsNavigating(true);
      setActiveTab("route");
      showToast(
        `Rute alternatif diterapkan: ${route.name || "Alternatif"}`,
        "success",
      );

      // Persist to Firestore for the active delivery
      if (activeDelivery?.id) {
        try {
          await updateDeliveryStatus(activeDelivery.id, {
            isRerouted: !isMain,
            selectedAlternativeRoute: isMain ? null : route,
          });
        } catch (err) {
          console.error("Failed to persist reroute:", err);
        }
      }
    },
    [showToast, activeDelivery?.id],
  );

  const handleAcceptProactiveReroute = useCallback(async () => {
    if (isApplyingProactiveRoute) return;
    setIsApplyingProactiveRoute(true);
    try {
      const bestAlternative = routeAlternatives.alternatives?.[0] || null;
      if (bestAlternative) {
        await handleApplyAlternativeRoute(bestAlternative);
      } else {
        setRerouted(true);
        setIsNavigating(true);
        setActiveTab("route");
        showToast("Reroute proaktif diterapkan.", "success");

        if (activeDelivery?.id) {
          await updateDeliveryStatus(activeDelivery.id, { isRerouted: true });
        }
      }
      setProactiveWarning(null);
    } catch (err) {
      showToast("Gagal menerapkan rute: " + err.message, "error");
    } finally {
      setIsApplyingProactiveRoute(false);
    }
  }, [
    isApplyingProactiveRoute,
    routeAlternatives.alternatives,
    handleApplyAlternativeRoute,
    activeDelivery?.id,
    showToast,
  ]);

  // ── Handle Submit ─────────────────────────────────────────────────────────
  const handleSubmitReport = useCallback(
    async ({ photoFile, audioBlob, location }) => {
      setIsLoading(true);
      setAiDecision(null);
      try {
        // Auto-fill location from GPS if not provided
        const reportLocation = location || 
          (courierLocation ? `Lat: ${courierLocation.lat.toFixed(5)}, Lng: ${courierLocation.lng.toFixed(5)}` : null) ||
          activeDelivery?.address || 
          "Unknown";

        const result = await analyzeIncident({
          photoFile,
          audioBlob,
          courierId: user?.id,
          location: reportLocation,
        });
        setAiDecision(result.aiDecision);
        setActiveTab("route");
        showToast("Analisis AI selesai!", "success");
      } catch (err) {
        showToast(`Kesalahan: ${err.message}`, "error");
      } finally {
        setIsLoading(false);
      }
    },
    [activeDelivery, courierLocation, showToast, user],
  );

  // ── Handle Optimize Route (AI) ────────────────────────────────────────────
  const handleOptimizeRoute = useCallback(async () => {
    const pending = deliveries.filter((d) => d.status !== "delivered");
    if (pending.length < 2) {
      showToast("Minimal 2 paket aktif untuk optimasi rute.", "info");
      return;
    }
    setIsOptimizing(true);
    setAiRouteInsight(null);
    try {
      const result = await optimizeRoute(deliveries);
      // Reorder deliveries based on AI optimized order
      if (result.optimizedOrder?.length) {
        setDeliveries((prev) => {
          const orderMap = {};
          result.optimizedOrder.forEach((id, idx) => {
            orderMap[id] = idx;
          });
          const sorted = [...prev].sort((a, b) => {
            const aIdx = orderMap[a.id] ?? 999;
            const bIdx = orderMap[b.id] ?? 999;
            return aIdx - bIdx;
          });
          return sorted;
        });
      }
      setAiRouteInsight(result);
      showToast(
        `🤖 Rute dioptimalkan! ${result.isMock ? "(Standar)" : "(Gemini AI)"}`,
        "success",
      );
    } catch (err) {
      showToast(`Gagal mengoptimalkan: ${err.message}`, "error");
    } finally {
      setIsOptimizing(false);
    }
  }, [deliveries, showToast]);
  // ── Handle Mark Delivered ────────────────────────────────────────────────────
  const handleMarkDelivered = useCallback(
    async (deliveryId, note = null) => {
      if (!canMarkDelivered || deliveryId !== activeDelivery?.id) {
        showToast(markDeliveredReason, "warning");
        return;
      }

      try {
        await updateDeliveryStatus(deliveryId, {
          status: "delivered",
          courierLocation,
          ...(note ? { deliveryNote: note, deliveredAt: new Date().toISOString() } : { deliveredAt: new Date().toISOString() }),
        });
      } catch (err) {
        showToast(err.message || "Gagal menandai pengiriman", "error");
        return;
      }

      setDeliveries((prev) => {
        const updated = prev.map((d) =>
          d.id === deliveryId ? { ...d, status: "delivered", deliveryNote: note, deliveredAt: new Date().toISOString() } : d,
        );

        // Find the next pending delivery and promote it to in_transit
        const nextIdx = updated.findIndex((d) => d.status === "pending");
        if (nextIdx !== -1) {
          updated[nextIdx] = { ...updated[nextIdx], status: "in_transit" };
          showToast(
            `✅ Terkirim! Menuju: ${updated[nextIdx].recipient}`,
            "success",
          );
        } else {
          showToast("🎉 Semua pengiriman hari ini selesai!", "success");
        }

        return updated;
      });

      // Reset navigation state for next delivery
      setIsNavigating(false);
      setRerouted(false);
      setSelectedAlternativeRoute(null);
      setRouteDirections(null);

      // Auto-switch to route tab so the map refreshes to the new destination
      setTimeout(() => {
        setActiveTab("route");
        setIsNavigating(true);
      }, 700);
    },
    [
      activeDelivery,
      canMarkDelivered,
      courierLocation,
      markDeliveredReason,
      showToast,
    ],
  );

  return (
    <div className="h-dvh flex flex-col bg-main overflow-hidden relative">
      {/* ═══ LOADING STATE ═══ */}
      {isPageLoading && (
        <div className="absolute inset-0 z-[200] bg-main flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center shadow-xl overflow-hidden">
            <img src="/icons/icon-192.png" alt="NusaRoute" className="w-12 h-12 object-contain" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-black text-text-main">NusaRoute AI</h2>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">Memuat data pengiriman...</p>
          </div>
          <div className="w-32 h-1 bg-surface rounded-full overflow-hidden mt-2">
            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      )}

      {/* ═══ LOGOUT CONFIRMATION MODAL ═══ */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
          <div className="relative z-10 bg-surface border border-theme rounded-3xl p-6 w-full max-w-xs mx-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertIcon className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-black text-text-main mb-1">Keluar dari Sesi?</h3>
            <p className="text-[11px] text-text-muted mb-5">Anda perlu login kembali untuk mengakses aplikasi.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-theme bg-main text-text-muted text-xs font-black uppercase tracking-wider hover:bg-surface transition-all"
              >
                Batal
              </button>
              <button
                onClick={onLogout}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-xs font-black uppercase tracking-wider hover:bg-red-600 transition-all shadow-md"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      <Header
        backendStatus={backendStatus}
        user={user}
        onLogout={() => setShowLogoutConfirm(true)}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      {/* SIMULATION FLOATING BUTTON (Dev Only) */}
      {import.meta.env.DEV && activeTab === "route" && (
        <div className="fixed top-20 right-4 z-[50] flex flex-col gap-2">
          <button
            onClick={() => setShowSimMenu(!showSimMenu)}
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-2xl transition-all border-2 ${
              showSimMenu
                ? "bg-orange-500 text-white border-white scale-110"
                : "bg-surface border-orange-500/30 text-orange-500 hover:scale-110"
            }`}
            title="Simulation Controller"
          >
            <RobotIcon className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* SIMULATION PICKER OVERLAY */}
      {import.meta.env.DEV && activeTab === "route" && isPickingLocation && (
        <div className="fixed inset-x-4 top-24 z-[70] animate-slide-down pointer-events-none">
          <div className="bg-orange-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/20 backdrop-blur-md pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center animate-pulse">
                <MapPinIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider">
                  Mode Pilih Lokasi
                </p>
                <p className="text-[10px] opacity-90">
                  Ketuk di mana saja pada peta untuk pindah posisi
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsPickingLocation(false)}
              className="bg-black/20 hover:bg-black/30 px-3 py-1.5 rounded-lg text-[10px] font-bold"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* SIMULATION MENU OVERLAY (Dev Only) */}
      {import.meta.env.DEV && activeTab === "route" && showSimMenu && (
        <div className="fixed inset-x-4 top-36 z-[60] animate-scale-in max-w-md mx-auto">
          <div className="bg-surface border-2 border-orange-500/50 rounded-3xl p-6 shadow-[0_20px_50px_rgba(249,115,22,0.3)]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <RobotIcon className="w-5 h-5 text-orange-500" />
                </div>
                <h3 className="text-xs font-black text-text-main uppercase tracking-widest">
                  Simulation Controller
                </h3>
              </div>
              <button
                onClick={() => setShowSimMenu(false)}
                className="w-8 h-8 rounded-full bg-main border border-theme flex items-center justify-center text-text-muted text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Location Mocks */}
              <div className="space-y-3">
                <p className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-1">
                  Pindah Lokasi (Teleport)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      const loc = { lat: -7.2655, lng: 112.7483 };
                      setMockLocation(loc);
                      setCourierLocation(loc);
                      showToast("Teleport ke Stasiun Gubeng", "success");
                    }}
                    className="p-3 bg-main border border-theme rounded-2xl text-[10px] font-black text-text-main hover:border-orange-500/50 transition-all active:scale-95 shadow-sm"
                  >
                    📍 Gubeng
                  </button>
                  <button
                    onClick={() => {
                      const loc = { lat: -7.2588, lng: 112.7388 };
                      setMockLocation(loc);
                      setCourierLocation(loc);
                      showToast("Teleport ke Tunjungan Plaza", "success");
                    }}
                    className="p-3 bg-main border border-theme rounded-2xl text-[10px] font-black text-text-main hover:border-orange-500/50 transition-all active:scale-95 shadow-sm"
                  >
                    📍 Tunjungan
                  </button>
                  <button
                    onClick={() => {
                      setIsPickingLocation(true);
                      setShowSimMenu(false);
                    }}
                    className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-2xl text-[10px] font-black text-orange-500 col-span-2 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    🎯 Pilih Lokasi Bebas di Peta
                  </button>
                  <button
                    onClick={() => {
                      setMockLocation(null);
                      showToast("Kembali ke GPS Real-time", "info");
                    }}
                    className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-[10px] font-black text-red-500 col-span-2 active:scale-95 transition-all"
                  >
                    🔄 Reset ke Lokasi Asli
                  </button>
                </div>
              </div>

              {/* Event Mocks */}
              <div className="space-y-3 pt-4 border-t border-theme">
                <p className="text-[10px] text-text-muted font-black uppercase tracking-widest ml-1">
                  Picu Skenario Operasional
                </p>
                <button
                  onClick={() => {
                    setProactiveWarning({
                      id: "mock-1",
                      severity: "high",
                      affectedZones: ["Bundaran Waru", "Jl. Ahmad Yani"],
                      nearestZoneName: "Bundaran Waru",
                      nearestDistanceKm: 0.8,
                      alternativeNote:
                        "Jalur utama terdeteksi macet total. AI menyarankan lewat rute alternatif untuk hemat 15 menit.",
                      impactScore: 85,
                    });
                    setActiveTab("route");
                    setShowSimMenu(false);
                    showToast("Skenario Macet Dipicu!", "warning");
                  }}
                  className="w-full p-4 bg-orange-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-orange-500/30 active:scale-95 transition-all"
                >
                  🔥 Trigger Alert Macet AI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Content Area */}
      <main className="flex-1 relative overflow-hidden">
        {/* TAB: ROUTE (Immersive Map View) */}
        {activeTab === "route" && (
          <div className="absolute inset-0 animate-fade-in flex flex-col">
            {/* Background Map Container */}
            <div className="absolute inset-0 z-0">
              <GoogleMap
                ref={mapRef}
                mode="courier"
                courierLat={courierLocation?.lat ?? null}
                courierLng={courierLocation?.lng ?? null}
                destLat={activeDelivery?.lat}
                destLng={activeDelivery?.lng}
                destinationName={activeDelivery?.recipient}
                deliveries={deliveries}
                rerouted={rerouted}
                isDarkMode={theme === "dark"}
                isNavigating={isNavigating}
                followUser={followUser}
                onUserInteraction={() => setFollowUser(false)}
                onToggleFollow={() => setFollowUser((v) => !v)}
                routePreferenceIndex={mapRoutePreferenceIndex}
                onRouteFetched={handleRouteFetched}
                onMapClick={(loc) => {
                  if (isPickingLocation) {
                    setMockLocation(loc);
                    setCourierLocation(loc);
                    setIsPickingLocation(false);
                    showToast("Posisi simulasi diperbarui!", "success");
                  }
                }}
              />
            </div>

            {/* Top Overlay: Turn-by-turn navigation only */}
            <div className="relative z-10 pt-2 px-4 pointer-events-none">
              <div className="max-w-md mx-auto pointer-events-auto">
                {/* Location Status Banner */}
                {locationStatus === "loading" && !courierLocation && (
                  <div className="mb-2 bg-surface border border-theme rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg animate-pulse">
                    <svg className="w-5 h-5 animate-spin text-primary shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <p className="text-xs font-bold text-text-main">Mencari lokasi Anda...</p>
                  </div>
                )}

                {locationStatus === "denied" && (
                  <div className="mb-2 bg-red-500 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
                    <AlertIcon className="w-5 h-5 text-white shrink-0" />
                    <div>
                      <p className="text-xs font-black text-white">Lokasi Tidak Aktif</p>
                      <p className="text-[10px] text-white/80">Aktifkan GPS dan izinkan akses lokasi untuk navigasi.</p>
                    </div>
                  </div>
                )}
                {/* Turn-by-turn navigation (only when navigating) */}
                {isNavigating &&
                  routeDirections &&
                  activeDelivery &&
                  activeDelivery.status !== "delivered" &&
                  !allDelivered && (
                    <div className="animate-slide-down">
                      <TurnByTurnNav
                        directions={routeDirections}
                        isNavigating={isNavigating}
                      />
                    </div>
                  )}
              </div>
            </div>

            {/* Spacer to push content down */}
            <div className="flex-1 pointer-events-none" />

            {/* Bottom Overlay: Active Card + FABs */}
            <div className="relative z-10 px-4 pb-20 pointer-events-none shrink min-h-0 flex flex-col justify-end">
              <div className="max-w-md w-full mx-auto pointer-events-none flex flex-col gap-3 shrink min-h-0">

                <div className="w-full pointer-events-auto">
                  {/* FAB row: Traffic + AI Chat (left) | Locate Me (right) */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setShowTrafficLayer((v) => !v);
                          mapRef.current?.toggleTraffic?.();
                        }}
                        className={`map-fab ${showTrafficLayer ? "active" : ""}`}
                        title={showTrafficLayer ? "Sembunyikan lalu lintas" : "Tampilkan lalu lintas"}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setShowAIChat(true)}
                        className="map-fab"
                        title="Tanya Asisten AI"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </button>
                    </div>
                    <button
                      onClick={handleLocateMe}
                      className="map-fab"
                      title="Cek Lokasi Saya"
                    >
                      <MapPinIcon className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="animate-slide-up-mobile">
                    {deliveries.length === 0 ? (
                      /* ── Empty State: No deliveries assigned yet ── */
                      <div className="glass-card-sage shadow-xl overflow-hidden p-5">
                        <div className="text-center">
                          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                            <PackageIcon className="w-7 h-7 text-primary" />
                          </div>
                          <h3 className="text-sm font-black text-text-main mb-1">Belum Ada Pengiriman</h3>
                          <p className="text-[11px] text-text-muted leading-relaxed">
                            Dispatcher belum mendelegasikan paket ke Anda. Tunggu sebentar, paket akan muncul otomatis.
                          </p>
                        </div>
                      </div>
                    ) : allDelivered ? (
                      /* ── Completion Summary ── */
                      <div className="glass-card-sage shadow-xl overflow-hidden p-5">
                        <div className="text-center mb-4">
                          <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500/30 flex items-center justify-center mx-auto mb-3">
                            <CheckIcon className="w-8 h-8 text-green-500" />
                          </div>
                          <h3 className="text-lg font-black text-text-main">Semua Pengiriman Selesai! 🎉</h3>
                          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">Ringkasan Performa Hari Ini</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          <div className="bg-surface border border-theme rounded-xl p-3 text-center">
                            <p className="text-xl font-black text-primary">{deliveries.length}</p>
                            <p className="text-[8px] text-text-muted font-bold uppercase">Total Paket</p>
                          </div>
                          <div className="bg-surface border border-theme rounded-xl p-3 text-center">
                            <p className="text-xl font-black text-green-500">{deliveries.filter(d => d.status === 'delivered').length}</p>
                            <p className="text-[8px] text-text-muted font-bold uppercase">Terkirim</p>
                          </div>
                          <div className="bg-surface border border-theme rounded-xl p-3 text-center">
                            <p className="text-xl font-black text-blue-500">{deliveries.filter(d => d.isRerouted).length}</p>
                            <p className="text-[8px] text-text-muted font-bold uppercase">Reroute</p>
                          </div>
                        </div>
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
                          <p className="text-[10px] text-primary font-bold text-center">
                            Kerja bagus, {user?.name || 'Kurir'}! Semua paket telah diantar dengan sukses.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <ActiveRouteCard
                        delivery={activeDelivery}
                        onReportIncident={() => setActiveTab("report")}
                        onMarkDelivered={handleMarkDelivered}
                        rerouted={mapRoutePreferenceIndex > 0}
                        canMarkDelivered={canMarkDelivered}
                        markDeliveredReason={markDeliveredReason}
                        distanceKm={
                          selectedAlternativeRoute
                            ? selectedAlternativeRoute.distance
                            : routeDirections?.distance || activeDistanceKm
                        }
                        eta={effectiveActiveEta}
                        isNavigating={isNavigating}
                        onStartNav={() => setIsNavigating(true)}
                      />
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: REPORT (Full Screen Overlay) */}
        {activeTab === "report" && (
          <div className="fixed inset-0 z-[60] bg-main flex flex-col animate-fade-in">
            <div className="bg-surface border-b border-theme px-4 py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab("route")}
                  className="text-text-main text-2xl pr-2"
                >
                  ←
                </button>
                <div>
                  <h2 className="text-lg font-black text-text-main uppercase tracking-tight">
                    Lapor Hambatan
                  </h2>
                  <p className="text-[10px] text-text-muted font-bold uppercase">
                    Petugas: {user?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("route")}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-main border border-theme text-text-muted font-bold"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 pb-10">
              <div className="max-w-md mx-auto">
                <IncidentReporter
                  onClose={() => setActiveTab("route")}
                  onSubmit={handleSubmitReport}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB: DELIVERIES (List View) */}
        {activeTab === "deliveries" && (
          <div className="h-full overflow-y-auto px-4 pt-4 pb-24 animate-fade-in">
            <div className="max-w-md mx-auto space-y-4">
              {/* Header + AI Optimize Button */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-text-main uppercase tracking-wider">
                    Jadwal Pengiriman
                  </h2>
                  <p className="text-[10px] text-text-muted font-bold">
                    {deliveries.filter((d) => d.status !== "delivered").length}{" "}
                    aktif &bull;{" "}
                    {deliveries.filter((d) => d.status === "delivered").length}{" "}
                    selesai
                  </p>
                </div>
                <button
                  onClick={handleOptimizeRoute}
                  disabled={isOptimizing}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg
                    ${
                      isOptimizing
                        ? "bg-primary/30 text-primary/50 cursor-not-allowed"
                        : "bg-primary text-white shadow-primary/30 hover:opacity-90"
                    }`}
                >
                  {isOptimizing ? (
                    <>
                      <svg
                        className="w-3.5 h-3.5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>{" "}
                      Mengoptimalkan...
                    </>
                  ) : (
                    <>
                      <RobotIcon className="w-3.5 h-3.5" /> Optimalkan AI
                    </>
                  )}
                </button>
              </div>

              {/* Multi-Route Alternatives with non-flicker loading state */}
              <div className="relative">
                {isRouteAlternativesLoading && (
                  <div className="absolute inset-0 z-10 bg-surface/40 backdrop-blur-[2px] rounded-2xl flex items-center justify-center animate-fade-in">
                    <div className="bg-surface border border-theme px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
                      <svg
                        className="w-4 h-4 animate-spin text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        ></path>
                      </svg>
                      <span className="text-[10px] font-black text-text-main uppercase tracking-wider">
                        Menganalisis...
                      </span>
                    </div>
                  </div>
                )}
                <MultiRouteAlternatives
                  currentRoute={routeAlternatives.currentRoute}
                  alternatives={routeAlternatives.alternatives}
                  appliedRouteId={selectedAlternativeRoute?.id}
                  selectedRouteId={
                    previewRouteId || selectedAlternativeRoute?.id
                  }
                  onSelectRoute={(route) => setPreviewRouteId(route.id)}
                  onApplyRoute={(route) => {
                    handleApplyAlternativeRoute(route);
                    setPreviewRouteId(null);
                  }}
                />
              </div>

              {/* AI Route Insight Panel */}
              {aiRouteInsight && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 animate-slide-up space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <RobotIcon className="w-3.5 h-3.5" />{" "}
                      {aiRouteInsight.isMock
                        ? "Optimasi Standar"
                        : `Gemini AI — ${aiRouteInsight.model}`}
                    </p>
                    <button
                      onClick={() => setAiRouteInsight(null)}
                      className="text-text-muted/40 hover:text-text-muted text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-text-main leading-relaxed">
                    {aiRouteInsight.reasoning}
                  </p>
                  <div className="flex items-center gap-4 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-text-muted font-bold uppercase">
                        Estimasi Total
                      </span>
                      <span className="text-[10px] text-primary font-black">
                        {aiRouteInsight.totalEstimatedTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-text-muted font-bold uppercase">
                        Titik
                      </span>
                      <span className="text-[10px] text-primary font-black">
                        {aiRouteInsight.optimizedOrder?.length ?? 0}
                      </span>
                    </div>
                  </div>
                  {aiRouteInsight.routeHighlights?.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {aiRouteInsight.routeHighlights.map((h, i) => (
                        <span
                          key={i}
                          className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-lg font-bold"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Route Overview Map */}
              <RouteOverviewMap
                deliveries={deliveries}
                courierLat={courierLocation?.lat}
                courierLng={courierLocation?.lng}
                isDarkMode={theme === "dark"}
              />

              {/* Delivery List */}
              <DeliveryList
                deliveries={deliveries}
                onMarkDelivered={handleMarkDelivered}
                activeDeliveryId={activeDelivery?.id}
                canMarkDelivered={canMarkDelivered}
                markDeliveredReason={markDeliveredReason}
                distancesMap={distancesMap}
                etasMap={etasMap}
              />
            </div>
          </div>
        )}
      </main>

      {/* ═══ AI CHAT FLOATING BUTTON — removed, now inline with FAB row ═══ */}

      {/* ═══ AI CHAT MODAL ═══ */}
      {showAIChat && (
        <AIChatAssistant
          courierId={user?.id}
          onClose={() => setShowAIChat(false)}
        />
      )}

      {/* ═══ AI PROACTIVE WARNING MODAL ═══ */}
      {proactiveWarning && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center animate-fade-in">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-md mx-4 mb-4 sm:mb-0 animate-slide-up">
            <div className="bg-surface border-2 border-orange-500/40 rounded-3xl shadow-2xl shadow-orange-500/10 overflow-hidden">
              {/* Header */}
              <div className="bg-orange-500 px-5 py-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <AlertIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white/80 text-[9px] font-black uppercase tracking-widest">Peringatan AI Proaktif</p>
                  <h3 className="text-white text-base font-black leading-tight">Kemacetan Terdeteksi</h3>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {/* Severity & Action badges */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] px-3 py-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-500 font-black uppercase">
                    Prioritas {proactiveWarning.priorityLabel || proactiveWarning.severity || "Tinggi"}
                  </span>
                  {proactiveWarning.recommendedAction && (
                    <span className="text-[10px] px-3 py-1.5 rounded-xl border border-theme bg-main text-text-muted font-black uppercase">
                      {proactiveWarning.recommendedAction === "REDIRECT_TO_HUB" ? "Alihkan ke Hub" : "Reroute"}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="space-y-2">
                  <p className="text-sm text-text-main leading-relaxed">
                    Mendeteksi potensi macet di{" "}
                    <span className="font-black text-orange-500">
                      {proactiveWarning.affectedZones?.join(", ")}
                    </span>
                  </p>
                  {proactiveWarning.nearestZoneName && (
                    <p className="text-xs text-text-muted">
                      Zona terdekat: <span className="font-bold text-text-main">{proactiveWarning.nearestZoneName}</span>
                      {proactiveWarning.nearestDistanceKm != null && ` (${proactiveWarning.nearestDistanceKm} km dari posisi Anda)`}
                    </p>
                  )}
                </div>

                {/* AI Suggestion */}
                <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-2xl">
                  <p className="text-[9px] text-orange-500 font-black uppercase tracking-widest mb-1.5">💡 Saran AI</p>
                  <p className="text-sm text-text-main leading-relaxed font-medium">
                    {proactiveWarning.alternativeNote}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleAcceptProactiveReroute}
                    disabled={isApplyingProactiveRoute}
                    className="flex-1 py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all active:scale-95 shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                  >
                    {isApplyingProactiveRoute ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        Menerapkan...
                      </>
                    ) : (
                      <>
                        <RouteIcon className="w-4 h-4" /> Terapkan Rute AI
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setProactiveWarning(null)}
                    disabled={isApplyingProactiveRoute}
                    className="px-5 py-3.5 rounded-2xl border-2 border-theme bg-surface text-text-muted text-xs font-black uppercase tracking-wider hover:bg-main disabled:opacity-60 transition-all active:scale-95"
                  >
                    Abaikan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ AI DECISION MODAL (Incident Analysis Result) ═══ */}
      {aiDecision && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center animate-fade-in">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-md mx-4 mb-4 sm:mb-0 animate-slide-up max-h-[85vh] overflow-y-auto scrollbar-hide">
            <AIDecisionCard
              decision={aiDecision}
              onDismiss={() => setAiDecision(null)}
              onAccept={async () => {
                setRerouted(true);
                setAiDecision(null);
                setIsNavigating(true);
                showToast("Rute baru diterapkan. Menyesuaikan peta...", "success");
                if (activeDelivery?.id) {
                  await updateDeliveryStatus(activeDelivery.id, { isRerouted: true });
                }
              }}
              showActions={true}
            />
          </div>
        </div>
      )}

      {/* Bottom Navigation (Modern PWA Style) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-nav-bg border-t border-theme pb-safe pt-2 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="max-w-md mx-auto px-8 flex justify-between items-center h-16">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`mobile-nav-pill ${activeTab === tab.id ? "active" : ""}`}
              >
                <span className="text-xl">
                  {React.createElement(Icon, { className: "w-6 h-6" })}
                </span>
                <p
                  className={`text-[10px] font-bold uppercase tracking-[0.15em] ${activeTab === tab.id ? "text-white" : "text-text-muted"}`}
                >
                  {tab.label}
                </p>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
