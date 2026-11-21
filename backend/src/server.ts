import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import crypto from "crypto";
import multer from "multer";
import { APP_CONFIG } from "./config/app-config.js";
import {
  processIncidentReport,
  optimizeDeliveryRoute,
  chatWithAssistant,
} from "./services/ai-agent.js";
import {
  predictTrafficConditions,
  optimizePickupPoints,
  proactiveReroute,
  generateRouteAlternatives,
  getLiveWeather,
  updateWeather,
  haversineKm,
  solveNearestNeighborTSP,
  invalidateTrafficCache,
} from "./services/traffic-agent.js";
import {
  saveIncidentReport,
  getDeliveries,
  getAllDeliveries,
  getDeliveryById,
  updateDeliveryStatus,
  getAllReports,
  loginUser,
  loginWithGoogleIdToken,
  listUsers,
  registerUser,
  getTrafficZones,
  upsertTrafficZone,
  deleteTrafficZone,
  isFirestoreReady,
  isFirebaseAuthReady,
  addDelivery,
  applyPickupHubToDeliveries,
  saveUserFcmToken,
  resetDatabase,
} from "./services/firebase-admin.js";
import {
  startAgent,
  stopAgent,
  getAgentStatus,
  getAnalytics,
  recordDeliveryCompletion,
  runAgentTickOnce,
} from "./services/autonomous-agent.js";
import { signAuthToken, verifyAuthToken } from "./services/auth-token.js";
import type { Delivery, WeatherCondition } from "./types/index.js";

type AuthRole = "courier" | "dispatcher" | "system";
interface AuthenticatedUser {
  sub: string;
  email: string;
  name: string;
  role: AuthRole;
}
interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}

const app = express();
app.disable("x-powered-by");
// Trust the first reverse-proxy hop (Google Cloud Run / Firebase Hosting) so req.ip reflects real client IP
app.set("trust proxy", 1);

const PORT = APP_CONFIG.port;
const allowedOrigins = APP_CONFIG.corsOrigins;
const DELIVERY_MARK_RADIUS_KM = APP_CONFIG.deliveryMarkRadiusKm;

// Security headers middleware (OWASP baseline)
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(self), microphone=(self), camera=(self)");
  if (APP_CONFIG.nodeEnv === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Allow Firebase Hosting domains (including project subdomains like nusarouteai-1f67f.web.app) and custom domains
      try {
        const url = new URL(origin);
        if (
          url.hostname.endsWith(".web.app") ||
          url.hostname.endsWith(".firebaseapp.com") ||
          (process.env.CUSTOM_DOMAIN && url.hostname.endsWith(process.env.CUSTOM_DOMAIN.toLowerCase()))
        ) {
          return callback(null, true);
        }
      } catch {
        // Invalid origin format
      }
      if (APP_CONFIG.nodeEnv !== "production") {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

// Telemetry & Observability: In-memory live performance metrics
const serverMetrics = {
  startTime: new Date().toISOString(),
  totalRequests: 0,
  status2xx: 0,
  status4xx: 0,
  status5xx: 0,
  activeConnections: 0,
  lastRequestAt: null as string | null,
};

// Structured Logging Middleware (Compatible with Google Cloud Logging / Logs Explorer)
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  serverMetrics.totalRequests++;
  serverMetrics.activeConnections++;
  serverMetrics.lastRequestAt = new Date().toISOString();

  res.on("finish", () => {
    serverMetrics.activeConnections = Math.max(0, serverMetrics.activeConnections - 1);
    const durationMs = Date.now() - startTime;
    const latencySec = (durationMs / 1000).toFixed(3);
    const status = res.statusCode;

    if (status >= 500) serverMetrics.status5xx++;
    else if (status >= 400) serverMetrics.status4xx++;
    else if (status >= 200) serverMetrics.status2xx++;

    // Format structured JSON log for Google Cloud Logging in production or Cloud Run
    if (process.env.K_SERVICE || APP_CONFIG.nodeEnv === "production") {
      const severity = status >= 500 ? "ERROR" : status >= 400 ? "WARNING" : "INFO";
      console.log(
        JSON.stringify({
          severity,
          message: `${req.method} ${req.originalUrl || req.url} ${status} ${durationMs}ms`,
          httpRequest: {
            requestMethod: req.method,
            requestUrl: req.originalUrl || req.url,
            status,
            userAgent: req.headers["user-agent"] || "",
            remoteIp: req.ip || "",
            latency: `${latencySec}s`,
          },
          time: new Date().toISOString(),
          service: "nusaroute-api",
          durationMs,
        })
      );
    }
  });

  next();
});

const rateLimitMap = new Map<string, { count: number; startTime: number }>();
const RATE_LIMIT_WINDOW = APP_CONFIG.rateLimit.windowMs;
const MAX_REQUESTS = APP_CONFIG.rateLimit.maxRequests;
const AI_MAX_REQUESTS = APP_CONFIG.rateLimit.aiMaxRequests;

// Periodic pruning prevents unbounded memory growth on long-running Cloud Run containers
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.startTime > RATE_LIMIT_WINDOW * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW * 2).unref();

function rateLimiter(limit = MAX_REQUESTS) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const userLimit = rateLimitMap.get(ip) || { count: 0, startTime: now };

    if (now - userLimit.startTime > RATE_LIMIT_WINDOW) {
      userLimit.count = 1;
      userLimit.startTime = now;
    } else {
      userLimit.count++;
    }

    rateLimitMap.set(ip, userLimit);

    if (userLimit.count > limit) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    next();
  };
}

function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const API_KEY = APP_CONFIG.apiKey;
function authGuard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.path === "/api/health" || req.path === "/api/monitoring" || req.path === "/api/login" || req.path === "/api/login/google") return next();

  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const payload = verifyAuthToken(token);
    if (payload) {
      req.authUser = {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      };
      return next();
    }
    return res.status(401).json({ error: "Unauthorized: Invalid or expired Bearer token" });
  }

  const clientKey = typeof req.headers["x-api-key"] === "string" ? req.headers["x-api-key"] : "";
  if (clientKey && timingSafeEquals(clientKey, API_KEY)) {
    req.authUser = {
      sub: "system",
      email: "system@nusaroute.ai",
      name: "System Service",
      role: "system",
    };
    return next();
  }

  return res.status(401).json({ error: "Unauthorized: Valid Bearer JWT or API Key required" });
}

function requireRole(...allowedRoles: AuthRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser || !allowedRoles.includes(req.authUser.role)) {
      return res.status(403).json({
        error: `Forbidden: Role '${req.authUser?.role ?? "anonymous"}' tidak diizinkan mengakses endpoint ini.`,
      });
    }
    next();
  };
}

app.use(authGuard);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: APP_CONFIG.upload.maxFileSizeBytes },
  fileFilter: (_req, file, cb) => {
    const allowed = APP_CONFIG.upload.allowedMimePrefixes.some((prefix) =>
      file.mimetype.startsWith(prefix)
    );
    if (!allowed) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}. Only image/* and audio/* allowed.`));
    }
    cb(null, true);
  },
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    firestore: isFirestoreReady ? "connected" : "memory_mode",
    ai: APP_CONFIG.useMockAi ? "mock" : "gemini",
    mode: APP_CONFIG.useMockAi ? "simulation" : "live",
    model: APP_CONFIG.geminiModel,
    operationCity: APP_CONFIG.operationCity,
    defaultOrigin: APP_CONFIG.defaultOrigin,
    geofenceRadiusMeters: Math.round(DELIVERY_MARK_RADIUS_KM * 1000),
    hubClusterRadiusKm: APP_CONFIG.hubClusterRadiusKm,
    authProviders: {
      password: true,
      google: isFirebaseAuthReady,
    },
  });
});

app.get("/api/monitoring", (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  const uptimeSec = Math.round(process.uptime());
  const hours = Math.floor(uptimeSec / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  const seconds = uptimeSec % 60;

  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: uptimeSec,
      formatted: `${hours}h ${minutes}m ${seconds}s`,
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: {
        rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        externalMb: Math.round((mem.external / 1024 / 1024) * 100) / 100,
      },
    },
    cloudRun: {
      service: process.env.K_SERVICE || "local-development",
      revision: process.env.K_REVISION || "none",
      configuration: process.env.K_CONFIGURATION || "none",
      region: process.env.CLOUD_RUN_REGION || "asia-southeast2",
    },
    ai: {
      provider: "Google Gemini (Generative Language API)",
      primaryModel: APP_CONFIG.geminiModel,
      mode: APP_CONFIG.useMockAi ? "simulation" : "live",
      failoverCandidates: ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-lite-latest", "gemini-3-flash-preview"],
      isMockAi: APP_CONFIG.useMockAi,
    },
    firestore: {
      status: isFirestoreReady ? "connected" : "memory_mode",
      projectId: APP_CONFIG.firebase.projectId,
    },
    metrics: {
      ...serverMetrics,
      successRatePercent:
        serverMetrics.totalRequests > 0
          ? Math.round((serverMetrics.status2xx / serverMetrics.totalRequests) * 1000) / 10
          : 100,
    },
  });
});

app.post("/api/login", rateLimiter(20), async (req: Request, res: Response) => {
  try {
    const { identifier, username, email, password } = req.body as {
      identifier?: string;
      username?: string;
      email?: string;
      password?: string;
    };
    const loginId = (identifier || username || email || "").trim();
    if (!loginId || !password) {
      return res.status(400).json({ success: false, error: "Username/email dan kata sandi wajib diisi." });
    }
    const result = await loginUser(loginId, password);
    if (!result.success || !result.user) {
      return res.status(401).json(result);
    }
    const token = signAuthToken(result.user);
    res.json({ ...result, token });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/login/google", rateLimiter(20), async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({ success: false, error: "Google ID token wajib disertakan." });
    }
    const result = await loginWithGoogleIdToken(idToken);
    if (!result.success || !result.user) {
      return res.status(result.statusCode || 401).json({
        success: false,
        error: result.error || "Autentikasi Google gagal.",
      });
    }
    const token = signAuthToken(result.user);
    res.json({ success: true, user: result.user, token });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post(
  "/api/analyze-incident",
  rateLimiter(AI_MAX_REQUESTS),
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const photoFile = files?.photo?.[0];
      const audioFile = files?.audio?.[0];
      const requestedCourierId = req.body.courierId || "unknown";
      const courierId =
        req.authUser?.role === "courier" ? req.authUser.sub : requestedCourierId;
      const { location = "Unknown Location" } = req.body;

      if (!photoFile && !audioFile) {
        return res.status(400).json({
          success: false,
          error: "At least one file (photo or audio) is required.",
        });
      }

      const aiDecision = await processIncidentReport(
        photoFile?.buffer ?? null,
        audioFile?.buffer ?? null,
        photoFile?.mimetype ?? "image/jpeg",
        audioFile?.mimetype ?? "audio/webm"
      );

      const savedReport = await saveIncidentReport({
        courierId,
        location,
        hasPhoto: !!photoFile,
        hasAudio: !!audioFile,
        aiDecision,
      });

      res.json({
        success: true,
        reportId: savedReport.id,
        aiDecision,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: "Internal server error during AI analysis.",
        detail: err.message,
      });
    }
  }
);

app.post("/api/deliveries/optimize", async (req: Request, res: Response) => {
  try {
    const { deliveries } = req.body;
    if (!Array.isArray(deliveries) || deliveries.length === 0) {
      return res.status(400).json({ success: false, error: "deliveries array is required." });
    }
    const result = await optimizeDeliveryRoute(deliveries);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/deliveries/all", requireRole("dispatcher", "system"), async (_req: Request, res: Response) => {
  try {
    const deliveries = await getAllDeliveries();
    res.json(deliveries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/deliveries", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requestedCourierId = typeof req.query.courierId === "string" ? req.query.courierId : "";
    if (req.authUser?.role === "courier") {
      if (requestedCourierId && requestedCourierId !== req.authUser.sub) {
        return res.status(403).json({ error: "Forbidden: Kurir hanya dapat mengakses paket miliknya sendiri." });
      }
      const deliveries = await getDeliveries(req.authUser.sub);
      return res.json(deliveries);
    }
    if (!requestedCourierId) {
      return res.status(400).json({ error: "courierId query parameter is required." });
    }
    const deliveries = await getDeliveries(requestedCourierId);
    res.json(deliveries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/deliveries", requireRole("dispatcher", "system"), async (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (!data.recipient || !data.address) {
      return res.status(400).json({ error: "recipient and address are required" });
    }
    if (typeof data.recipient !== "string" || data.recipient.length > 200 || typeof data.address !== "string" || data.address.length > 500) {
      return res.status(400).json({ error: "recipient or address exceeds allowed length" });
    }
    if (data.lat !== undefined && (typeof data.lat !== "number" || !Number.isFinite(data.lat) || data.lat < -90 || data.lat > 90)) {
      return res.status(400).json({ error: "lat must be a valid number between -90 and 90" });
    }
    if (data.lng !== undefined && (typeof data.lng !== "number" || !Number.isFinite(data.lng) || data.lng < -180 || data.lng > 180)) {
      return res.status(400).json({ error: "lng must be a valid number between -180 and 180" });
    }
    const created = await addDelivery(data);
    res.status(201).json({ success: true, delivery: created });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/deliveries/reset", requireRole("dispatcher", "system"), async (_req: Request, res: Response) => {
  try {
    const stats = await resetDatabase();
    res.json({
      success: true,
      message: "Database berhasil di-reset ke kondisi awal demo.",
      stats,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/deliveries/auto-assign", requireRole("dispatcher", "system"), async (req: Request, res: Response) => {
  try {
    const { deliveries: targetDeliveries } = req.body;
    const allDeliveries: Delivery[] = targetDeliveries || (await getAllDeliveries());
    const unassigned = allDeliveries.filter((d: Delivery) => d.status === "unassigned" || !d.courierId);

    if (unassigned.length === 0) {
      return res.json({ success: true, message: "Semua paket sudah terdelegasi.", assignedCount: 0 });
    }

    // Dynamically load active couriers from Firestore/DB (zero hardcoded courier IDs or hubs)
    const activeCouriers = (await listUsers()).filter((u) => u.role === "courier");
    if (activeCouriers.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Belum ada akun kurir terdaftar di database. Tambahkan kurir terlebih dahulu via POST /api/users atau npm run user:add.",
      });
    }

    // Track current active load & spatial anchor per courier dynamically
    const courierLoad = new Map<string, number>();
    const courierAnchors = new Map<string, { lat: number; lng: number }>();

    for (const c of activeCouriers) {
      const assignedToCourier = allDeliveries.filter(
        (d) => d.courierId === c.id && d.status !== "delivered"
      );
      courierLoad.set(c.id, assignedToCourier.length);

      if (typeof c.hubLat === "number" && typeof c.hubLng === "number") {
        courierAnchors.set(c.id, { lat: c.hubLat, lng: c.hubLng });
      } else if (assignedToCourier.length > 0) {
        const avgLat =
          assignedToCourier.reduce((sum, d) => sum + (d.lat ?? APP_CONFIG.defaultOrigin.lat), 0) /
          assignedToCourier.length;
        const avgLng =
          assignedToCourier.reduce((sum, d) => sum + (d.lng ?? APP_CONFIG.defaultOrigin.lng), 0) /
          assignedToCourier.length;
        courierAnchors.set(c.id, { lat: avgLat, lng: avgLng });
      } else {
        courierAnchors.set(c.id, APP_CONFIG.defaultOrigin);
      }
    }

    const formatLocalTimeWindow = (): string => {
      const now = new Date();
      const fmt = new Intl.DateTimeFormat("id-ID", {
        timeZone: APP_CONFIG.weatherCoordinates.timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const start = fmt.format(new Date(now.getTime() + 30 * 60 * 1000)).replace(".", ":");
      const end = fmt.format(new Date(now.getTime() + 150 * 60 * 1000)).replace(".", ":");
      return `${start} - ${end}`;
    };

    const LOAD_PENALTY_KM = 0.75; // balances distance vs fair workload distribution
    let assignedCount = 0;

    for (const delivery of unassigned) {
      if (delivery.lat == null || delivery.lng == null) continue;

      let bestCourierId = activeCouriers[0].id;
      let bestScore = Infinity;

      for (const c of activeCouriers) {
        const anchor = courierAnchors.get(c.id) || APP_CONFIG.defaultOrigin;
        const distKm = haversineKm(delivery.lat, delivery.lng, anchor.lat, anchor.lng) ?? 10;
        const load = courierLoad.get(c.id) || 0;
        const score = distKm + load * LOAD_PENALTY_KM;
        if (score < bestScore) {
          bestScore = score;
          bestCourierId = c.id;
        }
      }

      await updateDeliveryStatus(delivery.id, "pending", {
        courierId: bestCourierId,
        estimatedArrival: delivery.timeSlot || formatLocalTimeWindow(),
      });
      courierLoad.set(bestCourierId, (courierLoad.get(bestCourierId) || 0) + 1);
      assignedCount++;
    }

    res.json({
      success: true,
      message: `Berhasil mendelegasikan ${assignedCount} paket ke ${activeCouriers.length} kurir aktif secara dinamis.`,
      assignedCount,
      activeCourierCount: activeCouriers.length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch("/api/deliveries/:id/status", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status, courierLocation, bypassGeofence, deliveryNote, wasOnTime } = req.body;

    const allowed = ["unassigned", "pending", "in_transit", "delivered", "rerouted"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(", ")}` });
    }

    const current = await getDeliveryById(id);
    if (!current) {
      return res.status(404).json({ error: `Delivery ${id} not found.` });
    }

    if (req.authUser?.role === "courier" && current.courierId && current.courierId !== req.authUser.sub) {
      return res.status(403).json({ error: "Forbidden: Anda tidak memiliki akses ke paket kurir lain." });
    }

    const canBypassGeofence =
      Boolean(bypassGeofence) && (req.authUser?.role === "dispatcher" || req.authUser?.role === "system");

    if (status === "delivered") {
      if (!canBypassGeofence && current.lat != null && current.lng != null) {
        if (!courierLocation || courierLocation.lat == null || courierLocation.lng == null) {
          return res.status(400).json({
            error: "Posisi kurir diperlukan untuk verifikasi lokasi.",
            code: "LOCATION_REQUIRED",
          });
        }

        const distKm = haversineKm(
          courierLocation.lat,
          courierLocation.lng,
          current.lat,
          current.lng
        );

        if (distKm != null && distKm > DELIVERY_MARK_RADIUS_KM) {
          return res.status(400).json({
            error: `Kurir berada ${Math.round(distKm * 1000)}m dari tujuan. Maksimal radius: ${DELIVERY_MARK_RADIUS_KM * 1000}m.`,
            code: "GEOFENCE_FAILED",
            distanceMeters: Math.round(distKm * 1000),
          });
        }
      }

      recordDeliveryCompletion(current, wasOnTime !== false);
    }

    const updated = await updateDeliveryStatus(id, status, {
      ...(deliveryNote ? { deliveryNote } : {}),
      ...(status === "delivered" ? { deliveredAt: new Date().toISOString() } : {}),
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/incidents", requireRole("dispatcher", "system"), async (_req: Request, res: Response) => {
  try {
    const reports = await getAllReports();
    res.json(reports);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/smart/zones", async (_req: Request, res: Response) => {
  try {
    const zones = await getTrafficZones();
    res.json({ success: true, zones });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: errMsg });
  }
});

app.post("/api/smart/zones", requireRole("dispatcher", "system"), async (req: Request, res: Response) => {
  try {
    const { id, name, lat, lng, radius = 1.5, area, peakHours, floodProne } = req.body;
    if (!name || typeof lat !== "number" || typeof lng !== "number" || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, error: "name, lat (-90..90), dan lng (-180..180) wajib valid." });
    }
    const saved = await upsertTrafficZone({ id, name, lat, lng, radius: Number(radius), area, peakHours, floodProne });
    invalidateTrafficCache();
    res.status(201).json({ success: true, zone: saved });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: errMsg });
  }
});

app.delete("/api/smart/zones/:id", requireRole("dispatcher", "system"), async (req: Request, res: Response) => {
  try {
    const zoneId = req.params.id as string;
    await deleteTrafficZone(zoneId);
    invalidateTrafficCache();
    res.json({ success: true, deletedId: zoneId });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: errMsg });
  }
});

app.get("/api/smart/traffic", async (_req: Request, res: Response) => {
  try {
    const traffic = await predictTrafficConditions();
    res.json(traffic);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/smart/pickup-points", async (req: Request, res: Response) => {
  try {
    const { deliveries } = req.body;
    if (!Array.isArray(deliveries)) {
      return res.status(400).json({ error: "deliveries array is required" });
    }
    const result = await optimizePickupPoints(deliveries);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/smart/proactive-alert", async (req: Request, res: Response) => {
  try {
    const { deliveries, trafficZones } = req.body;
    if (!Array.isArray(deliveries) || !Array.isArray(trafficZones)) {
      return res.status(400).json({ error: "deliveries and trafficZones arrays are required" });
    }
    const alerts = proactiveReroute(deliveries, trafficZones);
    res.json({ alerts, count: alerts.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/smart/route-alternatives", async (req: Request, res: Response) => {
  try {
      const { delivery, threatZone, trafficZones, baseDistanceKm, baseDurationMinutes } = req.body;
      if (!delivery) {
        return res.status(400).json({ error: "delivery object is required" });
      }
      const alternatives = await generateRouteAlternatives(delivery, threatZone ?? null, {
        trafficZones: Array.isArray(trafficZones) ? trafficZones : undefined,
        baseDistanceKm: typeof baseDistanceKm === "number" ? baseDistanceKm : null,
        baseDurationMinutes: typeof baseDurationMinutes === "number" ? baseDurationMinutes : null,
      });
      res.json(alternatives);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errMsg });
    }
  });

app.get("/api/smart/weather", async (_req: Request, res: Response) => {
  try {
    const weather = await getLiveWeather();
    res.json(weather);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/smart/weather", requireRole("dispatcher", "system"), (req: Request, res: Response) => {
  try {
    const { condition, temp } = req.body;
    const allowed: WeatherCondition[] = ["sunny", "cloudy", "rain", "heavy_rain"];
    if (!allowed.includes(condition)) {
      return res.status(400).json({ error: `Condition must be: ${allowed.join(", ")}` });
    }
    const updated = updateWeather(condition, temp);
    res.json({ success: true, weather: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/smart/apply-hub", requireRole("dispatcher", "system"), async (req: Request, res: Response) => {
  try {
    const { hub } = req.body;
    if (!hub || !Array.isArray(hub.deliveryIds)) {
      return res.status(400).json({ success: false, error: "Valid hub object required" });
    }
    const result = await applyPickupHubToDeliveries(hub);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/smart/ai-chat", rateLimiter(30), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message, courierId: requestedCourierId = "unknown" } = req.body as {
      message?: string;
      courierId?: string;
    };
    const courierId =
      req.authUser?.role === "courier" ? req.authUser.sub : requestedCourierId;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }

    let deliveries: Delivery[] = [];
    if (courierId && courierId !== "unknown") {
      deliveries = await getDeliveries(courierId);
    }
    if (deliveries.length === 0) {
      deliveries = await getAllDeliveries();
    }

    const traffic = await predictTrafficConditions();
    const weather = await getLiveWeather();

    const result = await chatWithAssistant(message.trim(), {
      courierId,
      deliveries,
      trafficZones: traffic.zones,
      weather,
    });

    res.json(result);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errMsg });
  }
});

app.get("/api/users", requireRole("dispatcher", "system"), async (_req: Request, res: Response) => {
  try {
    const users = await listUsers();
    res.json({ success: true, users });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: errMsg });
  }
});

app.post("/api/users", requireRole("dispatcher", "system"), async (req: Request, res: Response) => {
  try {
    const { email, name, role = "courier", username, region, hubLat, hubLng, password } = req.body as {
      email?: string;
      name?: string;
      role?: "courier" | "dispatcher";
      username?: string;
      region?: string;
      hubLat?: number;
      hubLng?: number;
      password?: string;
    };
    if (!email || !name) {
      return res.status(400).json({ success: false, error: "email dan name wajib diisi." });
    }
    if (role !== "courier" && role !== "dispatcher") {
      return res.status(400).json({ success: false, error: "role harus 'courier' atau 'dispatcher'." });
    }
    const result = await registerUser({ email, name, role, username, region, hubLat, hubLng, password });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ success: false, error: result.error });
    }
    res.status(201).json({ success: true, user: result.user });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: errMsg });
  }
});

app.post("/api/users/fcm-token", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, token } = req.body as { userId?: string; token?: string };
    if (!userId || !token) {
      return res.status(400).json({ success: false, error: "userId and token are required" });
    }
    if (req.authUser?.role === "courier" && userId !== req.authUser.sub) {
      return res.status(403).json({ success: false, error: "Forbidden: Tidak dapat menyimpan token FCM untuk pengguna lain." });
    }
    const result = await saveUserFcmToken(userId, token);
    res.json(result);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: errMsg });
  }
});

app.get("/api/agent/status", (_req: Request, res: Response) => {
  res.json({ success: true, ...getAgentStatus() });
});

app.post("/api/agent/start", requireRole("dispatcher", "system"), (_req: Request, res: Response) => {
  startAgent();
  res.json({ success: true, message: "Autonomous agent started." });
});

app.post("/api/agent/stop", requireRole("dispatcher", "system"), (_req: Request, res: Response) => {
  stopAgent();
  res.json({ success: true, message: "Autonomous agent stopped." });
});

app.post("/api/agent/tick", requireRole("dispatcher", "system"), async (_req: Request, res: Response) => {
  try {
    const result = await runAgentTickOnce();
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: errMsg });
  }
});

app.get("/api/analytics", requireRole("dispatcher", "system"), (_req: Request, res: Response) => {
  res.json({ success: true, ...getAnalytics() });
});

app.post("/api/deliveries/tsp-benchmark", requireRole("dispatcher", "system"), async (req: Request, res: Response) => {
  try {
    const origin = req.body.origin || APP_CONFIG.defaultOrigin;
    const deliveries = (await getAllDeliveries()) || [];
    const benchmark = solveNearestNeighborTSP(origin, deliveries);
    res.json({ success: true, benchmark });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Express 5 centralized JSON 404 fallback
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Express 5 centralized 4-arity error middleware (catches sync/async throws & Multer errors)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = Number(err?.status || err?.statusCode) || (err?.message?.includes("Unsupported file type") ? 400 : 500);
  if (status >= 500) {
    console.error("[Express Error]:", err?.stack || err?.message || err);
  }
  let message = err?.message || "Terjadi kesalahan internal pada server.";
  if (message.includes("signal is aborted") || message.includes("aborted")) {
    message = "Waktu analisis AI melebihi batas toleransi. Silakan coba kirim ulang laporan Anda.";
  } else if (message.includes("RESOURCE_EXHAUSTED") || message.includes("429")) {
    message = "Layanan AI sedang melayani beban tinggi. Sistem secara otomatis beralih ke model cadangan.";
  }
  res.status(status).json({
    error: APP_CONFIG.nodeEnv === "production" && status >= 500 ? "Terjadi kendala sementara pada sistem. Silakan muat ulang halaman." : message,
    message,
  });
});

// Production fail-fast guard: refuse to start in production with weak/default secrets
if (APP_CONFIG.nodeEnv === "production") {
  const weakJwt =
    !process.env.JWT_SECRET ||
    APP_CONFIG.jwtSecret.length < 24 ||
    APP_CONFIG.jwtSecret.includes("dev") ||
    APP_CONFIG.jwtSecret.includes("change_me");
  const weakApiKey =
    !process.env.API_KEY ||
    APP_CONFIG.apiKey.length < 16 ||
    APP_CONFIG.apiKey.includes("dev") ||
    APP_CONFIG.apiKey.includes("change_me");

  if (weakJwt || weakApiKey) {
    console.error(
      "[Fatal Security Error] NODE_ENV=production requires strong JWT_SECRET (>=24 chars) and API_KEY (>=16 chars) via Secret Manager / Cloud Run env."
    );
    process.exit(1);
  }
}

const server = app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] CORS allowed from: ${allowedOrigins.join(", ")}`);
  console.log(`[AI Mode] ${APP_CONFIG.useMockAi ? "SIMULATION (MOCK)" : `LIVE (${APP_CONFIG.geminiModel})`}`);
  console.log(`[Firestore] ${isFirestoreReady ? "Connected" : "Memory Mode"}`);
  console.log(`[Agent Loop] ${APP_CONFIG.enableInProcessAgentLoop ? "In-Process Timer" : "External Trigger Only (POST /api/agent/tick)"}`);
  startAgent();
});

const gracefulShutdown = (signal: string) => {
  console.log(`[Server] ${signal} received. Closing autonomous daemon and HTTP server...`);
  stopAgent();
  server.close(() => {
    console.log("[Server] HTTP server closed gracefully. Exiting process.");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("[Server] Forceful shutdown after 10s timeout.");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;
