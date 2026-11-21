export type DeliveryStatus = "unassigned" | "pending" | "in_transit" | "delivered" | "rerouted";

export type Priority = "high" | "medium" | "low";

export interface PickupHub {
  id?: string;
  label: string;
  reason: string;
  lat?: number;
  lng?: number;
  centroid?: { lat: number; lng: number };
  deliveryIds?: string[];
  deliveries?: Delivery[];
  stopCount?: number;
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
  authProvider?: "password" | "google";
  photoUrl?: string;
}

export interface TrafficZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  area?: string;
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
  updatedAt?: string;
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
}

export interface IncidentReport {
  id: string;
  courierId: string;
  location: string;
  lat?: number;
  lng?: number;
  hasPhoto: boolean;
  hasAudio: boolean;
  aiDecision: AIDecision;
  createdAt: string;
}

export interface RouteAlternative {
  name: string;
  via: string;
  durationMins: number;
  distanceKm: number;
  isRecommended: boolean;
}

export interface RouteOptimizationResult {
  optimizedOrder: string[];
  reasoning: string;
  totalEstimatedTime: string;
  routeHighlights?: string[];
  isMock?: boolean;
  model?: string;
  optimizedAt?: string;
}

export interface AgentDecision {
  id: string;
  timestamp: string;
  type: string;
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
  co2SavedKg?: number;
  hoursSaved?: number;
  onTimeRate?: number;
  operationalDragReductionPercent?: number;
}
