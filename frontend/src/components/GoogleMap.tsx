import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Delivery, IncidentReport } from "../types";
import { AlertTriangleIcon } from "./UiIcons";

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const SURABAYA_CENTER = { lat: -7.2575, lng: 112.7521 };

const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a9bb0" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#263d44" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#354f52" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#cad2c5" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#354f52" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#52796f" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#84a98c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#16213e" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#52796f" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1e2f35" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263d44" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f4550" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#354f52" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#cad2c5" }] },
];

function makeMarkerIcon(type = "courier") {
  if (type === "courier") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="16" fill="#4285F4" fill-opacity="0.15"/>
      <circle cx="18" cy="18" r="10" fill="#4285F4" stroke="white" stroke-width="3"/>
      <circle cx="18" cy="18" r="4" fill="white"/>
    </svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new window.google.maps.Size(36, 36),
      anchor: new window.google.maps.Point(18, 18),
    };
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="#52796f"/>
    <circle cx="16" cy="16" r="8" fill="white"/>
    <circle cx="16" cy="16" r="4" fill="#52796f"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(32, 42),
    anchor: new window.google.maps.Point(16, 42),
  };
}

function makeIncidentMarkerIcon(severity = "high") {
  const color = severity === "critical" ? "#ef4444" : "#f97316";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
    <circle cx="15" cy="15" r="12" fill="${color}" fill-opacity="0.2">
      <animate attributeName="r" from="8" to="14" dur="1.5s" repeatCount="indefinite" />
      <animate attributeName="fill-opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />
    </circle>
    <circle cx="15" cy="15" r="6" fill="${color}" stroke="white" stroke-width="2"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(30, 30),
    anchor: new window.google.maps.Point(15, 15),
  };
}

let loadPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (window.google?.maps?.Map) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = "__nusaroute_maps_cb";
    (window as unknown as Record<string, () => void>)[callbackName] = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      resolve();
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&callback=${callbackName}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps script. Check your API key."));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

function MockMap({ onLocate }: { onLocate?: () => void }) {
  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col items-center justify-center gap-2">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(132,169,140,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(132,169,140,0.4) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 80"
        preserveAspectRatio="none"
      >
        <path
          d="M10 65 Q30 35 50 45 Q70 55 90 20"
          stroke="#84a98c"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="3 2"
          strokeLinecap="round"
          opacity="0.5"
        />
        <circle cx="10" cy="65" r="2.5" fill="#84a98c" />
        <circle cx="90" cy="20" r="2.5" fill="#cad2c5" />
      </svg>
      <div className="w-3 h-3 rounded-full bg-sage-400 animate-pulse relative z-10" />
      <p className="text-white/30 text-xs text-center px-6 relative z-10">
        Atur{" "}
        <code className="text-sage-400 bg-white/5 px-1 rounded">
          VITE_GOOGLE_MAPS_API_KEY
        </code>{" "}
        untuk mengaktifkan peta
      </p>

      <button
        onClick={() => {
          if (onLocate) onLocate();
          else alert("Geolocation memerlukan API Key yang valid.");
        }}
        className="absolute right-4 bottom-64 w-12 h-12 rounded-full bg-sage-500 shadow-sage-glow flex items-center justify-center text-white active:scale-90 transition-all z-20 border border-white/10"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
        </svg>
      </button>
    </div>
  );
}

export interface GoogleMapHandle {
  panToLocation: (lat: number, lng: number) => void;
  toggleTraffic: () => void;
  isTrafficVisible: () => boolean;
}

export interface RouteFetchedData {
  routeIndex: number;
  distance: string;
  duration: string;
  steps: Array<{
    instructions: string;
    distance: string;
    maneuver: string;
  }>;
  allRoutes?: Array<{
    id: string;
    name: string;
    distance: string;
    duration: string;
  }>;
}

interface RoutesApiStep {
  distanceMeters?: number;
  staticDuration?: string;
  navigationInstruction?: {
    maneuver?: string;
    instructions?: string;
  };
}

interface RoutesApiResponse {
  routes?: Array<{
    distanceMeters: number;
    duration: string;
    polyline: { encodedPolyline: string };
    legs?: Array<{
      steps?: RoutesApiStep[];
    }>;
  }>;
}

function decodeGooglePolyline(encoded: string): google.maps.LatLngLiteral[] {
  const points: google.maps.LatLngLiteral[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

function formatDistanceMeters(meters: number): string {
  if (meters >= 1000) {
    return (meters / 1000).toFixed(1) + " km";
  }
  return `${Math.round(meters)} m`;
}

function formatDurationSeconds(secondsStr: string | number): string {
  const totalSec =
    typeof secondsStr === "number"
      ? secondsStr
      : parseInt(String(secondsStr).replace("s", ""), 10) || 0;
  const mins = Math.max(1, Math.round(totalSec / 60));
  return `${mins} min`;
}

async function fetchModernRoutesApi(
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
  apiKey: string
): Promise<RoutesApiResponse | null> {
  if (!apiKey || apiKey === "your_google_maps_api_key_here") return null;

  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: true,
      }),
    });

    if (!res.ok) {
      console.warn(`[Routes API] Server responded with HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as RoutesApiResponse;
    if (data && Array.isArray(data.routes) && data.routes.length > 0) {
      return data;
    }
  } catch (err) {
    console.warn("[Routes API] Network fetch failed:", err);
  }
  return null;
}

export interface CourierPosition {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region?: string;
  activeDelivery?: string;
}

export interface GoogleMapProps {
  courierLat?: number | null;
  courierLng?: number | null;
  destLat?: number | null;
  destLng?: number | null;
  destinationName?: string;
  rerouted?: boolean;
  mode?: "courier" | "dispatcher";
  incidents?: IncidentReport[];
  deliveries?: Delivery[];
  courierPositions?: CourierPosition[];
  isDarkMode?: boolean;
  isNavigating?: boolean;
  followUser?: boolean;
  onUserInteraction?: () => void;
  onToggleFollow?: () => void;
  routePreferenceIndex?: number;
  onRouteFetched?: (data: RouteFetchedData) => void;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
}

const GoogleMap = forwardRef<GoogleMapHandle, GoogleMapProps>(
  (
    {
      courierLat = SURABAYA_CENTER.lat,
      courierLng = SURABAYA_CENTER.lng,
      destLat,
      destLng,
      destinationName = "Tujuan Pengiriman",
      rerouted = false,
      mode = "courier",
      incidents = [],
      deliveries = [],
      courierPositions = [],
      isDarkMode = false,
      isNavigating = false,
      followUser = true,
      onUserInteraction,
      onToggleFollow,
      routePreferenceIndex = 0,
      onRouteFetched,
      onMapClick,
    },
    ref
  ) => {
    const mapRef = useRef<HTMLDivElement | null>(null);
    const mapInstanceRef = useRef<google.maps.Map | null>(null);
    const requestDirectionsRef = useRef<
      ((origin: google.maps.LatLngLiteral, destination: google.maps.LatLngLiteral) => Promise<void>) | null
    >(null);
    const lastOriginRef = useRef<{ lat: number | null; lng: number | null; t: number; destLat?: number | null; destLng?: number | null }>({
      lat: null,
      lng: null,
      t: 0,
    });
    const [status, setStatus] = useState<"loading" | "ready" | "error" | "no-key">("loading");
    const [errorMsg, setErrorMsg] = useState("");

    const hasKey = Boolean(MAPS_API_KEY && MAPS_API_KEY !== "your_google_maps_api_key_here");
    const courierMarkerRef = useRef<google.maps.Marker | null>(null);
    const destMarkerRef = useRef<google.maps.Marker | null>(null);
    const customPolylineRef = useRef<google.maps.Polyline | null>(null);
    const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
    const deliveryMarkersRef = useRef<google.maps.Marker[]>([]);
    const courierMarkersRef = useRef<google.maps.Marker[]>([]);
    const [showTraffic, setShowTraffic] = useState(mode === "dispatcher");
    const userInteractedRef = useRef(false);
    const followRef = useRef(Boolean(followUser));
    const onMapClickRef = useRef(onMapClick);
    const onUserInteractionRef = useRef(onUserInteraction);

    const lastAutoActionRef = useRef(0);
    const now = () => Date.now();

    function safeFitBounds(bounds: google.maps.LatLngBounds, padding = 60, force = false) {
      const map = mapInstanceRef.current;
      if (!map) return;
      if (force || followRef.current) {
        try {
          map.fitBounds(bounds, padding);
          lastAutoActionRef.current = now();
        } catch (e) {
          console.warn("safeFitBounds failed", e);
        }
      }
    }

    function safePanTo(latLng: google.maps.LatLngLiteral, zoom: number | null = null, force = false) {
      const map = mapInstanceRef.current;
      if (!map) return;
      if (force || followRef.current) {
        try {
          if (zoom != null) map.setZoom(zoom);
          map.panTo(latLng);
          lastAutoActionRef.current = now();
        } catch (e) {
          console.warn("safePanTo failed", e);
        }
      }
    }

    useEffect(() => {
      onMapClickRef.current = onMapClick;
    }, [onMapClick]);

    useEffect(() => {
      onUserInteractionRef.current = onUserInteraction;
    }, [onUserInteraction]);

    useEffect(() => {
      followRef.current = Boolean(followUser);
    }, [followUser]);

    const lineColor = useMemo(() => {
      if (rerouted) return "#f97316";
      return "#4285F4";
    }, [rerouted]);

    const lineColorRef = useRef(lineColor);
    useEffect(() => {
      lineColorRef.current = lineColor;
    }, [lineColor]);

    useEffect(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setOptions({
          styles: isDarkMode ? DARK_MAP_STYLE : [],
        });
      }
    }, [isDarkMode]);

    useEffect(() => {
      if (trafficLayerRef.current && mapInstanceRef.current) {
        if (showTraffic) {
          trafficLayerRef.current.setMap(mapInstanceRef.current);
        } else {
          trafficLayerRef.current.setMap(null);
        }
      }
    }, [showTraffic]);

    // Dispatcher Mode: Delivery markers
    useEffect(() => {
      if (status !== "ready" || !mapInstanceRef.current || !window.google?.maps) return;

      const gmaps = window.google.maps;
      const map = mapInstanceRef.current;

      deliveryMarkersRef.current.forEach((m) => m.setMap(null));
      deliveryMarkersRef.current = [];

      if (!deliveries || deliveries.length === 0) return;

      if (mode === "dispatcher") {
        const statusColors: Record<string, string> = {
          delivered: "#22c55e",
          in_transit: "#3b82f6",
          pending: "#f59e0b",
          rerouted: "#f97316",
        };

        deliveries.forEach((d) => {
          if (d.lat == null || d.lng == null) return;

          const color = statusColors[d.status] || statusColors.pending;
          const isDelivered = d.status === "delivered";

          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="${color}" fill-opacity="${isDelivered ? 0.4 : 0.85}" stroke="white" stroke-width="2"/>
            ${d.priority === "high" ? '<circle cx="12" cy="12" r="4" fill="white"/>' : ""}
          </svg>`;

          const marker = new gmaps.Marker({
            position: { lat: d.lat, lng: d.lng },
            map,
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
              scaledSize: new gmaps.Size(24, 24),
              anchor: new gmaps.Point(12, 12),
            },
            title: `${d.recipient} (${d.status})`,
            zIndex: isDelivered ? 1 : 5,
            opacity: isDelivered ? 0.6 : 1,
          });

          const infoContent = `<div style="font-family:system-ui;font-size:12px;color:#1a1a2e;padding:6px;max-width:200px">
            <p style="margin:0 0 4px;font-weight:800;font-size:13px">${d.recipient}</p>
            <p style="margin:0 0 4px;color:#666;font-size:11px">${d.address || ""}</p>
            <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
              <span style="background:${color};color:white;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;text-transform:uppercase">${d.status === "in_transit" ? "Jalan" : d.status === "delivered" ? "Selesai" : d.status === "pending" ? "Antri" : d.status}</span>
              ${d.priority === "high" ? '<span style="color:#ef4444;font-size:10px;font-weight:700">● PRIORITAS</span>' : ""}
            </div>
            ${d.courierId ? `<p style="margin:4px 0 0;font-size:10px;color:#888">Kurir: ${d.courierId}</p>` : ""}
          </div>`;

          const infoWindow = new gmaps.InfoWindow({ content: infoContent });
          marker.addListener("click", () => infoWindow.open(map, marker));

          deliveryMarkersRef.current.push(marker);
        });
      } else {
        deliveries.forEach((d) => {
          if (d.lat == null || d.lng == null) return;
          if (d.status === "delivered") return;
          if (d.lat === destLat && d.lng === destLng) return;

          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6" fill="#94a3b8" fill-opacity="0.7" stroke="white" stroke-width="1.5"/>
          </svg>`;

          const marker = new gmaps.Marker({
            position: { lat: d.lat, lng: d.lng },
            map,
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
              scaledSize: new gmaps.Size(16, 16),
              anchor: new gmaps.Point(8, 8),
            },
            title: d.recipient,
            zIndex: 2,
          });

          const infoWindow = new gmaps.InfoWindow({
            content: `<div style="font-family:system-ui;font-size:12px;color:#1a1a2e;padding:4px">
              <p style="margin:0;font-weight:700">${d.recipient}</p>
              <p style="margin:2px 0 0;color:#666;font-size:10px">${d.address || ""}</p>
            </div>`,
          });
          marker.addListener("click", () => infoWindow.open(map, marker));

          deliveryMarkersRef.current.push(marker);
        });

        const hubsShown = new Set<string>();
        deliveries.forEach((d) => {
          if (!d.pickupHub || !d.lat || !d.lng) return;
          const hubKey = d.pickupHub.label;
          if (hubsShown.has(hubKey)) return;
          hubsShown.add(hubKey);

          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
            <rect x="4" y="4" width="24" height="24" rx="6" fill="#3b82f6" stroke="white" stroke-width="2.5"/>
            <text x="16" y="20" text-anchor="middle" font-size="12" fill="white" font-weight="bold">P</text>
          </svg>`;

          const marker = new gmaps.Marker({
            position: { lat: d.lat, lng: d.lng },
            map,
            icon: {
              url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
              scaledSize: new gmaps.Size(32, 32),
              anchor: new gmaps.Point(16, 16),
            },
            title: `Hub: ${d.pickupHub.label}`,
            zIndex: 20,
          });

          const infoWindow = new gmaps.InfoWindow({
            content: `<div style="font-family:system-ui;font-size:12px;color:#1a1a2e;padding:6px;max-width:200px">
              <p style="margin:0;font-weight:800;color:#3b82f6;font-size:10px;text-transform:uppercase">Titik Hub Konsolidasi</p>
              <p style="margin:4px 0 2px;font-weight:800;font-size:13px">${d.pickupHub.label}</p>
              <p style="margin:0;color:#666;font-size:11px;font-style:italic">${d.pickupHub.reason || ""}</p>
              <p style="margin:6px 0 0;font-size:10px;color:#3b82f6;font-weight:600">Parkir di sini, distribusikan paket</p>
            </div>`,
          });
          marker.addListener("click", () => infoWindow.open(map, marker));

          deliveryMarkersRef.current.push(marker);
        });
      }
    }, [mode, status, deliveries, destLat, destLng]);

    // Dispatcher Mode: Courier position markers
    useEffect(() => {
      if (mode !== "dispatcher" || status !== "ready" || !mapInstanceRef.current || !window.google?.maps) return;

      const gmaps = window.google.maps;
      const map = mapInstanceRef.current;

      courierMarkersRef.current.forEach((m) => m.setMap(null));
      courierMarkersRef.current = [];

      if (!courierPositions || courierPositions.length === 0) return;

      courierPositions.forEach((courier) => {
        if (courier.lat == null || courier.lng == null) return;

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="18" fill="#4285F4" fill-opacity="0.15">
            <animate attributeName="r" from="14" to="18" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="fill-opacity" from="0.3" to="0" dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="20" cy="20" r="10" fill="#4285F4" stroke="white" stroke-width="3"/>
          <path d="M16 17 L24 17 L22 23 L18 23 Z" fill="white" />
        </svg>`;

        const marker = new gmaps.Marker({
          position: { lat: courier.lat, lng: courier.lng },
          map,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
            scaledSize: new gmaps.Size(40, 40),
            anchor: new gmaps.Point(20, 20),
          },
          title: courier.name || courier.id,
          zIndex: 50,
        });

        const infoContent = `<div style="font-family:system-ui;font-size:12px;color:#1a1a2e;padding:6px">
          <p style="margin:0;font-weight:800;font-size:13px">${courier.name || courier.id}</p>
          <p style="margin:4px 0 0;color:#666;font-size:10px">${courier.region || "Surabaya"}</p>
          ${courier.activeDelivery ? `<p style="margin:4px 0 0;font-size:11px">Menuju: <b>${courier.activeDelivery}</b></p>` : ""}
        </div>`;

        const infoWindow = new gmaps.InfoWindow({ content: infoContent });
        marker.addListener("click", () => infoWindow.open(map, marker));

        courierMarkersRef.current.push(marker);
      });
    }, [mode, status, courierPositions]);

    useEffect(() => {
      lineColorRef.current = lineColor;
      if (customPolylineRef.current) {
        customPolylineRef.current.setOptions({ strokeColor: lineColor });
      }
    }, [lineColor]);

    useImperativeHandle(ref, () => ({
      panToLocation: (lat: number, lng: number) => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo({ lat, lng });
          mapInstanceRef.current.setZoom(16);
        }
      },
      toggleTraffic: () => {
        setShowTraffic((v) => !v);
      },
      isTrafficVisible: () => showTraffic,
    }));

    useEffect(() => {
      if (!hasKey) {
        setStatus("no-key");
        return;
      }
      if (!mapRef.current) return;

      let isMounted = true;

      async function initMap() {
        try {
          await loadGoogleMapsScript(MAPS_API_KEY);
          if (!isMounted || !mapRef.current) return;

          const gmaps = window.google.maps;
          const courierPos =
            courierLat != null && courierLng != null ? { lat: courierLat, lng: courierLng } : null;
          const destPos = destLat != null && destLng != null ? { lat: destLat, lng: destLng } : null;

          const map = new gmaps.Map(mapRef.current, {
            center: destPos ?? courierPos ?? SURABAYA_CENTER,
            zoom: destPos ? 14 : 13,
            styles: isDarkMode ? DARK_MAP_STYLE : [],
            disableDefaultUI: true,
            zoomControl: mode !== "courier",
            zoomControlOptions: {
              position: gmaps.ControlPosition.RIGHT_CENTER,
            },
            gestureHandling: "greedy",
          });
          mapInstanceRef.current = map;

          const trafficLayer = new gmaps.TrafficLayer();
          trafficLayerRef.current = trafficLayer;
          if (showTraffic) {
            trafficLayer.setMap(map);
          }

          map.addListener("dragstart", () => {
            userInteractedRef.current = true;
            followRef.current = false;
            try {
              onUserInteractionRef.current?.();
            } catch (e) {}
          });
          map.addListener("zoom_changed", () => {
            userInteractedRef.current = true;
            followRef.current = false;
            try {
              onUserInteractionRef.current?.();
            } catch (e) {}
          });

          if (mapRef.current) {
            mapRef.current.addEventListener("mousedown", () => {
              userInteractedRef.current = true;
              followRef.current = false;
              try {
                onUserInteractionRef.current?.();
              } catch (e) {}
            });
            mapRef.current.addEventListener("touchstart", () => {
              userInteractedRef.current = true;
              followRef.current = false;
              try {
                onUserInteractionRef.current?.();
              } catch (e) {}
            });
          }

          map.addListener("click", (e: google.maps.MapMouseEvent) => {
            if (e.latLng && onMapClickRef.current) {
              onMapClickRef.current({
                lat: e.latLng.lat(),
                lng: e.latLng.lng(),
              });
            }
          });

          if (courierPos) {
            const courierMarker = new gmaps.Marker({
              position: courierPos,
              map,
              title: "Posisi Kurir",
              icon: makeMarkerIcon("courier"),
              zIndex: 10,
            });
            courierMarkerRef.current = courierMarker;
          }

          if (destPos) {
            const destMarker = new gmaps.Marker({
              position: destPos,
              map,
              title: destinationName,
              icon: makeMarkerIcon("destination"),
              zIndex: 9,
            });
            const infoWindow = new gmaps.InfoWindow({
              content: `<div style="font-family:Inter,sans-serif;font-size:13px;color:#1a1a2e;padding:4px 2px">
                <strong>${destinationName}</strong>
              </div>`,
            });
            destMarker.addListener("click", () => infoWindow.open(map, destMarker));
            destMarkerRef.current = destMarker;

            const requestDirections = async (
              origin: google.maps.LatLngLiteral,
              destination: google.maps.LatLngLiteral
            ) => {
              const preferredIndex =
                Number.isInteger(routePreferenceIndex) && routePreferenceIndex >= 0
                  ? routePreferenceIndex
                  : 0;

              // 1. Google Routes API v2 (https://routes.googleapis.com/directions/v2:computeRoutes)
              const routesData = await fetchModernRoutesApi(origin, destination, MAPS_API_KEY);
              if (routesData?.routes && routesData.routes.length > 0) {
                const maxIndex = routesData.routes.length - 1;
                const routeIndex = Math.min(preferredIndex, maxIndex);
                const selectedRoute = routesData.routes[routeIndex] || routesData.routes[0];

                const pts = decodeGooglePolyline(selectedRoute.polyline?.encodedPolyline || "");
                if (pts.length > 0) {
                  if (customPolylineRef.current) {
                    customPolylineRef.current.setMap(null);
                    customPolylineRef.current = null;
                  }

                  customPolylineRef.current = new window.google.maps.Polyline({
                    path: pts,
                    strokeColor: lineColorRef.current,
                    strokeWeight: 6,
                    strokeOpacity: 0.95,
                    map,
                    zIndex: 50,
                  });

                  const bounds = new window.google.maps.LatLngBounds();
                  pts.forEach((p) => bounds.extend(p));
                  safeFitBounds(bounds, 60);

                  if (onRouteFetched) {
                    const rawSteps = selectedRoute.legs?.[0]?.steps || [];
                    const steps = rawSteps.map((s) => ({
                      instructions: s.navigationInstruction?.instructions || "Lanjutkan perjalanan",
                      distance: formatDistanceMeters(s.distanceMeters || 0),
                      maneuver: (s.navigationInstruction?.maneuver || "straight").toLowerCase(),
                    }));

                    onRouteFetched({
                      routeIndex,
                      distance: formatDistanceMeters(selectedRoute.distanceMeters || 0),
                      duration: formatDurationSeconds(selectedRoute.duration || "0s"),
                      steps,
                      allRoutes: routesData.routes.map((r, i) => ({
                        id: String(i),
                        name: i === 0 ? "Rute Utama" : `Rute Alternatif ${i}`,
                        distance: formatDistanceMeters(r.distanceMeters || 0),
                        duration: formatDurationSeconds(r.duration || "0s"),
                      })),
                    });
                  }
                  return;
                }
              }

              // 2. Fallback visualisasi garis langsung jika panggilan Routes API terputus
              if (customPolylineRef.current) {
                customPolylineRef.current.setMap(null);
                customPolylineRef.current = null;
              }
              customPolylineRef.current = new window.google.maps.Polyline({
                path: [origin, destination],
                strokeColor: lineColorRef.current,
                strokeWeight: 4,
                strokeOpacity: 0.7,
                map,
                zIndex: 50,
              });

              const bounds = new window.google.maps.LatLngBounds();
              bounds.extend(origin);
              bounds.extend(destination);
              safeFitBounds(bounds, 60);
            };

            requestDirectionsRef.current = requestDirections;

            if (courierPos && destPos) requestDirections(courierPos, destPos);
          }

          if (mode === "dispatcher" && incidents.length > 0) {
            incidents.forEach((inc) => {
              let pos = inc.lat && inc.lng ? { lat: inc.lat, lng: inc.lng } : null;

              if (!pos) {
                const hash = (inc.id || "0")
                  .split("")
                  .reduce((a, b) => a + b.charCodeAt(0), 0);
                pos = {
                  lat: SURABAYA_CENTER.lat + ((hash % 10) - 5) * 0.005,
                  lng: SURABAYA_CENTER.lng + ((hash % 8) - 4) * 0.005,
                };
              }

              const marker = new gmaps.Marker({
                position: pos,
                map,
                icon: makeIncidentMarkerIcon(inc.aiDecision?.severity),
                title: inc.aiDecision?.incidentTypeLabel,
                zIndex: 100,
              });

              const info = new gmaps.InfoWindow({
                content: `<div style="color:#1a1a2e;font-family:sans-serif;padding:5px">
                <p style="margin:0;font-size:10px;font-weight:bold;color:#f97316;text-transform:uppercase">${inc.aiDecision?.incidentTypeLabel || "Insiden"}</p>
                <p style="margin:2px 0;font-size:12px"><b>Lokasi:</b> ${inc.location || ""}</p>
                <p style="margin:0;font-size:11px;color:#666">${(inc.aiDecision?.analysisId || "").substring(0, 60)}...</p>
              </div>`,
              });
              marker.addListener("click", () => info.open(map, marker));
            });
          }

          if (isMounted) setStatus("ready");
        } catch (err: unknown) {
          console.error("Google Maps error:", err);
          if (isMounted) {
            setErrorMsg(err instanceof Error ? err.message : "Error loading map");
            setStatus("error");
          }
        }
      }

      initMap();
      return () => {
        isMounted = false;
      };
    }, [hasKey, destLat, destLng]);

    useEffect(() => {
      userInteractedRef.current = false;
      followRef.current = true;
    }, [destLat, destLng]);

    const prevNavigatingRef = useRef(false);
    useEffect(() => {
      if (isNavigating && !prevNavigatingRef.current && mapInstanceRef.current) {
        const courierPos =
          courierLat != null && courierLng != null ? { lat: courierLat, lng: courierLng } : null;
        if (courierPos) {
          mapInstanceRef.current.setZoom(17);
          mapInstanceRef.current.panTo(courierPos);
          mapInstanceRef.current.setTilt(45);
          followRef.current = true;
        }
      }
      if (!isNavigating && prevNavigatingRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.setTilt(0);
      }
      prevNavigatingRef.current = isNavigating;
    }, [isNavigating]);

    useEffect(() => {
      if (status === "ready" && mapInstanceRef.current) {
        const gmaps = window.google.maps;
        const courierPos =
          courierLat != null && courierLng != null ? { lat: courierLat, lng: courierLng } : null;
        const destPos = destLat != null && destLng != null ? { lat: destLat, lng: destLng } : null;

        if (courierMarkerRef.current && courierPos) {
          const currentPos = courierMarkerRef.current.getPosition();
          if (currentPos) {
            const startLat = currentPos.lat();
            const startLng = currentPos.lng();
            const endLat = courierPos.lat;
            const endLng = courierPos.lng;

            const moved = Math.abs(startLat - endLat) + Math.abs(startLng - endLng);
            if (moved > 0.00005) {
              const steps = 15;
              let step = 0;
              const animate = () => {
                step++;
                const t = step / steps;
                const ease = 1 - Math.pow(1 - t, 3);
                const lat = startLat + (endLat - startLat) * ease;
                const lng = startLng + (endLng - startLng) * ease;
                courierMarkerRef.current?.setPosition({ lat, lng });
                if (step < steps) {
                  requestAnimationFrame(animate);
                }
              };
              requestAnimationFrame(animate);
            }
          } else {
            courierMarkerRef.current.setPosition(courierPos);
          }
        } else if (courierPos) {
          const m = new gmaps.Marker({
            position: courierPos,
            map: mapInstanceRef.current,
            title: "Posisi Kurir",
            icon: makeMarkerIcon("courier"),
            zIndex: 10,
          });
          courierMarkerRef.current = m;
        }

        if (destPos) {
          if (destMarkerRef.current) {
            destMarkerRef.current.setPosition(destPos);
            if (
              destMarkerRef.current.getTitle &&
              destMarkerRef.current.getTitle() !== destinationName
            ) {
              destMarkerRef.current.setTitle(destinationName);
            }
          } else {
            const dm = new gmaps.Marker({
              position: destPos,
              map: mapInstanceRef.current,
              title: destinationName,
              icon: makeMarkerIcon("destination"),
              zIndex: 9,
            });
            const iw = new gmaps.InfoWindow({
              content: `<div style="font-family:Inter,sans-serif;font-size:13px;color:#1a1a2e;padding:4px 2px"><strong>${destinationName}</strong></div>`,
            });
            dm.addListener("click", () => iw.open(mapInstanceRef.current, dm));
            destMarkerRef.current = dm;
          }
        } else if (destMarkerRef.current) {
          destMarkerRef.current.setMap(null);
          destMarkerRef.current = null;
        }

        if (followRef.current && courierPos) {
          if (isNavigating) {
            mapInstanceRef.current.panTo(courierPos);
          } else if (destPos) {
            const bounds = new gmaps.LatLngBounds();
            bounds.extend(courierPos);
            bounds.extend(destPos);
            safeFitBounds(bounds, 80);
          } else {
            safePanTo(courierPos, 13);
          }
        }
      }
    }, [status, courierLat, courierLng, destLat, destLng]);

    useEffect(() => {
      if (
        status !== "ready" ||
        !mapInstanceRef.current ||
        destLat == null ||
        destLng == null ||
        courierLat == null ||
        courierLng == null
      )
        return;

      const origin = { lat: courierLat, lng: courierLng };
      const destination = { lat: destLat, lng: destLng };

      const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const toRad = (v: number) => (v * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lng2 - lng1);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      const last = lastOriginRef.current;
      const movedKm =
        last.lat == null ? Infinity : haversineKm(last.lat, last.lng || 0, origin.lat, origin.lng);
      const nowTime = Date.now();
      const destChanged = last.destLat !== destination.lat || last.destLng !== destination.lng;

      if (movedKm > 0.05 || destChanged || nowTime - last.t > 15000) {
        lastOriginRef.current = {
          lat: origin.lat,
          lng: origin.lng,
          t: nowTime,
          destLat: destination.lat,
          destLng: destination.lng,
        };

        if (requestDirectionsRef.current) {
          requestDirectionsRef.current(origin, destination);
        }
      }
    }, [status, courierLat, courierLng, destLat, destLng, routePreferenceIndex, lineColor]);

    if (!hasKey) {
      return <MockMap onLocate={onToggleFollow} />;
    }

    if (status === "error") {
      return (
        <div className="w-full h-40 rounded-xl bg-red-900/20 border border-red-400/20 flex flex-col items-center justify-center gap-2 p-4">
          <AlertTriangleIcon className="w-6 h-6 text-red-400" />
          <p className="text-red-400 text-xs text-center">{errorMsg}</p>
          <p className="text-white/30 text-xs text-center">
            Periksa apakah Maps JavaScript API & Routes API aktif
          </p>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full overflow-hidden">
        {status === "loading" && (
          <div className="absolute inset-0 z-10 bg-sage-900/70 flex flex-col items-center justify-center gap-2">
            <svg className="w-6 h-6 animate-spin text-sage-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sage-300 text-xs">Memuat peta...</p>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" />
      </div>
    );
  }
);

GoogleMap.displayName = "GoogleMap";

export default GoogleMap;
