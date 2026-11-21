import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import crypto from "crypto";
import type { AgentDecision, AgentState, Delivery, IncidentReport, TrafficZone, User } from "../types/index.js";
import { APP_CONFIG } from "../config/app-config.js";
import { SEED_DELIVERIES, SEED_USERS } from "../data/seed-data.js";
import { SURABAYA_ZONES, FLOOD_PRONE_ZONE_IDS } from "../data/surabaya-zones.js";

let db: Firestore | null = null;
let adminAuth: Auth | null = null;
export let isFirestoreReady = false;
export let isFirebaseAuthReady = false;

export const DEMO_DELIVERIES: Delivery[] = SEED_DELIVERIES;

/**
 * Cryptographically strong salted password hashing using Node.js native scrypt.
 * Format: scrypt$<hex_salt>$<hex_derived_key>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string | undefined): boolean {
  if (!storedHash) return false;

  if (storedHash.startsWith("scrypt$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 3) return false;
    const [, salt, expectedHex] = parts;
    const actualBuf = crypto.scryptSync(password, salt, 64);
    const expectedBuf = Buffer.from(expectedHex, "hex");
    if (actualBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  }

  // Backward-compatible constant-time check for legacy SHA-256 hashes already in Firestore
  const legacyHex = crypto.createHash("sha256").update(password).digest("hex");
  const a = Buffer.from(legacyHex, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const memoryUsers: User[] = SEED_USERS.map((u) => ({
  ...u,
  password: hashPassword(APP_CONFIG.demoDefaultPassword),
}));

const memoryStore: {
  reports: IncidentReport[];
  deliveries: Delivery[];
  trafficZones: TrafficZone[];
} = {
  reports: [],
  deliveries: JSON.parse(JSON.stringify(SEED_DELIVERIES)),
  trafficZones: SURABAYA_ZONES.map((z) => ({
    ...z,
    floodProne: (FLOOD_PRONE_ZONE_IDS as readonly string[]).includes(z.id),
  })),
};

export async function resetDatabase(): Promise<{
  usersCount: number;
  deliveriesCount: number;
  zonesCount: number;
  cleanedReportsCount: number;
  cleanedDecisionsCount: number;
}> {
  if (isFirestoreReady && db) {
    // 1. Reset all 15 deliveries to initial unassigned status
    for (const d of SEED_DELIVERIES) {
      await db.collection("deliveries").doc(d.id).set(d);
    }
    const allDels = await db.collection("deliveries").get();
    const seedIds = new Set(SEED_DELIVERIES.map((s) => s.id));
    for (const doc of allDels.docs) {
      if (!seedIds.has(doc.id)) {
        await doc.ref.delete();
      }
    }

    // 2. Reset Surabaya traffic zones
    for (const z of memoryStore.trafficZones) {
      await db.collection("traffic_zones").doc(z.id).set(z);
    }

    // 3. Ensure seed users have valid active status & default password
    for (const u of SEED_USERS) {
      await db.collection("users").doc(u.id).set(
        {
          ...u,
          password: hashPassword(APP_CONFIG.demoDefaultPassword),
          active: true,
        },
        { merge: true }
      );
    }

    // 4. Clean transient test incident reports
    const reportsSnap = await db.collection("incident_reports").get();
    for (const doc of reportsSnap.docs) {
      await doc.ref.delete();
    }

    // 5. Clean past agent decisions
    const decisionsSnap = await db.collection("agent_decisions").get();
    for (const doc of decisionsSnap.docs) {
      await doc.ref.delete();
    }

    return {
      usersCount: SEED_USERS.length,
      deliveriesCount: SEED_DELIVERIES.length,
      zonesCount: memoryStore.trafficZones.length,
      cleanedReportsCount: reportsSnap.size,
      cleanedDecisionsCount: decisionsSnap.size,
    };
  }

  // In-memory fallback
  memoryStore.deliveries = JSON.parse(JSON.stringify(SEED_DELIVERIES));
  memoryStore.reports = [];
  memoryStore.trafficZones = SURABAYA_ZONES.map((z) => ({
    ...z,
    floodProne: (FLOOD_PRONE_ZONE_IDS as readonly string[]).includes(z.id),
  }));

  return {
    usersCount: memoryUsers.length,
    deliveriesCount: memoryStore.deliveries.length,
    zonesCount: memoryStore.trafficZones.length,
    cleanedReportsCount: 0,
    cleanedDecisionsCount: 0,
  };
}

export async function seedDatabase(force = false): Promise<void> {
  if (!db) return;
  if (force) {
    await resetDatabase();
    return;
  }
  if (!APP_CONFIG.enableAutoSeed) {
    console.log("[Firestore Seed] Skipped (ENABLE_AUTO_SEED=false / production mode).");
    return;
  }

  try {
    const [existingUsers, existingDeliveries, existingZones] = await Promise.all([
      db.collection("users").limit(1).get(),
      db.collection("deliveries").limit(1).get(),
      db.collection("traffic_zones").limit(1).get(),
    ]);

    if (existingUsers.empty) {
      for (const u of SEED_USERS) {
        await db.collection("users").doc(u.id).set(
          {
            ...u,
            password: hashPassword(APP_CONFIG.demoDefaultPassword),
          },
          { merge: true }
        );
      }
      console.log(`[Firestore Seed] Initialized ${SEED_USERS.length} seed users (collection was empty).`);
    } else {
      console.log("[Firestore Seed] Users collection already populated; preserving existing accounts.");
    }

    if (existingDeliveries.empty) {
      for (const d of SEED_DELIVERIES) {
        await db.collection("deliveries").doc(d.id).set(d);
      }
      console.log(`[Firestore Seed] Initialized ${SEED_DELIVERIES.length} seed deliveries (collection was empty).`);
    } else {
      console.log("[Firestore Seed] Deliveries collection already populated; preserving live delivery state.");
    }

    if (existingZones.empty) {
      for (const z of memoryStore.trafficZones) {
        await db.collection("traffic_zones").doc(z.id).set(z);
      }
      console.log(`[Firestore Seed] Initialized ${memoryStore.trafficZones.length} traffic zones (collection was empty).`);
    } else {
      console.log("[Firestore Seed] Traffic zones collection already populated; preserving custom zones.");
    }
  } catch (err: any) {
    console.error("[Firestore Seed Error]:", err?.message || err);
  }
}

const { projectId, clientEmail, privateKey } = APP_CONFIG.firebase;
if (projectId && clientEmail && privateKey) {
  try {
    const certConfig = {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    };
    const app = getApps().length === 0
      ? initializeApp({ credential: cert(certConfig) })
      : getApps()[0];
    db = getFirestore(app);
    adminAuth = getAuth(app);
    isFirestoreReady = true;
    isFirebaseAuthReady = true;
    console.log(`[Firebase Admin] Connected to project: ${certConfig.projectId}`);
    seedDatabase();
  } catch (err: any) {
    console.error("[Firebase Admin Error]:", err?.message || err);
  }
} else {
  console.log("[Firebase Admin] Credentials not configured. Using in-memory store mode.");
}

export async function loginUser(
  identifier: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const normalized = identifier.trim().toLowerCase();

  if (isFirestoreReady && db) {
    try {
      let docSnap = null;
      if (normalized.includes("@")) {
        const snap = await db.collection("users").where("email", "==", normalized).limit(1).get();
        if (!snap.empty) docSnap = snap.docs[0];
      } else {
        const byUsername = await db.collection("users").where("username", "==", normalized).limit(1).get();
        if (!byUsername.empty) {
          docSnap = byUsername.docs[0];
        } else {
          // Fallback for legacy seeded accounts without explicit username field
          const byDomainEmail = await db
            .collection("users")
            .where("email", "==", `${normalized}@nusaroute.ai`)
            .limit(1)
            .get();
          if (!byDomainEmail.empty) docSnap = byDomainEmail.docs[0];
        }
      }

      if (docSnap) {
        const userData = docSnap.data() as User;
        if (verifyPassword(password, userData.password)) {
          const { password: _omitted, ...safeUser } = userData;
          return { success: true, user: { ...safeUser, id: docSnap.id } };
        }
      }
    } catch (err: any) {
      console.error("[Login Error]:", err?.message || err);
    }
  } else {
    const found = memoryUsers.find((u) => {
      const emailLower = u.email.toLowerCase();
      const usernameLower = (u.username || emailLower.split("@")[0]).toLowerCase();
      return (emailLower === normalized || usernameLower === normalized) && verifyPassword(password, u.password);
    });
    if (found) {
      const { password: _omitted, ...safeUser } = found;
      return { success: true, user: safeUser as User };
    }
  }
  return { success: false, error: "Username/email atau kata sandi salah." };
}

export async function loginWithGoogleIdToken(idToken: string): Promise<{
  success: boolean;
  user?: User;
  error?: string;
  statusCode?: number;
}> {
  if (!isFirebaseAuthReady || !adminAuth) {
    return {
      success: false,
      statusCode: 503,
      error: "Login Google belum aktif di server (Firebase Admin SDK belum dikonfigurasi).",
    };
  }

  try {
    // Cryptographically verifies Google's RS256 signature, issuer, project audience, and expiration
    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = (decoded.email || "").trim().toLowerCase();
    if (!email || decoded.email_verified === false) {
      return {
        success: false,
        statusCode: 401,
        error: "Akun Google tidak memiliki alamat email terverifikasi.",
      };
    }

    const isConfiguredDispatcher = APP_CONFIG.dispatcherEmails.includes(email);

    if (isFirestoreReady && db) {
      const byEmail = await db.collection("users").where("email", "==", email).limit(1).get();
      if (!byEmail.empty) {
        const existingDoc = byEmail.docs[0];
        const existingData = existingDoc.data() as User;
        const resolvedRole: "courier" | "dispatcher" = isConfiguredDispatcher
          ? "dispatcher"
          : existingData.role || "courier";
        const updatedFields: Partial<User> = {
          role: resolvedRole,
          ...(decoded.picture ? { photoUrl: decoded.picture } : {}),
        };
        await existingDoc.ref.set(
          { ...updatedFields, lastLoginAt: new Date().toISOString() },
          { merge: true }
        );
        const { password: _omitted, ...safeUser } = existingData;
        return {
          success: true,
          user: {
            ...safeUser,
            ...updatedFields,
            id: existingDoc.id,
          },
        };
      }

      if (!APP_CONFIG.googleAutoRegister) {
        return {
          success: false,
          statusCode: 403,
          error: `Akun Google (${email}) belum terdaftar di sistem. Hubungi Dispatcher/Admin untuk mendaftarkan email Anda.`,
        };
      }

      const newUser: User = {
        id: decoded.uid,
        email,
        username: email.split("@")[0],
        name: decoded.name || email.split("@")[0],
        role: isConfiguredDispatcher ? "dispatcher" : "courier",
        region: "Surabaya",
        authProvider: "google",
        ...(decoded.picture ? { photoUrl: decoded.picture } : {}),
      };

      await db.collection("users").doc(newUser.id).set({
        ...newUser,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      });

      return { success: true, user: newUser };
    }

    return {
      success: false,
      statusCode: 503,
      error: "Firestore belum siap untuk memproses akun Google.",
    };
  } catch (err: any) {
    console.error("[Google Login Verify Error]:", err?.message || err);
    return {
      success: false,
      statusCode: 401,
      error: "Token Google tidak valid atau sesi telah kedaluwarsa. Silakan login ulang.",
    };
  }
}

export async function listUsers(): Promise<User[]> {
  if (isFirestoreReady && db) {
    const snap = await db.collection("users").get();
    return snap.docs.map((d: QueryDocumentSnapshot) => {
      const { password: _omitted, ...safeUser } = d.data() as User;
      return { ...safeUser, id: d.id };
    });
  }
  return memoryUsers.map(({ password: _omitted, ...safeUser }) => safeUser as User);
}

export async function registerUser(input: {
  email: string;
  name: string;
  role: "courier" | "dispatcher";
  username?: string;
  region?: string;
  hubLat?: number;
  hubLng?: number;
  password?: string;
}): Promise<{ success: boolean; user?: User; error?: string; statusCode?: number }> {
  const email = input.email.trim().toLowerCase();
  const username = (input.username || email.split("@")[0]).trim().toLowerCase();
  const name = input.name.trim();
  const role: "courier" | "dispatcher" = input.role === "dispatcher" ? "dispatcher" : "courier";
  const region = (input.region || APP_CONFIG.operationCity).trim();
  const authProvider: "password" | "google" = input.password ? "password" : "google";

  if (!email.includes("@") || !name) {
    return { success: false, statusCode: 400, error: "Email valid dan nama lengkap wajib diisi." };
  }

  if (isFirestoreReady && db) {
    const existing = await db.collection("users").where("email", "==", email).limit(1).get();
    if (!existing.empty) {
      return { success: false, statusCode: 409, error: `Email ${email} sudah terdaftar.` };
    }

    const id = `${role === "dispatcher" ? "adm" : "cur"}-${crypto.randomBytes(4).toString("hex")}`;
    const docData: Record<string, unknown> = {
      id,
      email,
      username,
      name,
      role,
      region,
      authProvider,
      ...(typeof input.hubLat === "number" && Number.isFinite(input.hubLat) ? { hubLat: input.hubLat } : {}),
      ...(typeof input.hubLng === "number" && Number.isFinite(input.hubLng) ? { hubLng: input.hubLng } : {}),
      createdAt: new Date().toISOString(),
    };
    if (input.password) {
      docData.password = hashPassword(input.password);
    }

    await db.collection("users").doc(id).set(docData);
    const { password: _omitted, ...safeUser } = docData as unknown as User;
    return { success: true, user: safeUser };
  }

  if (memoryUsers.some((u) => u.email.toLowerCase() === email)) {
    return { success: false, statusCode: 409, error: `Email ${email} sudah terdaftar.` };
  }

  const id = `${role === "dispatcher" ? "adm" : "cur"}-${crypto.randomBytes(4).toString("hex")}`;
  const newUser: User = {
    id,
    email,
    username,
    name,
    role,
    region,
    authProvider,
    ...(typeof input.hubLat === "number" && Number.isFinite(input.hubLat) ? { hubLat: input.hubLat } : {}),
    ...(typeof input.hubLng === "number" && Number.isFinite(input.hubLng) ? { hubLng: input.hubLng } : {}),
    ...(input.password ? { password: hashPassword(input.password) } : {}),
  };
  memoryUsers.push(newUser);
  const { password: _omitted, ...safeUser } = newUser;
  return { success: true, user: safeUser };
}

export async function getTrafficZones(): Promise<TrafficZone[]> {
  if (isFirestoreReady && db) {
    try {
      const snap = await db.collection("traffic_zones").get();
      if (!snap.empty) {
        return snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as TrafficZone));
      }
    } catch (err: any) {
      console.error("[Get Traffic Zones Error]:", err?.message || err);
    }
  }
  return memoryStore.trafficZones;
}

export async function upsertTrafficZone(zone: TrafficZone): Promise<TrafficZone> {
  const cleanZone: TrafficZone = {
    id: zone.id || `zone-${crypto.randomBytes(3).toString("hex")}`,
    name: zone.name.trim(),
    lat: zone.lat,
    lng: zone.lng,
    radius: zone.radius > 0 ? zone.radius : 1.5,
    area: (zone.area || APP_CONFIG.operationCity).trim(),
    peakHours: Array.isArray(zone.peakHours) && zone.peakHours.length > 0 ? zone.peakHours : [[7, 9], [17, 19]],
    floodProne: Boolean(zone.floodProne),
  };

  if (isFirestoreReady && db) {
    await db.collection("traffic_zones").doc(cleanZone.id).set(cleanZone, { merge: true });
    return cleanZone;
  }

  const idx = memoryStore.trafficZones.findIndex((z) => z.id === cleanZone.id);
  if (idx !== -1) memoryStore.trafficZones[idx] = cleanZone;
  else memoryStore.trafficZones.push(cleanZone);
  return cleanZone;
}

export async function deleteTrafficZone(zoneId: string): Promise<boolean> {
  if (isFirestoreReady && db) {
    await db.collection("traffic_zones").doc(zoneId).delete();
    return true;
  }
  const prevLen = memoryStore.trafficZones.length;
  memoryStore.trafficZones = memoryStore.trafficZones.filter((z) => z.id !== zoneId);
  return memoryStore.trafficZones.length < prevLen;
}

export async function saveIncidentReport(reportData: any): Promise<{ id: string; [key: string]: any }> {
  const doc = {
    ...reportData,
    id: `RPT-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  if (isFirestoreReady && db) {
    try {
      const ref = await db.collection("incident_reports").add(doc);
      return { id: ref.id, ...doc };
    } catch (err: any) {
      console.error("[Incident Save Error]:", err?.message || err);
    }
  }

  memoryStore.reports.unshift(doc);
  return doc;
}

export async function getDeliveries(courierId: string): Promise<Delivery[]> {
  if (isFirestoreReady && db) {
    try {
      const snap = await db.collection("deliveries").where("courierId", "==", courierId).get();
      return snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as Delivery));
    } catch (err: any) {
      console.error("[Get Deliveries Error]:", err?.message || err);
    }
  }
  return memoryStore.deliveries.filter((d) => d.courierId === courierId);
}

export async function getAllDeliveries(): Promise<Delivery[]> {
  if (isFirestoreReady && db) {
    try {
      const snap = await db.collection("deliveries").get();
      return snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as Delivery));
    } catch (err: any) {
      console.error("[Get All Deliveries Error]:", err?.message || err);
    }
  }
  return memoryStore.deliveries;
}

export async function getDeliveryById(id: string): Promise<Delivery | null> {
  if (isFirestoreReady && db) {
    try {
      const snap = await db.collection("deliveries").doc(id).get();
      if (snap.exists) return { id: snap.id, ...snap.data() } as Delivery;
    } catch (err: any) {
      console.error("[Get Delivery By ID Error]:", err?.message || err);
    }
  }
  return memoryStore.deliveries.find((d) => d.id === id) || null;
}

export async function addDelivery(data: Partial<Delivery>): Promise<Delivery> {
  const generatedId = `DEL-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(2)
    .toString("hex")
    .toUpperCase()}`;

  const newDelivery: Delivery = {
    id: data.id || generatedId,
    courierId: data.courierId || null,
    recipient: data.recipient || "Penerima Baru",
    address: data.address || "Surabaya",
    lat: data.lat ?? APP_CONFIG.defaultOrigin.lat,
    lng: data.lng ?? APP_CONFIG.defaultOrigin.lng,
    status: (data.status as any) || "unassigned",
    priority: data.priority || "medium",
    estimatedArrival: data.estimatedArrival || null,
    packageCount: data.packageCount || 1,
    timeSlot: data.timeSlot || "09:00 - 12:00",
    notes: data.notes || "",
    pickupHub: data.pickupHub || null,
    isRerouted: false,
    deliveryNote: null,
  };

  if (isFirestoreReady && db) {
    try {
      await db.collection("deliveries").doc(newDelivery.id).set(newDelivery);
      return newDelivery;
    } catch (err: any) {
      console.error("[Add Delivery Error]:", err?.message || err);
    }
  }

  memoryStore.deliveries.push(newDelivery);
  return newDelivery;
}

export async function updateDeliveryStatus(
  deliveryId: string,
  status: string,
  extra: Record<string, any> = {}
): Promise<Delivery | null> {
  if (isFirestoreReady && db) {
    try {
      await db.collection("deliveries").doc(deliveryId).update({ status, ...extra });
      const updated = await db.collection("deliveries").doc(deliveryId).get();
      return { id: updated.id, ...updated.data() } as Delivery;
    } catch (err: any) {
      console.error("[Update Status Error]:", err?.message || err);
    }
  }

  const idx = memoryStore.deliveries.findIndex((d) => d.id === deliveryId);
  if (idx !== -1) {
    memoryStore.deliveries[idx] = { ...memoryStore.deliveries[idx], status: status as any, ...extra };
    return memoryStore.deliveries[idx];
  }
  return null;
}

export async function applyPickupHubToDeliveries(hub: {
  deliveryIds: string[];
  label: string;
  reason: string;
  centroid?: { lat: number; lng: number };
}): Promise<{ success: boolean; updatedCount: number }> {
  const ids = new Set(hub.deliveryIds || []);
  let count = 0;

  if (isFirestoreReady && db) {
    const batch = db.batch();
    for (const id of ids) {
      const ref = db.collection("deliveries").doc(id);
      batch.update(ref, {
        pickupHub: {
          label: hub.label,
          reason: hub.reason,
          lat: hub.centroid?.lat,
          lng: hub.centroid?.lng,
        },
      });
      count++;
    }
    await batch.commit();
    return { success: true, updatedCount: count };
  }

  memoryStore.deliveries.forEach((d) => {
    if (ids.has(d.id)) {
      d.pickupHub = {
        label: hub.label,
        reason: hub.reason,
        lat: hub.centroid?.lat,
        lng: hub.centroid?.lng,
      };
      count++;
    }
  });

  return { success: true, updatedCount: count };
}

export async function getAllReports(): Promise<IncidentReport[]> {
  if (isFirestoreReady && db) {
    try {
      const snap = await db.collection("incident_reports").orderBy("createdAt", "desc").limit(50).get();
      return snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as IncidentReport));
    } catch (err: any) {
      console.error("[Get Reports Error]:", err?.message || err);
    }
  }
  return memoryStore.reports;
}

const fcmTokenStore = new Map<string, string>();

export async function saveUserFcmToken(
  userId: string,
  token: string
): Promise<{ success: boolean }> {
  fcmTokenStore.set(userId, token);
  if (isFirestoreReady && db) {
    try {
      await db.collection("users").doc(userId).set(
        {
          fcmToken: token,
          fcmUpdatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Save FCM Token Error]:", msg);
    }
  }
  return { success: true };
}

export async function saveAgentDecision(decision: AgentDecision): Promise<void> {
  if (!isFirestoreReady || !db) return;
  try {
    await db.collection("agent_decisions").doc(decision.id).set(decision);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Save Agent Decision Error]:", msg);
  }
}

export async function getRecentAgentDecisions(limit = 50): Promise<AgentDecision[]> {
  if (!isFirestoreReady || !db) return [];
  try {
    const snap = await db
      .collection("agent_decisions")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((d: QueryDocumentSnapshot) => d.data() as AgentDecision).reverse();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Load Agent Decisions Error]:", msg);
    return [];
  }
}

export interface PersistedAgentSnapshot {
  tickCount: number;
  lastTick: string | null;
  lastHubAssessment: string | null;
  stats: AgentState["stats"];
  updatedAt: string;
}

export async function saveAgentStateSnapshot(snapshot: Omit<PersistedAgentSnapshot, "updatedAt">): Promise<void> {
  if (!isFirestoreReady || !db) return;
  try {
    await db.collection("system_state").doc("autonomous_agent").set(
      {
        ...snapshot,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Save Agent Snapshot Error]:", msg);
  }
}

export async function loadAgentStateSnapshot(): Promise<PersistedAgentSnapshot | null> {
  if (!isFirestoreReady || !db) return null;
  try {
    const doc = await db.collection("system_state").doc("autonomous_agent").get();
    if (!doc.exists) return null;
    return doc.data() as PersistedAgentSnapshot;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Load Agent Snapshot Error]:", msg);
    return null;
  }
}
