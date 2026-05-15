/**
 * NusaRoute AI — API Service
 * Handles all communication with the backend Express server.
 */

const BASE_URL = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? "http://localhost:3000" : "");
const API_KEY = import.meta.env.VITE_API_KEY || "nusaroute-dev-secret-key";

/**
 * Standard headers with API Key
 */
const getHeaders = (extra = {}) => ({
  "Content-Type": "application/json",
  "X-API-Key": API_KEY,
  ...extra,
});

/**
 * Login user via backend.
 */
export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data;
}

/**
 * Analyze an incident by sending photo + audio to the AI backend.
 */
export async function analyzeIncident({
  photoFile,
  audioBlob,
  courierId,
  location = "Unknown",
}) {
  const formData = new FormData();

  if (photoFile) formData.append("photo", photoFile);
  if (audioBlob) formData.append("audio", audioBlob, "audio-report.webm");
  formData.append("courierId", courierId);
  formData.append("location", location);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${BASE_URL}/api/analyze-incident`, {
      method: "POST",
      headers: { "X-API-Key": API_KEY }, // Multipart doesn't need Content-Type header manually
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Server error: ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch all deliveries for the current courier.
 */
export async function fetchDeliveries(courierId) {
  const res = await fetch(`${BASE_URL}/api/deliveries?courierId=${courierId}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch deliveries");
  return res.json();
}

/**
 * Fetch ALL deliveries across all couriers.
 */
export async function fetchAllDeliveries() {
  const res = await fetch(`${BASE_URL}/api/deliveries/all`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch all deliveries");
  return res.json();
}

/**
 * Add a new delivery package.
 */
export async function addDelivery(deliveryData) {
  const res = await fetch(`${BASE_URL}/api/deliveries`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(deliveryData),
  });
  if (!res.ok) throw new Error("Failed to create delivery");
  return res.json();
}

/**
 * Auto-assign unassigned deliveries to couriers based on proximity.
 */
export async function autoAssignDeliveries() {
  const res = await fetch(`${BASE_URL}/api/deliveries/auto-assign`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to auto-assign deliveries");
  return res.json();
}

/**
 * Update delivery status.
 */
export async function updateDeliveryStatus(deliveryId, updates) {
  const res = await fetch(`${BASE_URL}/api/deliveries/${deliveryId}/status`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to update delivery");
  return data;
}

/**
 * Ask Gemini AI to optimize the delivery route order.
 */
export async function optimizeRoute(deliveries) {
  const res = await fetch(`${BASE_URL}/api/deliveries/optimize`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ deliveries }),
  });
  if (!res.ok) throw new Error("Failed to optimize route");
  return res.json();
}

/**
 * Fetch all incident reports.
 */
export async function fetchIncidents() {
  const res = await fetch(`${BASE_URL}/api/incidents`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch incidents");
  return res.json();
}

/**
 * Health check.
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Smart City Agentic AI ───────────────────────────────────────────────────

/**
 * Fetch traffic predictions for 10 Surabaya zones.
 */
export async function fetchTrafficPrediction() {
  const res = await fetch(`${BASE_URL}/api/smart/traffic`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch traffic prediction");
  return res.json();
}

/**
 * Get AI-optimized pickup hub recommendations.
 */
export async function fetchPickupPoints(deliveries) {
  const res = await fetch(`${BASE_URL}/api/smart/pickup-points`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ deliveries }),
  });
  if (!res.ok) throw new Error("Failed to optimize pickup points");
  return res.json();
}

/**
 * Check if the active route is affected by congestion zones.
 */
export async function fetchProactiveAlert(deliveries, trafficZones) {
  const res = await fetch(`${BASE_URL}/api/smart/proactive-alert`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ deliveries, trafficZones }),
  });
  if (!res.ok) throw new Error("Failed to get proactive alert");
  return res.json();
}

/**
 * Get AI-generated alternative routes.
 */
export async function fetchRouteAlternatives({
  delivery,
  trafficZones = [],
  baseDistanceKm,
  baseDurationMinutes,
}) {
  const res = await fetch(`${BASE_URL}/api/smart/route-alternatives`, {
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

/**
 * Apply an AI-suggested pickup hub.
 */
export async function applyPickupHub(hub) {
  const res = await fetch(`${BASE_URL}/api/smart/apply-hub`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ hub }),
  });
  if (!res.ok) throw new Error("Failed to apply pickup hub");
  return res.json();
}

/**
 * Save the Courier's FCM Token.
 */
export async function saveFcmToken(userId, token) {
  const res = await fetch(`${BASE_URL}/api/users/fcm-token`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ userId, token }),
  });
  if (!res.ok) throw new Error("Failed to save FCM token");
  return res.json();
}

/**
 * Fetch current weather simulation state.
 */
export async function fetchWeather() {
  const res = await fetch(`${BASE_URL}/api/smart/weather`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch weather");
  return res.json();
}

/**
 * Send a message to the AI Chat Assistant.
 */
export async function sendAIChat(message, courierId) {
  const res = await fetch(`${BASE_URL}/api/smart/ai-chat`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ message, courierId }),
  });
  if (!res.ok) throw new Error("Failed to send AI chat");
  return res.json();
}

/**
 * Update weather simulation state.
 */
export async function updateWeather(condition, temp = 31) {
  const res = await fetch(`${BASE_URL}/api/smart/weather`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ condition, temp }),
  });
  if (!res.ok) throw new Error("Failed to update weather");
  return res.json();
}

// ─── Autonomous Agent & Analytics ─────────────────────────────────────────────

/**
 * Fetch analytics dashboard data.
 */
export async function fetchAnalytics() {
  const res = await fetch(`${BASE_URL}/api/analytics`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

/**
 * Fetch autonomous agent status.
 */
export async function fetchAgentStatus() {
  const res = await fetch(`${BASE_URL}/api/agent/status`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch agent status");
  return res.json();
}

/**
 * Start the autonomous agent.
 */
export async function startAgentAPI() {
  const res = await fetch(`${BASE_URL}/api/agent/start`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to start agent");
  return res.json();
}

/**
 * Stop the autonomous agent.
 */
export async function stopAgentAPI() {
  const res = await fetch(`${BASE_URL}/api/agent/stop`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to stop agent");
  return res.json();
}
