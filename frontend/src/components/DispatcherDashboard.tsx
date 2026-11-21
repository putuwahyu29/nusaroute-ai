import React, { useState, useEffect } from "react";
import Header from "./Header";
import GoogleMap from "./GoogleMap";
import TrafficZoneOverlay from "./TrafficZoneOverlay";
import CongestionHeatmap from "./CongestionHeatmap";
import SmartHubAssignment from "./SmartHubAssignment";
import DeliveryClusteringCard from "./DeliveryClusteringCard";
import LocationPickerMap from "./LocationPickerMap";
import AnalyticsPage from "../pages/AnalyticsPage";
import {
  fetchAllDeliveries,
  fetchIncidents,
  fetchTrafficPrediction,
  fetchPickupPoints,
  fetchProactiveAlert,
  applyPickupHub,
  addDelivery,
  fetchWeather,
  updateWeather,
  autoAssignDeliveries,
  resetDatabaseDemo,
  fetchUsers,
  toUserFriendlyError,
} from "../services/api";
import {
  SunIcon,
  ShieldIcon,
  AlertIcon,
  MapPinIcon,
  HubIcon,
  PackageIcon,
  LeafIcon,
  RainIcon,
  CloudIcon,
  ActivityIcon,
  TruckIcon,
  XIcon,
  CompassIcon,
  RouteIcon,
} from "./UiIcons";
import Notification from "./Notification";
import { Delivery, IncidentReport, TrafficZone, PickupHub, Weather, User } from "../types";

function calcDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface DispatcherDashboardProps {
  user: User;
  onLogout: () => void;
  theme?: string;
  toggleTheme?: () => void;
}

interface ProactiveAlertItem {
  id?: string;
  deliveryId?: string;
  recipient?: string;
  affectedZones?: string[];
  alternativeNote?: string;
  message?: string;
  delivery?: { id?: string; recipient?: string };
  threatZone?: { name?: string };
}

export default function DispatcherDashboard({
  user,
  onLogout,
  theme: propTheme,
  toggleTheme: propToggleTheme,
}: DispatcherDashboardProps) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [courierMap, setCourierMap] = useState<Record<string, string>>({});
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const getCourierName = (courierId?: string | null): string => {
    if (!courierId) return "Kurir (TBA)";
    return courierMap[courierId] || courierId;
  };
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [stats, setStats] = useState({ total: 0, inTransit: 0, delayed: 0 });
  const [localTheme, setLocalTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const theme = propTheme ?? localTheme;
  const toggleTheme =
    propToggleTheme ??
    (() => {
      const next = (propTheme ?? localTheme) === "dark" ? "light" : "dark";
      setLocalTheme(next);
      localStorage.setItem("theme", next);
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    });
  const [mapCenter, setMapCenter] = useState({ lat: -7.2575, lng: 112.7521 });

  const [activeRightTab, setActiveRightTab] = useState<
    "alerts" | "traffic" | "hubs" | "clustering" | "proactive"
  >("alerts");
  const [trafficZones, setTrafficZones] = useState<TrafficZone[]>([]);
  const [aiAnalysisTime, setAiAnalysisTime] = useState<string | null>(null);
  const [pickupHubs, setPickupHubs] = useState<PickupHub[]>([]);
  const [sustainability, setSustainability] = useState<{
    totalSavingKm?: number;
    co2SavedKg?: number;
    treesEquivalent?: number;
  } | null>(null);
  const [proactiveAlerts, setProactiveAlerts] = useState<ProactiveAlertItem[]>([]);
  const [aiLoading, setAiLoading] = useState({
    traffic: false,
    hubs: false,
    proactive: false,
  });
  const [hubLoading, setHubLoading] = useState<string | null>(null);
  const [appliedHubIds, setAppliedHubIds] = useState<string[]>([]);
  const [weather, setWeather] = useState<Weather>({ condition: "sunny", temp: 31 });
  const [, setIsWeatherLoading] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<"fleet" | "map" | "ai">("map");
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    recipient: "",
    address: "",
    priority: "medium" as "high" | "medium" | "low",
    packageCount: 1,
    lat: "",
    lng: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleApplyHub = async (hub: PickupHub & { deliveries?: Delivery[] }) => {
    try {
      if (hub.id) setHubLoading(hub.id);
      const payload = {
        ...hub,
        deliveryIds: hub.deliveryIds || hub.deliveries?.map((d) => d.id) || [],
      };
      await applyPickupHub(payload);

      const affectedIds = new Set(payload.deliveryIds);
      setDeliveries((prev) =>
        prev.map((d) =>
          affectedIds.has(d.id)
            ? { ...d, pickupHub: { label: hub.label, reason: hub.reason } }
            : d
        )
      );

      if (hub.id) setAppliedHubIds((prev) => [...prev, hub.id!]);

      setNotification({
        message: `Hub '${hub.label}' diterapkan ke ${payload.deliveryIds.length} paket. Instruksi telah dikirim ke kurir.`,
        type: "success",
      });
    } catch (err: unknown) {
      setNotification({
        message: toUserFriendlyError(err, "Gagal menetapkan Hub penjemputan."),
        type: "error",
      });
    } finally {
      setHubLoading(null);
    }
  };

  const handleAutoAssign = async () => {
    try {
      setIsAutoAssigning(true);
      const result = await autoAssignDeliveries();
      setNotification({
        message: result.message || `${result.assignedCount} paket berhasil didelegasikan.`,
        type: "success",
      });
      const res = await fetchAllDeliveries();
      setDeliveries(res);
    } catch (err: unknown) {
      setNotification({
        message: toUserFriendlyError(err, "Gagal mendelegasikan paket secara otomatis."),
        type: "error",
      });
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const handleResetDemo = async () => {
    const ok = window.confirm(
      "Apakah Anda yakin ingin me-reset data demo ke kondisi awal?\n\n- 15 paket pengiriman dikembalikan ke status 'unassigned'\n- 10 zona rawan macet default dipulihkan\n- Riwayat laporan insiden sementara dibersihkan"
    );
    if (!ok) return;

    try {
      setIsResetting(true);
      const result = await resetDatabaseDemo();
      setNotification({
        message: result.message || "Database berhasil di-reset ke kondisi awal demo.",
        type: "success",
      });
      const [resDels, resUsers, resZones] = await Promise.all([
        fetchAllDeliveries(),
        fetchUsers(),
        fetchTrafficZones(),
      ]);
      setDeliveries(resDels);
      const map: Record<string, string> = {};
      for (const u of resUsers) {
        if (u.role === "courier") {
          map[u.id] = u.name;
        }
      }
      setCourierMap(map);
      setTrafficZones(resZones);
    } catch (err: unknown) {
      setNotification({
        message: toUserFriendlyError(err, "Gagal me-reset data demo."),
        type: "error",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleSendProactiveAlert = async (alertData: ProactiveAlertItem) => {
    const alertId = alertData.id || alertData.deliveryId || alertData.delivery?.id;
    const recipient = alertData.recipient || alertData.delivery?.recipient || "Kurir";
    const instruction =
      alertData.alternativeNote || alertData.message || "Ikuti rute alternatif yang disarankan.";
    try {
      if (alertId) setHubLoading(`alert-${alertId}`);
      setNotification({
        message: `Notifikasi optimasi dikirim ke ${recipient}!\nInstruksi: ${instruction}`,
        type: "info",
      });
    } catch (err: unknown) {
      setNotification({
        message: toUserFriendlyError(err, "Gagal mengirim notifikasi."),
        type: "error",
      });
    } finally {
      setHubLoading(null);
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const handleAddDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const newDel: Partial<Delivery> = {
        courierId: null,
        status: "unassigned",
        recipient: deliveryForm.recipient,
        address: deliveryForm.address,
        priority: deliveryForm.priority,
        lat: deliveryForm.lat ? parseFloat(deliveryForm.lat) : -7.2575 + (Math.random() * 0.04 - 0.02),
        lng: deliveryForm.lng ? parseFloat(deliveryForm.lng) : 112.7521 + (Math.random() * 0.04 - 0.02),
        packageCount: parseInt(String(deliveryForm.packageCount), 10) || 1,
        estimatedArrival: "14:00",
      };
      const saved = await addDelivery(newDel);
      setDeliveries((prev) => [...prev, saved.delivery]);
      setShowAddModal(false);
      setDeliveryForm({
        recipient: "",
        address: "",
        priority: "medium",
        packageCount: 1,
        lat: "",
        lng: "",
      });
      setNotification({
        message: `Pengiriman baru berhasil ditambahkan${deliveryForm.lat ? " dengan lokasi dari peta" : ""}.`,
        type: "success",
      });
    } catch (err: unknown) {
      setNotification({
        message: toUserFriendlyError(err, "Gagal menambahkan pengiriman baru."),
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateWeather = async (condition: Weather["condition"]) => {
    try {
      setIsWeatherLoading(true);
      await updateWeather(condition);
      setNotification({
        message: `Kondisi cuaca diubah ke ${condition}. Kalkulasi rute sedang disesuaikan...`,
        type: "info",
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: unknown) {
      setNotification({
        message: toUserFriendlyError(err, "Gagal memperbarui status cuaca."),
        type: "error",
      });
    } finally {
      setIsWeatherLoading(false);
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setMapCenter({ lat: -7.2575, lng: 112.7521 });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadIncidents = async () => {
      try {
        const [incRes, usersRes] = await Promise.all([
          fetchIncidents(),
          fetchUsers().catch(() => [] as User[]),
        ]);
        if (isMounted) {
          setIncidents(incRes || []);
          const map: Record<string, string> = {};
          for (const u of usersRes) {
            if (u.id && u.name) map[u.id] = u.name;
          }
          setCourierMap(map);
        }
      } catch (err) {
        console.error("Error loading incidents:", err);
      }
    };

    const loadSmartCityInsights = async () => {
      try {
        const res = await fetchAllDeliveries();
        const docs = res || [];

        if (!isMounted) return;

        setDeliveries(docs);
        setStats({
          total: docs.length,
          inTransit: docs.filter((d) => d.status === "in_transit").length,
          delayed: docs.filter((d) => d.status === "rerouted").length,
        });

        setAiLoading({ traffic: true, hubs: true, proactive: true });
        const [trafficRes, hubsRes] = await Promise.all([
          fetchTrafficPrediction().catch((err) => {
            console.error("Traffic error:", err);
            return { zones: [], weather: { condition: "sunny" as const, temp: 31 }, source: "", generatedAt: "" };
          }),
          fetchPickupPoints(docs).catch((err) => {
            console.error("Pickup hub error:", err);
            return { hubs: [], totalDeliveriesClustered: 0, sustainability: { kmSaved: 0, co2SavedKg: 0, timeSavedMinutes: 0 } };
          }),
        ]);

        if (!isMounted) return;

        const populatedHubs = (hubsRes.hubs || []).map((hub) => ({
          ...hub,
          deliveries: (hub.deliveryIds || [])
            .map((id) => docs.find((d) => d.id === id))
            .filter(Boolean) as Delivery[],
        }));

        setTrafficZones(trafficRes.zones || []);
        setAiAnalysisTime(trafficRes.generatedAt);
        setPickupHubs(populatedHubs);
        setSustainability({
          totalSavingKm: hubsRes.sustainability?.kmSaved || 0,
          co2SavedKg: hubsRes.sustainability?.co2SavedKg || 0,
          treesEquivalent: Math.round((hubsRes.sustainability?.co2SavedKg || 0) * 0.05),
        });

        if ((trafficRes.zones || []).length > 0) {
          const proactiveRes = await fetchProactiveAlert(docs, trafficRes.zones || []).catch(
            (err) => {
              console.error("Proactive error:", err);
              return { alerts: [], count: 0 };
            }
          );
          if (isMounted) {
            setProactiveAlerts(proactiveRes.alerts || []);
          }
        } else if (isMounted) {
          setProactiveAlerts([]);
        }

        if (isMounted) {
          setAiLoading((prev) => ({ ...prev, proactive: false }));
        }

        const weatherRes = await fetchWeather();
        if (isMounted) setWeather(weatherRes);
      } catch {
        // network fallback handled via cached states
      } finally {
        if (isMounted) {
          setAiLoading({
            traffic: false,
            hubs: false,
            proactive: false,
          });
        }
      }
    };

    loadSmartCityInsights();
    loadIncidents();
    const interval = setInterval(loadIncidents, 10000);
    const refreshInterval = setInterval(loadSmartCityInsights, 300000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearInterval(refreshInterval);
    };
  }, []);

  return (
    <div className="h-screen bg-main text-text-main flex flex-col transition-colors duration-300 overflow-hidden">
      {showAnalytics && (
        <div className="fixed inset-0 z-[100] bg-main animate-fade-in">
          <AnalyticsPage onBack={() => setShowAnalytics(false)} />
        </div>
      )}

      <Header
        backendStatus={{ status: "ok" }}
        user={user}
        onLogout={() => setShowLogoutConfirm(true)}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative transition-all">
        <aside
          className={`w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-theme bg-surface p-6 overflow-y-auto scrollbar-hide shrink-0 shadow-sm h-full ${
            activeMobileTab === "fleet" ? "flex flex-col" : "hidden lg:flex lg:flex-col"
          }`}
        >
          <section className="mb-6">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Ikhtisar Operasional
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-main border border-theme rounded-xl p-3.5 shadow-sm">
                <span className="text-xs text-text-muted font-medium block mb-0.5">
                  Total Aktif
                </span>
                <span className="text-2xl font-bold font-mono text-primary">{stats.total}</span>
              </div>
              <div className="bg-main border border-theme rounded-xl p-3.5 shadow-sm">
                <span className="text-xs text-text-muted font-medium block mb-0.5">
                  Dalam Tugas
                </span>
                <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {stats.inTransit}
                </span>
              </div>
            </div>

            <div className="bg-main border border-theme rounded-xl p-3.5 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-primary block uppercase tracking-wider">
                  Kondisi Cuaca Operasional
                </span>
                <span className="text-sm font-bold text-text-main capitalize">
                  {weather.condition.replace("_", " ")} • {weather.temp}°C
                </span>
                <span className="text-[11px] text-text-muted block">Surabaya Perkotaan</span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-surface border border-theme flex items-center justify-center text-primary shrink-0 shadow-sm">
                {weather.condition === "sunny" ? (
                  <SunIcon className="w-5 h-5" />
                ) : weather.condition === "rain" ? (
                  <RainIcon className="w-5 h-5" />
                ) : (
                  <CloudIcon className="w-5 h-5" />
                )}
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Manajemen Order
            </h2>
            <div className="space-y-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full btn-sage py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2"
              >
                <span>+</span> Tambah Order Pengiriman
              </button>
              <button
                onClick={handleAutoAssign}
                disabled={
                  isAutoAssigning ||
                  deliveries.filter((d) => !d.courierId || d.status === "unassigned").length === 0
                }
                className="w-full py-2.5 px-4 bg-surface hover:bg-main border border-theme disabled:opacity-50 disabled:cursor-not-allowed text-text-main text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {isAutoAssigning ? (
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
                    Mendelegasikan...
                  </>
                ) : (
                  <>
                    <TruckIcon className="w-4 h-4 text-primary" /> Alokasi Otomatis Armada
                  </>
                )}
              </button>
              {deliveries.filter((d) => !d.courierId || d.status === "unassigned").length > 0 && (
                <p className="text-[11px] text-text-muted text-center">
                  {deliveries.filter((d) => !d.courierId || d.status === "unassigned").length} paket belum ditugaskan
                </p>
              )}
              <button
                onClick={handleResetDemo}
                disabled={isResetting}
                className="w-full py-2 px-4 bg-surface hover:bg-red-500/10 border border-theme hover:border-red-500/30 disabled:opacity-50 text-text-muted hover:text-red-500 text-xs font-medium rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                title="Kembalikan semua paket ke status unassigned dan bersihkan laporan uji coba"
              >
                {isResetting ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Me-reset Data...
                  </>
                ) : (
                  <>
                    <ActivityIcon className="w-3.5 h-3.5 opacity-70" /> Reset Data Demo
                  </>
                )}
              </button>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Telematika & Analisis
            </h2>
            <button
              onClick={() => setShowAnalytics(true)}
              className="w-full py-2.5 px-4 bg-surface hover:bg-main border border-theme text-text-main text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <ActivityIcon className="w-4 h-4 text-primary" /> Buka Laporan Telematika Armada
            </button>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Titik Pengiriman ({deliveries.length})
            </h2>
            <div className="space-y-2">
              {deliveries.map((d) => (
                <div
                  key={d.id}
                  className="bg-main border border-theme hover:border-primary/50 rounded-xl p-3 transition-all cursor-pointer shadow-sm group"
                >
                  <div className="flex justify-between items-start mb-1.5 gap-2">
                    <p className="text-xs font-bold text-text-main truncate group-hover:text-primary transition-colors">
                      {d.recipient}
                    </p>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-semibold tracking-tight shrink-0 border ${
                        d.status === "unassigned" || !d.courierId
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : d.status === "in_transit"
                          ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                          : "bg-surface text-text-muted border-theme"
                      }`}
                    >
                      {d.status === "unassigned" || !d.courierId
                        ? "Belum Ditugaskan"
                        : d.status === "in_transit"
                        ? "Dalam Perjalanan"
                        : "Menunggu"}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted truncate leading-snug font-normal mb-2">
                    {d.address}
                  </p>
                  <div className="text-[11px] text-text-muted font-medium flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-theme rounded-lg w-fit">
                    <TruckIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{d.courierId ? getCourierName(d.courierId) : "Belum didelegasikan"}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {sustainability && (
            <section className="mt-6 animate-fade-in">
              <h2 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <LeafIcon className="w-3.5 h-3.5" /> Dampak Keberlanjutan
              </h2>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 shadow-sm">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-muted font-medium">
                      Jarak Hemat
                    </span>
                    <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {sustainability.totalSavingKm || 0} km
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-muted font-medium">
                      Reduksi Emisi CO₂
                    </span>
                    <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {sustainability.co2SavedKg || 0} kg
                    </span>
                  </div>
                  <div className="w-full h-px bg-emerald-500/10"></div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                      <LeafIcon className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-text-main font-medium leading-snug">
                      Setara dengan penanaman{" "}
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {sustainability.treesEquivalent || 0} pohon
                      </span>{" "}
                      di area perkotaan Surabaya.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </aside>

        <section
          className={`flex-1 relative min-h-0 border-b lg:border-b-0 border-theme ${
            activeMobileTab === "map" ? "block" : "hidden lg:block"
          }`}
        >
          <div className="absolute inset-0">
            <div className="w-full h-full relative">
              <GoogleMap
                mode="dispatcher"
                incidents={incidents}
                deliveries={deliveries}
                courierPositions={Object.values(
                  deliveries
                    .filter((d) => d.status === "in_transit" && d.lat && d.lng && d.courierId)
                    .reduce((acc: Record<string, { id: string; name: string; lat: number; lng: number; activeDelivery?: string }>, d) => {
                      if (d.courierId && !acc[d.courierId]) {
                        acc[d.courierId] = {
                          id: d.courierId,
                          name: getCourierName(d.courierId),
                          lat: d.lat,
                          lng: d.lng,
                          activeDelivery: d.recipient,
                        };
                      }
                      return acc;
                    }, {})
                )}
                courierLat={mapCenter.lat}
                courierLng={mapCenter.lng}
                destinationName="Surabaya Main Hub"
                isDarkMode={theme === "dark"}
              />
              <TrafficZoneOverlay
                trafficZones={
                  activeRightTab === "traffic" || activeRightTab === "proactive"
                    ? trafficZones
                    : []
                }
              />
            </div>
          </div>

          <div className="absolute top-4 left-4 w-72 bg-surface/95 backdrop-blur-md border border-theme p-3.5 rounded-xl shadow-lg hidden sm:block z-20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-text-main">Ringkasan Armada Surabaya</p>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2.5 text-center">
              <div className="bg-main rounded-lg p-2 border border-theme">
                <p className="text-sm font-bold font-mono text-primary">{stats.total}</p>
                <p className="text-[10px] text-text-muted font-medium uppercase">Total</p>
              </div>
              <div className="bg-main rounded-lg p-2 border border-theme">
                <p className="text-sm font-bold font-mono text-sky-600 dark:text-sky-400">{stats.inTransit}</p>
                <p className="text-[10px] text-text-muted font-medium uppercase">Jalan</p>
              </div>
              <div className="bg-main rounded-lg p-2 border border-theme">
                <p className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">{incidents.length}</p>
                <p className="text-[10px] text-text-muted font-medium uppercase">Laporan</p>
              </div>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed font-normal">
              {incidents.length === 0
                ? "Seluruh jalur operasional Surabaya terpantau lancar tanpa hambatan."
                : `${incidents.length} laporan hambatan aktif sedang dalam penanganan dispatcher.`}
            </p>
          </div>
        </section>

        <aside
          className={`w-full lg:w-96 border-l-0 lg:border-l border-theme bg-surface flex flex-col shrink-0 shadow-sm relative z-30 h-full ${
            activeMobileTab === "ai" ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className="p-2 border-b border-theme bg-main sticky top-0 z-10">
            <div className="grid grid-cols-5 p-1 bg-surface border border-theme rounded-xl text-xs font-medium gap-1">
              <button
                type="button"
                onClick={() => setActiveRightTab("alerts")}
                className={`py-1.5 px-1 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
                  activeRightTab === "alerts"
                    ? "bg-primary text-white shadow-sm font-semibold"
                    : "text-text-muted hover:text-text-main"
                }`}
                title="Laporan Kurir"
              >
                <span>Laporan</span>
                {incidents.length > 0 && (
                  <span className={`px-1 py-0.5 rounded text-[10px] font-mono leading-none ${
                    activeRightTab === "alerts" ? "bg-white/20 text-white" : "bg-main border border-theme text-text-main"
                  }`}>
                    {incidents.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveRightTab("traffic")}
                className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                  activeRightTab === "traffic"
                    ? "bg-primary text-white shadow-sm font-semibold"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                Traffic
              </button>
              <button
                type="button"
                onClick={() => setActiveRightTab("hubs")}
                className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                  activeRightTab === "hubs"
                    ? "bg-primary text-white shadow-sm font-semibold"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                Hubs
              </button>
              <button
                type="button"
                onClick={() => setActiveRightTab("clustering")}
                className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                  activeRightTab === "clustering"
                    ? "bg-primary text-white shadow-sm font-semibold"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                Kluster
              </button>
              <button
                type="button"
                onClick={() => setActiveRightTab("proactive")}
                className={`py-1.5 px-1 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
                  activeRightTab === "proactive"
                    ? "bg-primary text-white shadow-sm font-semibold"
                    : "text-text-muted hover:text-text-main"
                }`}
                title="Reroute Proaktif"
              >
                <span>Reroute</span>
                {proactiveAlerts.length > 0 && (
                  <span className={`px-1 py-0.5 rounded text-[10px] font-mono leading-none ${
                    activeRightTab === "proactive" ? "bg-white/20 text-white" : "bg-main border border-theme text-text-main"
                  }`}>
                    {proactiveAlerts.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {activeRightTab === "alerts" && (
              <div className="space-y-4 animate-fade-in">
                {incidents.length === 0 ? (
                  <div className="text-center py-20 opacity-40">
                    <ShieldIcon className="w-8 h-8 mx-auto mb-3 text-text-muted" />
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
                      Tidak ada laporan hambatan
                    </p>
                    <p className="text-[10px] mt-1">Wilayah Surabaya terpantau lancar.</p>
                  </div>
                ) : (
                  incidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="bg-main border border-theme rounded-2xl overflow-hidden hover:border-orange-500/40 transition-all animate-slide-up shadow-md"
                    >
                      <div className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-lg shadow-inner">
                            {inc.aiDecision?.incidentType === "flooding" ? (
                              <MapPinIcon className="w-4.5 h-4.5 text-orange-500" />
                            ) : (
                              <AlertIcon className="w-4.5 h-4.5 text-orange-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-orange-500 font-black uppercase tracking-wider truncate">
                              {inc.aiDecision?.incidentTypeLabel || "Hambatan Terdeteksi"}
                            </p>
                            <p className="text-xs text-text-main font-bold truncate leading-tight">
                              {inc.location}
                            </p>
                          </div>
                          <span className="text-[9px] text-text-muted font-black uppercase shrink-0">
                            {new Date(inc.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted mb-4 font-medium leading-relaxed italic border-l-2 border-orange-500/20 pl-3">
                          &ldquo;
                          {inc.aiDecision?.analysis ||
                            inc.aiDecision?.analysisId ||
                            "Rekomendasi penyesuaian rute sedang diproses..."}
                          &rdquo;
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              setSelectedIncident(selectedIncident?.id === inc.id ? null : inc)
                            }
                            className="flex-1 py-2 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider border border-primary/20 hover:bg-primary/20 transition-all"
                          >
                            {selectedIncident?.id === inc.id ? "Tutup Detail" : "Lihat Detail"}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedIncident(null);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="px-4 py-2 rounded-xl bg-surface border border-theme text-[10px] font-black uppercase tracking-wider hover:bg-primary/5 transition-all"
                            title="Fokus ke Peta"
                          >
                            <MapPinIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {selectedIncident?.id === inc.id && (
                        <div className="border-t border-theme bg-surface p-4 animate-fade-in">
                          <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-3">
                            Detail Laporan
                          </p>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-text-muted font-bold">Kurir</span>
                              <span className="text-[10px] font-black text-text-main">
                                {inc.courierId || "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-text-muted font-bold">Rekomendasi Tindakan</span>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-lg uppercase ${
                                  inc.aiDecision?.action === "REROUTE"
                                    ? "bg-orange-500/10 text-orange-500"
                                    : inc.aiDecision?.action === "REDIRECT_TO_HUB"
                                    ? "bg-blue-500/10 text-blue-500"
                                    : "bg-green-500/10 text-green-600"
                                }`}
                              >
                                {inc.aiDecision?.action || "Proses..."}
                              </span>
                            </div>
                            {inc.aiDecision?.recommendation && (
                              <div className="mt-2 p-3 rounded-xl bg-main border border-theme">
                                <p className="text-[9px] font-black text-text-muted uppercase mb-1">
                                  Rekomendasi Sistem
                                </p>
                                <p className="text-[11px] font-bold text-primary">
                                  {inc.aiDecision.recommendation}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeRightTab === "traffic" && (
              <div className="animate-fade-in h-full min-h-0 flex flex-col w-full">
                {aiLoading.traffic ? (
                  <p className="text-xs text-text-muted text-center py-10 animate-pulse flex items-center justify-center gap-2">
                    <ActivityIcon className="w-4 h-4 animate-spin text-primary" /> Memperbarui data kepadatan Surabaya...
                  </p>
                ) : (
                  <div className="flex-1 min-h-0 flex flex-col gap-3 w-full">
                    <p className="text-[9px] text-text-muted font-bold mb-4">
                      Pembaruan data lalu lintas:{" "}
                      {aiAnalysisTime
                        ? new Date(aiAnalysisTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </p>
                    <CongestionHeatmap zones={trafficZones} />
                  </div>
                )}
              </div>
            )}

            {activeRightTab === "hubs" && (
              <div className="animate-fade-in">
                <SmartHubAssignment
                  hubs={pickupHubs}
                  isLoading={aiLoading.hubs}
                  onApplyHub={handleApplyHub}
                  loadingHubId={hubLoading}
                  appliedHubIds={appliedHubIds}
                  courierNameMap={courierMap}
                />
              </div>
            )}

            {activeRightTab === "clustering" && (
              <div className="animate-fade-in">
                <DeliveryClusteringCard
                  clusters={pickupHubs.map((hub, idx) => {
                    const clusterDeliveries =
                      hub.deliveries && hub.deliveries.length > 0
                        ? hub.deliveries
                        : deliveries.filter((d) => hub.deliveryIds?.includes(d.id));
                    const cLat = hub.centroid?.lat ?? hub.lat;
                    const cLng = hub.centroid?.lng ?? hub.lng;
                    const distances = clusterDeliveries.map((d) =>
                      cLat != null && cLng != null && d.lat != null && d.lng != null
                        ? calcDistanceKm(cLat, cLng, d.lat, d.lng)
                        : 0
                    );
                    const totalKm = distances.reduce((acc, km) => acc + km, 0);
                    const estMins = Math.max(5, Math.round((totalKm / 20) * 60 + clusterDeliveries.length * 4));
                    return {
                      id: hub.id || `cluster-${idx + 1}`,
                      name: hub.label || `Kluster Spasial #${idx + 1}`,
                      zone: hub.reason || "Kluster Dinamis",
                      totalDistance: `${totalKm.toFixed(1)} km`,
                      estimatedTime: `~${estMins} mnt`,
                      deliveries: clusterDeliveries.map((d, dIdx) => ({
                        id: d.id,
                        recipient: d.recipient,
                        address: d.address,
                        distance: `${(distances[dIdx] ?? 0).toFixed(2)} km`,
                      })),
                    };
                  })}
                  totalDeliveries={deliveries.length}
                />
              </div>
            )}

            {activeRightTab === "proactive" && (
              <div className="animate-fade-in">
                {aiLoading.proactive ? (
                  <p className="text-xs text-text-muted text-center py-10 animate-pulse flex items-center justify-center gap-2">
                    <ActivityIcon className="w-4 h-4 animate-spin text-primary" /> Memeriksa status telematika kurir aktif...
                  </p>
                ) : proactiveAlerts.length === 0 ? (
                  <div className="text-center py-20 opacity-40">
                    <HubIcon className="w-8 h-8 mx-auto mb-3 text-text-muted" />
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
                      Semua Rute Aman
                    </p>
                    <p className="text-[10px] mt-1">Tidak ada rute aktif yang melewati zona macet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {proactiveAlerts.map((alert, idx) => {
                      const alertId = alert.id || alert.deliveryId || alert.delivery?.id || String(idx);
                      const recipient = alert.recipient || alert.delivery?.recipient || "Paket Aktif";
                      const zones = Array.isArray(alert.affectedZones)
                        ? alert.affectedZones
                        : alert.threatZone?.name
                        ? [alert.threatZone.name]
                        : [];
                      const note =
                        alert.alternativeNote ||
                        alert.message ||
                        "Disarankan menggunakan jalur alternatif untuk menghindari kemacetan.";

                      return (
                        <div key={alertId} className="bg-main border border-orange-500/30 rounded-2xl p-4">
                          <div className="flex items-start gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                              <AlertIcon className="w-4 h-4 text-orange-500" />
                            </div>
                            <div>
                              <p className="text-[10px] text-orange-500 font-black uppercase tracking-wider mb-0.5">
                                Rute Terdampak
                              </p>
                              <p className="text-xs font-bold text-text-main leading-tight">
                                {recipient}
                              </p>
                              <p className="text-[10px] text-text-muted">
                                Melewati: {zones.length > 0 ? zones.join(", ") : "Zona Padat Surabaya"}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 p-3 bg-orange-500/5 rounded-xl border border-orange-500/20">
                            <p className="text-[9px] text-orange-500 font-black uppercase tracking-widest mb-1">
                              Rekomendasi Reroute
                            </p>
                            <p className="text-[11px] font-medium text-text-main leading-relaxed">
                              {note}
                            </p>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => handleSendProactiveAlert(alert)}
                              disabled={hubLoading === `alert-${alertId}`}
                              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-orange-500/20"
                            >
                              {hubLoading === `alert-${alertId}` ? "Mengirim..." : "Kirim Notif"}
                            </button>
                            <button
                              onClick={() =>
                                setProactiveAlerts((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="px-3 py-2 bg-surface hover:bg-main border border-theme text-[10px] font-black uppercase tracking-wider text-text-muted rounded-xl transition-all"
                            >
                              Abaikan
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          ></div>
          <div className="bg-main border border-theme rounded-3xl w-full max-w-lg relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-theme flex justify-between items-center bg-surface sticky top-0">
              <h3 className="font-black text-lg text-text-main uppercase tracking-tight">
                Tambah Pengiriman Baru
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                aria-label="Tutup"
                className="w-8 h-8 rounded-full bg-main border border-theme flex items-center justify-center text-text-muted hover:text-red-500 transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddDelivery} className="p-5 space-y-4 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-[10px] text-text-muted font-black uppercase tracking-wider ml-1">
                  Penerima / Nama Toko
                </label>
                <input
                  type="text"
                  required
                  value={deliveryForm.recipient}
                  onChange={(e) =>
                    setDeliveryForm({
                      ...deliveryForm,
                      recipient: e.target.value,
                    })
                  }
                  className="w-full bg-surface border border-theme rounded-xl px-4 py-3 text-sm font-medium text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  placeholder="Contoh: Toko Maju Jaya"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-text-muted font-black uppercase tracking-wider ml-1">
                  Alamat Lengkap
                </label>
                <textarea
                  required
                  value={deliveryForm.address}
                  onChange={(e) =>
                    setDeliveryForm({
                      ...deliveryForm,
                      address: e.target.value,
                    })
                  }
                  className="w-full bg-surface border border-theme rounded-xl px-4 py-3 text-sm font-medium text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none h-20"
                  placeholder="Contoh: Jl. Diponegoro No. 123, Surabaya"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-muted font-black uppercase tracking-wider ml-1">
                    Prioritas
                  </label>
                  <select
                    value={deliveryForm.priority}
                    onChange={(e) =>
                      setDeliveryForm({
                        ...deliveryForm,
                        priority: e.target.value as "high" | "medium" | "low",
                      })
                    }
                    className="w-full bg-surface border border-theme rounded-xl px-4 py-3 text-sm font-medium text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none"
                  >
                    <option value="high">Prioritas Tinggi</option>
                    <option value="medium">Prioritas Sedang</option>
                    <option value="low">Prioritas Rendah</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-text-muted font-black uppercase tracking-wider ml-1">
                    Jumlah Paket
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={deliveryForm.packageCount}
                    onChange={(e) =>
                      setDeliveryForm({
                        ...deliveryForm,
                        packageCount: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full bg-surface border border-theme rounded-xl px-4 py-3 text-sm font-medium text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-text-muted font-black uppercase tracking-wider ml-1">
                  Lokasi Pengiriman (Klik pada peta)
                </label>
                <div className="relative w-full h-52 rounded-xl overflow-hidden border border-theme shadow-inner">
                  <LocationPickerMap
                    lat={deliveryForm.lat ? parseFloat(deliveryForm.lat) : null}
                    lng={deliveryForm.lng ? parseFloat(deliveryForm.lng) : null}
                    isDarkMode={theme === "dark"}
                    onLocationSelect={(loc) => {
                      setDeliveryForm({
                        ...deliveryForm,
                        lat: loc.lat.toFixed(6),
                        lng: loc.lng.toFixed(6),
                      });
                    }}
                  />
                </div>
                {deliveryForm.lat && deliveryForm.lng ? (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 flex items-center gap-1.5 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                      <MapPinIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-[10px] font-bold text-primary">
                        {parseFloat(deliveryForm.lat).toFixed(5)}, {parseFloat(deliveryForm.lng).toFixed(5)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeliveryForm({ ...deliveryForm, lat: "", lng: "" })}
                      className="px-2.5 py-2 rounded-lg border border-red-500/20 bg-red-500/5 text-red-500 text-[9px] font-black uppercase hover:bg-red-500/10 transition-all"
                    >
                      Reset
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-text-muted italic mt-1 ml-1 flex items-center gap-1.5">
                    <MapPinIcon className="w-3 h-3" />
                    Klik pada peta untuk menentukan lokasi tujuan pengiriman
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-4 py-4 bg-primary hover:bg-primary/90 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-primary/30 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
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
                        d="M4 12a8 8 0 018-8v8a8 8 0 01-8-8z"
                      />
                    </svg>
                    Memproses...
                  </>
                ) : (
                  "Buat Pengiriman"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-nav-bg backdrop-blur-md border-t border-theme pb-safe pt-1 shadow-lg">
        <div className="max-w-md mx-auto px-6 flex justify-around items-center h-16">
          <button
            type="button"
            onClick={() => setActiveMobileTab("fleet")}
            className={`mobile-nav-pill flex-1 py-1.5 ${activeMobileTab === "fleet" ? "active" : ""}`}
          >
            <PackageIcon className="w-5 h-5" />
            <span className="text-xs font-medium">
              Armada
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileTab("map")}
            className={`mobile-nav-pill flex-1 py-1.5 ${activeMobileTab === "map" ? "active" : ""}`}
          >
            <MapPinIcon className="w-5 h-5" />
            <span className="text-xs font-medium">
              Peta
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileTab("ai")}
            className={`mobile-nav-pill flex-1 py-1.5 ${activeMobileTab === "ai" ? "active" : ""}`}
          >
            <CompassIcon className="w-5 h-5" />
            <span className="text-xs font-medium">
              Pusat Kontrol
            </span>
          </button>
        </div>
      </nav>

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
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-theme bg-main text-text-muted text-xs font-semibold hover:bg-surface transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all shadow-sm"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
