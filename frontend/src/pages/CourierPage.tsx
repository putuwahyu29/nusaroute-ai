import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import Header from "../components/Header";
import IncidentReporter from "../components/IncidentReporter";
import AIDecisionCard from "../components/AIDecisionCard";
import DeliveryList from "../components/DeliveryList";
import GoogleMap, { GoogleMapHandle, RouteFetchedData } from "../components/GoogleMap";
import RouteOverviewMap from "../components/RouteOverviewMap";
import MultiRouteAlternatives from "../components/MultiRouteAlternatives";
import AIChatAssistant from "../components/AIChatAssistant";
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
  toUserFriendlyError,
} from "../services/api";
import { FRONTEND_CONFIG } from "../config/app-config";
import { messaging, getToken, onMessage } from "../firebase";
import {
  TruckIcon,
  CheckIcon,
  MapPinIcon,
  PackageIcon,
  AlertIcon,
  RouteIcon,
  ClockIcon,
  LockIcon,
  XIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  NavigationIcon,
  InfoIcon,
} from "../components/UiIcons";
import {
  Delivery,
  AIDecision,
  TrafficZone,
  User,
  RouteAlternative,
  RouteOptimizationResult,
} from "../types";

function haversineKm(
  lat1?: number | null,
  lng1?: number | null,
  lat2?: number | null,
  lng2?: number | null
): number | null {
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

function formatDist(km?: number | null): string | null {
  if (km == null) return null;
  if (km < 0.1) return "< 100 m";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `~${Math.round(km)} km`;
}

const AVG_SPEED_KMH = 25;
const TRAFFIC_BUFFER = 1.25;

const TRAFFIC_IMPACT: Record<string, number> = {
  critical: 0.6,
  high: 0.35,
  medium: 0.15,
  low: 0,
};

function estimateTravelMinutes(distanceKm?: number | null): number | null {
  if (distanceKm == null) return null;
  return Math.max(1, Math.ceil((distanceKm / AVG_SPEED_KMH) * 60 * TRAFFIC_BUFFER));
}

function getTrafficMultiplierForDelivery(delivery?: Delivery, trafficZones: TrafficZone[] = []): number {
  if (!delivery || delivery.lat == null || delivery.lng == null || !trafficZones.length) {
    return 1;
  }

  const matchedZones = trafficZones
    .map((zone) => {
      const distanceKm = haversineKm(delivery.lat, delivery.lng, zone.lat, zone.lng);
      return distanceKm != null && distanceKm <= (zone.radius || 2.0)
        ? { ...zone, distanceKm }
        : null;
    })
    .filter((z): z is TrafficZone & { distanceKm: number } => z != null)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (matchedZones.length === 0) return 1;

  const strongestZone = matchedZones.reduce((best, zone) => {
    if (!best) return zone;
    const bestImpact = TRAFFIC_IMPACT[best.level || "low"] || 0;
    const zoneImpact = TRAFFIC_IMPACT[zone.level || "low"] || 0;
    if (zoneImpact !== bestImpact) return zoneImpact > bestImpact ? zone : best;
    return zone.distanceKm < best.distanceKm ? zone : best;
  }, matchedZones[0]);

  const baseImpact = TRAFFIC_IMPACT[strongestZone.level || "low"] || 0;
  const proximityBoost =
    Math.max(
      0,
      ((strongestZone.radius || 2.0) - strongestZone.distanceKm) / (strongestZone.radius || 2.0)
    ) * 0.25;

  return 1 + baseImpact + proximityBoost;
}

interface ETAInfo {
  minutes: number;
  timeString: string;
  date: Date;
}

function computeETA(distanceKm?: number | null, trafficMultiplier = 1): ETAInfo | null {
  if (distanceKm == null) return null;
  const travelMins = estimateTravelMinutes(distanceKm);
  if (travelMins == null) return null;
  const minutes = Math.max(1, Math.ceil(travelMins * trafficMultiplier));
  const date = new Date(Date.now() + minutes * 60_000);
  const timeString = date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { minutes, timeString, date };
}

function parseDurationMinutes(durationText?: string | null): number | null {
  if (!durationText) return null;
  const text = String(durationText).toLowerCase();
  let totalMinutes = 0;
  let found = false;

  const hourMatch = text.match(/(\d+)\s*(h|hour|jam)/);
  if (hourMatch) {
    totalMinutes += parseInt(hourMatch[1], 10) * 60;
    found = true;
  }

  const minMatch = text.match(/(\d+)\s*(m|min|mnt)/);
  if (minMatch) {
    totalMinutes += parseInt(minMatch[1], 10);
    found = true;
  }

  if (!found) {
    const match = text.match(/(\d+)/);
    if (match) return Number(match[1]);
  }

  return totalMinutes > 0 ? totalMinutes : null;
}

function formatDuration(minutes?: number | null): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} mnt`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} mnt`;
}

function compareWithSchedule(etaDate?: Date, scheduledStr?: string | null): number | null {
  if (!etaDate || !scheduledStr) return null;
  const [h, m] = scheduledStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const scheduled = new Date();
  scheduled.setHours(h, m, 0, 0);
  return Math.round((etaDate.getTime() - scheduled.getTime()) / 60_000);
}

function formatScheduleDiff(diffMinutes?: number | null): { label: string; color: string } | null {
  if (diffMinutes == null) return null;
  const abs = Math.abs(diffMinutes);
  if (abs <= 3) return { label: "Tepat Waktu", color: "text-primary" };
  if (diffMinutes > 0) {
    if (diffMinutes > 360) return null;
    return { label: `+${formatDuration(diffMinutes)}`, color: "text-red-500" };
  }
  return { label: `-${formatDuration(abs)}`, color: "text-primary" };
}

const DELIVERY_MARK_RADIUS_KM = FRONTEND_CONFIG.deliveryMarkRadiusKm;

interface ActiveRouteCardProps {
  delivery?: Delivery | null;
  onReportIncident: () => void;
  onMarkDelivered: (deliveryId: string, note?: string | null) => void;
  rerouted?: boolean;
  distanceKm?: number | string | null;
  canMarkDelivered: boolean;
  markDeliveredReason?: string;
  eta?: ETAInfo | null;
  isNavigating: boolean;
  onStartNav: () => void;
  hasAlert?: boolean;
  onAcceptAlert?: () => void;
  onDismissAlert?: () => void;
}

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
}: ActiveRouteCardProps) {
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

  const scheduleDiff = eta ? compareWithSchedule(eta.date, delivery.estimatedArrival) : null;
  const diffLabel = formatScheduleDiff(scheduleDiff);

  return (
    <div className="bg-surface border border-theme rounded-2xl shadow-md overflow-hidden">
      <div
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-3 p-3.5 cursor-pointer select-none hover:bg-main/50 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          {isDelivered ? (
            <CheckIcon className="w-4 h-4 text-emerald-500" />
          ) : (
            <TruckIcon className="w-4 h-4 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-text-muted leading-none mb-1">
            {isDelivered
              ? "Selesai Dikirim"
              : rerouted
              ? "Tujuan Aktif (Jalur Alternatif)"
              : "Tujuan Aktif"}
          </p>
          <p className="font-bold text-sm text-text-main leading-snug line-clamp-2">
            {delivery.recipient}
          </p>
          {!expanded && (
            <p className="text-xs text-text-muted line-clamp-2 leading-snug mt-0.5">
              {delivery.address}
            </p>
          )}
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-0.5 font-mono">
          {eta ? (
            <>
              <p className="text-primary font-bold text-sm leading-none">{eta.timeString}</p>
              <p className="text-xs text-text-muted font-medium">
                ~{formatDuration(eta.minutes)}
                {distanceKm != null && (
                  <> · {typeof distanceKm === "string" ? distanceKm : formatDist(distanceKm)}</>
                )}
              </p>
              {diffLabel && (
                <p className={`text-[11px] font-semibold ${diffLabel.color}`}>{diffLabel.label}</p>
              )}
            </>
          ) : (
            <>
              <p className="text-primary font-bold text-sm leading-none">
                {delivery.estimatedArrival ?? "—"}
              </p>
              {distanceKm != null && (
                <p className="text-xs text-text-muted font-medium flex items-center justify-end gap-1">
                  <MapPinIcon className="w-3 h-3" />{" "}
                  {typeof distanceKm === "string" ? distanceKm : formatDist(distanceKm)}
                </p>
              )}
            </>
          )}
          <span
            className={`text-text-muted mt-0.5 inline-block transition-transform duration-200 ${
              expanded ? "-rotate-90" : "rotate-90"
            }`}
          >
            <ArrowRightIcon className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3.5 border-t border-theme/60 pt-3 flex flex-col gap-2.5 animate-fade-in">
          <div className="flex items-start gap-2 text-xs text-text-muted">
            <MapPinIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="leading-snug">{delivery.address}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className={`px-2 py-0.5 rounded-md font-medium border ${prio.color}`}>
              {prio.label}
            </span>
            {delivery.packageCount && (
              <span className="text-text-muted bg-main border border-theme px-2 py-0.5 rounded-md flex items-center gap-1">
                <PackageIcon className="w-3 h-3" /> {delivery.packageCount} paket
              </span>
            )}
            {delivery.timeSlot && (
              <span className="text-text-muted bg-main border border-theme px-2 py-0.5 rounded-md flex items-center gap-1 font-mono">
                <ClockIcon className="w-3 h-3" /> {delivery.timeSlot}
              </span>
            )}
            {rerouted && (
              <span className="text-orange-600 dark:text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
                <RouteIcon className="w-3 h-3" /> Jalur Alternatif Aktif
              </span>
            )}
          </div>

          {delivery.notes && (
            <div className="text-xs text-text-main bg-main border border-theme px-3 py-2 rounded-xl flex items-start gap-2">
              <PackageIcon className="w-4 h-4 shrink-0 text-primary mt-0.5" />
              <span>{delivery.notes}</span>
            </div>
          )}

          {delivery.pickupHub && (
            <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl space-y-1 animate-fade-in">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center shrink-0">
                  <MapPinIcon className="w-4 h-4 text-sky-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                    Titik Drop-off Hub Konsolidasi
                  </p>
                  <p className="text-sm font-bold text-text-main leading-tight">
                    {delivery.pickupHub.label}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {delivery.pickupHub.reason}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="px-3 pb-3">
        {!isDelivered ? (
          <>
            {hasAlert ? (
              <div className="flex gap-2 animate-scale-in">
                <button
                  onClick={onAcceptAlert}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                >
                  <RouteIcon className="w-4 h-4" /> Terima Reroute
                </button>
                <button
                  onClick={onDismissAlert}
                  className="px-4 py-2.5 rounded-xl border border-theme bg-surface text-text-muted text-xs font-semibold hover:bg-main active:scale-95 transition-all"
                >
                  Abaikan
                </button>
              </div>
            ) : isNavigating ? (
              <div className="space-y-2 animate-scale-in">
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
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                      !canMarkDelivered
                        ? "bg-surface border border-theme text-text-muted shadow-none cursor-not-allowed opacity-75"
                        : confirming
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                        : "btn-sage"
                    }`}
                  >
                    {!canMarkDelivered ? (
                      <>
                        <LockIcon className="w-4 h-4 shrink-0" />
                        <span>Tandai Terkirim</span>
                      </>
                    ) : confirming ? (
                      <>
                        <CheckIcon className="w-4 h-4" /> Konfirmasi Terkirim
                      </>
                    ) : (
                      <>
                        <CheckIcon className="w-4 h-4" /> Tandai Terkirim
                      </>
                    )}
                  </button>
                  {confirming && (
                    <button
                      onClick={() => {
                        setConfirming(false);
                        setDeliveryNote("");
                      }}
                      className="px-3 py-2.5 rounded-xl border border-theme bg-surface text-text-muted text-xs font-semibold hover:bg-main active:scale-95 transition-all"
                    >
                      Batal
                    </button>
                  )}
                  {!confirming && (
                    <button
                      onClick={onReportIncident}
                      className="px-3 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                      title="Laporkan Hambatan"
                    >
                      <AlertIcon className="w-4 h-4" /> Lapor
                    </button>
                  )}
                </div>
                {!canMarkDelivered && markDeliveredReason && (
                  <p className="text-[11px] text-text-muted text-center pt-0.5 flex items-center justify-center gap-1.5">
                    <InfoIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{markDeliveredReason}</span>
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={onStartNav}
                className="w-full btn-sage py-3 text-xs font-semibold flex items-center justify-center gap-2"
              >
                <TruckIcon className="w-4 h-4" /> Mulai Navigasi Sekarang
              </button>
            )}
          </>
        ) : (
          <div className="py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold text-center flex items-center justify-center gap-1.5">
            <CheckIcon className="w-4 h-4" /> Pengiriman Telah Selesai
          </div>
        )}
      </div>
    </div>
  );
}

interface ToastProps {
  message: string;
  type?: "info" | "success" | "error" | "warning";
  onClose: () => void;
}

function Toast({ message, type = "info", onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const styles = {
    success: "border-green-400/50 bg-green-600 text-white shadow-green-900/30",
    error: "border-red-400/50 bg-red-600 text-white shadow-red-900/30",
    warning: "border-orange-400/50 bg-orange-600 text-white shadow-orange-900/30",
    info: "border-primary/30 bg-surface text-text-main",
  };

  return (
    <div
      className={`fixed top-20 left-4 right-4 z-50 animate-slide-up rounded-2xl border shadow-xl p-4 flex items-center gap-3 ${
        styles[type] || styles.info
      }`}
    >
      <span className="text-base shrink-0">
        {type === "success" ? (
          <CheckIcon className="w-5 h-5 text-white" />
        ) : type === "error" ? (
          <AlertIcon className="w-5 h-5 text-white" />
        ) : type === "warning" ? (
          <AlertIcon className="w-5 h-5 text-white" />
        ) : (
          <InfoIcon className="w-5 h-5 text-primary" />
        )}
      </span>
      <p className="flex-1 text-sm font-semibold leading-snug">{message}</p>
      <button
        onClick={onClose}
        aria-label="Tutup"
        className="opacity-60 hover:opacity-100 p-1 rounded-lg shrink-0"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

function ManeuverIcon({ maneuver }: { maneuver: string }) {
  const m = maneuver.toLowerCase();
  if (m.includes("right")) {
    return <ArrowRightIcon className="w-5 h-5" />;
  }
  if (m.includes("left")) {
    return <ArrowLeftIcon className="w-5 h-5" />;
  }
  return <NavigationIcon className="w-5 h-5" />;
}

interface TurnByTurnNavProps {
  directions?: RouteFetchedData | null;
  isNavigating: boolean;
}

function TurnByTurnNav({ directions, isNavigating }: TurnByTurnNavProps) {
  const [expanded, setExpanded] = useState(false);

  if (!directions || !directions.steps || directions.steps.length === 0) return null;

  const nextStep = directions.steps[0];
  const remainingSteps = directions.steps.slice(1);

  return (
    <div
      className={`bg-main border rounded-3xl shadow-xl overflow-hidden mt-3 transition-all duration-500 ${
        isNavigating ? "border-primary ring-4 ring-primary/20" : "border-theme"
      }`}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        className={`px-4 py-4 flex items-center gap-4 cursor-pointer select-none transition-colors ${
          isNavigating ? "bg-primary" : "bg-surface border-b border-theme"
        }`}
      >
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-lg ${
            isNavigating ? "bg-white/20 text-white" : "bg-primary text-white"
          }`}
        >
          <ManeuverIcon maneuver={nextStep.maneuver} />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-bold leading-tight line-clamp-2 [&_b]:font-black [&_div]:text-xs ${
              isNavigating ? "text-white" : "text-text-main"
            }`}
            dangerouslySetInnerHTML={{ __html: nextStep.instructions }}
          />
          <p
            className={`text-xs font-semibold mt-1 ${
              isNavigating ? "text-white/80" : "text-primary"
            }`}
          >
            {nextStep.distance}
          </p>
        </div>
        <div className={isNavigating ? "text-white opacity-75" : "text-text-muted"}>
          <ArrowRightIcon className={`w-4 h-4 transition-transform duration-200 ${expanded ? "-rotate-90" : "rotate-90"}`} />
        </div>
      </div>

      {expanded && remainingSteps.length > 0 && (
        <div className="max-h-60 overflow-y-auto p-2 bg-surface">
          {remainingSteps.map((step, idx) => (
            <div
              key={idx}
              className="flex gap-3 items-center p-3 border-b border-theme last:border-0 hover:bg-main rounded-xl transition-colors"
            >
              <div className="w-6 h-6 rounded-lg bg-surface text-text-main border border-theme flex items-center justify-center text-xs shrink-0">
                <ManeuverIcon maneuver={step.maneuver} />
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
            <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-xl flex items-center justify-center gap-1.5 w-fit mx-auto">
              <MapPinIcon className="w-3.5 h-3.5" />
              Tujuan: {directions.distance}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: "route" as const, icon: RouteIcon, label: "Rute" },
  { id: "report" as const, icon: AlertIcon, label: "Lapor" },
  { id: "deliveries" as const, icon: PackageIcon, label: "Paket" },
];

interface CourierPageProps {
  user: User;
  onLogout: () => void;
  theme: string;
  toggleTheme: () => void;
}

interface ProactiveWarningState {
  id: string;
  severity: string;
  affectedZones: string[];
  nearestZoneName?: string;
  nearestDistanceKm?: number;
  alternativeNote: string;
  impactScore?: number;
  priorityLabel?: string;
  recommendedAction?: string;
}

export default function CourierPage({ user, onLogout, theme, toggleTheme }: CourierPageProps) {
  const [activeTab, setActiveTab] = useState<"route" | "report" | "deliveries">("route");
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [aiDecision, setAiDecision] = useState<AIDecision | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aiRouteInsight, setAiRouteInsight] = useState<RouteOptimizationResult | null>(null);
  const [backendStatus, setBackendStatus] = useState<{ status: string } | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "info" | "success" | "error" | "warning";
    key: number;
  } | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [rerouted, setRerouted] = useState(false);
  const [routeDirections, setRouteDirections] = useState<RouteFetchedData | null>(null);
  const [courierLocation, setCourierLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [followUser, setFollowUser] = useState(true);
  const [trafficZones, setTrafficZones] = useState<TrafficZone[]>([]);
  const [routeAlternatives, setRouteAlternatives] = useState<{
    currentRoute: RouteAlternative | null;
    alternatives: RouteAlternative[];
  }>({
    currentRoute: null,
    alternatives: [],
  });
  const [isRouteAlternativesLoading, setIsRouteAlternativesLoading] = useState(false);
  const [isApplyingProactiveRoute, setIsApplyingProactiveRoute] = useState(false);
  const [selectedAlternativeRoute, setSelectedAlternativeRoute] = useState<RouteAlternative | null>(
    null
  );
  const [previewRouteId, setPreviewRouteId] = useState<string | null>(null);
  const [mockLocation, setMockLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [proactiveWarning, setProactiveWarning] = useState<ProactiveWarningState | null>(null);
  const [showTrafficLayer, setShowTrafficLayer] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"loading" | "active" | "denied">("loading");
  const mapRef = useRef<GoogleMapHandle | null>(null);

  const showToast = useCallback(
    (message: string, type: "info" | "success" | "error" | "warning" = "info") => {
      setToast({ message, type, key: Date.now() });
    },
    []
  );

  const sortDeliveries = useCallback((list: Delivery[]): Delivery[] => {
    const statusOrder: Record<string, number> = {
      in_transit: 0,
      pending: 1,
      rerouted: 2,
      delivered: 3,
    };
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...list].sort((a, b) => {
      const sDiff = (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
      if (sDiff !== 0) return sDiff;
      const pDiff = (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
      if (pDiff !== 0) return pDiff;
      return (a.estimatedArrival ?? "").localeCompare(b.estimatedArrival ?? "");
    });
  }, []);

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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [mockLocation]);

  useEffect(() => {
    if (isNavigating) setFollowUser(true);
  }, [isNavigating]);

  useEffect(() => {
    if (!user?.id || !messaging) return;

    const initFCM = async () => {
      try {
        if (!("Notification" in window)) return;
        if (Notification.permission === "denied") return;

        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
          if (!vapidKey) return;
          const token = await getToken(messaging, { vapidKey });
          if (token) {
            await saveFcmToken(user.id, token);
          }
        }
      } catch {
        // FCM is optional, polling is fallback
      }
    };

    initFCM();

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("[FCM] Foreground message received:", payload);
      setToast({
        key: Date.now(),
        message:
          payload.notification?.body || "Anda mendapat instruksi baru dari Dispatcher.",
        type: "info",
      });

      fetchDeliveries(user.id)
        .then((res) => {
          if (Array.isArray(res)) setDeliveries(sortDeliveries(res));
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
          setFollowUser(true);
          mapRef.current?.panToLocation(latitude, longitude);
        },
        (err) => {
          console.warn("Locate me failed", err);
          showToast(
            "Tidak dapat mengambil lokasi saat ini. Pastikan GPS aktif dan beri izin lokasi.",
            "warning"
          );
        }
      );
    } else {
      showToast("Perangkat ini tidak mendukung GPS/Geolocation.", "warning");
    }
  };

  const handleRouteFetched = useCallback((data: RouteFetchedData) => {
    setRouteDirections(data);
    if (data.allRoutes) {
      setRouteAlternatives({
        currentRoute: {
          name: data.allRoutes[0].name,
          via: data.allRoutes[0].name,
          distanceKm: parseFloat(data.allRoutes[0].distance) || 0,
          durationMins: parseDurationMinutes(data.allRoutes[0].duration) || 0,
          isRecommended: true,
        },
        alternatives: data.allRoutes.slice(1).map((r) => ({
          name: r.name,
          via: r.name,
          distanceKm: parseFloat(r.distance) || 0,
          durationMins: parseDurationMinutes(r.duration) || 0,
          isRecommended: false,
        })),
      });
    }
  }, []);

  const activeDelivery =
    deliveries.find((d) => d.status === "in_transit") ||
    deliveries.find((d) => d.status === "pending") ||
    deliveries[0];
  const allDelivered =
    deliveries.length > 0 && deliveries.every((d) => d.status === "delivered");

  const distancesMap = useMemo(() => {
    const map: Record<string, number | null> = {};
    deliveries.forEach((d) => {
      if (d.lat != null && d.lng != null && courierLocation && courierLocation.lat != null) {
        map[d.id] = haversineKm(courierLocation.lat, courierLocation.lng, d.lat, d.lng);
      }
    });
    return map;
  }, [deliveries, courierLocation]);

  const activeDistanceKm = activeDelivery ? distancesMap[activeDelivery.id] ?? null : null;
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

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const etasMap = useMemo(() => {
    const map: Record<string, ETAInfo | null> = {};
    Object.entries(distancesMap).forEach(([id, km]) => {
      const delivery = deliveries.find((item) => item.id === id);
      const isActive = delivery?.id === activeDelivery?.id;

      if (isActive && (selectedAlternativeRoute || routeDirections)) {
        const durationText = selectedAlternativeRoute
          ? `${selectedAlternativeRoute.durationMins} mnt`
          : routeDirections?.duration;

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

      const trafficMultiplier = getTrafficMultiplierForDelivery(delivery, trafficZones);
      map[id] = computeETA(km, trafficMultiplier);
    });
    return map;
  }, [
    distancesMap,
    deliveries,
    trafficZones,
    tick,
    selectedAlternativeRoute,
    activeDelivery?.id,
    routeDirections,
  ]);

  const lastFetchLocation = useRef<{ lat: number | null; lng: number | null; activeId?: string }>({
    lat: null,
    lng: null,
  });

  useEffect(() => {
    if (
      !activeDelivery ||
      activeDelivery.status !== "in_transit" ||
      !isNavigating ||
      !courierLocation?.lat ||
      !courierLocation?.lng
    )
      return;

    const distFromLastFetch = lastFetchLocation.current.lat
      ? haversineKm(
          courierLocation.lat,
          courierLocation.lng,
          lastFetchLocation.current.lat,
          lastFetchLocation.current.lng
        )
      : 999;

    const deliveryChanged = activeDelivery.id !== lastFetchLocation.current.activeId;

    if (!deliveryChanged && distFromLastFetch != null && distFromLastFetch < 0.2) {
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
        if (res.originalRoute || res.alternatives?.length) {
          const current: RouteAlternative = {
            name: "Rute Utama",
            via: res.originalRoute?.path?.join(" -> ") || "Jalur Utama",
            durationMins: res.originalRoute?.durationMins || 0,
            distanceKm: distancesMap[activeDelivery.id] ?? 0,
            isRecommended: true,
          };
          setRouteAlternatives({
            currentRoute: current,
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

  const activeEta = activeDelivery ? etasMap[activeDelivery.id] ?? null : null;
  const effectiveActiveEta = activeEta;

  const mapRoutePreferenceIndex = useMemo(() => {
    if (!selectedAlternativeRoute?.name) return 0;
    const match = String(selectedAlternativeRoute.name).match(/alt-(\d+)/i);
    if (!match) return 0;
    const altNumber = Number(match[1]);
    if (!Number.isFinite(altNumber) || altNumber < 1) return 0;
    return altNumber;
  }, [selectedAlternativeRoute]);

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

        if (res.alerts && res.alerts.length > 0) {
          const alert =
            res.alerts.find((a: { deliveryId?: string }) => a.deliveryId === activeDelivery?.id) ||
            res.alerts[0];
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

  useEffect(() => {
    checkHealth().then(setBackendStatus);
    if (user?.id) {
      fetchDeliveries(user.id)
        .then((res) => {
          const list = Array.isArray(res) ? res : [];
          const sorted = sortDeliveries(list);
          setDeliveries(sorted);

          const active =
            sorted.find((d) => d.status === "in_transit") ||
            sorted.find((d) => d.status === "pending") ||
            sorted[0];

          if (active?.isRerouted) {
            setRerouted(true);
          }
        })
        .catch(() => showToast("Server tidak terhubung — menggunakan data lokal", "info"))
        .finally(() => setIsPageLoading(false));
    } else {
      setIsPageLoading(false);
    }
  }, [user, sortDeliveries, showToast]);

  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetchDeliveries(user.id);
        if (Array.isArray(res)) {
          setDeliveries((prev) => {
            const updated = sortDeliveries(res);
            const prevJSON = JSON.stringify(
              prev.map((d) => ({ id: d.id, status: d.status, pickupHub: d.pickupHub }))
            );
            const newJSON = JSON.stringify(
              updated.map((d) => ({ id: d.id, status: d.status, pickupHub: d.pickupHub }))
            );
            if (prevJSON !== newJSON) {
              const newHubs = updated.filter(
                (d) => d.pickupHub && !prev.find((p) => p.id === d.id && p.pickupHub)
              );
              if (newHubs.length > 0 && newHubs[0].pickupHub) {
                showToast(
                  `Instruksi baru dari Dispatcher: Hub "${newHubs[0].pickupHub.label}" diterapkan.`,
                  "info"
                );
              }
              return updated;
            }
            return prev;
          });
        }
      } catch {
        // Silent fail on polling
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.id, sortDeliveries, showToast]);

  const handleApplyAlternativeRoute = useCallback(
    async (route: RouteAlternative) => {
      const isMain = !route || route.name.includes("Utama");
      setRerouted(!isMain);
      setSelectedAlternativeRoute(isMain ? null : route);
      setIsNavigating(true);
      setActiveTab("route");
      showToast(`Rute alternatif diterapkan: ${route.name || "Alternatif"}`, "success");

      if (activeDelivery?.id) {
        try {
          await updateDeliveryStatus(activeDelivery.id, {
            isRerouted: !isMain,
          });
        } catch (err) {
          console.error("Failed to persist reroute:", err);
        }
      }
    },
    [showToast, activeDelivery?.id]
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
    } catch (err: unknown) {
      showToast(
        toUserFriendlyError(err, "Gagal menerapkan rute baru."),
        "error"
      );
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

  const handleSubmitReport = useCallback(
    async ({
      photoFile,
      audioBlob,
      location,
    }: {
      photoFile?: File | null;
      audioBlob?: Blob | null;
      location?: string;
    }) => {
      setIsLoading(true);
      setAiDecision(null);
      try {
        const reportLocation =
          location ||
          (courierLocation
            ? `Lat: ${courierLocation.lat.toFixed(5)}, Lng: ${courierLocation.lng.toFixed(5)}`
            : null) ||
          activeDelivery?.address ||
          "Surabaya";

        const result = await analyzeIncident({
          photoFile: photoFile || undefined,
          audioBlob: audioBlob || undefined,
          courierId: user?.id,
          location: reportLocation,
        });
        setAiDecision(result.aiDecision);
        setActiveTab("route");
        showToast("Laporan insiden berhasil diproses", "success");
      } catch (err: unknown) {
        showToast(
          toUserFriendlyError(err, "Gagal mengirim laporan insiden."),
          "error"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [activeDelivery, courierLocation, showToast, user]
  );

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
      if (result.optimizedOrder?.length) {
        setDeliveries((prev) => {
          const orderMap: Record<string, number> = {};
          result.optimizedOrder.forEach((id: string, idx: number) => {
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
        "Urutan pengiriman berhasil dioptimalkan",
        "success"
      );
    } catch (err: unknown) {
      showToast(
        toUserFriendlyError(err, "Gagal mengoptimalkan rute pengiriman."),
        "error"
      );
    } finally {
      setIsOptimizing(false);
    }
  }, [deliveries, showToast]);

  const handleMarkDelivered = useCallback(
    async (deliveryId: string, note?: string | null) => {
      if (!canMarkDelivered || deliveryId !== activeDelivery?.id) {
        showToast(markDeliveredReason, "warning");
        return;
      }

      try {
        await updateDeliveryStatus(deliveryId, {
          status: "delivered",
          courierLocation,
          ...(note
            ? { deliveryNote: note, deliveredAt: new Date().toISOString() }
            : { deliveredAt: new Date().toISOString() }),
        });
      } catch (err: unknown) {
        showToast(
          toUserFriendlyError(err, "Gagal memperbarui status pengiriman."),
          "error"
        );
        return;
      }

      setDeliveries((prev) => {
        const updated = prev.map((d) =>
          d.id === deliveryId
            ? {
                ...d,
                status: "delivered" as const,
                deliveryNote: note,
                deliveredAt: new Date().toISOString(),
              }
            : d
        );

        const nextIdx = updated.findIndex((d) => d.status === "pending");
        if (nextIdx !== -1) {
          updated[nextIdx] = { ...updated[nextIdx], status: "in_transit" };
          showToast(`Terkirim! Menuju: ${updated[nextIdx].recipient}`, "success");
        } else {
          showToast("Semua pengiriman hari ini selesai!", "success");
        }

        return updated;
      });

      setIsNavigating(false);
      setRerouted(false);
      setSelectedAlternativeRoute(null);
      setRouteDirections(null);

      setTimeout(() => {
        setActiveTab("route");
        setIsNavigating(true);
      }, 700);
    },
    [activeDelivery, canMarkDelivered, courierLocation, markDeliveredReason, showToast]
  );

  return (
    <div className="h-dvh flex flex-col bg-main overflow-hidden relative">
      {isPageLoading && (
        <div className="absolute inset-0 z-[200] bg-main flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center shadow-xl overflow-hidden">
            <img src="/icons/icon-192.png" alt="NusaRoute" className="w-12 h-12 object-contain" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-text-main">NusaRoute</h2>
            <p className="text-xs text-text-muted mt-1">
              Memuat data pengiriman...
            </p>
          </div>
          <div className="w-32 h-1 bg-surface rounded-full overflow-hidden mt-2">
            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="relative z-10 bg-surface border border-theme rounded-3xl p-6 w-full max-w-xs mx-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertIcon className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-text-main mb-1">Keluar dari Sesi?</h3>
            <p className="text-xs text-text-muted mb-5">
              Anda perlu login kembali untuk mengakses aplikasi.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-theme bg-main text-text-muted text-xs font-semibold hover:bg-surface transition-all"
              >
                Batal
              </button>
              <button
                onClick={onLogout}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all shadow-sm"
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

      <main className="flex-1 relative overflow-hidden">
        {activeTab === "route" && (
          <div className="absolute inset-0 animate-fade-in flex flex-col">
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
              />
            </div>

            <div className="relative z-10 pt-2 px-4 pointer-events-none">
              <div className="max-w-md mx-auto pointer-events-auto">
                {locationStatus === "loading" && !courierLocation && (
                  <div className="mb-2 bg-surface border border-theme rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg animate-pulse">
                    <svg
                      className="w-5 h-5 animate-spin text-primary shrink-0"
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
                    </svg>
                    <p className="text-xs font-bold text-text-main">Mencari lokasi Anda...</p>
                  </div>
                )}

                {locationStatus === "denied" && (
                  <div className="mb-2 bg-red-500 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
                    <AlertIcon className="w-5 h-5 text-white shrink-0" />
                    <div>
                      <p className="text-xs font-black text-white">Lokasi Tidak Aktif</p>
                      <p className="text-[10px] text-white/80">
                        Aktifkan GPS dan izinkan akses lokasi untuk navigasi.
                      </p>
                    </div>
                  </div>
                )}

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

            <div className="flex-1 pointer-events-none" />

            <div className="relative z-10 px-4 pb-24 pointer-events-none shrink min-h-0 flex flex-col justify-end">
              <div className="max-w-md w-full mx-auto pointer-events-none flex flex-col gap-3 shrink min-h-0">
                <div className="w-full pointer-events-auto">
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
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => setShowAIChat(true)}
                        className="map-fab"
                        title="Asisten Lapangan"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
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
                      <div className="glass-card-sage shadow-xl overflow-hidden p-5">
                        <div className="text-center">
                          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                            <PackageIcon className="w-7 h-7 text-primary" />
                          </div>
                          <h3 className="text-sm font-bold text-text-main mb-1">
                            Belum Ada Pengiriman
                          </h3>
                          <p className="text-xs text-text-muted leading-relaxed">
                            Dispatcher belum mendelegasikan paket ke Anda. Tunggu sebentar, paket akan muncul otomatis.
                          </p>
                        </div>
                      </div>
                    ) : allDelivered ? (
                      <div className="glass-card-sage shadow-xl overflow-hidden p-5">
                        <div className="text-center mb-4">
                          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                            <CheckIcon className="w-8 h-8 text-emerald-500" />
                          </div>
                          <h3 className="text-base font-bold text-text-main">
                            Semua Pengiriman Selesai!
                          </h3>
                          <p className="text-xs text-text-muted font-medium mt-0.5">
                            Ringkasan Performa Pengiriman Hari Ini
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          <div className="bg-surface border border-theme rounded-xl p-3 text-center">
                            <p className="text-xl font-bold font-mono text-primary">{deliveries.length}</p>
                            <p className="text-[10px] text-text-muted font-medium uppercase">
                              Total Paket
                            </p>
                          </div>
                          <div className="bg-surface border border-theme rounded-xl p-3 text-center">
                            <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                              {deliveries.filter((d) => d.status === "delivered").length}
                            </p>
                            <p className="text-[10px] text-text-muted font-medium uppercase">
                              Terkirim
                            </p>
                          </div>
                          <div className="bg-surface border border-theme rounded-xl p-3 text-center">
                            <p className="text-xl font-bold font-mono text-sky-600 dark:text-sky-400">
                              {deliveries.filter((d) => d.isRerouted).length}
                            </p>
                            <p className="text-[10px] text-text-muted font-medium uppercase">
                              Reroute
                            </p>
                          </div>
                        </div>
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
                          <p className="text-xs text-primary font-medium text-center">
                            Kerja bagus, {user?.name || "Kurir"}! Seluruh paket berhasil diantar ke penerima.
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
                            ? `${selectedAlternativeRoute.distanceKm} km`
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

        {activeTab === "report" && (
          <div className="h-full overflow-y-auto px-4 pt-4 pb-24 animate-fade-in">
            <div className="max-w-md mx-auto">
              <IncidentReporter
                onClose={() => setActiveTab("route")}
                onSubmit={handleSubmitReport}
                isLoading={isLoading}
              />
            </div>
          </div>
        )}

        {activeTab === "deliveries" && (
          <div className="h-full overflow-y-auto px-4 pt-4 pb-24 animate-fade-in">
            <div className="max-w-md mx-auto space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-text-main tracking-tight">
                    Jadwal Pengiriman
                  </h2>
                  <p className="text-xs text-text-muted font-medium">
                    {deliveries.filter((d) => d.status !== "delivered").length} aktif &bull;{" "}
                    {deliveries.filter((d) => d.status === "delivered").length} selesai
                  </p>
                </div>
                <button
                  onClick={handleOptimizeRoute}
                  disabled={isOptimizing}
                  className={`flex items-center justify-center gap-1.5 px-3.5 min-h-[44px] rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all active:scale-95 shadow-sm ${
                    isOptimizing
                      ? "bg-primary/30 text-primary/50 cursor-not-allowed"
                      : "bg-primary text-white hover:opacity-90"
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
                      <RouteIcon className="w-4 h-4 shrink-0" /> Optimalkan Rute
                    </>
                  )}
                </button>
              </div>

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
                  appliedRouteId={selectedAlternativeRoute?.name}
                  selectedRouteId={previewRouteId || selectedAlternativeRoute?.name}
                  onSelectRoute={(route) => setPreviewRouteId(route.name)}
                  onApplyRoute={(route) => {
                    const matched =
                      routeAlternatives.alternatives.find((a) => a.name === route.name) ||
                      (routeAlternatives.currentRoute?.name === route.name
                        ? routeAlternatives.currentRoute
                        : null);

                    const targetRoute: RouteAlternative = matched || {
                      name: route.name || "Rute Alternatif",
                      via: route.via || "",
                      durationMins:
                        route.mins ||
                        (route.duration ? parseDurationMinutes(route.duration) || 0 : 0),
                      distanceKm: parseFloat(route.distance || "0") || 0,
                      isRecommended: false,
                    };

                    handleApplyAlternativeRoute(targetRoute);
                    setPreviewRouteId(null);
                  }}
                />
              </div>

              {aiRouteInsight && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 animate-slide-up space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <RouteIcon className="w-3.5 h-3.5" />{" "}
                      {aiRouteInsight.isMock
                        ? "Mode Simulasi (Optimasi Haversine TSP)"
                        : `Rute Teroptimasi Live (${aiRouteInsight.model || "Gemini AI"})`}
                    </p>
                    <button
                      onClick={() => setAiRouteInsight(null)}
                      aria-label="Tutup wawasan rute"
                      className="w-9 h-9 -mr-1.5 -mt-1 rounded-xl flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface/80 transition-colors shrink-0"
                    >
                      <XIcon className="w-4 h-4" />
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
                  {aiRouteInsight.routeHighlights && aiRouteInsight.routeHighlights.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {aiRouteInsight.routeHighlights.map((h: string, i: number) => (
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

              <RouteOverviewMap
                deliveries={deliveries}
                courierLat={courierLocation?.lat}
                courierLng={courierLocation?.lng}
                isDarkMode={theme === "dark"}
              />

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

      {showAIChat && (
        <AIChatAssistant courierId={user?.id} onClose={() => setShowAIChat(false)} />
      )}

      {proactiveWarning && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md mx-4 mb-4 sm:mb-0 animate-slide-up">
            <div className="bg-surface border border-theme rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-amber-600 dark:bg-amber-700 px-5 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <AlertIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white/80 text-[10px] font-bold uppercase tracking-wider">
                    Peringatan Gangguan Rute
                  </p>
                  <h3 className="text-white text-base font-bold leading-tight">
                    Kepadatan Lalu Lintas Terdeteksi
                  </h3>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold">
                    Prioritas {proactiveWarning.priorityLabel || proactiveWarning.severity || "Tinggi"}
                  </span>
                  {proactiveWarning.recommendedAction && (
                    <span className="text-xs px-2.5 py-1 rounded-lg border border-theme bg-main text-text-muted font-semibold">
                      {proactiveWarning.recommendedAction === "REDIRECT_TO_HUB"
                        ? "Alihkan ke Hub"
                        : "Reroute"}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  <p className="text-text-main leading-relaxed">
                    Terdeteksi potensi macet di area{" "}
                    <span className="font-semibold text-amber-700 dark:text-amber-300">
                      {proactiveWarning.affectedZones?.join(", ")}
                    </span>
                  </p>
                  {proactiveWarning.nearestZoneName && (
                    <p className="text-text-muted">
                      Zona terdekat:{" "}
                      <span className="font-semibold text-text-main">{proactiveWarning.nearestZoneName}</span>
                      {proactiveWarning.nearestDistanceKm != null &&
                        ` (~${proactiveWarning.nearestDistanceKm} km dari posisi Anda)`}
                    </p>
                  )}
                </div>

                <div className="p-3.5 bg-main border border-theme rounded-xl">
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <RouteIcon className="w-3.5 h-3.5 text-primary" /> Rekomendasi Jalur Alternatif
                  </p>
                  <p className="text-xs text-text-main leading-relaxed">
                    {proactiveWarning.alternativeNote}
                  </p>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    onClick={handleAcceptProactiveReroute}
                    disabled={isApplyingProactiveRoute}
                    className="flex-1 py-2.5 px-4 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    {isApplyingProactiveRoute ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
                        </svg>
                        Menerapkan...
                      </>
                    ) : (
                      <>
                        <RouteIcon className="w-4 h-4" /> Terapkan Pengalihan Rute
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setProactiveWarning(null)}
                    disabled={isApplyingProactiveRoute}
                    className="px-4 py-2.5 rounded-xl border border-theme bg-surface hover:bg-main text-text-muted text-xs font-semibold disabled:opacity-60 transition-all"
                  >
                    Abaikan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {aiDecision && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
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

      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-nav-bg backdrop-blur-md border-t border-theme pb-safe pt-1 shadow-lg">
        <div className="max-w-md mx-auto px-6 flex justify-around items-center h-16">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`mobile-nav-pill flex-1 py-1.5 ${isActive ? "active" : ""}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
