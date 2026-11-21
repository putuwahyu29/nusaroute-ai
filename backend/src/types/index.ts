export type DeliveryStatus = "unassigned" | "pending" | "in_transit" | "delivered" | "rerouted";

export type Priority = "high" | "medium" | "low";

export interface PickupHub {
  id?: string;
  label: string;
  reason: string;
  lat?: number;
  lng?: number;
}

export interface Delivery {
  id: string;
  courierId: string | null;
  recipient: string;
  address: string;
  lat: number;
  lng: number;
  status: DeliveryStatus;
  priority: Priority;
  estimatedArrival?: string | null;
  packageCount?: number;
  timeSlot?: string;
  notes?: string;
  pickupHub?: PickupHub | null;
  isRerouted?: boolean;
  deliveryNote?: string | null;
  deliveredAt?: string | null;
}

export interface User {
  id: string;
  email: string;
  username?: string;
  name: string;
  role: "courier" | "dispatcher";
  region?: string;
  hubLat?: number;
  hubLng?: number;
  password?: string;
  authProvider?: "password" | "google";
  photoUrl?: string;
}

export interface TrafficZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  area: string;
  peakHours: [number, number][];
  floodProne?: boolean;
  level?: "low" | "medium" | "high" | "critical";
  reason?: string;
  label?: string;
  color?: string;
  predictedAt?: string;
}

export type WeatherCondition = "sunny" | "cloudy" | "rain" | "heavy_rain";

export interface Weather {
  condition: WeatherCondition;
  temp: number;
  updatedAt: string;
}

export interface IncidentReport {
  id: string;
  courierId: string;
  location: string;
  hasPhoto: boolean;
  hasAudio: boolean;
  aiDecision: AIDecision;
  createdAt: string;
}

export interface AITelemetry {
  latencyMs: number;
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
  retryCount?: number;
}

export interface AIDecision {
  action: "REROUTE" | "WAIT" | "REDIRECT_TO_HUB" | "ESCALATE";
  severity: "low" | "medium" | "high" | "critical";
  severityLabel: string;
  incidentType: "road_closure" | "traffic_jam" | "flooding" | "accident" | "other";
  incidentTypeLabel: string;
  incidentTypeLabelId?: string;
  analysis: string;
  analysisId?: string;
  analysisEn?: string;
  recommendation: string;
  recommendationId?: string;
  recommendationEn?: string;
  reroutePoints: string[];
  estimatedDelay: number;
  isMock?: boolean;
  model?: string;
  processedAt?: string;
  errorDetails?: string;
  telemetry?: AITelemetry;
}

export interface RouteOptimizationResult {
  optimizedOrder: string[];
  reasoning: string;
  totalEstimatedTime: string;
  routeHighlights: string[];
  isMock?: boolean;
  model?: string;
  optimizedAt?: string;
  errorDetails?: string;
}

export interface AIChatContext {
  courierId: string;
  deliveries: Delivery[];
  trafficZones: TrafficZone[];
  weather: Weather;
}

export interface AIChatResponse {
  reply: string;
  model: string;
  isMock: boolean;
  timestamp: string;
}

export interface ProactiveAlert {
  id: string;
  deliveryId: string;
  recipient: string;
  severity: "high" | "critical";
  affectedZones: string[];
  nearestZoneName: string;
  nearestDistanceKm: number;
  alternativeNote: string;
  impactScore: number;
  priorityLabel: string;
  recommendedAction: "REROUTE" | "REDIRECT_TO_HUB";
  delivery: Delivery;
  threatZone: TrafficZone;
  suggestedAction: "REROUTE" | "REDIRECT_TO_HUB";
  message: string;
}

export type AgentDecisionType =
  | "AUTONOMOUS_REROUTE"
  | "HUB_OPTIMIZATION"
  | "TRAFFIC_ADVISORY"
  | "LOAD_BALANCE"
  | "STUCK_COURIER";

export interface AgentDecision {
  id: string;
  timestamp: string;
  type: AgentDecisionType;
  summary: string;
  details?: Record<string, unknown>;
  estimatedSaving?: number;
}

export interface AgentStats {
  totalDecisions: number;
  reroutesIssued: number;
  hubsAssigned: number;
  alertsSent: number;
  successfulReroutes: number;
  kmSaved: number;
  minutesSaved: number;
  deliveriesOnTime: number;
  deliveriesLate: number;
  totalDeliveriesCompleted: number;
}

export interface AgentState {
  isRunning: boolean;
  lastTick: string | null;
  lastHubAssessment: string | null;
  tickCount: number;
  decisionsLog: AgentDecision[];
  rerouteCooldowns: Record<string, number>;
  stats: AgentStats;
}
