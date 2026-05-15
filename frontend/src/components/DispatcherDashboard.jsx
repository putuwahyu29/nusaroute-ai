import React, { useState, useEffect } from "react";
import Header from "./Header.jsx";
import GoogleMap from "./GoogleMap.jsx";
import TrafficZoneOverlay from "./TrafficZoneOverlay.jsx";
import CongestionHeatmap from "./CongestionHeatmap.jsx";
import SmartHubAssignment from "./SmartHubAssignment.jsx";
import DeliveryClusteringCard from "./DeliveryClusteringCard.jsx";
import LocationPickerMap from "./LocationPickerMap.jsx";
import AnalyticsPage from "../pages/AnalyticsPage.jsx";
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
} from "../services/api.js";
import {
  SunIcon,
  MoonIcon,
  LogoutIcon,
  ShieldIcon,
  AlertIcon,
  MapPinIcon,
  RobotIcon,
  HubIcon,
  PackageIcon,
  LeafIcon,
  RainIcon,
  CloudIcon,
  ActivityIcon,
} from "./UiIcons.jsx";
import Notification from "./Notification.jsx";
/** Map courier IDs to courier names */
const COURIER_MAP = {
  "sby-c01": "Budi Santoso",
  "sby-c02": "Agus Setiawan",
  "sby-c03": "Eko Prasetyo",
};

function getCourierName(courierId) {
  return COURIER_MAP[courierId] || courierId || "Kurir (TBA)";
}

export default function DispatcherDashboard({ user, onLogout }) {
  const [deliveries, setDeliveries] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [stats, setStats] = useState({ total: 0, inTransit: 0, delayed: 0 });
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [networkStatus, setNetworkStatus] = useState("Menghubungkan...");
  const [mapCenter, setMapCenter] = useState({ lat: -7.2575, lng: 112.7521 });

  // Smart City AI State
  const [activeRightTab, setActiveRightTab] = useState("alerts"); // 'alerts', 'traffic', 'hubs', 'clustering', 'proactive'
  const [trafficZones, setTrafficZones] = useState([]);
  const [aiAnalysisTime, setAiAnalysisTime] = useState(null);
  const [pickupHubs, setPickupHubs] = useState([]);
  const [sustainability, setSustainability] = useState(null);
  const [proactiveAlerts, setProactiveAlerts] = useState([]);
  const [aiLoading, setAiLoading] = useState({
    traffic: false,
    hubs: false,
    proactive: false,
  });
  const [hubLoading, setHubLoading] = useState(null);
  const [appliedHubIds, setAppliedHubIds] = useState([]);
  const [weather, setWeather] = useState({ condition: "sunny", temp: 31 });
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [notification, setNotification] = useState(null); // { message, type }
  const [activeMobileTab, setActiveMobileTab] = useState("map"); // 'fleet', 'map', 'ai'
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleApplyHub = async (hub) => {
    try {
      setHubLoading(hub.id);
      // Ensure we send deliveryIds which the backend expects
      const payload = {
        ...hub,
        deliveryIds: hub.deliveryIds || hub.deliveries?.map((d) => d.id) || [],
      };
      await applyPickupHub(payload);

      // Update local deliveries state to reflect the hub assignment immediately
      const affectedIds = new Set(payload.deliveryIds);
      setDeliveries((prev) =>
        prev.map((d) =>
          affectedIds.has(d.id)
            ? { ...d, pickupHub: { label: hub.label, reason: hub.reason } }
            : d,
        ),
      );

      // Mark this hub as applied
      setAppliedHubIds((prev) => [...prev, hub.id]);

      setNotification({
        message: `✅ Hub '${hub.label}' diterapkan ke ${payload.deliveryIds.length} paket. Instruksi telah dikirim ke kurir.`,
        type: "success",
      });
    } catch (err) {
      setNotification({ message: `Gagal: ${err.message}`, type: "error" });
    } finally {
      setHubLoading(null);
    }
  };

  const handleAutoAssign = async () => {
    try {
      setIsAutoAssigning(true);
      const result = await autoAssignDeliveries();
      setNotification({
        message: result.message || `${result.assigned} paket berhasil didelegasikan.`,
        type: "success",
      });
      // Refresh deliveries
      const res = await fetchAllDeliveries();
      if (res.deliveries) setDeliveries(res.deliveries);
    } catch (err) {
      setNotification({ message: `Gagal: ${err.message}`, type: "error" });
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const handleSendProactiveAlert = async (alertData) => {
    try {
      setHubLoading(`alert-${alertData.id}`);
      // In a real app, this would call a specific FCM endpoint for reroute
      // For this demo, we'll use a generic status update or alert
      setNotification({
        message: `Notifikasi optimasi dikirim ke ${alertData.recipient}!\nInstruksi: ${alertData.alternativeNote}`,
        type: "info",
      });
    } catch (err) {
      setNotification({
        message: `Gagal mengirim notif: ${err.message}`,
        type: "error",
      });
    } finally {
      setHubLoading(null);
    }
  };

  // Sync theme with document class (Tailwind dark mode)
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  // Add Delivery State
  const [showAddModal, setShowAddModal] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    recipient: "",
    address: "",
    priority: "medium",
    packageCount: 1,
    lat: "",
    lng: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  const handleAddDelivery = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const newDel = {
        courierId: null, // Will be assigned via auto-assign
        status: "unassigned",
        ...deliveryForm,
        lat: deliveryForm.lat
          ? parseFloat(deliveryForm.lat)
          : -7.2575 + (Math.random() * 0.04 - 0.02),
        lng: deliveryForm.lng
          ? parseFloat(deliveryForm.lng)
          : 112.7521 + (Math.random() * 0.04 - 0.02),
        packageCount: parseInt(deliveryForm.packageCount) || 1,
        estimatedArrival: "14:00", // Mock initial ETA
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
    } catch (err) {
      setNotification({
        message: "Gagal menambahkan pengiriman: " + err.message,
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateWeather = async (condition) => {
    try {
      setIsWeatherLoading(true);
      await updateWeather(condition);
      setNotification({
        message: `Cuaca diperbarui ke ${condition}. AI sedang menyesuaikan rute...`,
        type: "info",
      });
      // Re-trigger smart city insights load
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setNotification({
        message: "Gagal update cuaca: " + err.message,
        type: "error",
      });
    } finally {
      setIsWeatherLoading(false);
    }
  };

  // Get real GPS location for the map center
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // Fallback to Surabaya center if permission denied
          setMapCenter({ lat: -7.2575, lng: 112.7521 });
        },
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadIncidents = async () => {
      try {
        const res = await fetchIncidents();
        if (isMounted) setIncidents(res.incidents || []);
      } catch (err) {
        console.error("Error loading incidents:", err);
      }
    };

    const loadSmartCityInsights = async () => {
      try {
        const res = await fetchAllDeliveries();
        const docs = res.deliveries || [];

        if (!isMounted) return;

        setDeliveries(docs);
        setNetworkStatus("Terhubung & Optimal");
        setStats({
          total: docs.length,
          inTransit: docs.filter((d) => d.status === "in_transit").length,
          delayed: docs.filter((d) => d.status === "delayed").length,
        });

        setAiLoading({ traffic: true, hubs: true, proactive: true });
        const [trafficRes, hubsRes] = await Promise.all([
          fetchTrafficPrediction().catch((err) => {
            console.error("Traffic error:", err);
            return { zones: [], generatedAt: null };
          }),
          fetchPickupPoints(docs).catch((err) => {
            console.error("Pickup hub error:", err);
            return { hubs: [] };
          }),
        ]);

        if (!isMounted) return;

        // Map deliveryIds to actual objects for the UI components
        const populatedHubs = (hubsRes.hubs || []).map((hub) => ({
          ...hub,
          deliveries: (hub.deliveryIds || [])
            .map((id) => docs.find((d) => d.id === id))
            .filter(Boolean),
        }));

        setTrafficZones(trafficRes.zones || []);
        setAiAnalysisTime(trafficRes.generatedAt);
        setPickupHubs(populatedHubs);
        setSustainability(hubsRes.sustainability);

        if ((trafficRes.zones || []).length > 0) {
          const proactiveRes = await fetchProactiveAlert(
            docs,
            trafficRes.zones || [],
          ).catch((err) => {
            console.error("Proactive error:", err);
            return { affected: [] };
          });
          if (isMounted) {
            setProactiveAlerts(proactiveRes.affected || []);
          }
        } else if (isMounted) {
          setProactiveAlerts([]);
        }

        if (isMounted) {
          setAiLoading((prev) => ({ ...prev, proactive: false }));
        }

        const weatherRes = await fetchWeather();
        if (isMounted) setWeather(weatherRes.weather);
      } catch {
        if (isMounted) setNetworkStatus("Offline / Tidak Terhubung");
      } finally {
        if (isMounted) {
          setAiLoading((prev) => ({
            ...prev,
            traffic: false,
            hubs: false,
            proactive: false,
          }));
        }
      }
    };

    loadSmartCityInsights();
    loadIncidents();
    const interval = setInterval(loadIncidents, 10000); // Poll every 10s instead of 5s
    const refreshInterval = setInterval(loadSmartCityInsights, 300000); // Poll every 5 mins instead of 3 mins

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearInterval(refreshInterval);
    };
  }, []);

  return (
    <div className="h-screen bg-main text-text-main flex flex-col transition-colors duration-300 overflow-hidden">
      {/* Analytics Full-Screen Overlay */}
      {showAnalytics && (
        <div className="fixed inset-0 z-[100] bg-main animate-fade-in">
          <AnalyticsPage onBack={() => setShowAnalytics(false)} />
        </div>
      )}

      {/* Header with NusaRoute AI branding */}
      <Header
        backendStatus={{ status: "ok" }}
        user={user}
        onLogout={() => setShowLogoutConfirm(true)}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative transition-all">
        {/* Left Sidebar: Fleet Info */}
        <aside
          className={`w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-theme bg-surface p-6 overflow-y-auto scrollbar-hide shrink-0 shadow-sm h-full ${activeMobileTab === "fleet" ? "flex flex-col" : "hidden lg:flex lg:flex-col"}`}
        >
          <section className="mb-8">
            <h2 className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-black mb-4 ml-1">
              Ikhtisar Operasional
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-surface border border-theme rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1">
                  Total Aktif
                </p>
                <p className="text-2xl font-black text-primary">
                  {stats.total}
                </p>
              </div>
              <div className="bg-surface border border-theme rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1">
                  Dalam Tugas
                </p>
                <p className="text-2xl font-black text-blue-500">
                  {stats.inTransit}
                </p>
              </div>
            </div>

            {/* Weather Condition (AI Prediction) */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute -top-4 -right-4 text-primary/10 text-5xl">
                {weather.condition === "sunny" ? (
                  <SunIcon className="w-16 h-16" />
                ) : weather.condition === "rain" ? (
                  <RainIcon className="w-16 h-16" />
                ) : (
                  <CloudIcon className="w-16 h-16" />
                )}
              </div>
              <p className="text-[9px] text-primary font-black uppercase tracking-[0.15em] mb-2 relative z-10">
                Prediksi Cuaca AI (Real-time)
              </p>
              <div className="flex items-center gap-2 relative z-10">
                <div className="flex-1">
                  <p className="text-sm font-black text-text-main capitalize leading-none mb-1">
                    {weather.condition.replace("_", " ")}
                  </p>
                  <p className="text-[10px] text-text-muted font-bold">
                    {weather.temp}°C • Surabaya City
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-black mb-4 ml-1">
              Manajemen Order
            </h2>
            <div className="space-y-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
              >
                <span className="text-lg leading-none">+</span> Tambah Pengiriman
              </button>
              <button
                onClick={handleAutoAssign}
                disabled={isAutoAssigning || deliveries.filter(d => !d.courierId || d.status === "unassigned").length === 0}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
              >
                {isAutoAssigning ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Mendelegasikan...
                  </>
                ) : (
                  <>
                    <RobotIcon className="w-4 h-4" /> Delegasi Otomatis ke Kurir
                  </>
                )}
              </button>
              {deliveries.filter(d => !d.courierId || d.status === "unassigned").length > 0 && (
                <p className="text-[9px] text-text-muted text-center italic">
                  {deliveries.filter(d => !d.courierId || d.status === "unassigned").length} paket belum ditugaskan
                </p>
              )}
            </div>
          </section>

          {/* Analytics & Agent Button */}
          <section className="mb-8">
            <h2 className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-black mb-4 ml-1">
              Kecerdasan Operasional
            </h2>
            <button
              onClick={() => setShowAnalytics(true)}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
            >
              <ActivityIcon className="w-4 h-4" /> Analytics & Agent AI
            </button>
          </section>

          <section>
            <h2 className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-black mb-4 ml-1">
              Titik Pengiriman
            </h2>
            <div className="space-y-2">
              {deliveries.map((d) => (
                <div
                  key={d.id}
                  className="bg-surface border border-theme rounded-2xl p-3 hover:border-primary transition-all cursor-pointer shadow-sm group"
                >
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <p className="text-[11px] font-black text-text-main truncate group-hover:text-primary transition-colors">
                      {d.recipient}
                    </p>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-lg font-bold uppercase tracking-tighter shrink-0 ${
                        d.status === "unassigned" || !d.courierId
                          ? "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                          : d.status === "in_transit"
                            ? "bg-blue-500/10 text-blue-600"
                            : "bg-main text-text-muted border border-theme"
                      }`}
                    >
                      {d.status === "unassigned" || !d.courierId ? "Belum" : d.status === "in_transit" ? "Jalan" : "Antri"}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-muted truncate leading-tight font-medium mb-1.5">
                    {d.address}
                  </p>
                  <div className="text-[9px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1.5 px-2 py-1 bg-primary/5 rounded-lg w-fit">
                    <span>🚚</span>
                    <span>{d.courierId ? getCourierName(d.courierId) : "Belum ditugaskan"}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Sustainability Report */}
          {sustainability && (
            <section className="mt-8 animate-fade-in">
              <h2 className="text-[10px] text-green-500 uppercase tracking-[0.2em] font-black mb-4 ml-1 flex items-center gap-2">
                <LeafIcon className="w-3.5 h-3.5" /> Dampak Keberlanjutan
              </h2>
              <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 shadow-sm">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-text-muted font-bold uppercase">
                      Jarak Hemat
                    </span>
                    <span className="text-sm font-black text-green-600">
                      {sustainability.totalSavingKm} KM
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-text-muted font-bold uppercase">
                      Reduksi CO2
                    </span>
                    <span className="text-sm font-black text-green-600">
                      {sustainability.co2SavedKg} KG
                    </span>
                  </div>
                  <div className="w-full h-px bg-green-500/10"></div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600">
                      <LeafIcon className="w-5 h-5" />
                    </div>
                    <p className="text-[10px] text-text-main font-bold leading-tight">
                      Setara dengan menanam{" "}
                      <span className="text-green-600 font-black">
                        {sustainability.treesEquivalent} pohon
                      </span>{" "}
                      baru di Surabaya.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </aside>

        {/* Center: Large Surabaya Map */}
        <section
          className={`flex-1 relative min-h-0 border-b lg:border-b-0 border-theme ${activeMobileTab === "map" ? "block" : "hidden lg:block"}`}
        >
          <div className="absolute inset-0">
            <div className="w-full h-full relative">
              <GoogleMap
                mode="dispatcher"
                incidents={incidents}
                deliveries={deliveries}
                courierPositions={
                  // Build courier positions from deliveries that are in_transit
                  // In production, this would come from real-time GPS tracking
                  Object.values(
                    deliveries
                      .filter((d) => d.status === "in_transit" && d.lat && d.lng)
                      .reduce((acc, d) => {
                        if (!acc[d.courierId]) {
                          acc[d.courierId] = {
                            id: d.courierId,
                            name: getCourierName(d.courierId),
                            lat: d.lat,
                            lng: d.lng,
                            activeDelivery: d.recipient,
                          };
                        }
                        return acc;
                      }, {}),
                  )
                }
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

          {/* Floating Analytics Card */}
          <div className="absolute bottom-6 right-6 w-72 bg-surface border border-theme p-5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-fade-in hidden sm:block z-20">
            <div className="flex items-center gap-3 mb-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <p className="text-[11px] font-black uppercase tracking-tight text-text-main">
                {networkStatus}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-main rounded-xl p-2 text-center border border-theme">
                <p className="text-xs font-black text-primary">{stats.total}</p>
                <p className="text-[8px] text-text-muted font-bold uppercase">
                  Total
                </p>
              </div>
              <div className="bg-main rounded-xl p-2 text-center border border-theme">
                <p className="text-xs font-black text-blue-500">
                  {stats.inTransit}
                </p>
                <p className="text-[8px] text-text-muted font-bold uppercase">
                  Jalan
                </p>
              </div>
              <div className="bg-main rounded-xl p-2 text-center border border-theme">
                <p className="text-xs font-black text-orange-500">
                  {incidents.length}
                </p>
                <p className="text-[8px] text-text-muted font-bold uppercase">
                  Laporan
                </p>
              </div>
            </div>
            <p className="text-[10px] text-text-muted leading-relaxed font-bold">
              {incidents.length === 0
                ? "Tidak ada hambatan aktif. Seluruh rute Surabaya terpantau lancar."
                : `${incidents.length} hambatan aktif terdeteksi. AI merekomendasikan reroute.`}
            </p>
          </div>
        </section>

        {/* Right Sidebar: Smart City AI Panels */}
        <aside
          className={`w-full lg:w-96 border-l-0 lg:border-l border-theme bg-surface flex flex-col shrink-0 shadow-sm relative z-30 h-full ${activeMobileTab === "ai" ? "flex" : "hidden lg:flex"}`}
        >
          {/* Tabs */}
          <div className="flex border-b border-theme bg-main px-2 pt-2 sticky top-0 z-10 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveRightTab("alerts")}
              className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${activeRightTab === "alerts" ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text-main"}`}
            >
              Laporan Kurir{" "}
              <span className="ml-1 bg-surface px-1.5 py-0.5 rounded-md border border-theme">
                {incidents.length}
              </span>
            </button>
            <button
              onClick={() => setActiveRightTab("traffic")}
              className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${activeRightTab === "traffic" ? "border-red-500 text-red-500" : "border-transparent text-text-muted hover:text-text-main"}`}
            >
              Lalu Lintas
            </button>
            <button
              onClick={() => setActiveRightTab("hubs")}
              className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${activeRightTab === "hubs" ? "border-blue-500 text-blue-500" : "border-transparent text-text-muted hover:text-text-main"}`}
            >
              Pickup Hub
            </button>
            <button
              onClick={() => setActiveRightTab("clustering")}
              className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${activeRightTab === "clustering" ? "border-purple-500 text-purple-500" : "border-transparent text-text-muted hover:text-text-main"}`}
            >
              Kluster
            </button>
            <button
              onClick={() => setActiveRightTab("proactive")}
              className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${activeRightTab === "proactive" ? "border-orange-500 text-orange-500" : "border-transparent text-text-muted hover:text-text-main"}`}
            >
              Reroute{" "}
              <span className="ml-1 bg-surface px-1.5 py-0.5 rounded-md border border-theme">
                {proactiveAlerts.length}
              </span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {/* ── Tab: Laporan Kurir (Incidents) ── */}
            {activeRightTab === "alerts" && (
              <div className="space-y-4 animate-fade-in">
                {incidents.length === 0 ? (
                  <div className="text-center py-20 opacity-40">
                    <ShieldIcon className="w-8 h-8 mx-auto mb-3 text-text-muted" />
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
                      Tidak ada laporan hambatan
                    </p>
                    <p className="text-[10px] mt-1">
                      Wilayah Surabaya terpantau lancar.
                    </p>
                  </div>
                ) : (
                  incidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="bg-main border border-theme rounded-2xl overflow-hidden hover:border-orange-500/40 transition-all animate-slide-up shadow-md"
                    >
                      {/* Card Header (always visible) */}
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
                              {inc.aiDecision?.incidentTypeLabel ||
                                "Hambatan Terdeteksi"}
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
                            "Analisis AI sedang diproses..."}
                          &rdquo;
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              setSelectedIncident(
                                selectedIncident?.id === inc.id ? null : inc,
                              )
                            }
                            className="flex-1 py-2 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider border border-primary/20 hover:bg-primary/20 transition-all"
                          >
                            {selectedIncident?.id === inc.id
                              ? "Tutup Detail"
                              : "Lihat Detail"}
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

                      {/* Expandable Detail Panel */}
                      {selectedIncident?.id === inc.id && (
                        <div className="border-t border-theme bg-surface p-4 animate-fade-in">
                          <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-3">
                            Detail Laporan
                          </p>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-text-muted font-bold">
                                Kurir
                              </span>
                              <span className="text-[10px] font-black text-text-main">
                                {inc.courierId || "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-text-muted font-bold">
                                Rekomendasi AI
                              </span>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-lg uppercase ${
                                  inc.aiDecision?.action === "REROUTE"
                                    ? "bg-orange-500/10 text-orange-500"
                                    : inc.aiDecision?.action ===
                                        "REDIRECT_TO_HUB"
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
                                  Rekomendasi AI
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

            {/* ── Tab: Live Traffic Prediction ── */}
            {activeRightTab === "traffic" && (
              <div className="animate-fade-in h-full min-h-0 flex flex-col w-full">
                {aiLoading.traffic ? (
                  <p className="text-xs text-text-muted text-center py-10 animate-pulse flex items-center justify-center gap-2">
                    <RobotIcon className="w-4 h-4" /> Menganalisis traffic
                    Surabaya...
                  </p>
                ) : (
                  <div className="flex-1 min-h-0 flex flex-col gap-3 w-full">
                    <p className="text-[9px] text-text-muted font-bold mb-4">
                      Dianalisis AI pada:{" "}
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

            {/* ── Tab: Smart Pickup Hubs ── */}
            {activeRightTab === "hubs" && (
              <div className="animate-fade-in">
                <SmartHubAssignment
                  hubs={pickupHubs}
                  isLoading={aiLoading.hubs}
                  onApplyHub={handleApplyHub}
                  loadingHubId={hubLoading}
                  appliedHubIds={appliedHubIds}
                />
              </div>
            )}

            {/* ── Tab: Delivery Clustering ── */}
            {activeRightTab === "clustering" && (
              <div className="animate-fade-in">
                <DeliveryClusteringCard
                  clusters={[
                    {
                      id: "cluster-1",
                      name: "Zona Tunjungan - Pusat Kota",
                      zone: "Tunjungan",
                      totalDistance: "~9.5 km",
                      estimatedTime: "~42 mnt",
                      deliveries: deliveries
                        .filter((d) => d.priority === "high")
                        .slice(0, 4)
                        .map((d) => ({
                          id: d.id,
                          recipient: d.recipient,
                          address: d.address,
                          distance: "1.2 km",
                        })),
                    },
                    {
                      id: "cluster-2",
                      name: "Zona Wonokromo - Selatan",
                      zone: "Wonokromo",
                      totalDistance: "~7.2 km",
                      estimatedTime: "~35 mnt",
                      deliveries: deliveries
                        .filter((d) => d.priority === "medium")
                        .slice(0, 3)
                        .map((d) => ({
                          id: d.id,
                          recipient: d.recipient,
                          address: d.address,
                          distance: "0.8 km",
                        })),
                    },
                    {
                      id: "cluster-3",
                      name: "Zona MERR - Timur",
                      zone: "MERR",
                      totalDistance: "~11 km",
                      estimatedTime: "~48 mnt",
                      deliveries: deliveries
                        .filter((d) => d.priority === "low")
                        .slice(0, 4)
                        .map((d) => ({
                          id: d.id,
                          recipient: d.recipient,
                          address: d.address,
                          distance: "0.9 km",
                        })),
                    },
                  ]}
                  totalDeliveries={deliveries.length}
                />
              </div>
            )}

            {/* ── Tab: Proactive Reroute ── */}
            {activeRightTab === "proactive" && (
              <div className="animate-fade-in">
                {aiLoading.proactive ? (
                  <p className="text-xs text-text-muted text-center py-10 animate-pulse flex items-center justify-center gap-2">
                    <RobotIcon className="w-4 h-4" /> Memeriksa jalur kurir
                    aktif...
                  </p>
                ) : proactiveAlerts.length === 0 ? (
                  <div className="text-center py-20 opacity-40">
                    <HubIcon className="w-8 h-8 mx-auto mb-3 text-text-muted" />
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
                      Semua Rute Aman
                    </p>
                    <p className="text-[10px] mt-1">
                      Tidak ada rute aktif yang melewati zona macet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {proactiveAlerts.map((alert, idx) => (
                      <div
                        key={idx}
                        className="bg-main border border-orange-500/30 rounded-2xl p-4"
                      >
                        <div className="flex items-start gap-3 mb-2">
                          <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                            <AlertIcon className="w-4 h-4 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-[10px] text-orange-500 font-black uppercase tracking-wider mb-0.5">
                              Rute Terdampak
                            </p>
                            <p className="text-xs font-bold text-text-main leading-tight">
                              {alert.recipient}
                            </p>
                            <p className="text-[10px] text-text-muted">
                              Melewati: {alert.affectedZones.join(", ")}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 p-3 bg-orange-500/5 rounded-xl border border-orange-500/20">
                          <p className="text-[9px] text-orange-500 font-black uppercase tracking-widest mb-1">
                            Rekomendasi Reroute
                          </p>
                          <p className="text-[11px] font-medium text-text-main leading-relaxed">
                            {alert.alternativeNote}
                          </p>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleSendProactiveAlert(alert)}
                            disabled={hubLoading === `alert-${alert.id}`}
                            className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-orange-500/20"
                          >
                            {hubLoading === `alert-${alert.id}`
                              ? "Mengirim..."
                              : "Kirim Notif"}
                          </button>
                          <button className="px-3 py-2 bg-surface hover:bg-main border border-theme text-[10px] font-black uppercase tracking-wider text-text-muted rounded-xl transition-all">
                            Abaikan
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Add Delivery Modal */}
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
                className="w-8 h-8 rounded-full bg-main border border-theme flex items-center justify-center text-text-muted hover:text-red-500 transition-colors"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleAddDelivery}
              className="p-5 space-y-4 overflow-y-auto"
            >
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
                        priority: e.target.value,
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
                        packageCount: e.target.value,
                      })
                    }
                    className="w-full bg-surface border border-theme rounded-xl px-4 py-3 text-sm font-medium text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>

              {/* Map Location Picker */}
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
                    <svg
                      className="w-4 h-4 animate-spin text-white"
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
                        d="M4 12a8 8 0 018-8v8a8 8 0 01-8-8z"
                      ></path>
                    </svg>{" "}
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

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-nav-bg border-t border-theme pb-safe pt-2 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="max-w-md mx-auto px-8 flex justify-between items-center h-16">
          <button
            onClick={() => setActiveMobileTab("fleet")}
            className={`mobile-nav-pill ${activeMobileTab === "fleet" ? "active" : ""}`}
          >
            <span className="text-xl">
              <PackageIcon className="w-6 h-6" />
            </span>
            <p className={`text-[10px] font-bold uppercase tracking-[0.15em] ${activeMobileTab === "fleet" ? "text-white" : "text-text-muted"}`}>
              Armada
            </p>
          </button>
          <button
            onClick={() => setActiveMobileTab("map")}
            className={`mobile-nav-pill ${activeMobileTab === "map" ? "active" : ""}`}
          >
            <span className="text-xl">
              <MapPinIcon className="w-6 h-6" />
            </span>
            <p className={`text-[10px] font-bold uppercase tracking-[0.15em] ${activeMobileTab === "map" ? "text-white" : "text-text-muted"}`}>
              Peta
            </p>
          </button>
          <button
            onClick={() => setActiveMobileTab("ai")}
            className={`mobile-nav-pill ${activeMobileTab === "ai" ? "active" : ""}`}
          >
            <span className="text-xl">
              <RobotIcon className="w-6 h-6" />
            </span>
            <p className={`text-[10px] font-bold uppercase tracking-[0.15em] ${activeMobileTab === "ai" ? "text-white" : "text-text-muted"}`}>
              Pusat AI
            </p>
          </button>
        </div>
      </nav>

      {/* Logout Confirmation Modal */}
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

      {/* Global Notification Toast */}
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
