import { useEffect, useRef, useState } from "react";

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const SURABAYA_CENTER = { lat: -7.2575, lng: 112.7521 };

const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a9bb0" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#263d44" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#354f52" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#16213e" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1e2f35" }] },
];

interface LocationPickerMapProps {
  lat?: number | string | null;
  lng?: number | string | null;
  isDarkMode?: boolean;
  onLocationSelect?: (coords: { lat: number; lng: number }) => void;
}

export default function LocationPickerMap({
  lat,
  lng,
  isDarkMode = true,
  onLocationSelect,
}: LocationPickerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const hasKey = Boolean(MAPS_API_KEY && MAPS_API_KEY !== "your_google_maps_api_key_here");
    if (!hasKey) {
      setIsReady(false);
      return;
    }

    let isMounted = true;

    async function initPickerMap() {
      if (!window.google?.maps?.Map) {
        await new Promise<void>((resolve) => {
          const check = setInterval(() => {
            if (window.google?.maps?.Map) {
              clearInterval(check);
              resolve();
            }
          }, 200);
          setTimeout(() => {
            clearInterval(check);
            resolve();
          }, 5000);
        });
      }

      if (!window.google?.maps?.Map || !isMounted || !mapContainerRef.current) return;

      const gmaps = window.google.maps;
      const parsedLat = typeof lat === "string" ? parseFloat(lat) : lat;
      const parsedLng = typeof lng === "string" ? parseFloat(lng) : lng;
      const initialCenter =
        parsedLat && parsedLng && !isNaN(parsedLat) && !isNaN(parsedLng)
          ? { lat: parsedLat, lng: parsedLng }
          : SURABAYA_CENTER;

      const map = new gmaps.Map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 13,
        styles: isDarkMode ? DARK_STYLE : [],
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: gmaps.ControlPosition.RIGHT_CENTER },
        gestureHandling: "greedy",
        clickableIcons: false,
      });

      mapInstanceRef.current = map;

      if (parsedLat && parsedLng && !isNaN(parsedLat) && !isNaN(parsedLng)) {
        markerRef.current = new gmaps.Marker({
          position: { lat: parsedLat, lng: parsedLng },
          map,
          draggable: true,
          animation: gmaps.Animation.DROP,
          icon: {
            path: gmaps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#52796f",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });

        markerRef.current.addListener("dragend", (e: google.maps.MapMouseEvent) => {
          if (e.latLng && onLocationSelect) {
            onLocationSelect({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          }
        });
      }

      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const clickedLat = e.latLng.lat();
        const clickedLng = e.latLng.lng();

        if (markerRef.current) {
          markerRef.current.setPosition({ lat: clickedLat, lng: clickedLng });
        } else {
          markerRef.current = new gmaps.Marker({
            position: { lat: clickedLat, lng: clickedLng },
            map,
            draggable: true,
            animation: gmaps.Animation.DROP,
            icon: {
              path: gmaps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: "#52796f",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
            },
          });

          markerRef.current.addListener("dragend", (e2: google.maps.MapMouseEvent) => {
            if (e2.latLng && onLocationSelect) {
              onLocationSelect({ lat: e2.latLng.lat(), lng: e2.latLng.lng() });
            }
          });
        }

        if (onLocationSelect) {
          onLocationSelect({ lat: clickedLat, lng: clickedLng });
        }
      });

      if (isMounted) setIsReady(true);
    }

    initPickerMap();

    return () => {
      isMounted = false;
    };
  }, [isDarkMode]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    const parsedLat = typeof lat === "string" ? parseFloat(lat) : lat;
    const parsedLng = typeof lng === "string" ? parseFloat(lng) : lng;

    if (parsedLat && parsedLng && !isNaN(parsedLat) && !isNaN(parsedLng)) {
      const pos = { lat: parsedLat, lng: parsedLng };
      if (markerRef.current) {
        markerRef.current.setPosition(pos);
      } else {
        const gmaps = window.google.maps;
        markerRef.current = new gmaps.Marker({
          position: pos,
          map: mapInstanceRef.current,
          draggable: true,
          animation: gmaps.Animation.DROP,
          icon: {
            path: gmaps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#52796f",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
        markerRef.current.addListener("dragend", (e: google.maps.MapMouseEvent) => {
          if (e.latLng && onLocationSelect) {
            onLocationSelect({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          }
        });
      }
      mapInstanceRef.current.panTo(pos);
    } else if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
  }, [lat, lng]);

  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setOptions({
        styles: isDarkMode ? DARK_STYLE : [],
      });
    }
  }, [isDarkMode]);

  const hasKey = Boolean(MAPS_API_KEY && MAPS_API_KEY !== "your_google_maps_api_key_here");

  if (!hasKey) {
    const parsedLat = typeof lat === "number" ? lat : typeof lat === "string" ? parseFloat(lat) : 0;
    const parsedLng = typeof lng === "number" ? lng : typeof lng === "string" ? parseFloat(lng) : 0;

    return (
      <div className="w-full h-full bg-surface flex flex-col items-center justify-center gap-2 p-4">
        <div className="w-full h-full relative overflow-hidden rounded-lg">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "linear-gradient(rgba(132,169,140,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(132,169,140,0.4) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <svg
              className="w-8 h-8 text-primary/40"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10z"
              />
              <circle cx="12" cy="11" r="2" />
            </svg>
            <p className="text-[10px] text-text-muted font-bold text-center px-4">
              Google Maps API Key diperlukan untuk peta interaktif.
              <br />
              Masukkan koordinat secara manual di bawah.
            </p>
          </div>
        </div>
        <div className="w-full grid grid-cols-2 gap-2 mt-2">
          <input
            type="number"
            step="any"
            placeholder="Latitude (cth: -7.2575)"
            value={lat ?? ""}
            onChange={(e) => {
              if (onLocationSelect && e.target.value) {
                onLocationSelect({ lat: parseFloat(e.target.value), lng: parsedLng || 112.7521 });
              }
            }}
            className="w-full bg-main border border-theme rounded-lg px-3 py-2 text-[10px] font-medium text-text-main focus:border-primary outline-none"
          />
          <input
            type="number"
            step="any"
            placeholder="Longitude (cth: 112.7521)"
            value={lng ?? ""}
            onChange={(e) => {
              if (onLocationSelect && e.target.value) {
                onLocationSelect({ lat: parsedLat || -7.2575, lng: parseFloat(e.target.value) });
              }
            }}
            className="w-full bg-main border border-theme rounded-lg px-3 py-2 text-[10px] font-medium text-text-main focus:border-primary outline-none"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full" />
      {!isReady && (
        <div className="absolute inset-0 bg-surface flex items-center justify-center">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span className="text-[10px] font-bold text-text-muted">Memuat peta...</span>
          </div>
        </div>
      )}
      {isReady && !lat && !lng && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="bg-surface/80 backdrop-blur-sm border border-theme rounded-xl px-3 py-2 shadow-lg animate-pulse">
            <p className="text-xs font-semibold text-text-main flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10z" />
                <circle cx="12" cy="11" r="2" />
              </svg>
              Klik peta untuk menentukan titik tujuan
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
