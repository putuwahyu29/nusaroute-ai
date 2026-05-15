import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from "react";

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const SURABAYA_CENTER = { lat: -7.2575, lng: 112.7521 };

// ── Dark map style matching the Sage Green theme ──────────────────────────────
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a9bb0" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#263d44" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#354f52" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cad2c5" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#354f52" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#52796f" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#84a98c" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#16213e" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#52796f" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#1e2f35" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263d44" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f4550" }],
  },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#354f52" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cad2c5" }],
  },
];

// ── Custom SVG marker icon ────────────────────────────────────────────────────
function makeMarkerIcon(type = "courier") {
  if (type === "courier") {
    // Google Maps-style navigation dot: blue circle with white border and direction arrow
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

  // Destination marker
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

// ── Load Google Maps script tag (once, idempotent) ────────────────────────────
let loadPromise = null;

function loadGoogleMapsScript(apiKey) {
  // Already loaded
  if (window.google?.maps?.Map) return Promise.resolve();

  // Already loading — return same promise
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = "__nusaroute_maps_cb";
    window[callbackName] = () => {
      delete window[callbackName];
      resolve();
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=routes&callback=${callbackName}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loadPromise = null;
      reject(
        new Error("Failed to load Google Maps script. Check your API key."),
      );
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

// ── Mock grid fallback (no API key) ──────────────────────────────────────────
function MockMap({ followUser, onToggleFollow }) {
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

      {/* Locate Me (Mock) */}
      <button
        onClick={() =>
          alert(
            "Geolocation requires a valid Google Maps API Key for full functionality / Geolocation memerlukan API Key yang valid",
          )
        }
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

      {/* follow button removed per UX request */}
    </div>
  );
}

// ── Main GoogleMap component ──────────────────────────────────────────────────
const GoogleMap = forwardRef(
  (
    {
      courierLat = SURABAYA_CENTER.lat,
      courierLng = SURABAYA_CENTER.lng,
      destLat,
      destLng,
      destinationName = "Tujuan Pengiriman",
      rerouted = false,
      mode = "courier", // 'courier' | 'dispatcher'
      incidents = [],
      deliveries = [],       // Dispatcher: all delivery points
      courierPositions = [], // Dispatcher: real-time courier positions [{id, name, lat, lng}]
      isDarkMode = false,
      isNavigating = false,
      followUser = true,
      onUserInteraction,
      onToggleFollow,
      routePreferenceIndex = 0,
      onRouteFetched,
      onMapClick,
    },
    ref,
  ) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const directionsServiceRef = useRef(null);
    const directionsRendererRef = useRef(null);
    const lastOriginRef = useRef({ lat: null, lng: null, t: 0 });
    const [status, setStatus] = useState("loading");
    const [errorMsg, setErrorMsg] = useState("");

    const hasKey = Boolean(
      MAPS_API_KEY && MAPS_API_KEY !== "your_google_maps_api_key_here",
    );
    const courierMarkerRef = useRef(null);
    const destMarkerRef = useRef(null);
    const customPolylineRef = useRef(null);
    const trafficLayerRef = useRef(null);
    const deliveryMarkersRef = useRef([]);   // Dispatcher: delivery point markers
    const courierMarkersRef = useRef([]);    // Dispatcher: courier position markers
    const [showTraffic, setShowTraffic] = useState(mode === "dispatcher"); // On by default for dispatcher only
    const userInteractedRef = useRef(false);
    const followRef = useRef(Boolean(followUser));
    const onMapClickRef = useRef(onMapClick);
    const onUserInteractionRef = useRef(onUserInteraction);
    const onToggleFollowRef = useRef(onToggleFollow);

    const lastAutoActionRef = useRef(0);
    const now = () => Date.now();

    function safeFitBounds(bounds, padding = 60, force = false) {
      const map = mapInstanceRef.current;
      if (!map) return;
      const last = lastAutoActionRef.current || 0;
      // Only auto-fit when forced or when following is enabled.
      if (force || followRef.current) {
        try {
          map.fitBounds(bounds, padding);
          lastAutoActionRef.current = now();
        } catch (e) {
          console.warn("safeFitBounds failed", e);
        }
      }
    }

    function safePanTo(latLng, zoom = null, force = false) {
      const map = mapInstanceRef.current;
      if (!map) return;
      const last = lastAutoActionRef.current || 0;
      // Only auto-pan when forced or when following is enabled.
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
    // Keep the ref up to date with the latest prop
    useEffect(() => {
      onMapClickRef.current = onMapClick;
    }, [onMapClick]);

    useEffect(() => {
      onUserInteractionRef.current = onUserInteraction;
    }, [onUserInteraction]);

    useEffect(() => {
      onToggleFollowRef.current = onToggleFollow;
    }, [onToggleFollow]);

    // keep followRef in sync with external prop ONLY — not isNavigating
    // This way, user can freely explore the map during navigation
    useEffect(() => {
      followRef.current = Boolean(followUser);
    }, [followUser]);

    // Compute line color based on theme and reroute status
    const lineColor = useMemo(() => {
      if (rerouted) return "#f97316"; // Orange for reroute
      return "#4285F4"; // Google Maps blue — high contrast on both dark and light maps
    }, [rerouted]);

    const lineColorRef = useRef(lineColor);
    useEffect(() => {
      lineColorRef.current = lineColor;
    }, [lineColor]);

    // Sync map style when theme changes
    useEffect(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setOptions({
          styles: isDarkMode ? DARK_MAP_STYLE : [],
        });
      }
    }, [isDarkMode]);

    // Toggle traffic layer visibility
    useEffect(() => {
      if (trafficLayerRef.current && mapInstanceRef.current) {
        if (showTraffic) {
          trafficLayerRef.current.setMap(mapInstanceRef.current);
        } else {
          trafficLayerRef.current.setMap(null);
        }
      }
    }, [showTraffic]);

    // ── Dispatcher Mode: Delivery markers ──────────────────────────────────────
    useEffect(() => {
      if (status !== "ready" || !mapInstanceRef.current) return;
      if (!window.google?.maps) return;

      const gmaps = window.google.maps;
      const map = mapInstanceRef.current;

      // Clear old delivery markers
      deliveryMarkersRef.current.forEach((m) => m.setMap(null));
      deliveryMarkersRef.current = [];

      if (!deliveries || deliveries.length === 0) return;

      if (mode === "dispatcher") {
        // Dispatcher: show ALL deliveries with status colors
        const statusColors = {
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
        // Courier mode: show remaining stops as small dots + hub markers
        deliveries.forEach((d) => {
          if (d.lat == null || d.lng == null) return;
          if (d.status === "delivered") return; // Don't show completed
          // Skip the active delivery (already shown as destination marker)
          if (d.lat === destLat && d.lng === destLng) return;

          // Small gray dot for pending stops
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

        // Hub markers: show pickup hubs assigned to this courier's deliveries
        const hubsShown = new Set();
        deliveries.forEach((d) => {
          if (!d.pickupHub || !d.lat || !d.lng) return;
          const hubKey = d.pickupHub.label;
          if (hubsShown.has(hubKey)) return;
          hubsShown.add(hubKey);

          // Hub marker: blue square-ish marker
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
              <p style="margin:0;font-weight:800;color:#3b82f6;font-size:10px;text-transform:uppercase">📦 Titik Hub Konsolidasi</p>
              <p style="margin:4px 0 2px;font-weight:800;font-size:13px">${d.pickupHub.label}</p>
              <p style="margin:0;color:#666;font-size:11px;font-style:italic">${d.pickupHub.reason || ""}</p>
              <p style="margin:6px 0 0;font-size:10px;color:#3b82f6;font-weight:600">Parkir di sini, distribusikan paket jalan kaki</p>
            </div>`,
          });
          marker.addListener("click", () => infoWindow.open(map, marker));

          deliveryMarkersRef.current.push(marker);
        });
      }
    }, [mode, status, deliveries, destLat, destLng]);

    // ── Dispatcher Mode: Courier position markers ──────────────────────────────
    useEffect(() => {
      if (mode !== "dispatcher" || status !== "ready" || !mapInstanceRef.current) return;
      if (!window.google?.maps) return;

      const gmaps = window.google.maps;
      const map = mapInstanceRef.current;

      // Clear old courier markers
      courierMarkersRef.current.forEach((m) => m.setMap(null));
      courierMarkersRef.current = [];

      if (!courierPositions || courierPositions.length === 0) return;

      courierPositions.forEach((courier) => {
        if (courier.lat == null || courier.lng == null) return;

        // Courier marker: blue pulsing dot with label
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="18" fill="#4285F4" fill-opacity="0.15">
            <animate attributeName="r" from="14" to="18" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="fill-opacity" from="0.3" to="0" dur="2s" repeatCount="indefinite"/>
          </circle>
          <circle cx="20" cy="20" r="10" fill="#4285F4" stroke="white" stroke-width="3"/>
          <text x="20" y="24" text-anchor="middle" font-size="8" fill="white" font-weight="bold">🚚</text>
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
          <p style="margin:0;font-weight:800;font-size:13px">🚚 ${courier.name || courier.id}</p>
          <p style="margin:4px 0 0;color:#666;font-size:10px">${courier.region || "Surabaya"}</p>
          ${courier.activeDelivery ? `<p style="margin:4px 0 0;font-size:11px">Menuju: <b>${courier.activeDelivery}</b></p>` : ""}
        </div>`;

        const infoWindow = new gmaps.InfoWindow({ content: infoContent });
        marker.addListener("click", () => infoWindow.open(map, marker));

        courierMarkersRef.current.push(marker);
      });
    }, [mode, status, courierPositions]);

    // Sync polyline color when rerouted or theme changes
    useEffect(() => {
      if (directionsRendererRef.current) {
        const renderer = directionsRendererRef.current;
        const opts = {
          polylineOptions: {
            strokeColor: lineColor,
            strokeWeight: 6,
            strokeOpacity: 0.95,
          },
        };
        renderer.setOptions(opts);

        // Force refresh existing directions if any
        const currentDirections = renderer.getDirections();
        if (currentDirections) {
          renderer.setDirections(currentDirections);
        }

        // If we have a custom polyline (fallback), update it too
        if (customPolylineRef.current) {
          customPolylineRef.current.setOptions({ strokeColor: lineColor });
        }
      }
    }, [lineColor]);

    // Expose panTo and traffic toggle to parent
    useImperativeHandle(ref, () => ({
      panToLocation: (lat, lng) => {
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
          // Load the Maps JS SDK via script tag (idempotent — safe to call multiple times)
          await loadGoogleMapsScript(MAPS_API_KEY);
          if (!isMounted || !mapRef.current) return;

          const gmaps = window.google.maps;

          const courierPos =
            courierLat != null && courierLng != null
              ? { lat: courierLat, lng: courierLng }
              : null;
          const destPos =
            destLat != null ? { lat: destLat, lng: destLng } : null;

          // ── Create map ─────────────────────────────────────────────────────
          const map = new gmaps.Map(mapRef.current, {
            center: destPos ?? courierPos ?? SURABAYA_CENTER,
            zoom: destPos ? 14 : 13,
            styles: isDarkMode ? DARK_MAP_STYLE : [],
            disableDefaultUI: true,
            zoomControl: true,
            zoomControlOptions: {
              position: gmaps.ControlPosition.RIGHT_CENTER,
            },
            gestureHandling: "greedy",
          });
          mapInstanceRef.current = map;

          // ── Google Maps Traffic Layer (controlled by toggle) ────
          const trafficLayer = new gmaps.TrafficLayer();
          trafficLayerRef.current = trafficLayer;
          if (showTraffic) {
            trafficLayer.setMap(map);
          }

          // Track user interactions so we don't force-center while user is exploring the map
          map.addListener("dragstart", () => {
            userInteractedRef.current = true;
            // Stop following when user interacts
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
          // Also capture pointer interactions on the map DOM node (touch/mouse)
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

          // Add click listener
          map.addListener("click", (e) => {
            if (onMapClickRef.current) {
              onMapClickRef.current({
                lat: e.latLng.lat(),
                lng: e.latLng.lng(),
              });
            }
          });

          // ── Courier marker ─────────────────────────────────────────────────
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

          // ── Destination marker + route ─────────────────────────────────────
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
            destMarker.addListener("click", () =>
              infoWindow.open(map, destMarker),
            );
            destMarkerRef.current = destMarker;

            // ── Directions route ───────────────────────────────────────────
            // Create reusable DirectionsService/Renderer
            directionsServiceRef.current = new gmaps.DirectionsService();
            directionsRendererRef.current = new gmaps.DirectionsRenderer({
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: lineColorRef.current,
                strokeWeight: 5,
                strokeOpacity: 0.95,
              },
              preserveViewport: true,
            });
            directionsRendererRef.current.setMap(map);

            const requestDirections = (origin, destination) => {
              if (
                !directionsServiceRef.current ||
                !directionsRendererRef.current
              )
                return;
              console.debug("[GoogleMap] requesting directions", {
                origin,
                destination,
                routePreferenceIndex,
              });
              directionsServiceRef.current.route(
                {
                  origin,
                  destination,
                  travelMode: "DRIVING",
                  provideRouteAlternatives: true,
                },
                (result, routeStatus) => {
                  console.debug("[GoogleMap] directions callback", {
                    routeStatus,
                    routes:
                      (result && result.routes && result.routes.length) || 0,
                  });
                  if (routeStatus === "OK") {
                    const maxIndex = Math.max(
                      0,
                      (result.routes?.length || 1) - 1,
                    );
                    const preferredIndex =
                      Number.isInteger(routePreferenceIndex) &&
                      routePreferenceIndex >= 0
                        ? routePreferenceIndex
                        : 0;
                    const routeIndex = Math.min(preferredIndex, maxIndex);
                    console.debug("[GoogleMap] selected routeIndex", {
                      preferredIndex,
                      maxIndex,
                      routeIndex,
                    });

                    directionsRendererRef.current.setDirections(result);
                    let routeIndexApplied = false;
                    try {
                      directionsRendererRef.current.setRouteIndex(routeIndex);
                      routeIndexApplied = true;
                    } catch (e) {
                      routeIndexApplied = false;
                    }

                    // Fallback: draw custom polyline for selected route if setRouteIndex unavailable
                    try {
                      if (!routeIndexApplied) {
                        directionsRendererRef.current.setOptions({
                          polylineOptions: {
                            strokeColor: lineColorRef.current,
                            strokeOpacity: 0,
                          },
                        });
                        if (customPolylineRef.current) {
                          customPolylineRef.current.setMap(null);
                          customPolylineRef.current = null;
                        }
                        const selectedRoute =
                          result.routes[routeIndex] || result.routes[0];
                        const pts = (selectedRoute.overview_path || []).map(
                          (p) => ({ lat: p.lat(), lng: p.lng() }),
                        );
                        customPolylineRef.current = new gmaps.Polyline({
                          path: pts,
                          strokeColor: lineColorRef.current,
                          strokeWeight: 6,
                          strokeOpacity: 0.95,
                          map,
                          zIndex: 50,
                        });
                      } else {
                        if (customPolylineRef.current) {
                          customPolylineRef.current.setMap(null);
                          customPolylineRef.current = null;
                        }
                        directionsRendererRef.current.setOptions({
                          polylineOptions: {
                            strokeColor: lineColorRef.current,
                            strokeWeight: 6,
                            strokeOpacity: 0.95,
                          },
                        });
                      }
                    } catch (err) {
                      console.warn("[GoogleMap] polyline fallback error", err);
                    }

                    // Extract Turn-by-Turn Navigation steps
                    if (onRouteFetched) {
                      const selectedRoute =
                        result.routes[routeIndex] || result.routes[0];
                      const leg = selectedRoute.legs[0];
                      const steps = leg.steps.map((s) => ({
                        instructions: s.instructions,
                        distance: s.distance.text,
                        maneuver: s.maneuver || "straight",
                      }));
                      onRouteFetched({
                        routeIndex,
                        distance: leg.distance.text,
                        duration: leg.duration.text,
                        steps,
                      });
                    }

                  } else {
                    console.warn("Directions API:", routeStatus);
                    const bounds = new gmaps.LatLngBounds();
                    bounds.extend(origin);
                    bounds.extend(destination);
                    safeFitBounds(bounds, 60);
                  }
                },
              );
            };

            // Initial directions request (only if we have an origin)
            if (courierPos && destPos) requestDirections(courierPos, destPos);
          }

          // ── Dispatcher Mode: Incident Markers ──────────────────────────────
          if (mode === "dispatcher" && incidents.length > 0) {
            incidents.forEach((inc) => {
              let pos = inc.lat ? { lat: inc.lat, lng: inc.lng } : null;

              // Fallback for demo: if no lat/lng, offset slightly from Surabaya center
              if (!pos) {
                const hash = inc.id
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
                <p style="margin:0;font-size:10px;font-weight:bold;color:#f97316;text-transform:uppercase">${inc.aiDecision?.incidentTypeLabel}</p>
                <p style="margin:2px 0;font-size:12px"><b>Loc:</b> ${inc.location}</p>
                <p style="margin:0;font-size:11px;color:#666">${inc.aiDecision?.analysisId?.substring(0, 60)}...</p>
              </div>`,
              });
              marker.addListener("click", () => info.open(map, marker));
            });
          }

          if (isMounted) setStatus("ready");
        } catch (err) {
          console.error("Google Maps error:", err);
          if (isMounted) {
            setErrorMsg(err.message);
            setStatus("error");
          }
        }
      }

      initMap();
      return () => {
        isMounted = false;
      };
    }, [hasKey, destLat, destLng]); // Map only re-initializes when destination changes

    // When destination prop changes programmatically, allow auto-centering again
    useEffect(() => {
      userInteractedRef.current = false;
      followRef.current = true;
    }, [destLat, destLng]);

    // ── One-time zoom-in when navigation starts ──
    const prevNavigatingRef = useRef(false);
    useEffect(() => {
      if (isNavigating && !prevNavigatingRef.current && mapInstanceRef.current) {
        // Navigation just started — zoom in once
        const courierPos =
          courierLat != null && courierLng != null
            ? { lat: courierLat, lng: courierLng }
            : null;
        if (courierPos) {
          mapInstanceRef.current.setZoom(17);
          mapInstanceRef.current.panTo(courierPos);
          mapInstanceRef.current.setTilt(45);
          followRef.current = true;
        }
      }
      if (!isNavigating && prevNavigatingRef.current && mapInstanceRef.current) {
        // Navigation just stopped — reset tilt
        mapInstanceRef.current.setTilt(0);
      }
      prevNavigatingRef.current = isNavigating;
    }, [isNavigating]);

    // ── Follow Courier Logic (Real-time Navigation) ──
    useEffect(() => {
      if (status === "ready" && mapInstanceRef.current) {
        const gmaps = window.google.maps;
        const courierPos =
          courierLat != null && courierLng != null
            ? { lat: courierLat, lng: courierLng }
            : null;
        const destPos = destLat != null ? { lat: destLat, lng: destLng } : null;

        // ── Smooth marker animation (like Google Maps blue dot) ──
        if (courierMarkerRef.current && courierPos) {
          // Animate marker position smoothly
          const currentPos = courierMarkerRef.current.getPosition();
          if (currentPos) {
            const startLat = currentPos.lat();
            const startLng = currentPos.lng();
            const endLat = courierPos.lat;
            const endLng = courierPos.lng;

            // Only animate if moved more than ~5m (avoid jitter)
            const moved = Math.abs(startLat - endLat) + Math.abs(startLng - endLng);
            if (moved > 0.00005) {
              const steps = 15;
              let step = 0;
              const animate = () => {
                step++;
                const t = step / steps;
                // Ease-out interpolation
                const ease = 1 - Math.pow(1 - t, 3);
                const lat = startLat + (endLat - startLat) * ease;
                const lng = startLng + (endLng - startLng) * ease;
                courierMarkerRef.current.setPosition({ lat, lng });
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

        // Update or create destination marker
        if (destPos) {
          if (destMarkerRef.current) {
            destMarkerRef.current.setPosition(destPos);
            if (
              destMarkerRef.current?.getTitle &&
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

        // ── Camera behavior: only move camera when followRef is true ──
        // This is the key fix: user can freely pan/zoom without the map snapping back.
        // Camera only follows when user explicitly requests it (via "Locate Me" button).
        if (followRef.current && courierPos) {
          if (isNavigating) {
            // Navigation mode: smooth pan to courier, keep current zoom if user zoomed
            mapInstanceRef.current.panTo(courierPos);
            // Only set tilt once when navigation starts (not on every update)
          } else if (destPos) {
            // Overview mode: fit both points
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

    // Re-request directions when courier moves significantly or destination changes
    useEffect(() => {
      if (
        status !== "ready" ||
        !directionsServiceRef.current ||
        !directionsRendererRef.current ||
        destLat == null ||
        destLng == null
      )
        return;

      const origin = { lat: courierLat, lng: courierLng };
      const destination = { lat: destLat, lng: destLng };

      // Haversine distance (km)
      const haversineKm = (lat1, lng1, lat2, lng2) => {
        const toRad = (v) => (v * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lng2 - lng1);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };

      const last = lastOriginRef.current || { lat: null, lng: null, t: 0 };
      const movedKm =
        last.lat == null
          ? Infinity
          : haversineKm(last.lat, last.lng, origin.lat, origin.lng);
      const now = Date.now();

      // Re-request if moved > 0.05 km (~50m) OR destination changed OR >15s since last request
      const destChanged =
        last.destLat !== destination.lat || last.destLng !== destination.lng;
      if (movedKm > 0.05 || destChanged || now - last.t > 15000) {
        lastOriginRef.current = {
          lat: origin.lat,
          lng: origin.lng,
          t: now,
          destLat: destination.lat,
          destLng: destination.lng,
        };

        directionsServiceRef.current.route(
          {
            origin,
            destination,
            travelMode: "DRIVING",
            provideRouteAlternatives: true,
          },
          (result, routeStatus) => {
            if (routeStatus === "OK") {
              const maxIndex = Math.max(0, (result.routes?.length || 1) - 1);
              const preferredIndex =
                Number.isInteger(routePreferenceIndex) &&
                routePreferenceIndex >= 0
                  ? routePreferenceIndex
                  : 0;
              const routeIndex = Math.min(preferredIndex, maxIndex);
              directionsRendererRef.current.setDirections(result);
              let routeIndexApplied = false;
              try {
                directionsRendererRef.current.setRouteIndex(routeIndex);
                routeIndexApplied = true;
              } catch (e) {
                routeIndexApplied = false;
              }

              try {
                if (!routeIndexApplied) {
                  directionsRendererRef.current.setOptions({
                    polylineOptions: {
                      strokeColor: lineColorRef.current,
                      strokeOpacity: 0,
                    },
                  });
                  if (customPolylineRef.current) {
                    customPolylineRef.current.setMap(null);
                    customPolylineRef.current = null;
                  }
                  const selectedRoute =
                    result.routes[routeIndex] || result.routes[0];
                  const pts = (selectedRoute.overview_path || []).map((p) => ({
                    lat: p.lat(),
                    lng: p.lng(),
                  }));
                  customPolylineRef.current = new gmaps.Polyline({
                    path: pts,
                    strokeColor: lineColorRef.current,
                    strokeWeight: 6,
                    strokeOpacity: 0.95,
                    map,
                    zIndex: 50,
                  });
                } else {
                  if (customPolylineRef.current) {
                    customPolylineRef.current.setMap(null);
                    customPolylineRef.current = null;
                  }
                  directionsRendererRef.current.setOptions({
                    polylineOptions: {
                      strokeColor: lineColorRef.current,
                      strokeWeight: 6,
                      strokeOpacity: 0.95,
                    },
                  });
                }
              } catch (err) {
                console.warn("[GoogleMap] polyline fallback error", err);
              }

              if (onRouteFetched) {
                const selectedRoute =
                  result.routes[routeIndex] || result.routes[0];
                const leg = selectedRoute.legs[0];
                const steps = leg.steps.map((s) => ({
                  instructions: s.instructions,
                  distance: s.distance.text,
                  maneuver: s.maneuver || "straight",
                }));
                onRouteFetched({
                  routeIndex,
                  distance: leg.distance.text,
                  duration: leg.duration.text,
                  steps,
                  allRoutes: result.routes.map((r, i) => ({
                    id: `alt-${i}`,
                    name:
                      r.summary || (i === 0 ? "Rute Utama" : `Alternatif ${i}`),
                    distance: r.legs[0].distance.text,
                    duration: r.legs[0].duration.text,
                  })),
                });
              }

            } else {
              console.warn("Directions API (update):", routeStatus);
            }
          },
        );
      }
    }, [
      status,
      courierLat,
      courierLng,
      destLat,
      destLng,
      routePreferenceIndex,
      lineColor,
    ]);

    if (!hasKey)
      return (
        <MockMap
          followUser={followUser}
          onToggleFollow={onToggleFollowRef.current}
        />
      );
    if (status === "error")
      return (
        <div className="w-full h-40 rounded-xl bg-red-900/20 border border-red-400/20 flex flex-col items-center justify-center gap-2 p-4">
          <span className="text-2xl">⚠️</span>
          <p className="text-red-400 text-xs text-center">{errorMsg}</p>
          <p className="text-white/30 text-xs text-center">
            Check that Maps JavaScript API & Directions API are enabled
          </p>
        </div>
      );

    return (
      <div className="relative w-full h-full overflow-hidden">
        {status === "loading" && (
          <div className="absolute inset-0 z-10 bg-sage-900/70 flex flex-col items-center justify-center gap-2">
            <svg
              className="w-6 h-6 animate-spin text-sage-400"
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
            <p className="text-sage-300 text-xs">Memuat peta...</p>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" />

        {/* Traffic Layer Toggle (courier mode — handled externally via prop) */}

        {/* follow button removed per UX request */}
      </div>
    );
  },
);

export default GoogleMap;
