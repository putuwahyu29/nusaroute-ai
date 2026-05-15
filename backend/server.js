/**
 * NusaRoute AI — Backend Server
 * Express.js API server for AI-powered incident analysis and delivery management.
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import {
  processIncidentReport,
  optimizeDeliveryRoute,
} from "./services/ai-agent.js";
import {
  predictTrafficConditions,
  optimizePickupPoints,
  proactiveReroute,
  generateRouteAlternatives,
  getWeather,
} from "./services/traffic-agent.js";
import {
  saveIncidentReport,
  getDeliveries,
  getAllDeliveries,
  getDeliveryById,
  updateDeliveryStatus,
  getAllReports,
  loginUser,
  isFirestoreReady,
  addDelivery,
} from "./services/firebase-admin.js";
import {
  startAgent,
  stopAgent,
  getAgentStatus,
  getAnalytics,
  recordDeliveryCompletion,
} from "./services/autonomous-agent.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

// Support multiple origins (comma-separated in env) + Firebase Hosting
const allowedOrigins = CORS_ORIGIN.split(",").map(s => s.trim());
const DELIVERY_MARK_RADIUS_KM = 0.2;

function haversineKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Firebase Rewrites, mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(null, true); // In production behind Firebase Rewrites, allow all
  },
  credentials: true,
}));
app.use(express.json());

// --- Simple In-memory Rate Limiter ---
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100; // 100 req per min
const AI_MAX_REQUESTS = 5; // 5 AI requests per min

function rateLimiter(limit = MAX_REQUESTS) {
  return (req, res, next) => {
    const ip = req.ip;
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
      return res
        .status(429)
        .json({ error: "Too many requests. Please try again later." });
    }
    next();
  };
}

// --- Simple API Key Auth ---
const API_KEY = process.env.API_KEY || "nusaroute-dev-secret-key";
function authGuard(req, res, next) {
  // Allow health check and login without key
  if (req.path === "/api/health" || req.path === "/api/login") return next();

  const clientKey = req.headers["x-api-key"];
  if (clientKey === API_KEY) return next();

  return res
    .status(401)
    .json({ error: "Unauthorized: Invalid or missing API Key" });
}

app.use(authGuard);

// Multer: store files in memory (no disk I/O, no Firebase Storage needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
});

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    project: "NusaRoute AI",
    services: {
      ai: process.env.USE_MOCK_AI === "true" ? "mock" : "gemini",
      firestore: isFirestoreReady ? "connected" : "memory-mode",
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /api/login ─────────────────────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);

    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/analyze-incident ──────────────────────────────────────────────
// Receives photo + audio from courier, runs Gemini AI analysis.
app.post(
  "/api/analyze-incident",
  rateLimiter(AI_MAX_REQUESTS), // Strict limit for AI calls
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const photoFile = req.files?.photo?.[0];
      const audioFile = req.files?.audio?.[0];
      const { courierId = "unknown", location = "Unknown Location" } =
        req.body;

      if (!photoFile && !audioFile) {
        return res.status(400).json({
          success: false,
          error: "At least one file (photo or audio) is required.",
        });
      }

      console.log(`\n📨 Incident report from courier: ${courierId}`);
      console.log(`   📍 Location: ${location}`);
      console.log(
        `   📷 Photo: ${photoFile ? `${(photoFile.size / 1024).toFixed(1)} KB (${photoFile.mimetype})` : "none"}`,
      );
      console.log(
        `   🎙️ Audio: ${audioFile ? `${(audioFile.size / 1024).toFixed(1)} KB (${audioFile.mimetype})` : "none"}`,
      );

      // Run AI analysis
      const aiDecision = await processIncidentReport(
        photoFile?.buffer ?? null,
        audioFile?.buffer ?? null,
        photoFile?.mimetype ?? "image/jpeg",
        audioFile?.mimetype ?? "audio/webm",
      );

      // Persist report
      const savedReport = await saveIncidentReport({
        courierId,
        location,
        hasPhoto: !!photoFile,
        hasAudio: !!audioFile,
        aiDecision,
      });

      console.log(
        `   ✅ AI Decision: ${aiDecision.action} (${aiDecision.incidentType})`,
      );

      res.json({
        success: true,
        reportId: savedReport.id,
        aiDecision,
      });
    } catch (err) {
      console.error("❌ /api/analyze-incident error:", err);
      res.status(500).json({
        success: false,
        error: "Internal server error during AI analysis.",
        detail: err.message,
      });
    }
  },
);

// ─── POST /api/deliveries/optimize (AI Route Optimizer) ─────────────────────
// Accepts a courier's delivery list and returns AI-optimized order.
app.post("/api/deliveries/optimize", async (req, res) => {
  try {
    const { deliveries } = req.body;
    if (!Array.isArray(deliveries) || deliveries.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "deliveries array is required." });
    }
    console.log(
      `\n🧠 Route optimization requested for ${deliveries.length} stops`,
    );
    const result = await optimizeDeliveryRoute(deliveries);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ /api/deliveries/optimize error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/deliveries/all (Dispatcher: all couriers) ──────────────────────
app.get("/api/deliveries/all", async (req, res) => {
  try {
    const deliveries = await getAllDeliveries();
    res.json({ success: true, deliveries });
  } catch (err) {
    console.error("❌ /api/deliveries/all error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/deliveries ─────────────────────────────────────────────────────
app.get("/api/deliveries", async (req, res) => {
  try {
    const { courierId } = req.query;
    if (!courierId) {
      return res.status(400).json({ success: false, error: "courierId query parameter is required" });
    }
    const deliveries = await getDeliveries(courierId);
    res.json({ success: true, deliveries });
  } catch (err) {
    console.error("❌ /api/deliveries error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/deliveries ────────────────────────────────────────────────────
app.post("/api/deliveries", async (req, res) => {
  try {
    const deliveryData = req.body;
    if (!deliveryData.recipient || !deliveryData.address) {
      return res
        .status(400)
        .json({ success: false, error: "Recipient and address are required" });
    }
    const newDelivery = await addDelivery(deliveryData);
    res.json({ success: true, delivery: newDelivery });
  } catch (err) {
    console.error("❌ /api/deliveries POST error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/deliveries/auto-assign — AI-based courier assignment ──────────
app.post("/api/deliveries/auto-assign", async (req, res) => {
  try {
    const allDeliveries = await getAllDeliveries();
    const unassigned = allDeliveries.filter(
      (d) => !d.courierId || d.status === "unassigned",
    );

    if (unassigned.length === 0) {
      return res.json({
        success: true,
        message: "Tidak ada paket yang perlu ditugaskan.",
        assigned: 0,
      });
    }

    // Available couriers
    const couriers = [
      { id: "sby-c01", name: "Budi Santoso", region: "Surabaya Pusat & Timur", baseLat: -7.2652, baseLng: 112.7523 },
      { id: "sby-c02", name: "Agus Setiawan", region: "Surabaya Selatan", baseLat: -7.2988, baseLng: 112.7341 },
      { id: "sby-c03", name: "Eko Prasetyo", region: "Surabaya Utara & Barat", baseLat: -7.2412, baseLng: 112.7431 },
    ];

    // Simple clustering: assign each delivery to the nearest courier
    const assignments = unassigned.map((d) => {
      let bestCourier = couriers[0];
      let bestDist = Infinity;

      for (const c of couriers) {
        const dist = haversineKm(d.lat, d.lng, c.baseLat, c.baseLng);
        if (dist !== null && dist < bestDist) {
          bestDist = dist;
          bestCourier = c;
        }
      }

      return { deliveryId: d.id, courierId: bestCourier.id, courierName: bestCourier.name, distance: bestDist };
    });

    // Apply assignments
    for (const a of assignments) {
      await updateDeliveryStatus(a.deliveryId, {
        courierId: a.courierId,
        status: "pending",
        assignedAt: new Date().toISOString(),
      });
    }

    // Group by courier for response
    const summary = couriers.map((c) => {
      const assigned = assignments.filter((a) => a.courierId === c.id);
      return { courierId: c.id, courierName: c.name, count: assigned.length };
    }).filter((s) => s.count > 0);

    console.log(`\n📦 Auto-assigned ${assignments.length} deliveries to ${summary.length} couriers`);

    res.json({
      success: true,
      message: `${assignments.length} paket berhasil ditugaskan ke ${summary.length} kurir.`,
      assigned: assignments.length,
      summary,
    });
  } catch (err) {
    console.error("❌ /api/deliveries/auto-assign error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PATCH /api/deliveries/:id/status ────────────────────────────────────────
app.patch("/api/deliveries/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const { courierLocation, ...persistedUpdates } = updates;

    if (updates.status === "delivered") {
      const delivery = await getDeliveryById(id);
      if (!delivery) {
        return res
          .status(404)
          .json({ success: false, error: "Delivery not found" });
      }

      const distanceKm = haversineKm(
        courierLocation?.lat,
        courierLocation?.lng,
        delivery?.lat,
        delivery?.lng,
      );

      if (distanceKm == null) {
        return res.status(400).json({
          success: false,
          error:
            "Courier location is required to mark this delivery as delivered.",
        });
      }

      if (distanceKm > DELIVERY_MARK_RADIUS_KM) {
        return res.status(403).json({
          success: false,
          error: `Courier must be within ${Math.round(DELIVERY_MARK_RADIUS_KM * 1000)} m of the destination to mark it delivered.`,
          distanceKm,
        });
      }
    }

    await updateDeliveryStatus(id, persistedUpdates);

    // Record delivery completion for analytics
    if (updates.status === "delivered") {
      recordDeliveryCompletion({ id, ...updates }, true);
    }

    res.json({ success: true, message: `Delivery ${id} updated.` });
  } catch (err) {
    console.error("❌ /api/deliveries/:id/status error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/incidents ──────────────────────────────────────────────────────
app.get("/api/incidents", async (req, res) => {
  try {
    const incidents = await getAllReports();
    res.json({ success: true, incidents });
  } catch (err) {
    console.error("❌ /api/incidents error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── SMART CITY AI AGENTS ────────────────────────────────────────────────────

// GET /api/smart/traffic - Predict congestion zones
app.get("/api/smart/traffic", async (req, res) => {
  try {
    const prediction = await predictTrafficConditions();
    res.json({ success: true, ...prediction });
  } catch (err) {
    console.error("❌ /api/smart/traffic error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/smart/pickup-points - Optimize delivery clustering
app.post("/api/smart/pickup-points", async (req, res) => {
  try {
    const { deliveries } = req.body;
    if (!Array.isArray(deliveries)) {
      return res
        .status(400)
        .json({ success: false, error: "deliveries array required" });
    }
    const result = await optimizePickupPoints(deliveries);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ /api/smart/pickup-points error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/smart/proactive-alert - Detect if couriers are heading into congestion
app.post("/api/smart/proactive-alert", async (req, res) => {
  try {
    const { deliveries, trafficZones } = req.body;
    if (!Array.isArray(deliveries) || !Array.isArray(trafficZones)) {
      return res.status(400).json({
        success: false,
        error: "deliveries and trafficZones arrays required",
      });
    }
    const result = await proactiveReroute(deliveries, trafficZones);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ /api/smart/proactive-alert error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/smart/route-alternatives - Generate AI-based route alternatives for active delivery
app.post("/api/smart/route-alternatives", async (req, res) => {
  try {
    const {
      delivery,
      trafficZones = [],
      baseDistanceKm,
      baseDurationMinutes,
    } = req.body || {};

    if (!delivery || typeof delivery !== "object") {
      return res
        .status(400)
        .json({ success: false, error: "delivery object required" });
    }

    // IMPORTANT: Only generate route alternatives for deliveries that are IN_TRANSIT
    // (currently being delivered), NOT for pending or delivered packages
    if (delivery.status !== "in_transit") {
      return res.status(400).json({
        success: false,
        error: `Route alternatives hanya tersedia untuk paket yang sedang diantar (in_transit). Status saat ini: ${delivery.status || "unknown"}`,
        currentRoute: null,
        alternatives: [],
      });
    }

    const result = await generateRouteAlternatives({
      delivery,
      trafficZones,
      baseDistanceKm,
      baseDurationMinutes,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ /api/smart/route-alternatives error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/smart/weather - Get current AI-predicted weather
app.get("/api/smart/weather", (req, res) => {
  res.json({ success: true, weather: getWeather() });
});

// POST /api/smart/ai-chat - AI Assistant for couriers (natural language)
app.post("/api/smart/ai-chat", rateLimiter(AI_MAX_REQUESTS), async (req, res) => {
  try {
    const { message, courierId, context = {} } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: "message is required" });
    }

    const { predictTrafficConditions: getTraffic } = await import("./services/traffic-agent.js");
    const trafficData = await getTraffic().catch(() => ({ zones: [] }));
    const deliveries = await getDeliveries(courierId || "unknown");

    // Build context for AI
    const activeDeliveries = deliveries.filter(d => d.status !== "delivered");
    const deliveryContext = activeDeliveries.slice(0, 5).map(d =>
      `- ${d.recipient} (${d.address}, prioritas: ${d.priority})`
    ).join("\n");

    const trafficContext = (trafficData.zones || [])
      .filter(z => z.level === "high" || z.level === "critical")
      .map(z => `- ${z.name}: ${z.level} (${z.reason})`)
      .join("\n") || "Semua zona lancar.";

    const hour = new Date().getHours();
    const timeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    const systemPrompt = `Kamu adalah asisten AI logistik bernama NusaRoute AI untuk kurir pengiriman di Surabaya, Indonesia.
Waktu sekarang: ${timeStr} WIB.
Jawab dalam Bahasa Indonesia yang singkat, jelas, dan actionable (maksimal 3-4 kalimat).
Jangan gunakan markdown. Gunakan bahasa sehari-hari yang mudah dipahami kurir.

KONTEKS PENGIRIMAN AKTIF:
${deliveryContext || "Tidak ada pengiriman aktif."}

KONDISI LALU LINTAS SAAT INI:
${trafficContext}

CUACA: ${trafficData.weather?.condition || "cerah"} (${trafficData.weather?.temp || 31}°C)

Berikan saran yang spesifik dan praktis berdasarkan data di atas. Jika ditanya rute, sebutkan nama jalan Surabaya yang nyata.`;

    // Check if Gemini is available
    const USE_MOCK = process.env.USE_MOCK_AI === "true" || !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your_gemini_api_key_here";

    if (USE_MOCK) {
      // Smart mock responses based on keywords
      let reply = "Saya siap membantu! Tanyakan tentang rute, kemacetan, atau pengiriman Anda.";

      const msg = message.toLowerCase();
      if (msg.includes("macet") || msg.includes("traffic") || msg.includes("lancar")) {
        const congested = (trafficData.zones || []).filter(z => z.level === "high" || z.level === "critical");
        if (congested.length > 0) {
          reply = `Saat ini ada kemacetan di ${congested.map(z => z.name).join(", ")}. Saya sarankan hindari area tersebut dan ambil jalur alternatif.`;
        } else {
          reply = `Kondisi lalu lintas Surabaya saat ini relatif lancar. Tidak ada zona macet yang terdeteksi. Waktu yang bagus untuk mengantar!`;
        }
      } else if (msg.includes("rute") || msg.includes("jalan") || msg.includes("arah")) {
        reply = `Berdasarkan kondisi traffic saat ini, saya sarankan prioritaskan pengiriman di area yang sedang lancar dulu. Hindari Wonokromo dan Ahmad Yani di jam sibuk (17:00-19:00).`;
      } else if (msg.includes("cuaca") || msg.includes("hujan")) {
        reply = `Cuaca saat ini: ${trafficData.weather?.condition || "cerah"} (${trafficData.weather?.temp || 31}°C). ${trafficData.weather?.condition === "rain" ? "Hati-hati jalanan licin, terutama di area Wonokromo dan Kenjeran yang rawan genangan." : "Kondisi baik untuk pengiriman."}`;
      } else if (msg.includes("paket") || msg.includes("kirim") || msg.includes("antar")) {
        reply = `Anda memiliki ${activeDeliveries.length} paket aktif. ${activeDeliveries.length > 0 ? `Prioritas tertinggi: ${activeDeliveries.find(d => d.priority === "high")?.recipient || activeDeliveries[0].recipient}.` : ""} Gunakan fitur "Optimalkan AI" di tab Paket untuk urutan terbaik.`;
      } else if (msg.includes("hub") || msg.includes("parkir") || msg.includes("konsolidasi")) {
        reply = `Cek apakah ada instruksi hub dari dispatcher di card pengiriman Anda. Jika ada marker biru "P" di peta, itu adalah titik parkir yang disarankan AI untuk distribusi jalan kaki.`;
      }

      return res.json({
        success: true,
        reply,
        source: "mock",
        timestamp: new Date().toISOString(),
      });
    }

    // Real Gemini API
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const result = await ai.models.generateContent({
      model,
      contents: [
        { role: "user", parts: [{ text: systemPrompt + "\n\nPertanyaan kurir: " + message }] },
      ],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.3,
      },
    });

    const reply = result.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, saya tidak bisa memproses pertanyaan Anda saat ini.";

    res.json({
      success: true,
      reply: reply.trim(),
      source: "gemini",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ /api/smart/ai-chat error:", err);
    res.json({
      success: true,
      reply: "Maaf, terjadi gangguan pada sistem AI. Silakan coba lagi dalam beberapa saat.",
      source: "error-fallback",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ─── FCM & PUSH NOTIFICATIONS ────────────────────────────────────────────────

// POST /api/users/fcm-token - Save Courier's FCM Token
app.post("/api/users/fcm-token", async (req, res) => {
  try {
    const { userId, token } = req.body;
    if (!userId || !token) {
      return res
        .status(400)
        .json({ success: false, error: "userId and token required" });
    }
    const { saveFcmToken } = await import("./services/firebase-admin.js");
    await saveFcmToken(userId, token);
    res.json({ success: true, message: "FCM token saved" });
  } catch (err) {
    console.error("❌ /api/users/fcm-token error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/smart/apply-hub - Apply Hub and trigger FCM Push Notification
app.post("/api/smart/apply-hub", async (req, res) => {
  try {
    const { hub } = req.body;
    if (!hub || !Array.isArray(hub.deliveryIds)) {
      return res
        .status(400)
        .json({ success: false, error: "Valid hub object required" });
    }
    const { applyPickupHubToDeliveries } =
      await import("./services/firebase-admin.js");
    const result = await applyPickupHubToDeliveries(hub);
    res.json(result);
  } catch (err) {
    console.error("❌ /api/smart/apply-hub error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── AUTONOMOUS AGENT & ANALYTICS ─────────────────────────────────────────────

// GET /api/agent/status - Get autonomous agent status
app.get("/api/agent/status", (req, res) => {
  res.json({ success: true, ...getAgentStatus() });
});

// POST /api/agent/start - Start the autonomous agent
app.post("/api/agent/start", (req, res) => {
  startAgent();
  res.json({ success: true, message: "Autonomous agent started." });
});

// POST /api/agent/stop - Stop the autonomous agent
app.post("/api/agent/stop", (req, res) => {
  stopAgent();
  res.json({ success: true, message: "Autonomous agent stopped." });
});

// GET /api/analytics - Get full analytics dashboard data
app.get("/api/analytics", (req, res) => {
  res.json({ success: true, ...getAnalytics() });
});

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║       NusaRoute AI — Backend           ║");
  console.log("╚════════════════════════════════════════╝");
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 CORS allowed from: ${CORS_ORIGIN}`);
  console.log(
    `🤖 AI Mode: ${process.env.USE_MOCK_AI === "true" ? "🟡 MOCK" : "🟢 Gemini Live"}`,
  );
  console.log(
    `🔥 Firestore: ${isFirestoreReady ? "🟢 Connected" : "🟡 Memory Mode"}\n`,
  );

  // Start the Autonomous Agent Loop automatically
  startAgent();
});
