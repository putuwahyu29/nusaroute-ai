/**
 * Centralized frontend runtime configuration.
 * All environment-driven URLs, keys, and spatial constants live here.
 */
function parseCoord(val: string | undefined, fallback: number): number {
  if (!val) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export const FRONTEND_CONFIG = {
  backendUrl:
    import.meta.env.VITE_BACKEND_URL ||
    (import.meta.env.DEV ? "http://localhost:3000" : ""),
  apiKey: import.meta.env.VITE_API_KEY || "",
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  operationCity: import.meta.env.VITE_OPERATION_CITY || "Surabaya",
  deliveryMarkRadiusKm: parseCoord(import.meta.env.VITE_GEOFENCE_RADIUS_KM, 0.2),
  defaultMapCenter: {
    lat: parseCoord(import.meta.env.VITE_DEFAULT_LAT, -7.2652),
    lng: parseCoord(import.meta.env.VITE_DEFAULT_LNG, 112.7523),
  },
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || "",
  },
} as const;

export const hasValidFirebaseConfig = Boolean(
  FRONTEND_CONFIG.firebase.apiKey &&
    FRONTEND_CONFIG.firebase.projectId &&
    !FRONTEND_CONFIG.firebase.apiKey.includes("your_") &&
    !FRONTEND_CONFIG.firebase.projectId.includes("your-")
);
