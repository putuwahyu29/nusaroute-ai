import {
  predictTrafficConditions,
  optimizePickupPoints,
  solveNearestNeighborTSP,
  haversineKm,
} from "./traffic-agent.js";
import {
  getAllDeliveries,
  saveAgentDecision,
  getRecentAgentDecisions,
  saveAgentStateSnapshot,
  loadAgentStateSnapshot,
} from "./firebase-admin.js";
import { APP_CONFIG } from "../config/app-config.js";
import type { AgentDecision, AgentState, Delivery, TrafficZone } from "../types/index.js";

const AGENT_TICK_INTERVAL = APP_CONFIG.agentTickIntervalMs;
const REROUTE_COOLDOWN = APP_CONFIG.rerouteCooldownMs;
const HUB_REASSESS_INTERVAL = APP_CONFIG.hubReassessIntervalMs;
const DEFAULT_ORIGIN = APP_CONFIG.defaultOrigin;

let latestTspReductionPercent = 0;
let latestTspKmSaved = 0;
let latestTspTimeSavedMinutes = 0;
let latestHubKmSaved = 0;
let latestHubTimeSavedMinutes = 0;

const agentState: AgentState = {
  isRunning: false,
  lastTick: null,
  lastHubAssessment: null,
  tickCount: 0,
  decisionsLog: [],
  rerouteCooldowns: {},
  stats: {
    totalDecisions: 0,
    reroutesIssued: 0,
    hubsAssigned: 0,
    alertsSent: 0,
    successfulReroutes: 0,
    kmSaved: 0,
    minutesSaved: 0,
    deliveriesOnTime: 0,
    deliveriesLate: 0,
    totalDeliveriesCompleted: 0,
  },
};

const analyticsStore: {
  hourlyMetrics: Array<{ hour: number; avgDeliveryTime: number; onTimeRate: number; rerouteCount: number }>;
  dailyMetrics: Array<{ date: string; totalDeliveries: number; onTimeRate: number; kmSaved: number; co2Saved: number }>;
  agentDecisions: AgentDecision[];
  trafficAccuracy: Array<{ zoneId: string; predicted: string; actual: string; timestamp: string }>;
} = {
  hourlyMetrics: [],
  dailyMetrics: [],
  agentDecisions: [],
  trafficAccuracy: [],
};

let agentTimer: NodeJS.Timeout | null = null;

function logDecision(decision: Omit<AgentDecision, "id" | "timestamp">): void {
  const entry: AgentDecision = {
    id: `DEC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...decision,
  };

  agentState.decisionsLog.push(entry);
  analyticsStore.agentDecisions.push(entry);

  if (agentState.decisionsLog.length > 500) {
    agentState.decisionsLog = agentState.decisionsLog.slice(-500);
  }
  if (analyticsStore.agentDecisions.length > 1000) {
    analyticsStore.agentDecisions = analyticsStore.agentDecisions.slice(-1000);
  }

  agentState.stats.totalDecisions++;
  console.log(`[Agent Decision] ${decision.type}: ${decision.summary}`);
  // Persist decision asynchronously to Cloud Firestore so logs survive Cloud Run restarts
  void saveAgentDecision(entry);
}

async function gatherWorldState(): Promise<{
  trafficZones: TrafficZone[];
  weather: any;
  deliveries: Delivery[];
  activeDeliveries: Delivery[];
  timestamp: Date;
}> {
  const [trafficResult, deliveries] = await Promise.all([
    predictTrafficConditions().catch(() => ({ zones: [], weather: { condition: "sunny" as const, temp: 31, updatedAt: "" }, source: "", generatedAt: "" })),
    getAllDeliveries().catch(() => []),
  ]);

  return {
    trafficZones: trafficResult.zones || [],
    weather: trafficResult.weather || { condition: "sunny", temp: 31 },
    deliveries,
    activeDeliveries: deliveries.filter((d) => d.status !== "delivered"),
    timestamp: new Date(),
  };
}

function evaluateThreats(worldState: {
  trafficZones: TrafficZone[];
  activeDeliveries: Delivery[];
}): Array<{ delivery: Delivery; threatZone: TrafficZone; distance: number }> {
  const threats: Array<{ delivery: Delivery; threatZone: TrafficZone; distance: number }> = [];
  const dangerousZones = worldState.trafficZones.filter((z) => z.level === "high" || z.level === "critical");

  for (const delivery of worldState.activeDeliveries) {
    if (delivery.lat == null || delivery.lng == null) continue;

    for (const zone of dangerousZones) {
      const dist = haversineKm(delivery.lat, delivery.lng, zone.lat, zone.lng);
      if (dist != null && dist <= zone.radius) {
        threats.push({ delivery, threatZone: zone, distance: dist });
        break;
      }
    }
  }

  return threats;
}

async function executeAgentTick(): Promise<void> {
  const tickStart = Date.now();
  agentState.tickCount++;
  agentState.lastTick = new Date().toISOString();

  try {
    const world = await gatherWorldState();
    const threats = evaluateThreats(world);
    const now = Date.now();

    // Sync actual delivered count from Firestore / store (never invent 14/15)
    const deliveredCount = world.deliveries.filter((d) => d.status === "delivered").length;
    if (deliveredCount > agentState.stats.totalDeliveriesCompleted) {
      const diff = deliveredCount - agentState.stats.totalDeliveriesCompleted;
      agentState.stats.totalDeliveriesCompleted = deliveredCount;
      agentState.stats.deliveriesOnTime += diff;
    }

    // Compute real TSP optimization efficiency on active deliveries
    if (world.activeDeliveries.length >= 2) {
      const tsp = solveNearestNeighborTSP(DEFAULT_ORIGIN, world.activeDeliveries);
      latestTspReductionPercent = tsp.distanceReductionPercent;
      latestTspKmSaved = parseFloat(Math.max(0, tsp.originalDistanceKm - tsp.optimizedDistanceKm).toFixed(2));
      latestTspTimeSavedMinutes = tsp.timeReductionMinutes;
    } else {
      latestTspReductionPercent = 0;
      latestTspKmSaved = 0;
      latestTspTimeSavedMinutes = 0;
    }

    for (const { delivery, threatZone, distance } of threats) {
      const courierKey = delivery.courierId || delivery.id;
      const lastAlert = agentState.rerouteCooldowns[courierKey] || 0;

      if (now - lastAlert > REROUTE_COOLDOWN) {
        agentState.rerouteCooldowns[courierKey] = now;
        agentState.stats.reroutesIssued++;
        agentState.stats.alertsSent++;

        // Real geometric corridor estimate based on zone radius and threat severity
        const corridorKm = parseFloat(Math.max(0.5, threatZone.radius - distance * 0.5).toFixed(2));
        const delayAvoidedMins = Math.round((corridorKm / (threatZone.level === "critical" ? 10 : 16)) * 60 - (corridorKm / 26) * 60);

        logDecision({
          type: "AUTONOMOUS_REROUTE",
          summary: `Auto-reroute untuk ${delivery.recipient} - hindari ${threatZone.name} (jarak ${distance.toFixed(2)} km dari pusat zona)`,
          details: {
            deliveryId: delivery.id,
            zoneId: threatZone.id,
            threatLevel: threatZone.level,
            distanceFromZoneKm: parseFloat(distance.toFixed(2)),
          },
          estimatedSaving: Math.max(1, delayAvoidedMins),
        });
      }
    }

    const lastHubCheck = agentState.lastHubAssessment
      ? new Date(agentState.lastHubAssessment).getTime()
      : 0;

    if (now - lastHubCheck > HUB_REASSESS_INTERVAL && world.activeDeliveries.length >= 3) {
      agentState.lastHubAssessment = new Date().toISOString();
      const hubResult = await optimizePickupPoints(world.activeDeliveries);

      latestHubKmSaved = hubResult.sustainability.kmSaved;
      latestHubTimeSavedMinutes = hubResult.sustainability.timeSavedMinutes;

      if (hubResult.hubs.length > 0) {
        agentState.stats.hubsAssigned = hubResult.hubs.length;

        logDecision({
          type: "HUB_OPTIMIZATION",
          summary: `${hubResult.hubs.length} micro-hub konsolidasi teridentifikasi untuk ${hubResult.totalDeliveriesClustered} paket aktif (hemat ${hubResult.sustainability.kmSaved} km)`,
          details: {
            hubCount: hubResult.hubs.length,
            deliveriesClustered: hubResult.totalDeliveriesClustered,
            kmSaved: hubResult.sustainability.kmSaved,
          },
          estimatedSaving: hubResult.sustainability.timeSavedMinutes,
        });
      }
    }

    // Aggregate actual computed savings (TSP + Hub Clustering, never unbounded hardcoded += 12)
    agentState.stats.kmSaved = parseFloat((latestTspKmSaved + latestHubKmSaved).toFixed(2));
    agentState.stats.minutesSaved = Math.round(latestTspTimeSavedMinutes + latestHubTimeSavedMinutes);

    const criticalCount = world.trafficZones.filter((z) => z.level === "critical").length;
    const highCount = world.trafficZones.filter((z) => z.level === "high").length;

    if (criticalCount >= 3) {
      logDecision({
        type: "TRAFFIC_ADVISORY",
        summary: `Kondisi lalu lintas KRITIS: ${criticalCount} zona kritis, ${highCount} zona padat`,
        details: { criticalCount, highCount },
      });
    }

    // Persist aggregated agent state snapshot to Firestore
    await saveAgentStateSnapshot({
      tickCount: agentState.tickCount,
      lastTick: agentState.lastTick,
      lastHubAssessment: agentState.lastHubAssessment,
      stats: agentState.stats,
    });

    const duration = Date.now() - tickStart;
    console.log(`[Agent Tick #${agentState.tickCount}] Finished in ${duration}ms | Decisions: ${agentState.stats.totalDecisions}`);
  } catch (err: any) {
    console.error("[Autonomous Agent Tick Error]:", err?.message || err);
  }
}

let isHydrated = false;
async function hydrateAgentStateFromFirestore(): Promise<void> {
  if (isHydrated) return;
  isHydrated = true;
  try {
    const [snapshot, decisions] = await Promise.all([
      loadAgentStateSnapshot(),
      getRecentAgentDecisions(50),
    ]);
    if (snapshot) {
      agentState.tickCount = snapshot.tickCount || 0;
      agentState.lastTick = snapshot.lastTick || null;
      agentState.lastHubAssessment = snapshot.lastHubAssessment || null;
      agentState.stats = { ...agentState.stats, ...(snapshot.stats || {}) };
    }
    if (decisions.length > 0) {
      agentState.decisionsLog = decisions;
      analyticsStore.agentDecisions = [...decisions];
    }
    if (snapshot || decisions.length > 0) {
      console.log(`[Autonomous Agent] Hydrated persisted state (ticks=${agentState.tickCount}, decisions=${agentState.decisionsLog.length}).`);
    }
  } catch (err: any) {
    console.warn("[Autonomous Agent] Hydration skipped:", err?.message || err);
  }
}

/**
 * Single atomic evaluation tick — designed for Google Cloud Scheduler HTTP trigger
 * (POST /api/agent/tick) in multi-instance Cloud Run deployments.
 */
export async function runAgentTickOnce(): Promise<{
  tickCount: number;
  lastTick: string | null;
  totalDecisions: number;
}> {
  await hydrateAgentStateFromFirestore();
  await executeAgentTick();
  return {
    tickCount: agentState.tickCount,
    lastTick: agentState.lastTick,
    totalDecisions: agentState.stats.totalDecisions,
  };
}

export function startAgent(): void {
  if (!APP_CONFIG.enableInProcessAgentLoop) {
    console.log("[Autonomous Agent] In-process loop disabled (ENABLE_AGENT_LOOP=false). Awaiting Cloud Scheduler POST /api/agent/tick.");
    void hydrateAgentStateFromFirestore();
    return;
  }
  if (agentState.isRunning) {
    console.log("[Autonomous Agent] Already running.");
    return;
  }
  agentState.isRunning = true;
  console.log(`[Autonomous Agent] Started. Tick interval: ${AGENT_TICK_INTERVAL / 1000}s`);
  void hydrateAgentStateFromFirestore().then(() => executeAgentTick());
  agentTimer = setInterval(executeAgentTick, AGENT_TICK_INTERVAL);
}

export function stopAgent(): void {
  if (!agentState.isRunning) return;
  agentState.isRunning = false;
  if (agentTimer) {
    clearInterval(agentTimer);
    agentTimer = null;
  }
  console.log("[Autonomous Agent] Stopped.");
}

export function getAgentStatus(): AgentState {
  return { ...agentState };
}

export function getAnalytics(): {
  stats: AgentState["stats"] & {
    co2SavedKg: number;
    hoursSaved: number;
    onTimeRate: number;
    operationalDragReductionPercent: number;
  };
  decisions: AgentDecision[];
  trafficAccuracy: Array<{ zoneId: string; predicted: string; actual: string; timestamp: string }>;
} {
  const stats = agentState.stats;
  const co2SavedKg = parseFloat((stats.kmSaved * 0.103).toFixed(2));
  const hoursSaved = parseFloat((stats.minutesSaved / 60).toFixed(1));
  const totalCompleted = stats.totalDeliveriesCompleted;
  const onTime = stats.deliveriesOnTime;
  const onTimeRate = totalCompleted > 0 ? Math.round((onTime / totalCompleted) * 100) : 0;
  // Directly derived from actual Nearest-Neighbor TSP distance reduction percentage
  const operationalDragReductionPercent = latestTspReductionPercent;

  return {
    stats: {
      ...stats,
      co2SavedKg,
      hoursSaved,
      onTimeRate,
      operationalDragReductionPercent,
    },
    decisions: agentState.decisionsLog.slice(-50),
    trafficAccuracy: analyticsStore.trafficAccuracy,
  };
}

export function recordDeliveryCompletion(_delivery: Delivery, wasOnTime = true): void {
  agentState.stats.totalDeliveriesCompleted++;
  if (wasOnTime) {
    agentState.stats.deliveriesOnTime++;
  } else {
    agentState.stats.deliveriesLate++;
  }
  void saveAgentStateSnapshot({
    tickCount: agentState.tickCount,
    lastTick: agentState.lastTick,
    lastHubAssessment: agentState.lastHubAssessment,
    stats: agentState.stats,
  });
}
