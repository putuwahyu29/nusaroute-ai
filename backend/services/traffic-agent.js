/**
 * NusaRoute AI — Traffic & Smart City Agent
 * Agentic AI service for proactive traffic prediction, smart pickup optimization,
 * and proactive rerouting for urban logistics in Surabaya.
 */

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MOCK_MODE = process.env.USE_MOCK_AI === "true"; // Default to false for production
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// ── 10 Surabaya Traffic Zones ─────────────────────────────────────────────────
export const SURABAYA_ZONES = [
  {
    id: "gubeng",
    name: "Gubeng / Stasiun",
    lat: -7.2652,
    lng: 112.7523,
    radius: 1.5,
    area: "Surabaya Timur",
    peakHours: [
      [7, 9],
      [17, 19],
    ],
  },
  {
    id: "wonokromo",
    name: "Wonokromo / Sutos",
    lat: -7.2988,
    lng: 112.7341,
    radius: 1.8,
    area: "Surabaya Selatan",
    peakHours: [
      [7, 9],
      [12, 13],
      [17, 19],
    ],
  },
  {
    id: "tunjungan",
    name: "Tunjungan / Pusat Kota",
    lat: -7.2641,
    lng: 112.7394,
    radius: 1.2,
    area: "Surabaya Pusat",
    peakHours: [
      [8, 10],
      [17, 19],
    ],
  },
  {
    id: "kenjeran",
    name: "Kenjeran / Bulak",
    lat: -7.2312,
    lng: 112.7751,
    radius: 1.5,
    area: "Surabaya Utara",
    peakHours: [
      [7, 8],
      [17, 18],
    ],
  },
  {
    id: "waru",
    name: "Bundaran Waru (Cito)",
    lat: -7.3489,
    lng: 112.7228,
    radius: 2.0,
    area: "Pintu Masuk Selatan",
    peakHours: [
      [6, 9],
      [16, 19],
    ],
  },
  {
    id: "perak",
    name: "Pelabuhan Perak",
    lat: -7.2012,
    lng: 112.7295,
    radius: 1.5,
    area: "Surabaya Utara",
    peakHours: [
      [7, 10],
      [13, 14],
    ],
  },
  {
    id: "merr",
    name: "MERR / Sukolilo",
    lat: -7.2878,
    lng: 112.7962,
    radius: 2.0,
    area: "Surabaya Timur",
    peakHours: [
      [7, 9],
      [17, 19],
    ],
  },
  {
    id: "rungkut",
    name: "Rungkut / SIER",
    lat: -7.3178,
    lng: 112.7851,
    radius: 1.5,
    area: "Surabaya Timur",
    peakHours: [
      [7, 9],
      [16, 18],
    ],
  },
  {
    id: "kembang",
    name: "Jl. Kembang Jepun",
    lat: -7.2443,
    lng: 112.7448,
    radius: 1.0,
    area: "Surabaya Pusat",
    peakHours: [
      [8, 10],
      [16, 18],
    ],
  },
  {
    id: "darmo",
    name: "Jl. Raya Darmo",
    lat: -7.2821,
    lng: 112.7366,
    radius: 1.5,
    area: "Surabaya Selatan",
    peakHours: [
      [7, 9],
      [17, 19],
    ],
  },
];

// ── Cache System ──────────────────────────────────────────────────────────────
const TRAFFIC_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let trafficCache = {
  data: null,
  timestamp: 0,
};

// ── Utilities ─────────────────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function extractJSON(text) {
  if (!text || typeof text !== "string") return null;

  let s = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  // Try to find a JSON object or array pattern
  const m = s.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (m) s = m[0];

  // AI sometimes puts unescaped newlines inside strings
  s = s.replace(/\n/g, " ");

  try {
    return JSON.parse(s);
  } catch (err) {
    console.error("❌ JSON Parse Error. Raw text:", text.substring(0, 150));
    // If it fails, try a very aggressive clean
    try {
      const aggressiveClean = s.replace(/[^\{\}\[\]\w\s\d\":,.-]/g, "");
      return JSON.parse(aggressiveClean);
    } catch {
      throw new Error(`Invalid JSON format from AI: ${err.message}`);
    }
  }
}

function severityWeight(level) {
  const weights = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return weights[level] || 1;
}

// ── Weather Prediction System ────────────────────────────────────────────────
// In a production app, this would fetch from BMKG or OpenWeatherMap API.
// Here we implement an automated cycle to reflect real city dynamics.
let currentWeather = {
  condition: "sunny",
  temp: 31,
  updatedAt: new Date().toISOString(),
};

// Internal function to "predict" city weather based on random probability
function autoPredictWeather() {
  const conditions = ["sunny", "cloudy", "rain", "heavy_rain"];
  const weights = [0.6, 0.2, 0.15, 0.05]; // Mostly sunny, occasional rain

  const rand = Math.random();
  let cumulative = 0;
  let selected = "sunny";

  for (let i = 0; i < conditions.length; i++) {
    cumulative += weights[i];
    if (rand <= cumulative) {
      selected = conditions[i];
      break;
    }
  }

  currentWeather = {
    condition: selected,
    temp: selected === "sunny" ? 31 : selected === "cloudy" ? 28 : 26,
    updatedAt: new Date().toISOString(),
  };

  console.log(`🌦️ [Smart City AI] Predicted weather update: ${selected}`);
  trafficCache.data = null; // Clear cache for new analysis
}

export function getWeather() {
  return currentWeather;
}

const WEATHER_IMPACT = {
  sunny: 0,
  cloudy: 0.1,
  rain: 0.4,
  heavy_rain: 0.8,
};

// ── Rule-based traffic fallback ───────────────────────────────────────────────
function rulePredictTraffic(hour, weather = "sunny") {
  const levelLabel = {
    low: { label: "Lancar", color: "#22c55e" },
    medium: { label: "Sedang", color: "#f59e0b" },
    high: { label: "Padat", color: "#f97316" },
    critical: { label: "Macet Total", color: "#ef4444" },
  };

  const levelOrder = ["low", "medium", "high", "critical"];

  return SURABAYA_ZONES.map((zone) => {
    const inZonePeak = zone.peakHours.some(([s, e]) => hour >= s && hour <= e);
    const generalPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
    const isMidday = hour >= 12 && hour <= 13;
    const isLate = hour >= 22 || hour <= 5;

    let level, reason;
    if (inZonePeak && generalPeak) {
      level = "critical";
      reason = `Puncak kemacetan ${hour < 12 ? "pagi" : "sore"} di ${zone.name}`;
    } else if (inZonePeak || generalPeak) {
      level = "high";
      reason = `Jam sibuk ${hour < 12 ? "pagi" : "sore"}, lalu lintas padat`;
    } else if (isMidday) {
      level = "medium";
      reason = "Kepadatan jam makan siang";
    } else if (isLate) {
      level = "low";
      reason = "Lalu lintas sangat lancar (dini hari)";
    } else {
      level = "low";
      reason = "Lalu lintas normal, tidak ada hambatan signifikan";
    }

    // Apply Weather Impact
    if (weather === "heavy_rain") {
      // Heavy rain causes flash floods in certain zones
      const floodProne = ["wonokromo", "kenjeran", "merr", "waru"];
      if (floodProne.includes(zone.id)) {
        level = "critical";
        reason = `⚠️ Banjir/Genangan air akibat hujan lebat di ${zone.name}`;
      } else {
        // Increment level by 2 for other zones
        const idx = Math.min(levelOrder.indexOf(level) + 2, 3);
        level = levelOrder[idx];
        reason = `Lalu lintas terhambat hujan lebat`;
      }
    } else if (weather === "rain") {
      // Increment level by 1
      const idx = Math.min(levelOrder.indexOf(level) + 1, 3);
      level = levelOrder[idx];
      reason = `Jalanan licin dan pandangan terbatas karena hujan`;
    }

    return {
      ...zone,
      level,
      reason,
      ...levelLabel[level],
      predictedAt: new Date().toISOString(),
    };
  });
}

// ── 1. Predict Traffic Conditions ─────────────────────────────────────────────
export async function predictTrafficConditions() {
  const now = new Date();

  // Check Cache first
  if (
    trafficCache.data &&
    now.getTime() - trafficCache.timestamp < TRAFFIC_CACHE_TTL
  ) {
    console.log("🚦 [Cache Hit] Returning cached traffic prediction");
    return {
      ...trafficCache.data,
      isCached: true,
      expiresIn:
        Math.round(
          (TRAFFIC_CACHE_TTL - (now.getTime() - trafficCache.timestamp)) / 1000,
        ) + "s",
    };
  }

  const hour = now.getHours();
  const timeStr = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const weather = getWeather();

  if (MOCK_MODE) {
    console.log(
      `🚦 [Rule-based] Traffic prediction with weather: ${weather.condition}`,
    );
    const mockData = {
      zones: rulePredictTraffic(hour, weather.condition),
      weather,
      source: "rule-based",
      generatedAt: now.toISOString(),
    };
    trafficCache = { data: mockData, timestamp: now.getTime() };
    return mockData;
  }

  const zonesInfo = SURABAYA_ZONES.map(
    (z) => `${z.id}:${z.name}(${z.area})`,
  ).join(",");
  const prompt = `Surabaya traffic AI. Time: ${timeStr} WIB. Weather: ${weather.condition} (${weather.temp}°C). 
Zones: ${zonesInfo}.
Analyze Surabaya congestion. Consider:
1. Rush hours (07-09, 17-19).
2. WEATHER IMPACT: Rain causes heavy delays and floods in Wonokromo, Kenjeran, Waru.
JSON only: {"zones":[{"id":"","level":"low|medium|high|critical","reason":"<20 words in Bahasa Indonesia"}]}`;

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const raw = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!raw) {
      throw new Error("Empty response from AI");
    }
    const parsed = extractJSON(raw);

    if (!parsed || !Array.isArray(parsed.zones)) {
      throw new Error("AI response missing zones array");
    }

    const levelLabel = {
      low: { label: "Lancar", color: "#22c55e" },
      medium: { label: "Sedang", color: "#f59e0b" },
      high: { label: "Padat", color: "#f97316" },
      critical: { label: "Macet Total", color: "#ef4444" },
    };

    const zones = parsed.zones
      .map((ai) => {
        const meta = SURABAYA_ZONES.find((z) => z.id === ai.id);
        if (!meta) return null;
        return {
          ...meta,
          level: ai.level || "low",
          reason: ai.reason || "-",
          ...(levelLabel[ai.level] || levelLabel.low),
          predictedAt: now.toISOString(),
        };
      })
      .filter(Boolean);

    // Fill missing zones with rule-based
    const missing = rulePredictTraffic(hour, weather.condition).filter(
      (r) => !zones.find((z) => z.id === r.id),
    );
    const all = [...zones, ...missing].sort(
      (a, b) =>
        SURABAYA_ZONES.findIndex((z) => z.id === a.id) -
        SURABAYA_ZONES.findIndex((z) => z.id === b.id),
    );

    const responseData = {
      zones: all,
      weather,
      source: "gemini",
      generatedAt: now.toISOString(),
    };
    trafficCache = { data: responseData, timestamp: now.getTime() };
    return responseData;
  } catch (err) {
    console.warn("🚦 Traffic AI error, using rule-based:", err.message);
    const fallbackData = {
      zones: rulePredictTraffic(hour, weather.condition),
      weather,
      source: "rule-based",
      generatedAt: now.toISOString(),
    };
    trafficCache = { data: fallbackData, timestamp: now.getTime() };
    return fallbackData;
  }
}

// ── 2. Optimize Pickup Points ─────────────────────────────────────────────────
function clusterDeliveries(deliveries, radiusKm = 1.5) {
  const pts = deliveries.filter((d) => d.lat != null && d.lng != null);
  const assigned = new Set();
  const clusters = [];

  for (const d of pts) {
    if (assigned.has(d.id)) continue;
    const nearby = pts.filter(
      (p) =>
        !assigned.has(p.id) &&
        haversineKm(d.lat, d.lng, p.lat, p.lng) <= radiusKm,
    );
    if (nearby.length < 2) continue; // only cluster if 2+ deliveries nearby

    nearby.forEach((p) => assigned.add(p.id));
    const centLat = nearby.reduce((s, p) => s + p.lat, 0) / nearby.length;
    const centLng = nearby.reduce((s, p) => s + p.lng, 0) / nearby.length;

    clusters.push({
      id: `hub_${clusters.length + 1}`,
      lat: centLat,
      lng: centLng,
      deliveryIds: nearby.map((p) => p.id),
      recipients: nearby.map((p) => p.recipient || p.id),
      count: nearby.length,
    });
  }
  return clusters;
}

export async function optimizePickupPoints(deliveries) {
  const clusters = clusterDeliveries(deliveries, 1.5);

  if (clusters.length === 0) {
    return {
      hubs: [],
      message:
        "Tidak ada titik pengiriman yang dapat dikonsolidasi (semua terlalu berjauhan).",
      generatedAt: new Date().toISOString(),
    };
  }

  const makeFallbackHub = (c, i) => ({
    ...c,
    label: `Hub Konsolidasi ${i + 1}`,
    reason: `${c.count} pengiriman dalam radius 1.5 km dapat diambil dari satu titik`,
    estimatedSaving: `~${(c.count * 0.9).toFixed(1)} km lebih hemat`,
    savingMinutes: Math.round(c.count * 4),
  });

  if (MOCK_MODE) {
    const hubs = clusters.map(makeFallbackHub);
    return {
      hubs,
      message: `${hubs.length} titik hub teridentifikasi`,
      source: "rule-based",
      generatedAt: new Date().toISOString(),
    };
  }

  const clusterSummary = clusters
    .map(
      (c, i) =>
        `Hub${i + 1}: ${c.count} pengiriman, koordinat (-${Math.abs(c.lat).toFixed(4)},${c.lng.toFixed(4)}), penerima: ${c.recipients.slice(0, 3).join(", ")}`,
    )
    .join(" | ");

  const prompt = `Logistics pickup optimizer for Surabaya, Indonesia.
Clusters found: ${clusterSummary}
For each hub, suggest: real Surabaya landmark name near coordinates as pickup point, and why it saves time.
JSON only: {"hubs":[{"id":"hub_1","label":"nama titik pickup","reason":"<25 words Bahasa Indonesia","estimatedSaving":"X km","savingMinutes":N}]}`;

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    const raw = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!raw) {
      throw new Error("Empty response from AI (Pickup Points)");
    }
    const parsed = extractJSON(raw);

    if (!parsed || !Array.isArray(parsed.hubs)) {
      throw new Error("AI response missing hubs array");
    }

    const hubs = (parsed.hubs || []).map((h, i) => {
      const cluster =
        clusters.find((c) => c.id === h.id) || clusters[i] || clusters[0];
      return { ...cluster, ...h };
    });

    console.log(`🏪 [Gemini] ${hubs.length} pickup hubs optimized`);

    // Calculate Green Logistics Stats
    const totalSavingKm = hubs.reduce(
      (sum, h) => sum + parseFloat(h.estimatedSaving || 0),
      0,
    );
    const co2SavedKg = (totalSavingKm * 0.12).toFixed(2); // 120g CO2 per km for small delivery vehicles

    return {
      hubs,
      source: "gemini",
      generatedAt: new Date().toISOString(),
      sustainability: {
        totalSavingKm: totalSavingKm.toFixed(1),
        co2SavedKg,
        treesEquivalent: (co2SavedKg / 0.06).toFixed(1), // rough estimate
      },
    };
  } catch (err) {
    console.warn("🏪 Pickup AI error, using clusters:", err.message);
    const hubs = clusters.map(makeFallbackHub);
    const totalSavingKm = hubs.reduce(
      (sum, h) => sum + parseFloat(h.estimatedSaving || 0),
      0,
    );

    return {
      hubs,
      source: "rule-based",
      generatedAt: new Date().toISOString(),
      sustainability: {
        totalSavingKm: totalSavingKm.toFixed(1),
        co2SavedKg: (totalSavingKm * 0.12).toFixed(2),
        treesEquivalent: ((totalSavingKm * 0.12) / 0.06).toFixed(1),
      },
    };
  }
}

// ── 3. Proactive Reroute ──────────────────────────────────────────────────────
export async function proactiveReroute(deliveries, trafficZones) {
  const dangerZones = (trafficZones || []).filter(
    (z) => z.level === "high" || z.level === "critical",
  );

  // Find deliveries whose lat/lng overlaps with congested zones
  const affected = deliveries
    .filter((d) => d.lat != null && d.lng != null && d.status !== "delivered")
    .map((d) => {
      const zoneHits = dangerZones
        .map((z) => {
          const distanceKm = haversineKm(d.lat, d.lng, z.lat, z.lng);
          return distanceKm <= (z.radius || 2.0) ? { ...z, distanceKm } : null;
        })
        .filter(Boolean)
        .sort(
          (a, b) =>
            a.distanceKm - b.distanceKm ||
            severityWeight(b.level) - severityWeight(a.level),
        );

      if (zoneHits.length === 0) return null;

      const nearestZone = zoneHits[0];
      const mostSevereZone = [...zoneHits].sort(
        (a, b) =>
          severityWeight(b.level) - severityWeight(a.level) ||
          a.distanceKm - b.distanceKm,
      )[0];

      const impactScore = Math.round(
        severityWeight(mostSevereZone.level) * 100 +
          Math.max(
            0,
            ((mostSevereZone.radius || 2.0) - mostSevereZone.distanceKm) * 25,
          ),
      );

      return {
        ...d,
        affectedZones: zoneHits,
        nearestZone,
        nearestDistanceKm: nearestZone.distanceKm,
        impactScore,
        severity: mostSevereZone.level,
      };
    })
    .filter(Boolean);

  if (affected.length === 0) {
    return {
      affected: [],
      message: "Semua rute aktif bebas dari kemacetan yang terdeteksi.",
      generatedAt: new Date().toISOString(),
    };
  }

  const makeFallbackSuggestion = (d) => {
    const nearestZone = d.nearestZone || d.affectedZones[0];
    const action = d.severity === "critical" ? "REDIRECT_TO_HUB" : "REROUTE";

    return {
      deliveryId: d.id,
      recipient: d.recipient,
      affectedZones: d.affectedZones.map((z) => z.name),
      nearestZoneName: nearestZone?.name,
      nearestDistanceKm:
        nearestZone?.distanceKm != null
          ? Number(nearestZone.distanceKm.toFixed(2))
          : null,
      severity: d.severity || nearestZone?.level || "high",
      impactScore: d.impactScore,
      priorityLabel:
        d.severity === "critical"
          ? "Kritis"
          : d.severity === "high"
            ? "Tinggi"
            : "Sedang",
      recommendedAction: action,
      alternativeNote: `Hindari ${nearestZone?.name} — ambil jalan alternatif melalui jalur sekunder area ${nearestZone?.area || "sekitar lokasi"}`,
    };
  };

  const normalizedAffected = [...affected].sort(
    (a, b) => b.impactScore - a.impactScore,
  );

  if (MOCK_MODE) {
    const suggestions = normalizedAffected.map(makeFallbackSuggestion);
    return {
      affected: suggestions,
      affectedCount: suggestions.length,
      highestSeverity: suggestions[0]?.severity || "high",
      message: `${suggestions.length} rute terdampak kemacetan`,
      source: "rule-based",
      generatedAt: new Date().toISOString(),
    };
  }

  const affectedInfo = normalizedAffected
    .map(
      (d) =>
        `${d.recipient}(${d.address || ""}): melewati ${d.affectedZones.map((z) => z.name).join(", ")}; jarak terdekat ${d.nearestDistanceKm.toFixed(2)} km`,
    )
    .join(" | ");

  const prompt = `Urban rerouting AI for Surabaya, Indonesia.
Deliveries affected by congestion: ${affectedInfo}
For each, suggest a practical alternative street route in Bahasa Indonesia (2 short sentences, name real Surabaya streets).
Return JSON only with this structure:
{"suggestions":[{"deliveryId":"","alternativeNote":"","recommendedAction":"REROUTE|REDIRECT_TO_HUB","priorityLabel":"Kritis|Tinggi|Sedang","nearestZoneName":"","nearestDistanceKm":0}]}`;

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 1200,
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    const raw = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!raw) {
      throw new Error("Empty response from AI (Proactive Reroute)");
    }
    const parsed = extractJSON(raw);

    if (!parsed || !Array.isArray(parsed.suggestions)) {
      throw new Error("AI response missing suggestions array");
    }

    const suggestions = normalizedAffected.map((d, i) => {
      const s =
        parsed.suggestions?.find((x) => x.deliveryId === d.id) ||
        parsed.suggestions?.[i] ||
        {};
      const fallback = makeFallbackSuggestion(d);
      return {
        deliveryId: d.id,
        recipient: d.recipient,
        affectedZones: d.affectedZones.map((z) => z.name),
        nearestZoneName: s.nearestZoneName || fallback.nearestZoneName,
        nearestDistanceKm: s.nearestDistanceKm ?? fallback.nearestDistanceKm,
        severity: s.priorityLabel?.toLowerCase?.() || fallback.severity,
        impactScore: d.impactScore,
        priorityLabel: s.priorityLabel || fallback.priorityLabel,
        recommendedAction: s.recommendedAction || fallback.recommendedAction,
        alternativeNote: s.alternativeNote || fallback.alternativeNote,
      };
    });

    console.log(
      `🔀 [Gemini] ${suggestions.length} proactive reroutes generated`,
    );
    return {
      affected: suggestions,
      affectedCount: suggestions.length,
      highestSeverity: suggestions[0]?.severity || "high",
      message: `${suggestions.length} rute terdampak kemacetan`,
      source: "gemini",
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("🔀 Reroute AI error:", err.message);
    const suggestions = normalizedAffected.map(makeFallbackSuggestion);
    return {
      affected: suggestions,
      affectedCount: suggestions.length,
      highestSeverity: suggestions[0]?.severity || "high",
      message: `${suggestions.length} rute terdampak kemacetan`,
      source: "rule-based",
      generatedAt: new Date().toISOString(),
    };
  }
}

// ── 4. Route Alternatives (Smart City Agentic Routing) ─────────────────────
function summarizeCongestionAroundDelivery(delivery, trafficZones = []) {
  if (!delivery || delivery.lat == null || delivery.lng == null) return [];

  return trafficZones
    .map((zone) => {
      const distanceKm = haversineKm(
        delivery.lat,
        delivery.lng,
        zone.lat,
        zone.lng,
      );
      const influenceRadius = (zone.radius || 2.0) + 1.2;
      if (distanceKm > influenceRadius) return null;
      return { ...zone, distanceKm };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        severityWeight(b.level) - severityWeight(a.level) ||
        a.distanceKm - b.distanceKm,
    );
}

function buildFallbackRouteAlternatives({
  delivery,
  trafficZones = [],
  baseDistanceKm,
  baseDurationMinutes,
}) {
  const impacted = summarizeCongestionAroundDelivery(delivery, trafficZones);
  const hotZones = impacted
    .filter((zone) => zone.level === "critical" || zone.level === "high")
    .map((zone) => zone.name);

  const safeBaseDistance = Math.max(0.8, Number(baseDistanceKm || 4.5));
  const safeBaseDuration = Math.max(6, Number(baseDurationMinutes || 18));

  const congestionPenalty =
    hotZones.length > 0 ? Math.min(12, hotZones.length * 3) : 0;

  const currentRoute = {
    id: "route-main",
    name: "Rute Utama",
    distance: `${safeBaseDistance.toFixed(1)} km`,
    duration: `${safeBaseDuration + congestionPenalty} mnt`,
    delayMinutes: congestionPenalty,
    isOptimized: true,
    highlights:
      hotZones.length > 0
        ? `Melewati area padat: ${hotZones.slice(0, 2).join(", ")}`
        : "Lalu lintas relatif stabil",
    congestedZones: hotZones,
    reason:
      hotZones.length > 0
        ? "Rute utama masih layak, tetapi berpotensi delay jika volume kendaraan meningkat."
        : "Rute utama saat ini paling efisien berdasarkan prediksi trafik.",
  };

  const alternatives = [
    {
      id: "route-alt-1",
      name: "Alternatif 1 (Jalur Sekunder)",
      distance: `${(safeBaseDistance + 0.7).toFixed(1)} km`,
      duration: `${Math.max(8, safeBaseDuration + 2)} mnt`,
      delayMinutes: 2,
      highlights: "Menghindari titik macet utama",
      congestedZones: hotZones.slice(0, 1),
      reason: "Disarankan AI saat volume naik di zona prioritas tinggi.",
    },
    {
      id: "route-alt-2",
      name: "Alternatif 2 (Buffer Koridor)",
      distance: `${(safeBaseDistance + 1.1).toFixed(1)} km`,
      duration: `${Math.max(10, safeBaseDuration + 5)} mnt`,
      delayMinutes: 5,
      highlights: "Rute cadangan saat terjadi insiden mendadak",
      congestedZones: [],
      reason:
        "Memberi stabilitas ETA ketika terjadi penutupan jalan di koridor utama.",
    },
  ];

  return { currentRoute, alternatives };
}

export async function generateRouteAlternatives({
  delivery,
  trafficZones = [],
  baseDistanceKm,
  baseDurationMinutes,
}) {
  if (!delivery) {
    return {
      currentRoute: null,
      alternatives: [],
      source: "rule-based",
      generatedAt: new Date().toISOString(),
      message: "Delivery aktif tidak tersedia.",
    };
  }

  const fallback = buildFallbackRouteAlternatives({
    delivery,
    trafficZones,
    baseDistanceKm,
    baseDurationMinutes,
  });

  if (MOCK_MODE) {
    return {
      ...fallback,
      source: "rule-based",
      generatedAt: new Date().toISOString(),
      message: "Alternatif rute dibuat dari prediksi trafik rule-based.",
    };
  }

  const nearby = summarizeCongestionAroundDelivery(delivery, trafficZones)
    .slice(0, 5)
    .map(
      (zone) => `${zone.name}(${zone.level},${zone.distanceKm.toFixed(2)}km)`,
    )
    .join(", ");

  const prompt = `Urban logistics routing AI for Surabaya.

CONTEXT: Kurir sedang dalam perjalanan mengantar paket ini SEKARANG (status: in_transit).
Tujuan pengiriman aktif: ${delivery.recipient || "Tujuan"} di ${delivery.address || "-"}.
Jarak rute saat ini: ${Number(baseDistanceKm || 4.5).toFixed(1)} km.
Durasi estimasi saat ini: ${Math.round(Number(baseDurationMinutes || 18))} menit.
Zona kemacetan terdekat: ${nearby || "tidak ada"}.

TUGAS: Berikan saran rute alternatif untuk PENGIRIMAN YANG SEDANG BERLANGSUNG ini.
- Rute utama (currentRoute) adalah rute yang sedang digunakan kurir saat ini
- Alternatif (alternatives) adalah opsi rute lain yang bisa diambil untuk menghindari macet atau mempercepat pengiriman

Return JSON only with this shape:
{"currentRoute":{"id":"route-main","name":"...","distance":"X km","duration":"Y mnt","delayMinutes":N,"isOptimized":true,"highlights":"...","congestedZones":["..."],"reason":"..."},"alternatives":[{"id":"route-alt-1","name":"...","distance":"X km","duration":"Y mnt","delayMinutes":N,"highlights":"...","congestedZones":["..."],"reason":"..."},{"id":"route-alt-2","name":"...","distance":"X km","duration":"Y mnt","delayMinutes":N,"highlights":"...","congestedZones":["..."],"reason":"..."}]}`;

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 1500,
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    const raw = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!raw) {
      throw new Error("Empty response from AI (Route Alternatives)");
    }
    const parsed = extractJSON(raw);

    if (!parsed || !parsed.currentRoute) {
      throw new Error("AI response missing currentRoute object");
    }

    return {
      currentRoute: parsed.currentRoute || fallback.currentRoute,
      alternatives:
        Array.isArray(parsed.alternatives) && parsed.alternatives.length > 0
          ? parsed.alternatives.slice(0, 3)
          : fallback.alternatives,
      source: "gemini",
      generatedAt: new Date().toISOString(),
      message: "Alternatif rute dibuat oleh Agentic AI.",
    };
  } catch (err) {
    console.warn("🛣️ Route alternatives AI error:", err.message);
    return {
      ...fallback,
      source: "rule-based",
      generatedAt: new Date().toISOString(),
      message: "Fallback rule-based digunakan untuk alternatif rute.",
      error: err.message,
    };
  }
}
