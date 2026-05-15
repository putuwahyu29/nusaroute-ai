/**
 * RouteOverviewMap — Mini map showing all delivery stops in order.
 * Properly clears and redraws markers/polylines when deliveries change.
 * Falls back to an SVG timeline diagram if no Maps API key is set.
 */
import React, { useEffect, useRef, useState } from 'react';

const MAPS_API_KEY    = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const SURABAYA_CENTER = { lat: -7.2575, lng: 112.7521 };

// ── SVG timeline fallback ─────────────────────────────────────────────────────
function OverviewFallback({ deliveries }) {
  const active = deliveries.filter(d => d.status !== 'delivered');
  return (
    <div className="w-full rounded-2xl bg-surface border border-theme overflow-hidden">
      <div className="px-4 py-3 border-b border-theme flex items-center justify-between">
        <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">🗺️ Pratinjau Rute</p>
        <p className="text-[10px] text-primary font-black">
          {deliveries.filter(d => d.status === 'delivered').length}/{deliveries.length} selesai
        </p>
      </div>
      <div className="px-4 py-3 flex flex-col">
        {deliveries.map((d, idx) => {
          const isLast   = idx === deliveries.length - 1;
          const isDone   = d.status === 'delivered';
          const isActive = d.status === 'in_transit';
          return (
            <div key={d.id} className="flex items-stretch gap-3">
              {/* Node + connector */}
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border-2 transition-all
                  ${isDone   ? 'bg-slate-500/20 border-slate-400/40 text-slate-400' :
                    isActive ? 'bg-primary border-primary text-white shadow-md shadow-primary/30' :
                               'bg-amber-500/10 border-amber-500/40 text-amber-600'}`}
                >
                  {isDone ? '✓' : idx + 1}
                </div>
                {!isLast && (
                  <div
                    className={`w-0.5 my-1 rounded-full flex-1 transition-colors ${isDone ? 'bg-slate-500/20' : 'bg-primary/25'}`}
                    style={{ minHeight: 18 }}
                  />
                )}
              </div>

              {/* Stop info */}
              <div className="flex-1 pb-3">
                <p className={`text-xs font-bold leading-snug transition-all ${isDone ? 'text-text-muted line-through' : 'text-text-main'}`}>
                  {d.recipient}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[9px] text-text-muted">{d.estimatedArrival ?? '—'}</span>
                  {d.packageCount && <span className="text-[9px] text-text-muted">· {d.packageCount} paket</span>}
                  {d.priority === 'high' && !isDone && (
                    <span className="text-[9px] text-red-500 font-black">🔴 PRIO</span>
                  )}
                  {isDone   && <span className="text-[9px] text-primary font-bold">✅ Selesai</span>}
                  {isActive && <span className="text-[9px] text-primary font-black animate-pulse">▶ Aktif</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Maps loader (singleton) ───────────────────────────────────────────────────
let mapsLoadPromise = null;
function loadMaps(key) {
  if (window.google?.maps?.Map) return Promise.resolve();
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = new Promise((resolve, reject) => {
    const cb = '__nusaroute_overview_cb';
    window[cb] = () => { delete window[cb]; resolve(); };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=${cb}&loading=async`;
    s.async = true;
    s.onerror = () => { mapsLoadPromise = null; reject(new Error('Maps load failed')); };
    document.head.appendChild(s);
  });
  return mapsLoadPromise;
}

// ── Numbered pin icon ─────────────────────────────────────────────────────────
function makePin(number, status) {
  const bg    = status === 'delivered' ? '#64748b' : status === 'in_transit' ? '#52796f' : '#f59e0b';
  const label = status === 'delivered' ? '✓' : String(number);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="38" viewBox="0 0 32 38">
    <circle cx="16" cy="14" r="13" fill="${bg}" fill-opacity="0.95" stroke="white" stroke-width="2"/>
    <text x="16" y="19" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Inter,sans-serif">${label}</text>
    <line x1="16" y1="27" x2="16" y2="38" stroke="${bg}" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(32, 38),
    anchor: new window.google.maps.Point(16, 38),
  };
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RouteOverviewMap({ deliveries = [], courierLat, courierLng, isDarkMode = true }) {
  const mapDivRef      = useRef(null);
  const mapRef         = useRef(null);    // google.maps.Map instance
  const markersRef     = useRef([]);      // all active Marker instances
  const polylineRef    = useRef(null);    // the route Polyline instance
  const courierMarkerRef = useRef(null);  // courier dot Marker

  const [mapStatus, setMapStatus] = useState('loading');  // 'loading' | 'ready' | 'error'

  const hasKey = Boolean(MAPS_API_KEY && MAPS_API_KEY !== 'your_google_maps_api_key_here');

  const lineColor = isDarkMode ? "#cad2c5" : "#2d4a43";
  const lineColorRef = useRef(lineColor);
  
  useEffect(() => {
    lineColorRef.current = lineColor;
  }, [lineColor]);

  // ── Clear helpers ────────────────────────────────────────────────────────────
  function clearMarkers() {
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
  }
  function clearPolyline() {
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
  }
  function clearCourierMarker() {
    if (courierMarkerRef.current) { courierMarkerRef.current.setMap(null); courierMarkerRef.current = null; }
  }

  // ── Draw overlay (markers + polyline) without recreating the map ─────────────
  function drawOverlay(gmaps, map) {
    clearMarkers();
    clearPolyline();
    clearCourierMarker();

    const bounds = new gmaps.LatLngBounds();

    // Courier dot
    if (courierLat && courierLng) {
      const pos = { lat: courierLat, lng: courierLng };
      courierMarkerRef.current = new gmaps.Marker({
        position: pos,
        map,
        title: 'Posisi Kurir',
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#52796f',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        zIndex: 20,
      });
      bounds.extend(pos);
    }

    // Delivery markers
    const pathPoints = [];
    deliveries.forEach((d, idx) => {
      if (!d.lat || !d.lng) return;
      const pos = { lat: d.lat, lng: d.lng };
      pathPoints.push(pos);
      bounds.extend(pos);

      const marker = new gmaps.Marker({
        position: pos,
        map,
        title: d.recipient,
        icon: makePin(idx + 1, d.status),
        zIndex: d.status === 'in_transit' ? 15 : 10,
      });
      markersRef.current.push(marker);

      const infoContent = `
        <div style="font-family:Inter,sans-serif;font-size:12px;color:#0f172a;padding:4px;max-width:200px">
          <p style="margin:0;font-weight:900;font-size:10px;color:#52796f;text-transform:uppercase">Stop #${idx + 1}</p>
          <p style="margin:2px 0;font-weight:700;font-size:12px">${d.recipient}</p>
          <p style="margin:0;font-size:10px;color:#64748b">${d.estimatedArrival ?? ''} · ${d.packageCount ?? 1} paket</p>
          <p style="margin:2px 0;font-size:10px;color:${d.status === 'delivered' ? '#64748b' : d.status === 'in_transit' ? '#52796f' : '#f59e0b'}">
            ${d.status === 'delivered' ? '✅ Terkirim' : d.status === 'in_transit' ? '▶ Dalam Perjalanan' : '⏳ Menunggu'}
          </p>
        </div>`;
      const info = new gmaps.InfoWindow({ content: infoContent });
      marker.addListener('click', () => info.open(map, marker));
    });

    // Sequential route polyline
    if (pathPoints.length >= 2) {
      polylineRef.current = new gmaps.Polyline({
        path: pathPoints,
        geodesic: true,
        strokeColor: lineColorRef.current,
        strokeOpacity: 0.85,
        strokeWeight: 3.5,
        icons: [{
          icon: { path: gmaps.SymbolPath.FORWARD_OPEN_ARROW, scale: 2, strokeColor: '#84a98c' },
          offset: '50%',
          repeat: '100px',
        }],
        map,
      });
    }

    // Fit bounds — show all markers
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 20, right: 12, bottom: 12, left: 12 });
    }
  }

  // ── Effect: init map once, then update overlay on deliveries change ───────────
  useEffect(() => {
    if (!hasKey || !mapDivRef.current) return;

    let mounted = true;

    async function bootstrap() {
      try {
        await loadMaps(MAPS_API_KEY);
        if (!mounted || !mapDivRef.current) return;

        const gmaps = window.google.maps;

        // Create map only once
        if (!mapRef.current) {
          mapRef.current = new gmaps.Map(mapDivRef.current, {
            zoom: 13,
            center: SURABAYA_CENTER,
            disableDefaultUI: true,
            gestureHandling: 'cooperative',
            styles: isDarkMode ? [
              { elementType: 'geometry',           stylers: [{ color: '#1e293b' }] },
              { elementType: 'labels.text.fill',   stylers: [{ color: '#94a3b8' }] },
              { elementType: 'labels.text.stroke', stylers: [{ color: '#1e293b' }] },
              { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#263d44' }] },
              { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#cad2c5' }] },
              { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
              { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
              { featureType: 'transit', stylers: [{ visibility: 'off' }] },
            ] : [],
          });
        }

        // Always redraw overlay (markers + polyline) whenever deliveries change
        if (deliveries.length > 0) {
          drawOverlay(gmaps, mapRef.current);
        }

        if (mounted) setMapStatus('ready');
      } catch (err) {
        console.error('RouteOverviewMap:', err.message);
        if (mounted) setMapStatus('error');
      }
    }

    bootstrap();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasKey, deliveries, courierLat, courierLng]); // Remove isDarkMode from here to prevent map re-init

  // ── Effect: Update map styles when theme changes ─────────────────────────────
  useEffect(() => {
    if (mapRef.current && window.google?.maps) {
      const styles = isDarkMode ? [
        { elementType: 'geometry',           stylers: [{ color: '#1e293b' }] },
        { elementType: 'labels.text.fill',   stylers: [{ color: '#94a3b8' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1e293b' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#263d44' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#cad2c5' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
        { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ] : [];
      mapRef.current.setOptions({ styles });
    }
  }, [isDarkMode]);

  // ── Effect: Update polyline color in real-time ────────────────────────────────
  useEffect(() => {
    if (polylineRef.current) {
      polylineRef.current.setOptions({
        strokeColor: lineColor
      });
    }
  }, [lineColor]);

  // Cleanup all Google Maps objects on unmount
  useEffect(() => {
    return () => {
      clearMarkers();
      clearPolyline();
      clearCourierMarker();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasKey) return <OverviewFallback deliveries={deliveries} />;

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-theme shadow-md" style={{ height: 224 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface border-b border-theme">
        <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">🗺️ Peta Rute</p>
        <div className="flex items-center gap-3">
          {deliveries.some(d => d.status === 'in_transit') && (
            <span className="flex items-center gap-1 text-[9px] text-primary font-black">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
              Aktif
            </span>
          )}
          <span className="text-[9px] text-text-muted font-bold">
            {deliveries.filter(d => d.status === 'delivered').length}/{deliveries.length} selesai
          </span>
        </div>
      </div>

      {/* Map container */}
      <div className="relative" style={{ height: 182 }}>
        {mapStatus === 'loading' && (
          <div className="absolute inset-0 z-10 bg-surface flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="text-text-muted text-xs">Memuat peta rute...</p>
          </div>
        )}
        {mapStatus === 'error' && (
          <div className="absolute inset-0 z-10 bg-surface flex items-center justify-center">
            <p className="text-text-muted text-xs">Gagal memuat peta</p>
          </div>
        )}
        <div ref={mapDivRef} className="w-full h-full" />
      </div>
    </div>
  );
}
