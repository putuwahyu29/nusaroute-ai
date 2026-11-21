import { FRONTEND_CONFIG } from "../config/app-config";
import type {
  AIDecision,
  Delivery,
  IncidentReport,
  PickupHub,
  RouteAlternative,
  RouteOptimizationResult,
  TrafficZone,
  User,
  Weather,
  WeatherCondition,
} from "../types/index.js";

const BASE_URL = FRONTEND_CONFIG.backendUrl;
const API_KEY = FRONTEND_CONFIG.apiKey;
const AUTH_TOKEN_KEY = "nusaroute_auth_token";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // Ignore storage quota / private mode failures
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Ignore storage access failures
  }
}

/**
 * Konversi pesan error teknis menjadi pesan ramah pengguna berbahasa Indonesia.
 */
export function toUserFriendlyError(err: unknown, defaultMessage = "Terjadi kesalahan saat memproses data."): string {
  if (!err) return defaultMessage;
  const raw = (err instanceof Error ? err.message : String(err)).trim();
  if (!raw) return defaultMessage;

  const lower = raw.toLowerCase();
  if (lower.includes("abort") || lower.includes("signal is aborted") || lower.includes("timeout")) {
    return "Waktu analisis AI melebihi batas toleransi. Silakan coba kirim ulang laporan Anda.";
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("connection refused")) {
    return "Gagal terhubung ke server backend. Periksa koneksi internet Anda atau coba muat ulang halaman.";
  }
  if (lower.includes("resource_exhausted") || lower.includes("quota") || lower.includes("429")) {
    return "Layanan AI sedang melayani lalu lintas tinggi. Sistem secara otomatis beralih ke jalur cadangan.";
  }
  if (lower.includes("unauthorized") || lower.includes("401") || lower.includes("invalid or expired bearer token")) {
    return "Sesi login telah kedaluwarsa. Silakan masuk kembali.";
  }
  if (lower.includes("forbidden") || lower.includes("403")) {
    return "Akses ditolak: Akun Anda tidak memiliki izin untuk fitur ini.";
  }
  if (lower.includes("500") || lower.includes("internal server error")) {
    return "Terjadi kendala sementara pada server. Silakan coba beberapa saat lagi.";
  }
  return raw;
}

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }
  return headers;
};

const getHeaders = (extra: Record<string, string> = {}): Record<string, string> => ({
  "Content-Type": "application/json",
  ...getAuthHeaders(),
  ...extra,
});

async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401 && typeof window !== "undefined") {
    clearAuthToken();
    try {
      localStorage.removeItem("nusaroute_user");
    } catch {
      // Ignore storage failures
    }
    window.dispatchEvent(new CustomEvent("nusaroute:unauthorized"));
  }
  return res;
}

export async function login(
  identifier: string,
  password: string
): Promise<{ success: boolean; user: User; token?: string; error?: string }> {
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, email: identifier, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function loginWithGoogle(
  idToken: string
): Promise<{ success: boolean; user: User; token?: string; error?: string }> {
  const res = await fetch(`${BASE_URL}/api/login/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Google login failed");
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function analyzeIncident({
  photoFile,
  audioBlob,
  courierId,
  location = "Unknown",
}: {
  photoFile?: File | Blob | null;
  audioBlob?: Blob | null;
  courierId: string;
  location?: string;
}): Promise<{ success: boolean; reportId: string; aiDecision: AIDecision }> {
  const formData = new FormData();

  if (photoFile) formData.append("photo", photoFile);
  if (audioBlob) {
    const ext = audioBlob.type.includes("mp4")
      ? "mp4"
      : audioBlob.type.includes("ogg")
      ? "ogg"
      : audioBlob.type.includes("wav")
      ? "wav"
      : audioBlob.type.includes("aac")
      ? "aac"
      : "webm";
    formData.append("audio", audioBlob, `audio-report.${ext}`);
  }
  formData.append("courierId", courierId);
  formData.append("location", location);

  const controller = new AbortController();
  // Alokasikan waktu 75 detik untuk cold-start kontainer, upload media, dan inferensi multimodal LLM
  const timeout = setTimeout(() => {
    try {
      controller.abort(new Error("Batas waktu analisis AI (75 detik) terlampaui."));
    } catch {
      controller.abort();
    }
  }, 75000);

  try {
    const response = await authFetch(`${BASE_URL}/api/analyze-incident`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || err.error || `Server error: ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    throw new Error(toUserFriendlyError(err));
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchDeliveries(courierId: string): Promise<Delivery[]> {
  const res = await authFetch(`${BASE_URL}/api/deliveries?courierId=${encodeURIComponent(courierId)}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch deliveries");
  return res.json();
}

export async function fetchAllDeliveries(): Promise<Delivery[]> {
  const res = await authFetch(`${BASE_URL}/api/deliveries/all`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch all deliveries");
  return res.json();
}

export async function addDelivery(
  deliveryData: Partial<Delivery>
): Promise<{ success: boolean; delivery: Delivery }> {
  const res = await authFetch(`${BASE_URL}/api/deliveries`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(deliveryData),
  });
  if (!res.ok) throw new Error("Failed to create delivery");
  return res.json();
}

export async function autoAssignDeliveries(): Promise<{
  success: boolean;
  message: string;
  assignedCount: number;
}> {
  const res = await authFetch(`${BASE_URL}/api/deliveries/auto-assign`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to auto-assign deliveries");
  return res.json();
}

export async function resetDatabaseDemo(): Promise<{
  success: boolean;
  message: string;
  stats?: any;
}> {
  const res = await authFetch(`${BASE_URL}/api/deliveries/reset`, {
    method: "POST",
    headers: getHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to reset demo database");
  return data;
}

export async function updateDeliveryStatus(
  deliveryId: string,
  updates: Record<string, any>
): Promise<Delivery> {
  const res = await authFetch(`${BASE_URL}/api/deliveries/${encodeURIComponent(deliveryId)}/status`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to update delivery");
  return data;
}

export async function optimizeRoute(
  deliveries: Delivery[]
): Promise<RouteOptimizationResult> {
  const res = await authFetch(`${BASE_URL}/api/deliveries/optimize`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ deliveries }),
  });
  if (!res.ok) throw new Error("Failed to optimize route");
  return res.json();
}

export async function fetchIncidents(): Promise<IncidentReport[]> {
  const res = await authFetch(`${BASE_URL}/api/incidents`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch incidents");
  return res.json();
}

export async function checkHealth(): Promise<{
  status: string;
  firestore: string;
  ai: string;
  mode?: string;
  model?: string;
  operationCity?: string;
  defaultOrigin?: { lat: number; lng: number };
  geofenceRadiusMeters?: number;
  hubClusterRadiusKm?: number;
  authProviders?: { password: boolean; google: boolean };
} | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchUsers(): Promise<User[]> {
  const res = await authFetch(`${BASE_URL}/api/users`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch users");
  const data = await res.json();
  return data.users || [];
}

export async function fetchTrafficZones(): Promise<TrafficZone[]> {
  const res = await authFetch(`${BASE_URL}/api/smart/zones`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch traffic zones");
  const data = await res.json();
  return data.zones || [];
}

export async function fetchTrafficPrediction(): Promise<{
  zones: TrafficZone[];
  weather: Weather;
  source: string;
  generatedAt: string;
}> {
  const res = await authFetch(`${BASE_URL}/api/smart/traffic`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch traffic prediction");
  return res.json();
}

export async function fetchPickupPoints(deliveries: Delivery[]): Promise<{
  hubs: PickupHub[];
  totalDeliveriesClustered: number;
  sustainability: { kmSaved: number; co2SavedKg: number; timeSavedMinutes: number };
}> {
  const res = await authFetch(`${BASE_URL}/api/smart/pickup-points`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ deliveries }),
  });
  if (!res.ok) throw new Error("Failed to optimize pickup points");
  return res.json();
}

export async function fetchProactiveAlert(
  deliveries: Delivery[],
  trafficZones: TrafficZone[]
): Promise<{ alerts: any[]; count: number }> {
  const res = await authFetch(`${BASE_URL}/api/smart/proactive-alert`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ deliveries, trafficZones }),
  });
  if (!res.ok) throw new Error("Failed to get proactive alert");
  return res.json();
}

export async function fetchRouteAlternatives({
  delivery,
  trafficZones = [],
  baseDistanceKm,
  baseDurationMinutes,
}: {
  delivery: Delivery;
  trafficZones?: TrafficZone[];
  baseDistanceKm?: number;
  baseDurationMinutes?: number;
}): Promise<{
  originalRoute: { path: string[]; durationMins: number; risk: string };
  alternatives: RouteAlternative[];
}> {
  const res = await authFetch(`${BASE_URL}/api/smart/route-alternatives`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      delivery,
      trafficZones,
      baseDistanceKm,
      baseDurationMinutes,
    }),
  });
  if (!res.ok) throw new Error("Failed to fetch route alternatives");
  return res.json();
}

export async function applyPickupHub(
  hub: PickupHub
): Promise<{ success: boolean; updatedCount: number }> {
  const res = await authFetch(`${BASE_URL}/api/smart/apply-hub`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ hub }),
  });
  if (!res.ok) throw new Error("Failed to apply pickup hub");
  return res.json();
}

export async function saveFcmToken(
  userId: string,
  token: string
): Promise<{ success: boolean }> {
  const res = await authFetch(`${BASE_URL}/api/users/fcm-token`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ userId, token }),
  });
  if (!res.ok) throw new Error("Failed to save FCM token");
  return res.json();
}

export async function fetchWeather(): Promise<Weather> {
  const res = await authFetch(`${BASE_URL}/api/smart/weather`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch weather");
  return res.json();
}

export async function sendAIChat(
  message: string,
  courierId: string
): Promise<{ reply: string }> {
  const res = await authFetch(`${BASE_URL}/api/smart/ai-chat`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ message, courierId }),
  });
  if (!res.ok) throw new Error("Failed to send AI chat");
  return res.json();
}

export async function updateWeather(
  condition: WeatherCondition,
  temp = 31
): Promise<{ success: boolean; weather: Weather }> {
  const res = await authFetch(`${BASE_URL}/api/smart/weather`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ condition, temp }),
  });
  if (!res.ok) throw new Error("Failed to update weather");
  return res.json();
}

export async function fetchAnalytics(): Promise<any> {
  const res = await authFetch(`${BASE_URL}/api/analytics`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

export async function fetchAgentStatus(): Promise<any> {
  const res = await authFetch(`${BASE_URL}/api/agent/status`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch agent status");
  return res.json();
}

export async function startAgentAPI(): Promise<{ success: boolean; message: string }> {
  const res = await authFetch(`${BASE_URL}/api/agent/start`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to start agent");
  return res.json();
}

export async function stopAgentAPI(): Promise<{ success: boolean; message: string }> {
  const res = await authFetch(`${BASE_URL}/api/agent/stop`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to stop agent");
  return res.json();
}
