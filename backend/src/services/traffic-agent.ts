import { GoogleGenAI } from "@google/genai";
import { executeWithModelFailover } from "./ai-agent.js";
import type {
  Delivery,
  PickupHub,
  ProactiveAlert,
  TrafficZone,
  Weather,
  WeatherCondition,
} from "../types/index.js";
import { APP_CONFIG } from "../config/app-config.js";
import { SURABAYA_ZONES, FLOOD_PRONE_ZONE_IDS } from "../data/surabaya-zones.js";
import { getTrafficZones } from "./firebase-admin.js";

export { SURABAYA_ZONES };

export function invalidateTrafficCache(): void {
  trafficCache = { data: null, timestamp: 0 };
}

const MODEL_NAME = APP_CONFIG.geminiModel;

function getGenAIClient(): GoogleGenAI | null {
  const isMock = APP_CONFIG.useMockAi;
  const apiKey = APP_CONFIG.geminiApiKey;
  if (isMock || !apiKey || apiKey === "your_gemini_api_key_here") {
    return null;
  }
  try {
    return new GoogleGenAI({ apiKey });
  } catch {
    return null;
  }
}

const TRAFFIC_CACHE_TTL = APP_CONFIG.trafficCacheTtlMs;
let trafficCache: { data: any; timestamp: number } = {
  data: null,
  timestamp: 0,
};

export function haversineKm(
  lat1: number | null | undefined,
  lng1: number | null | undefined,
  lat2: number | null | undefined,
  lng2: number | null | undefined
): number | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
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

const WEATHER_CACHE_TTL = APP_CONFIG.weatherCacheTtlMs;
let weatherCache: { data: Weather & { source: string }; timestamp: number; isManualOverride: boolean } = {
  data: {
    condition: "sunny",
    temp: 31,
    updatedAt: new Date().toISOString(),
    source: "simulation",
  },
  timestamp: 0,
  isManualOverride: false,
};

function getOperationalLocalHour(date = new Date()): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_CONFIG.weatherCoordinates.timezone,
    hour: "numeric",
    hour12: false,
  });
  return parseInt(formatter.format(date), 10) % 24;
}

function mapWmoCodeToCondition(code: number): WeatherCondition {
  if ([65, 82, 95, 96, 99].includes(code)) return "heavy_rain";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 86)) return "rain";
  if ([2, 3, 45, 48].includes(code)) return "cloudy";
  return "sunny";
}

export async function getLiveWeather(): Promise<Weather & { source: string }> {
  const isMockMode = process.env.USE_MOCK_AI === "true";
  const now = Date.now();

  if (weatherCache.isManualOverride) {
    return weatherCache.data;
  }

  if (isMockMode) {
    return {
      ...weatherCache.data,
      source: "simulation",
    };
  }

  if (weatherCache.timestamp > 0 && now - weatherCache.timestamp < WEATHER_CACHE_TTL) {
    return weatherCache.data;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const { lat, lng, timezone } = APP_CONFIG.weatherCoordinates;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&current=temperature_2m,weather_code&timezone=${encodeURIComponent(timezone)}`;
    const res = await fetch(weatherUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const json: any = await res.json();
      const temp = Math.round(json?.current?.temperature_2m ?? 30);
      const code = Number(json?.current?.weather_code ?? 0);
      const condition = mapWmoCodeToCondition(code);
      weatherCache = {
        data: {
          condition,
          temp,
          updatedAt: new Date().toISOString(),
          source: "open-meteo-live",
        },
        timestamp: now,
        isManualOverride: false,
      };
      return weatherCache.data;
    }
  } catch (err: any) {
    console.warn("[Weather] Live Open-Meteo fetch failed, using last known state:", err?.message || err);
  }

  return weatherCache.data;
}

export function getWeather(): Weather {
  return weatherCache.data;
}

export function updateWeather(condition: WeatherCondition, temp?: number): Weather {
  weatherCache = {
    data: {
      condition,
      temp: temp ?? (condition === "sunny" ? 31 : condition === "cloudy" ? 28 : 26),
      updatedAt: new Date().toISOString(),
      source: "manual_override",
    },
    timestamp: Date.now(),
    isManualOverride: true,
  };
  trafficCache.data = null;
  return weatherCache.data;
}

export function rulePredictTraffic(
  hour: number,
  weather: WeatherCondition = "sunny",
  zones: TrafficZone[] = SURABAYA_ZONES
): TrafficZone[] {
  const levelMeta: Record<string, { label: string; color: string }> = {
    low: { label: "Lancar", color: "#22c55e" },
    medium: { label: "Sedang", color: "#f59e0b" },
    high: { label: "Padat", color: "#f97316" },
    critical: { label: "Macet Total", color: "#ef4444" },
  };

  const levelOrder: Array<"low" | "medium" | "high" | "critical"> = ["low", "medium", "high", "critical"];

  return zones.map((zone) => {
    const peaks = Array.isArray(zone.peakHours) ? zone.peakHours : [];
    const inZonePeak = peaks.some(([s, e]) => hour >= s && hour <= e);
    const generalPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
    const isMidday = hour >= 12 && hour <= 13;
    const isLate = hour >= 22 || hour <= 5;

    let level: "low" | "medium" | "high" | "critical";
    let reason: string;

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
      reason = "Lalu lintas normal, tidak ada hambatan";
    }

    const isFloodProne =
      zone.floodProne === true || (FLOOD_PRONE_ZONE_IDS as readonly string[]).includes(zone.id);

    if (weather === "heavy_rain") {
      if (isFloodProne) {
        level = "critical";
        reason = `Banjir/Genangan air akibat hujan lebat di ${zone.name}`;
      } else {
        const idx = Math.min(levelOrder.indexOf(level) + 2, 3);
        level = levelOrder[idx];
        reason = "Lalu lintas terhambat hujan lebat";
      }
    } else if (weather === "rain") {
      const idx = Math.min(levelOrder.indexOf(level) + 1, 3);
      level = levelOrder[idx];
      reason = "Jalanan licin dan pandangan terbatas karena hujan";
    }

    return {
      ...zone,
      level,
      reason,
      ...levelMeta[level],
      predictedAt: new Date().toISOString(),
    };
  });
}

export async function predictTrafficConditions(): Promise<{
  zones: TrafficZone[];
  weather: Weather;
  source: string;
  generatedAt: string;
  isCached?: boolean;
  expiresIn?: string;
}> {
  const now = new Date();

  if (trafficCache.data && now.getTime() - trafficCache.timestamp < TRAFFIC_CACHE_TTL) {
    return {
      ...trafficCache.data,
      isCached: true,
      expiresIn: `${Math.round((TRAFFIC_CACHE_TTL - (now.getTime() - trafficCache.timestamp)) / 1000)}s`,
    };
  }

  const hour = getOperationalLocalHour(now);
  const [weather, activeZones] = await Promise.all([getLiveWeather(), getTrafficZones()]);
  const client = getGenAIClient();

  if (!client) {
    if (APP_CONFIG.useMockAi) {
      const mockData = {
        zones: rulePredictTraffic(hour, weather.condition, activeZones),
        weather,
        source: "simulation",
        generatedAt: now.toISOString(),
      };
      trafficCache = { data: mockData, timestamp: now.getTime() };
      return mockData;
    }
    throw new Error("GEMINI_API_KEY tidak dikonfigurasi dan USE_MOCK_AI=false.");
  }

  try {
    const zonesInfo = activeZones.map((z) => `${z.id}:${z.name}(${z.area})`).join(",");
    const prompt = `${APP_CONFIG.operationCity} traffic AI. Jam: ${hour}:00 (${APP_CONFIG.weatherCoordinates.timezone}). Cuaca: ${weather.condition} (${weather.temp} C).
Zona: ${zonesInfo}.
Evaluasi kemacetan per zona. JSON only: {"zones":[{"id":"string","level":"low|medium|high|critical","reason":"string max 15 kata"}]}`;

    const { response: result, activeModel } = await executeWithModelFailover(
      client,
      (model) => ({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      })
    );

    const raw = result.text?.trim() || "";
    const parsed = JSON.parse(raw);

    const levelMeta: Record<string, { label: string; color: string }> = {
      low: { label: "Lancar", color: "#22c55e" },
      medium: { label: "Sedang", color: "#f59e0b" },
      high: { label: "Padat", color: "#f97316" },
      critical: { label: "Macet Total", color: "#ef4444" },
    };

    const zoneMap = new Map((parsed.zones || []).map((z: any) => [z.id, z]));
    const all = activeZones.map((meta) => {
      const aiZone = zoneMap.get(meta.id) as any;
      const level = (aiZone?.level || "low") as "low" | "medium" | "high" | "critical";
      return {
        ...meta,
        level,
        reason: aiZone?.reason || "Lalu lintas normal",
        ...(levelMeta[level] || levelMeta.low),
        predictedAt: now.toISOString(),
      };
    });

    const responseData = {
      zones: all,
      weather,
      source: "gemini",
      generatedAt: now.toISOString(),
    };
    trafficCache = { data: responseData, timestamp: now.getTime() };
    return responseData;
  } catch (err: any) {
    console.warn("[Traffic Agent] AI prediction error, falling back to rule-based engine:", err?.message || err);
    const fallbackData = {
      zones: rulePredictTraffic(hour, weather.condition, activeZones),
      weather,
      source: "rule-based",
      generatedAt: now.toISOString(),
    };
    trafficCache = { data: fallbackData, timestamp: now.getTime() };
    return fallbackData;
  }
}

export function clusterDeliveries(
  deliveries: Delivery[],
  radiusKm = APP_CONFIG.hubClusterRadiusKm
): Array<{
  centroid: { lat: number; lng: number };
  deliveries: Delivery[];
}> {
  const pts = deliveries.filter((d) => d.lat != null && d.lng != null);
  const assigned = new Set<string>();
  const clusters: Array<{ centroid: { lat: number; lng: number }; deliveries: Delivery[] }> = [];

  for (const d of pts) {
    if (assigned.has(d.id)) continue;
    const nearby = pts.filter(
      (p) => !assigned.has(p.id) && (haversineKm(d.lat, d.lng, p.lat, p.lng) ?? 999) <= radiusKm
    );
    if (nearby.length < 2) continue;

    nearby.forEach((p) => assigned.add(p.id));
    const centroid = {
      lat: nearby.reduce((sum, p) => sum + p.lat, 0) / nearby.length,
      lng: nearby.reduce((sum, p) => sum + p.lng, 0) / nearby.length,
    };
    clusters.push({ centroid, deliveries: nearby });
  }

  return clusters;
}

export async function optimizePickupPoints(deliveries: Delivery[]): Promise<{
  hubs: Array<
    PickupHub & {
      deliveryIds: string[];
      deliveries: Delivery[];
      centroid: { lat: number; lng: number };
      stopCount: number;
      count: number;
      savedKm: number;
      savingMinutes: number;
    }
  >;
  totalDeliveriesClustered: number;
  sustainability: { kmSaved: number; co2SavedKg: number; timeSavedMinutes: number };
}> {
  const active = deliveries.filter((d) => d.status !== "delivered");
  const clusters = clusterDeliveries(active);

  let totalKmSaved = 0;
  let totalTimeSavedMinutes = 0;

  const hubs = clusters.map((c, idx) => {
    const hubId = `HUB-${idx + 1}`;

    // Compute real geometric inter-stop distance avoided by consolidating into one hub
    let interStopKm = 0;
    for (let i = 0; i < c.deliveries.length - 1; i++) {
      const curr = c.deliveries[i];
      const next = c.deliveries[i + 1];
      interStopKm += haversineKm(curr.lat, curr.lng, next.lat, next.lng) ?? 0;
    }
    // Apply urban road circuity factor (1.25x Haversine for actual street turns)
    const clusterSavedKm = parseFloat((interStopKm * 1.25).toFixed(2));
    // Urban travel time (~18 km/h = 3.33 min/km) + 2 min saved per avoided vehicle re-parking
    const clusterTimeSaved = Math.round(clusterSavedKm * 3.33 + (c.deliveries.length - 1) * 2);

    totalKmSaved += clusterSavedKm;
    totalTimeSavedMinutes += clusterTimeSaved;

    // Derive hub label dynamically from the nearest zone or primary delivery address in cluster
    const nearestZone = SURABAYA_ZONES.reduce(
      (best, z) => {
        const d = haversineKm(c.centroid.lat, c.centroid.lng, z.lat, z.lng) ?? Infinity;
        return d < best.dist ? { zone: z, dist: d } : best;
      },
      { zone: null as TrafficZone | null, dist: Infinity }
    );

    const primaryAddr = (c.deliveries[0]?.address || "").split(",")[0].trim();
    const label =
      nearestZone.zone && nearestZone.dist <= nearestZone.zone.radius
        ? `Micro-Hub ${nearestZone.zone.name}`
        : primaryAddr
        ? `Micro-Hub ${primaryAddr}`
        : `Titik Konsolidasi ${idx + 1}`;

    return {
      id: hubId,
      label,
      reason: `Konsolidasi ${c.deliveries.length} paket dalam radius 1,5 km (menghemat ~${clusterSavedKm} km jarak antar-titik).`,
      centroid: c.centroid,
      lat: c.centroid.lat,
      lng: c.centroid.lng,
      deliveryIds: c.deliveries.map((d) => d.id),
      deliveries: c.deliveries,
      stopCount: c.deliveries.length,
      count: c.deliveries.length,
      savedKm: clusterSavedKm,
      savingMinutes: clusterTimeSaved,
    };
  });

  const totalClustered = clusters.reduce((sum, c) => sum + c.deliveries.length, 0);
  const kmSaved = parseFloat(totalKmSaved.toFixed(2));
  const timeSavedMinutes = Math.round(totalTimeSavedMinutes);
  // Motorcycle average emission factor: ~103 g CO2/km (0.103 kg/km)
  const co2SavedKg = parseFloat((kmSaved * 0.103).toFixed(2));

  return {
    hubs,
    totalDeliveriesClustered: totalClustered,
    sustainability: { kmSaved, co2SavedKg, timeSavedMinutes },
  };
}

export function proactiveReroute(
  deliveries: Delivery[],
  trafficZones: TrafficZone[]
): ProactiveAlert[] {
  const criticalZones = trafficZones.filter((z) => z.level === "high" || z.level === "critical");
  const alerts: ProactiveAlert[] = [];

  for (const delivery of deliveries) {
    if (delivery.status === "delivered" || !delivery.lat || !delivery.lng) continue;

    const matched: Array<{ zone: TrafficZone; dist: number }> = [];
    for (const zone of criticalZones) {
      const dist = haversineKm(delivery.lat, delivery.lng, zone.lat, zone.lng);
      if (dist != null && dist <= zone.radius) {
        matched.push({ zone, dist });
      }
    }

    if (matched.length === 0) continue;

    matched.sort((a, b) => a.dist - b.dist);
    const nearest = matched[0];
    const hasCritical = matched.some((m) => m.zone.level === "critical");
    const severity: "high" | "critical" = hasCritical ? "critical" : "high";
    const suggestedAction: "REROUTE" | "REDIRECT_TO_HUB" = hasCritical
      ? "REDIRECT_TO_HUB"
      : "REROUTE";
    const affectedZones = matched.map((m) => m.zone.name);
    const reasonText = nearest.zone.reason ? ` ${nearest.zone.reason}.` : "";
    const message = `Pengiriman ke ${delivery.recipient} terdampak ${nearest.zone.name} (${
      severity === "critical" ? "Macet Total" : "Padat"
    }).${reasonText}`;
    const alternativeNote = hasCritical
      ? `${message} Disarankan alihkan sementara ke Hub Konsolidasi terdekat atau gunakan koridor bypass Surabaya.`
      : `${message} Disarankan mengambil jalur alternatif (Jl. Diponegoro / Jl. Ngagel / MERR / Frontage Road).`;

    alerts.push({
      id: delivery.id,
      deliveryId: delivery.id,
      recipient: delivery.recipient,
      severity,
      affectedZones,
      nearestZoneName: nearest.zone.name,
      nearestDistanceKm: Number(nearest.dist.toFixed(2)),
      alternativeNote,
      impactScore: hasCritical ? 90 : 75,
      priorityLabel: hasCritical ? "Prioritas Kritis" : "Waspada Kemacetan",
      recommendedAction: suggestedAction,
      delivery,
      threatZone: nearest.zone,
      suggestedAction,
      message,
    });
  }

  return alerts;
}

export async function generateRouteAlternatives(
  delivery: Delivery,
  threatZone?: TrafficZone | null,
  options?: {
    trafficZones?: TrafficZone[];
    baseDistanceKm?: number | null;
    baseDurationMinutes?: number | null;
  }
): Promise<{
  originalRoute: { path: string[]; durationMins: number; risk: string };
  alternatives: Array<{
    name: string;
    via: string;
    durationMins: number;
    distanceKm: number;
    isRecommended: boolean;
  }>;
  isSimulated?: boolean;
}> {
  let resolvedZone: TrafficZone | null = threatZone ?? null;
  if (!resolvedZone) {
    const candidates =
      Array.isArray(options?.trafficZones) && options.trafficZones.length > 0
        ? options.trafficZones
        : SURABAYA_ZONES;

    let bestZone = candidates[0] ?? SURABAYA_ZONES[0];
    let minDist = Infinity;
    for (const z of candidates) {
      const d = haversineKm(delivery.lat, delivery.lng, z.lat, z.lng) ?? Infinity;
      const isBusy = z.level === "high" || z.level === "critical";
      const weightedDist = isBusy ? d * 0.5 : d;
      if (weightedDist < minDist) {
        minDist = weightedDist;
        bestZone = z;
      }
    }
    resolvedZone = bestZone;
  }

  const rawDistKm =
    haversineKm(resolvedZone.lat, resolvedZone.lng, delivery.lat, delivery.lng) ?? 2.5;
  // Road distance approximation using 1.3x urban street circuity factor when baseDistanceKm is absent
  const computedRoadKm = Math.max(
    1.2,
    parseFloat((rawDistKm * 1.3 + resolvedZone.radius * 0.6).toFixed(1))
  );
  const baseRoadKm =
    typeof options?.baseDistanceKm === "number" && options.baseDistanceKm > 0
      ? Number(options.baseDistanceKm.toFixed(1))
      : computedRoadKm;
  const congestedSpeedKmh = resolvedZone.level === "critical" ? 9 : 14;
  const computedDurationMins = Math.max(8, Math.round((baseRoadKm / congestedSpeedKmh) * 60));
  const originalDurationMins =
    typeof options?.baseDurationMinutes === "number" && options.baseDurationMinutes > 0
      ? Math.round(options.baseDurationMinutes)
      : computedDurationMins;

  const client = getGenAIClient();
  if (client) {
    try {
      const prompt = `Anda adalah dispatcher logistik Surabaya.
Paket tujuan: "${delivery.address}" (${delivery.lat}, ${delivery.lng}).
Hambatan aktif: "${resolvedZone.name}" (${resolvedZone.area}, level: ${resolvedZone.level || "high"}, alasan: ${resolvedZone.reason || "kemacetan"}).
Jarak estimasi koridor terdampak: ${baseRoadKm} km (estimasi macet ${originalDurationMins} menit).
Berikan 2 rute bypass jalan nyata di Surabaya yang menghindari ${resolvedZone.name}.
Balas JSON saja:
{"alternatives":[{"name":"string","via":"nama jalan nyata Surabaya","distanceKm":number,"durationMins":number,"isRecommended":boolean}]}`;

      const result = await client.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      });

      const parsed = JSON.parse(result.text?.trim() || "{}") as {
        alternatives?: Array<Record<string, unknown>>;
      };
      if (Array.isArray(parsed.alternatives) && parsed.alternatives.length > 0) {
        return {
          originalRoute: {
            path: [resolvedZone.name, delivery.address],
            durationMins: originalDurationMins,
            risk: resolvedZone.level || "high",
          },
          alternatives: parsed.alternatives.slice(0, 2).map((alt, idx) => ({
            name: String(alt.name || `Rute Alternatif ${idx + 1}`),
            via: String(alt.via || `Bypass sekitar ${resolvedZone.area || "Surabaya"}`),
            durationMins: Math.max(
              5,
              Math.round(Number(alt.durationMins) || originalDurationMins * 0.7)
            ),
            distanceKm: parseFloat((Number(alt.distanceKm) || baseRoadKm * 1.15).toFixed(1)),
            isRecommended: idx === 0 ? true : Boolean(alt.isRecommended),
          })),
          isSimulated: false,
        };
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn("[Route Alternatives] Gemini call failed, using geometric fallback:", errMsg);
    }
  }

  // Deterministic geometric calculation for simulation mode (USE_MOCK_AI=true) or offline fallback
  const bypass1Km = parseFloat((baseRoadKm * 1.15).toFixed(1));
  const bypass2Km = parseFloat((baseRoadKm * 1.32).toFixed(1));

  return {
    originalRoute: {
      path: [resolvedZone.name, delivery.address],
      durationMins: originalDurationMins,
      risk: resolvedZone.level || "high",
    },
    alternatives: [
      {
        name: `Bypass Sekunder (${resolvedZone.area || "Surabaya"})`,
        via: `Jalur kolektor menghindari radius ${resolvedZone.radius} km ${resolvedZone.name}`,
        durationMins: Math.max(5, Math.round((bypass1Km / 26) * 60)),
        distanceKm: bypass1Km,
        isRecommended: true,
      },
      {
        name: "Koridor Lingkar Alternatif",
        via: `Lingkar luar ${resolvedZone.area || "Surabaya"}`,
        durationMins: Math.max(6, Math.round((bypass2Km / 24) * 60)),
        distanceKm: bypass2Km,
        isRecommended: false,
      },
    ],
    isSimulated: true,
  };
}

/**
 * Algoritma Heuristik Nearest-Neighbor untuk Traveling Salesperson Problem (TSP) multi-titik.
 * Kompleksitas Waktu: O(n^2) - secara greedy memilih titik terdekat berikutnya dengan formula Haversine.
 * Mengukur efisiensi pemangkasan jarak kumulatif secara empiris pada titik pengiriman Surabaya.
 */
export function solveNearestNeighborTSP(
  origin: { lat: number; lng: number },
  deliveries: Delivery[]
): {
  orderedDeliveries: Delivery[];
  originalDistanceKm: number;
  optimizedDistanceKm: number;
  distanceReductionPercent: number;
  timeReductionMinutes: number;
} {
  const active = deliveries.filter((d) => d.status !== "delivered" && d.lat != null && d.lng != null);
  if (active.length <= 1) {
    return {
      orderedDeliveries: active,
      originalDistanceKm: 0,
      optimizedDistanceKm: 0,
      distanceReductionPercent: 0,
      timeReductionMinutes: 0,
    };
  }

  // Hitung jarak rute berurutan bawaan (arbitrary / insertion order)
  let origDist = 0;
  let curr = origin;
  for (const d of active) {
    origDist += haversineKm(curr.lat, curr.lng, d.lat, d.lng) ?? 0;
    curr = { lat: d.lat, lng: d.lng };
  }

  // Greedy Nearest-Neighbor TSP Solver
  const unvisited = [...active];
  const ordered: Delivery[] = [];
  let optDist = 0;
  curr = origin;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minD = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const d = haversineKm(curr.lat, curr.lng, unvisited[i].lat, unvisited[i].lng) ?? Infinity;
      if (d < minD) {
        minD = d;
        nearestIdx = i;
      }
    }

    const nextStop = unvisited.splice(nearestIdx, 1)[0];
    ordered.push(nextStop);
    optDist += minD;
    curr = { lat: nextStop.lat, lng: nextStop.lng };
  }

  const reductionPercent = origDist > 0 ? Math.round(((origDist - optDist) / origDist) * 100) : 0;
  const timeReductionMinutes = Math.round((origDist - optDist) * 3.5);

  return {
    orderedDeliveries: ordered,
    originalDistanceKm: parseFloat(origDist.toFixed(2)),
    optimizedDistanceKm: parseFloat(optDist.toFixed(2)),
    distanceReductionPercent: Math.max(0, reductionPercent),
    timeReductionMinutes: Math.max(0, timeReductionMinutes),
  };
}
