import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __configDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__configDir, "../../.env") });
dotenv.config();

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCoordinate(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const APP_CONFIG = {
  // Server & Security
  port: parseNumber(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  apiKey: process.env.API_KEY || "nusaroute-dev-secret-key",
  jwtSecret: process.env.JWT_SECRET || process.env.API_KEY || "nusaroute-dev-jwt-secret-change-in-prod",
  jwtTtlSeconds: parseNumber(process.env.JWT_TTL_SECONDS, 12 * 60 * 60),

  // Production lifecycle toggles
  enableAutoSeed:
    process.env.ENABLE_AUTO_SEED !== undefined
      ? process.env.ENABLE_AUTO_SEED === "true"
      : (process.env.NODE_ENV || "development") !== "production",
  enableInProcessAgentLoop: process.env.ENABLE_AGENT_LOOP !== "false",
  googleAutoRegister: process.env.GOOGLE_AUTO_REGISTER === "true",
  dispatcherEmails: (process.env.DISPATCHER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),

  // Gemini AI
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  useMockAi: process.env.USE_MOCK_AI === "true",

  // Firebase Admin SDK
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
    privateKey: process.env.FIREBASE_PRIVATE_KEY || "",
  },

  // Seed & Operational Thresholds (overridable via env)
  demoDefaultPassword: process.env.DEMO_DEFAULT_PASSWORD || "nusaroute2026",
  deliveryMarkRadiusKm: parseNumber(process.env.DELIVERY_MARK_RADIUS_KM, 0.2),
  hubClusterRadiusKm: parseNumber(process.env.HUB_CLUSTER_RADIUS_KM, 1.5),
  agentTickIntervalMs: parseNumber(process.env.AGENT_TICK_INTERVAL_MS, 3 * 60 * 1000),
  rerouteCooldownMs: parseNumber(process.env.REROUTE_COOLDOWN_MS, 10 * 60 * 1000),
  hubReassessIntervalMs: parseNumber(process.env.HUB_REASSESS_INTERVAL_MS, 15 * 60 * 1000),
  trafficCacheTtlMs: parseNumber(process.env.TRAFFIC_CACHE_TTL_MS, 5 * 60 * 1000),
  weatherCacheTtlMs: parseNumber(process.env.WEATHER_CACHE_TTL_MS, 10 * 60 * 1000),

  // Spatial Reference Coordinates & Region (fully env-driven)
  operationCity: process.env.OPERATION_CITY || "Surabaya",
  defaultOrigin: {
    lat: parseCoordinate(process.env.DEFAULT_ORIGIN_LAT, -7.2652),
    lng: parseCoordinate(process.env.DEFAULT_ORIGIN_LNG, 112.7523),
  },
  weatherCoordinates: {
    lat: parseCoordinate(process.env.WEATHER_LAT || process.env.DEFAULT_ORIGIN_LAT, -7.2575),
    lng: parseCoordinate(process.env.WEATHER_LNG || process.env.DEFAULT_ORIGIN_LNG, 112.7521),
    timezone: process.env.WEATHER_TIMEZONE || "Asia/Jakarta",
  },

  // Rate Limiting & Upload Guardrails
  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: parseNumber(process.env.RATE_LIMIT_MAX, 120),
    aiMaxRequests: parseNumber(process.env.AI_RATE_LIMIT_MAX, 10),
  },
  upload: {
    maxFileSizeBytes: 10 * 1024 * 1024,
    allowedMimePrefixes: ["image/", "audio/"],
  },
} as const;
