import React, { useEffect, useRef, useState } from "react";
import { RouteIcon, CheckIcon } from "./UiIcons";
import type { Delivery } from "../types";

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const SURABAYA_CENTER = { lat: -7.2575, lng: 112.7521 };

interface RouteOverviewMapProps {
  deliveries?: Delivery[];
  activeDeliveryId?: string | null;
  courierLat?: number | null;
  courierLng?: number | null;
  isDarkMode?: boolean;
}

function OverviewFallback({ deliveries }: { deliveries: Delivery[] }) {
  const completedCount = deliveries.filter((d) => d.status === "delivered").length;

  return (
    <div className="w-full rounded-xl bg-surface border border-theme overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-theme flex items-center justify-between">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
          <RouteIcon className="w-3.5 h-3.5 text-primary" /> Pratinjau Rute Roster
        </p>
        <p className="text-xs text-primary font-semibold font-mono">
          {completedCount}/{deliveries.length} selesai
        </p>
      </div>
      <div className="px-4 py-3 flex flex-col">
        {deliveries.map((d, idx) => {
          const isLast = idx === deliveries.length - 1;
          const isDone = d.status === "delivered";
          const isActive = d.status === "in_transit";
          return (
            <div key={d.id} className="flex items-stretch gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border-2 transition-all ${
                    isDone
                      ? "bg-slate-500/20 border-slate-400/40 text-slate-400"
                      : isActive
                      ? "bg-primary border-primary text-white shadow-md shadow-primary/30"
                      : "bg-amber-500/10 border-amber-500/40 text-amber-600"
                  }`}
                >
                  {isDone ? <CheckIcon className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                {!isLast && (
                  <div
                    className={`w-0.5 my-1 rounded-full flex-1 transition-colors ${
                      isDone ? "bg-slate-500/20" : "bg-primary/25"
                    }`}
                    style={{ minHeight: 18 }}
                  />
                )}
              </div>

              <div className="flex-1 pb-3">
                <p
                  className={`text-xs font-bold leading-snug transition-all ${
                    isDone ? "text-text-muted line-through" : "text-text-main"
                  }`}
                >
                  {d.recipient}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[9px] text-text-muted">{d.estimatedArrival ?? "-"}</span>
                  {d.packageCount && (
                    <span className="text-[9px] text-text-muted">· {d.packageCount} paket</span>
                  )}
                  {d.priority === "high" && !isDone && (
                    <span className="text-[9px] text-red-500 font-black px-1 py-0.5 rounded bg-red-500/10">
                      PRIORITAS
                    </span>
                  )}
                  {isDone && (
                    <span className="text-[9px] text-primary font-bold flex items-center gap-1">
                      <CheckIcon className="w-2.5 h-2.5" /> Selesai
                    </span>
                  )}
                  {isActive && (
                    <span className="text-[9px] text-primary font-black animate-pulse">
                      Aktif
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

let mapsLoadPromise: Promise<void> | null = null;
function loadMaps(key: string): Promise<void> {
  const win = window as any;
  if (win.google?.maps?.Map) return Promise.resolve();
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = new Promise<void>((resolve, reject) => {
    const cb = "__nusaroute_overview_cb";
    win[cb] = () => {
      delete win[cb];
      resolve();
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=${cb}&loading=async`;
    s.async = true;
    s.onerror = () => {
      mapsLoadPromise = null;
      reject(new Error("Maps load failed"));
    };
    document.head.appendChild(s);
  });
  return mapsLoadPromise;
}

function makePin(number: number, status?: string) {
  const win = window as any;
  const bg = status === "delivered" ? "#64748b" : status === "in_transit" ? "#52796f" : "#f59e0b";
  const innerContent =
    status === "delivered"
      ? `<path d="M11 14l3.5 3.5L21 10.5" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<text x="16" y="19" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Inter,sans-serif">${number}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="38" viewBox="0 0 32 38">
    <circle cx="16" cy="14" r="13" fill="${bg}" fill-opacity="0.95" stroke="white" stroke-width="2"/>
    ${innerContent}
    <line x1="16" y1="27" x2="16" y2="38" stroke="${bg}" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new win.google.maps.Size(32, 38),
    anchor: new win.google.maps.Point(16, 38),
  };
}

export default function RouteOverviewMap({
  deliveries = [],
  activeDeliveryId = null,
}: RouteOverviewMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!MAPS_API_KEY) {
      setLoadError(true);
      return;
    }

    let isMounted = true;
    loadMaps(MAPS_API_KEY)
      .then(() => {
        if (!isMounted || !mapRef.current) return;
        const win = window as any;
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new win.google.maps.Map(mapRef.current, {
            center: SURABAYA_CENTER,
            zoom: 13,
            disableDefaultUI: true,
            zoomControl: false,
          });
        }
      })
      .catch(() => {
        if (isMounted) setLoadError(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const win = window as any;
    if (!map || !win.google) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    const points = deliveries.filter((d) => d.lat != null && d.lng != null);
    if (points.length === 0) return;

    const bounds = new win.google.maps.LatLngBounds();
    const path: any[] = [];

    points.forEach((d, idx) => {
      const pos = { lat: d.lat, lng: d.lng };
      bounds.extend(pos);
      path.push(pos);

      const marker = new win.google.maps.Marker({
        position: pos,
        map,
        icon: makePin(idx + 1, d.id === activeDeliveryId ? "in_transit" : d.status),
        title: `${idx + 1}. ${d.recipient}`,
        zIndex: d.id === activeDeliveryId ? 100 : 10,
      });

      markersRef.current.push(marker);
    });

    polylineRef.current = new win.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#52796f",
      strokeOpacity: 0.8,
      strokeWeight: 3,
      map,
    });

    if (points.length === 1) {
      map.setCenter({ lat: points[0].lat, lng: points[0].lng });
      map.setZoom(14);
    } else {
      map.fitBounds(bounds, 40);
    }
  }, [deliveries, activeDeliveryId]);

  if (loadError || !MAPS_API_KEY) {
    return <OverviewFallback deliveries={deliveries} />;
  }

  return (
    <div className="w-full rounded-xl overflow-hidden border border-theme bg-surface shadow-sm">
      <div className="px-4 py-3 border-b border-theme flex items-center justify-between">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
          <RouteIcon className="w-3.5 h-3.5 text-primary" /> Pratinjau Rute di Peta
        </p>
        <p className="text-xs text-primary font-semibold font-mono">
          {deliveries.filter((d) => d.status === "delivered").length}/{deliveries.length} selesai
        </p>
      </div>
      <div ref={mapRef} className="w-full h-48 bg-main" />
    </div>
  );
}
