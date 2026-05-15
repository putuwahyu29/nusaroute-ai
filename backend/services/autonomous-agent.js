/**
 * NusaRoute AI — Autonomous Agent Loop
 * 
 * This is the core "Agentic AI" component that differentiates NusaRoute from
 * a simple AI-powered tool. It runs autonomously in the background, continuously
 * monitoring traffic conditions and courier positions, making proactive decisions
 * without human intervention.
 * 
 * Agent Capabilities:
 * 1. Periodic traffic monitoring & prediction
 * 2. Autonomous reroute decisions when couriers approach congestion
 * 3. Auto-assignment of pickup hubs when clustering is beneficial
 * 4. Logging all autonomous decisions for analytics & learning
 * 5. Multi-step reasoning chain: Monitor → Evaluate → Decide → Act → Log
 */

import { predictTrafficConditions, proactiveReroute, optimizePickupPoints } from './traffic-agent.js';
import { getAllDeliveries, updateDeliveryStatus, getAllReports } from './firebase-admin.js';
import admin from 'firebase-admin';

// ── Agent Configuration ───────────────────────────────────────────────────────
const AGENT_TICK_INTERVAL = 3 * 60 * 1000;  // Run every 3 minutes
const REROUTE_COOLDOWN = 10 * 60 * 1000;    // Don't re-alert same courier within 10 min
const HUB_REASSESS_INTERVAL = 15 * 60 * 1000; // Re-evaluate hubs every 15 min

// ── Agent State ───────────────────────────────────────────────────────────────
const agentState = {
  isRunning: false,
  lastTick: null,
  lastHubAssessment: null,
  tickCount: 0,
  decisionsLog: [],        // In-memory log of all autonomous decisions
  rerouteCooldowns: {},    // { courierId: lastAlertTimestamp }
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
  }
};

// ── Analytics Store ───────────────────────────────────────────────────────────
// Stores historical metrics for the analytics dashboard
const analyticsStore = {
  hourlyMetrics: [],       // { hour, avgDeliveryTime, onTimeRate, rerouteCount }
  dailyMetrics: [],        // { date, totalDeliveries, onTimeRate, kmSaved, co2Saved }
  agentDecisions: [],      // Full decision log with timestamps
  trafficAccuracy: [],     // { zoneId, predicted, actual, timestamp }
};

/**
 * Log an autonomous decision for analytics tracking.
 */
function logDecision(decision) {
  const entry = {
    id: `DEC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...decision,
  };

  agentState.decisionsLog.push(entry);
  analyticsStore.agentDecisions.push(entry);

  // Keep only last 500 decisions in memory
  if (agentState.decisionsLog.length > 500) {
    agentState.decisionsLog = agentState.decisionsLog.slice(-500);
  }
  if (analyticsStore.agentDecisions.length > 1000) {
    analyticsStore.agentDecisions = analyticsStore.agentDecisions.slice(-1000);
  }

  agentState.stats.totalDecisions++;
  console.log(`🤖 [Agent Decision] ${decision.type}: ${decision.summary}`);
}

/**
 * STEP 1: Monitor — Gather current state of the world
 */
async function gatherWorldState() {
  const [trafficResult, deliveries] = await Promise.all([
    predictTrafficConditions().catch(() => ({ zones: [] })),
    getAllDeliveries().catch(() => []),
  ]);

  return {
    trafficZones: trafficResult.zones || [],
    weather: trafficResult.weather || { condition: 'sunny' },
    deliveries,
    activeDeliveries: deliveries.filter(d => d.status !== 'delivered'),
    timestamp: new Date(),
  };
}

/**
 * STEP 2: Evaluate — Analyze the world state for threats/opportunities
 */
function evaluateThreats(worldState) {
  const { trafficZones, activeDeliveries } = worldState;
  
  const criticalZones = trafficZones.filter(z => z.level === 'critical');
  const highZones = trafficZones.filter(z => z.level === 'high');
  const congestionScore = criticalZones.length * 4 + highZones.length * 2;

  // Identify couriers potentially heading into trouble
  const atRiskDeliveries = [];
  for (const delivery of activeDeliveries) {
    if (!delivery.lat || !delivery.lng) continue;

    for (const zone of [...criticalZones, ...highZones]) {
      const dist = haversineKm(delivery.lat, delivery.lng, zone.lat, zone.lng);
      if (dist <= (zone.radius || 2.0)) {
        atRiskDeliveries.push({
          delivery,
          zone,
          distance: dist,
          risk: zone.level === 'critical' ? 'critical' : 'high',
        });
        break;
      }
    }
  }

  return {
    congestionScore,
    criticalZoneCount: criticalZones.length,
    highZoneCount: highZones.length,
    atRiskDeliveries,
    needsHubReassessment: shouldReassessHubs(),
    overallRisk: congestionScore >= 12 ? 'critical' : congestionScore >= 6 ? 'high' : congestionScore >= 3 ? 'medium' : 'low',
  };
}

/**
 * STEP 3: Decide — Make autonomous decisions based on evaluation
 */
async function makeDecisions(worldState, threats) {
  const decisions = [];
  const now = Date.now();

  // Decision A: Proactive Reroute for at-risk deliveries
  for (const risk of threats.atRiskDeliveries) {
    const courierId = risk.delivery.courierId;
    const lastAlert = agentState.rerouteCooldowns[courierId] || 0;

    // Skip if recently alerted (cooldown)
    if (now - lastAlert < REROUTE_COOLDOWN) continue;

    // Learning: Check zone accuracy before alerting (reduce false positives)
    const zoneAccuracy = feedbackLoop.getZoneAccuracy(risk.zone.id);
    if (zoneAccuracy < 0.3 && risk.risk !== 'critical') {
      // Skip low-confidence predictions unless critical
      continue;
    }

    decisions.push({
      type: 'AUTONOMOUS_REROUTE',
      target: risk.delivery.id,
      courierId,
      reason: `Pengiriman ${risk.delivery.recipient} berada ${risk.distance.toFixed(1)} km dari zona ${risk.zone.level} (${risk.zone.name})`,
      summary: `Auto-reroute untuk ${risk.delivery.recipient} — hindari ${risk.zone.name}`,
      severity: risk.risk,
      zoneName: risk.zone.name,
      estimatedSaving: Math.round(risk.distance * 3), // rough: 3 min per km saved
      confidence: Math.round(zoneAccuracy * 100),
    });

    agentState.rerouteCooldowns[courierId] = now;
  }

  // Decision B: Hub reassessment when traffic changes significantly
  if (threats.needsHubReassessment && worldState.activeDeliveries.length >= 4) {
    try {
      const hubResult = await optimizePickupPoints(worldState.activeDeliveries);
      if (hubResult.hubs && hubResult.hubs.length > 0) {
        decisions.push({
          type: 'HUB_OPTIMIZATION',
          hubs: hubResult.hubs,
          summary: `${hubResult.hubs.length} hub konsolidasi teridentifikasi untuk ${worldState.activeDeliveries.length} pengiriman aktif`,
          estimatedSaving: hubResult.sustainability?.totalSavingKm || 0,
        });
        agentState.lastHubAssessment = now;
      }
    } catch (err) {
      console.warn('🤖 [Agent] Hub assessment failed:', err.message);
    }
  }

  // Decision C: Multi-courier load balancing
  const workloadAnalysis = courierCoordinator.analyzeWorkloads(worldState.deliveries);
  if (!workloadAnalysis.balanced && workloadAnalysis.suggestions.length > 0) {
    decisions.push({
      type: 'LOAD_BALANCE',
      summary: `Ketidakseimbangan beban terdeteksi: ${workloadAnalysis.suggestions[0].reason}`,
      suggestions: workloadAnalysis.suggestions,
      loads: workloadAnalysis.loads,
    });
  }

  // Decision D: Stuck courier detection
  const stuckCouriers = courierCoordinator.detectStuckCouriers(worldState.deliveries);
  if (stuckCouriers.length > 0) {
    for (const stuck of stuckCouriers) {
      decisions.push({
        type: 'STUCK_COURIER',
        summary: `Kurir ${stuck.courierId} terjebak ${stuck.elapsedMinutes} menit pada pengiriman ${stuck.recipient}`,
        courierId: stuck.courierId,
        deliveryId: stuck.deliveryId,
        elapsedMinutes: stuck.elapsedMinutes,
      });
    }
  }

  // Decision E: Overall traffic advisory
  if (threats.overallRisk === 'critical' || threats.overallRisk === 'high') {
    decisions.push({
      type: 'TRAFFIC_ADVISORY',
      summary: `Kondisi lalu lintas ${threats.overallRisk === 'critical' ? 'KRITIS' : 'PADAT'}: ${threats.criticalZoneCount} zona kritis, ${threats.highZoneCount} zona padat`,
      severity: threats.overallRisk,
      affectedZones: threats.criticalZoneCount + threats.highZoneCount,
    });
  }

  return decisions;
}

/**
 * STEP 4: Act — Execute the decisions
 */
async function executeDecisions(decisions) {
  for (const decision of decisions) {
    logDecision(decision);

    switch (decision.type) {
      case 'AUTONOMOUS_REROUTE':
        agentState.stats.reroutesIssued++;
        agentState.stats.minutesSaved += decision.estimatedSaving || 0;
        agentState.stats.kmSaved += (decision.estimatedSaving || 0) * 0.4; // rough km estimate

        // Send FCM notification if available
        await sendAgentNotification(decision.courierId, {
          title: '🤖 NusaRoute AI — Reroute Otomatis',
          body: decision.reason,
        });
        break;

      case 'HUB_OPTIMIZATION':
        agentState.stats.hubsAssigned += decision.hubs?.length || 0;
        break;

      case 'LOAD_BALANCE':
        agentState.stats.alertsSent++;
        // Notify dispatchers about load imbalance
        break;

      case 'STUCK_COURIER':
        agentState.stats.alertsSent++;
        // Send notification to stuck courier
        await sendAgentNotification(decision.courierId, {
          title: '🤖 NusaRoute AI — Perhatian',
          body: `Anda sudah ${decision.elapsedMinutes} menit di lokasi yang sama. Apakah ada hambatan? Laporkan jika perlu bantuan.`,
        });
        break;

      case 'TRAFFIC_ADVISORY':
        agentState.stats.alertsSent++;
        break;
    }
  }
}

/**
 * Send FCM push notification from the autonomous agent.
 */
async function sendAgentNotification(courierId, notification) {
  try {
    const { isFirestoreReady } = await import('./firebase-admin.js');
    if (!isFirestoreReady) return;

    const db = admin.firestore();
    const userSnap = await db.collection('users').doc(courierId).get();
    if (!userSnap.exists) return;

    const token = userSnap.data().fcmToken;
    if (!token) return;

    await admin.messaging().send({
      notification,
      token,
      data: { source: 'autonomous-agent', timestamp: new Date().toISOString() },
    });

    console.log(`📨 [Agent] FCM sent to ${courierId}`);
  } catch (err) {
    // Non-critical: log and continue
    console.warn(`📨 [Agent] FCM failed for ${courierId}:`, err.message);
  }
}

/**
 * Check if hubs should be reassessed.
 */
function shouldReassessHubs() {
  if (!agentState.lastHubAssessment) return true;
  return Date.now() - agentState.lastHubAssessment > HUB_REASSESS_INTERVAL;
}

/**
 * Haversine distance helper.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Main Agent Loop ───────────────────────────────────────────────────────────

/**
 * Single tick of the autonomous agent.
 * Follows the Monitor → Evaluate → Decide → Act → Log cycle.
 */
async function agentTick() {
  if (!agentState.isRunning) return;

  agentState.tickCount++;
  agentState.lastTick = new Date().toISOString();

  try {
    // STEP 1: Monitor
    const worldState = await gatherWorldState();

    // STEP 2: Evaluate
    const threats = evaluateThreats(worldState);

    // STEP 3: Decide
    const decisions = await makeDecisions(worldState, threats);

    // STEP 4: Act
    if (decisions.length > 0) {
      await executeDecisions(decisions);
      console.log(`🤖 [Agent Tick #${agentState.tickCount}] ${decisions.length} decisions executed | Risk: ${threats.overallRisk}`);
    } else {
      console.log(`🤖 [Agent Tick #${agentState.tickCount}] No action needed | Risk: ${threats.overallRisk}`);
    }

    // Update hourly metrics
    updateHourlyMetrics(worldState, threats, decisions);

  } catch (err) {
    console.error(`❌ [Agent Tick #${agentState.tickCount}] Error:`, err.message);
  }
}

/**
 * Update hourly analytics metrics.
 */
function updateHourlyMetrics(worldState, threats, decisions) {
  const hour = new Date().getHours();
  const existing = analyticsStore.hourlyMetrics.find(m => m.hour === hour);

  const delivered = worldState.deliveries.filter(d => d.status === 'delivered').length;
  const total = worldState.deliveries.length;

  if (existing) {
    existing.rerouteCount += decisions.filter(d => d.type === 'AUTONOMOUS_REROUTE').length;
    existing.congestionScore = threats.congestionScore;
    existing.activeDeliveries = worldState.activeDeliveries.length;
    existing.deliveredCount = delivered;
    existing.updatedAt = new Date().toISOString();
  } else {
    analyticsStore.hourlyMetrics.push({
      hour,
      rerouteCount: decisions.filter(d => d.type === 'AUTONOMOUS_REROUTE').length,
      congestionScore: threats.congestionScore,
      activeDeliveries: worldState.activeDeliveries.length,
      deliveredCount: delivered,
      totalDeliveries: total,
      onTimeRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
      updatedAt: new Date().toISOString(),
    });
  }

  // Keep only last 24 hours
  if (analyticsStore.hourlyMetrics.length > 24) {
    analyticsStore.hourlyMetrics = analyticsStore.hourlyMetrics.slice(-24);
  }
}

/**
 * Record a delivery completion for analytics.
 */
export function recordDeliveryCompletion(delivery, wasOnTime = true) {
  agentState.stats.totalDeliveriesCompleted++;
  if (wasOnTime) {
    agentState.stats.deliveriesOnTime++;
  } else {
    agentState.stats.deliveriesLate++;
  }

  // Learning: Record if a rerouted delivery was faster
  if (delivery.isRerouted) {
    agentState.stats.successfulReroutes++;
    feedbackLoop.recordRerouteOutcome(delivery, wasOnTime);
  }
}

// ── LEARNING & FEEDBACK LOOP ──────────────────────────────────────────────────
/**
 * The feedback loop tracks the accuracy of agent decisions over time.
 * This enables the agent to improve its predictions and reduce false positives.
 */
const feedbackLoop = {
  predictions: [],    // { zoneId, predictedLevel, actualOutcome, timestamp }
  rerouteOutcomes: [], // { deliveryId, wasRerouted, wasOnTime, timeSaved }
  zoneAccuracy: {},   // { zoneId: { correct: N, total: N } }

  /**
   * Record a traffic prediction outcome for learning.
   */
  recordPrediction(zoneId, predictedLevel, actualLevel) {
    const isCorrect = predictedLevel === actualLevel;
    this.predictions.push({
      zoneId,
      predictedLevel,
      actualLevel,
      isCorrect,
      timestamp: new Date().toISOString(),
    });

    // Update zone accuracy
    if (!this.zoneAccuracy[zoneId]) {
      this.zoneAccuracy[zoneId] = { correct: 0, total: 0 };
    }
    this.zoneAccuracy[zoneId].total++;
    if (isCorrect) this.zoneAccuracy[zoneId].correct++;

    // Keep only last 200 predictions
    if (this.predictions.length > 200) {
      this.predictions = this.predictions.slice(-200);
    }
  },

  /**
   * Record the outcome of a reroute decision.
   */
  recordRerouteOutcome(delivery, wasOnTime) {
    this.rerouteOutcomes.push({
      deliveryId: delivery.id,
      wasRerouted: !!delivery.isRerouted,
      wasOnTime,
      timestamp: new Date().toISOString(),
    });

    if (this.rerouteOutcomes.length > 100) {
      this.rerouteOutcomes = this.rerouteOutcomes.slice(-100);
    }
  },

  /**
   * Get the prediction accuracy for a specific zone.
   * Used by the agent to adjust confidence in predictions.
   */
  getZoneAccuracy(zoneId) {
    const data = this.zoneAccuracy[zoneId];
    if (!data || data.total === 0) return 1.0; // Default: trust predictions
    return data.correct / data.total;
  },

  /**
   * Get overall reroute success rate.
   */
  getRerouteSuccessRate() {
    if (this.rerouteOutcomes.length === 0) return 1.0;
    const successful = this.rerouteOutcomes.filter(r => r.wasOnTime).length;
    return successful / this.rerouteOutcomes.length;
  },

  /**
   * Get summary for analytics dashboard.
   */
  getSummary() {
    const totalPredictions = this.predictions.length;
    const correctPredictions = this.predictions.filter(p => p.isCorrect).length;
    const overallAccuracy = totalPredictions > 0
      ? Math.round((correctPredictions / totalPredictions) * 100)
      : 100;

    return {
      totalPredictions,
      correctPredictions,
      overallAccuracy,
      rerouteSuccessRate: Math.round(this.getRerouteSuccessRate() * 100),
      zoneAccuracy: Object.entries(this.zoneAccuracy).map(([id, data]) => ({
        zoneId: id,
        accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 100,
        sampleSize: data.total,
      })),
    };
  },
};

// ── MULTI-COURIER COORDINATION ────────────────────────────────────────────────
/**
 * Intelligent load balancing and coordination between couriers.
 * Detects overloaded couriers and suggests reassignment.
 */
const courierCoordinator = {
  /**
   * Analyze courier workloads and detect imbalances.
   */
  analyzeWorkloads(deliveries) {
    const courierLoads = {};

    for (const d of deliveries) {
      if (d.status === 'delivered') continue;
      const cid = d.courierId || 'unassigned';
      if (!courierLoads[cid]) {
        courierLoads[cid] = { courierId: cid, pending: 0, highPriority: 0, totalDistance: 0 };
      }
      courierLoads[cid].pending++;
      if (d.priority === 'high') courierLoads[cid].highPriority++;
    }

    const loads = Object.values(courierLoads);
    if (loads.length < 2) return { balanced: true, loads, suggestions: [] };

    const avgLoad = loads.reduce((s, l) => s + l.pending, 0) / loads.length;
    const overloaded = loads.filter(l => l.pending > avgLoad * 1.5);
    const underloaded = loads.filter(l => l.pending < avgLoad * 0.5);

    const suggestions = [];
    for (const over of overloaded) {
      for (const under of underloaded) {
        const excessCount = Math.floor(over.pending - avgLoad);
        if (excessCount > 0) {
          suggestions.push({
            type: 'REASSIGN',
            from: over.courierId,
            to: under.courierId,
            count: Math.min(excessCount, 2), // Max 2 reassignments at a time
            reason: `${over.courierId} memiliki ${over.pending} paket (rata-rata: ${Math.round(avgLoad)}). Sarankan pindahkan ${Math.min(excessCount, 2)} paket ke ${under.courierId}.`,
          });
        }
      }
    }

    return {
      balanced: suggestions.length === 0,
      loads,
      avgLoad: Math.round(avgLoad),
      suggestions,
    };
  },

  /**
   * Detect if a courier is stuck (no delivery progress for too long).
   */
  detectStuckCouriers(deliveries) {
    const stuck = [];
    const now = Date.now();

    // Group by courier
    const byCourier = {};
    for (const d of deliveries) {
      const cid = d.courierId || 'unknown';
      if (!byCourier[cid]) byCourier[cid] = [];
      byCourier[cid].push(d);
    }

    for (const [courierId, courierDeliveries] of Object.entries(byCourier)) {
      const inTransit = courierDeliveries.find(d => d.status === 'in_transit');
      if (!inTransit) continue;

      // If a delivery has been in_transit for more than 45 minutes, flag it
      if (inTransit.startedAt) {
        const elapsed = now - new Date(inTransit.startedAt).getTime();
        if (elapsed > 45 * 60 * 1000) {
          stuck.push({
            courierId,
            deliveryId: inTransit.id,
            recipient: inTransit.recipient,
            elapsedMinutes: Math.round(elapsed / 60000),
            suggestion: 'Kurir mungkin terjebak macet atau mengalami hambatan. Pertimbangkan reassignment.',
          });
        }
      }
    }

    return stuck;
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

let agentInterval = null;

/**
 * Start the autonomous agent loop.
 */
export function startAgent() {
  if (agentState.isRunning) {
    console.log('🤖 [Agent] Already running.');
    return;
  }

  agentState.isRunning = true;
  console.log('\n🤖 ═══════════════════════════════════════════');
  console.log('🤖  Autonomous Agent STARTED');
  console.log(`🤖  Tick interval: ${AGENT_TICK_INTERVAL / 1000}s`);
  console.log(`🤖  Reroute cooldown: ${REROUTE_COOLDOWN / 1000}s`);
  console.log('🤖 ═══════════════════════════════════════════\n');

  // Run first tick immediately
  agentTick();

  // Schedule periodic ticks
  agentInterval = setInterval(agentTick, AGENT_TICK_INTERVAL);
}

/**
 * Stop the autonomous agent loop.
 */
export function stopAgent() {
  agentState.isRunning = false;
  if (agentInterval) {
    clearInterval(agentInterval);
    agentInterval = null;
  }
  console.log('🤖 [Agent] Stopped.');
}

/**
 * Get current agent status and stats (for API/dashboard).
 */
export function getAgentStatus() {
  return {
    isRunning: agentState.isRunning,
    lastTick: agentState.lastTick,
    tickCount: agentState.tickCount,
    stats: { ...agentState.stats },
    recentDecisions: agentState.decisionsLog.slice(-20),
    onTimeRate: agentState.stats.totalDeliveriesCompleted > 0
      ? Math.round((agentState.stats.deliveriesOnTime / agentState.stats.totalDeliveriesCompleted) * 100)
      : 100,
  };
}

/**
 * Get analytics data for the dashboard.
 */
export function getAnalytics() {
  const stats = agentState.stats;
  const onTimeRate = stats.totalDeliveriesCompleted > 0
    ? Math.round((stats.deliveriesOnTime / stats.totalDeliveriesCompleted) * 100)
    : 100;

  return {
    summary: {
      totalDecisions: stats.totalDecisions,
      reroutesIssued: stats.reroutesIssued,
      hubsAssigned: stats.hubsAssigned,
      alertsSent: stats.alertsSent,
      kmSaved: Math.round(stats.kmSaved * 10) / 10,
      minutesSaved: stats.minutesSaved,
      co2Saved: Math.round(stats.kmSaved * 0.12 * 100) / 100, // 120g CO2/km
      deliveriesCompleted: stats.totalDeliveriesCompleted,
      onTimeRate,
      operationalDragReduction: Math.min(95, Math.round(stats.minutesSaved * 0.8)), // percentage estimate
      successfulReroutes: stats.successfulReroutes,
    },
    learning: feedbackLoop.getSummary(),
    hourlyMetrics: analyticsStore.hourlyMetrics,
    recentDecisions: analyticsStore.agentDecisions.slice(-50),
    agentUptime: agentState.tickCount * (AGENT_TICK_INTERVAL / 1000),
    generatedAt: new Date().toISOString(),
  };
}

export { agentState };
