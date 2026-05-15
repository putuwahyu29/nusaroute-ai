/**
 * NusaRoute AI — Firebase Admin SDK Service
 * Handles all server-side Firestore operations.
 * Gracefully degrades to in-memory mode when not configured.
 */

import admin from "firebase-admin";
import dotenv from "dotenv";
dotenv.config();

let db = null;
let isFirestoreReady = false;

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } =
  process.env;

// ── Real-World Surabaya Delivery Data ──────────────────────────────────────────
// All deliveries start as "unassigned" — dispatcher assigns them to couriers
// Locations are clustered to enable Smart Pickup Hub feature
const DEMO_DELIVERIES = [
  // ═══ CLUSTER A: Area Tunjungan / Pusat Kota (3 paket berdekatan ~0.5km) ═══
  {
    id: "DEL-001",
    courierId: null,
    recipient: "Tunjungan Plaza 6 — Lt. 4",
    address: "Jl. Embong Malang No. 21-31, Surabaya",
    lat: -7.2625,
    lng: 112.7389,
    status: "unassigned",
    priority: "high",
    estimatedArrival: null,
    packageCount: 2,
    timeSlot: "09:00 - 11:00",
    notes: "Titip di concierge P6",
  },
  {
    id: "DEL-002",
    courierId: null,
    recipient: "Hotel Majapahit — Resepsionis",
    address: "Jl. Tunjungan No. 65, Surabaya",
    lat: -7.2601,
    lng: 112.7401,
    status: "unassigned",
    priority: "medium",
    estimatedArrival: null,
    packageCount: 1,
    timeSlot: "09:00 - 12:00",
    notes: "Paket tamu hotel, titip resepsionis",
  },
  {
    id: "DEL-003",
    courierId: null,
    recipient: "Siola Surabaya — Toko Buku",
    address: "Jl. Tunjungan No. 1, Surabaya",
    lat: -7.2588,
    lng: 112.7395,
    status: "unassigned",
    priority: "low",
    estimatedArrival: null,
    packageCount: 3,
    timeSlot: "10:00 - 14:00",
    notes: "Lantai 2, toko pojok kanan",
  },

  // ═══ CLUSTER B: Area Gubeng / RS (3 paket berdekatan ~0.8km) ═══
  {
    id: "DEL-004",
    courierId: null,
    recipient: "RS Siloam Surabaya",
    address: "Jl. Raya Gubeng No. 70, Surabaya",
    lat: -7.2731,
    lng: 112.7482,
    status: "unassigned",
    priority: "high",
    estimatedArrival: null,
    packageCount: 3,
    timeSlot: "09:00 - 10:00",
    notes: "Paket farmasi — urgent, masuk via IGD",
  },
  {
    id: "DEL-005",
    courierId: null,
    recipient: "Stasiun Gubeng — Loket Paket",
    address: "Jl. Gubeng Masjid No. 1, Surabaya",
    lat: -7.2652,
    lng: 112.7523,
    status: "unassigned",
    priority: "medium",
    estimatedArrival: null,
    packageCount: 2,
    timeSlot: "10:00 - 13:00",
    notes: "Serahkan ke loket paket KAI",
  },
  {
    id: "DEL-006",
    courierId: null,
    recipient: "Apotek Kimia Farma Gubeng",
    address: "Jl. Pemuda No. 27, Surabaya",
    lat: -7.2680,
    lng: 112.7510,
    status: "unassigned",
    priority: "high",
    estimatedArrival: null,
    packageCount: 1,
    timeSlot: "09:00 - 11:00",
    notes: "Obat resep — jangan terbalik",
  },

  // ═══ CLUSTER C: Area Wonokromo / Darmo (3 paket berdekatan ~1km) ═══
  {
    id: "DEL-007",
    courierId: null,
    recipient: "Ciputra World Surabaya",
    address: "Jl. Mayjen Sungkono No. 89, Surabaya",
    lat: -7.2912,
    lng: 112.7231,
    status: "unassigned",
    priority: "medium",
    estimatedArrival: null,
    packageCount: 2,
    timeSlot: "11:00 - 14:00",
    notes: "Parkir di area drop-off Barat",
  },
  {
    id: "DEL-008",
    courierId: null,
    recipient: "Kebun Binatang Surabaya (KBS)",
    address: "Jl. Setail No. 1, Surabaya",
    lat: -7.2959,
    lng: 112.7369,
    status: "unassigned",
    priority: "low",
    estimatedArrival: null,
    packageCount: 5,
    timeSlot: "10:00 - 15:00",
    notes: "Paket pakan hewan — gerbang logistik belakang",
  },
  {
    id: "DEL-009",
    courierId: null,
    recipient: "BG Junction Mall",
    address: "Jl. Bubutan No. 1-7, Surabaya",
    lat: -7.2485,
    lng: 112.7345,
    status: "unassigned",
    priority: "medium",
    estimatedArrival: null,
    packageCount: 1,
    timeSlot: "11:00 - 13:00",
    notes: "Tenant lt. 3 — konfirmasi WA dulu",
  },

  // ═══ CLUSTER D: Area Sukolilo / ITS / MERR (3 paket berdekatan ~1.2km) ═══
  {
    id: "DEL-010",
    courierId: null,
    recipient: "Institut Teknologi Sepuluh Nopember",
    address: "Kampus ITS Sukolilo, Surabaya",
    lat: -7.2824,
    lng: 112.7949,
    status: "unassigned",
    priority: "low",
    estimatedArrival: null,
    packageCount: 1,
    timeSlot: "13:00 - 16:00",
    notes: "Gedung Rektorat lt. 2",
  },
  {
    id: "DEL-011",
    courierId: null,
    recipient: "Galaxy Mall 3 — Uniqlo",
    address: "Jl. Dharmahusada Indah Timur, Surabaya",
    lat: -7.2755,
    lng: 112.7801,
    status: "unassigned",
    priority: "medium",
    estimatedArrival: null,
    packageCount: 4,
    timeSlot: "14:00 - 17:00",
    notes: "Hubungi PIC Toko sebelum datang",
  },
  {
    id: "DEL-012",
    courierId: null,
    recipient: "Marvell City Mall",
    address: "Jl. Nginden Semolo No. 99, Surabaya",
    lat: -7.2890,
    lng: 112.7720,
    status: "unassigned",
    priority: "high",
    estimatedArrival: null,
    packageCount: 2,
    timeSlot: "13:00 - 15:00",
    notes: "Drop di pos security utama",
  },

  // ═══ CLUSTER E: Area Ahmad Yani / Selatan (3 paket berdekatan ~1km) ═══
  {
    id: "DEL-013",
    courierId: null,
    recipient: "Royal Plaza Surabaya",
    address: "Jl. Ahmad Yani No. 16-18, Surabaya",
    lat: -7.3091,
    lng: 112.7341,
    status: "unassigned",
    priority: "medium",
    estimatedArrival: null,
    packageCount: 2,
    timeSlot: "14:00 - 16:00",
    notes: "Area food court lt. 3",
  },
  {
    id: "DEL-014",
    courierId: null,
    recipient: "City of Tomorrow (Cito)",
    address: "Jl. Ahmad Yani No. 288, Surabaya",
    lat: -7.3489,
    lng: 112.7228,
    status: "unassigned",
    priority: "high",
    estimatedArrival: null,
    packageCount: 1,
    timeSlot: "15:00 - 17:00",
    notes: "Konfirmasi kedatangan ke CS",
  },
  {
    id: "DEL-015",
    courierId: null,
    recipient: "Transmart Rungkut",
    address: "Jl. Raya Kalirungkut No. 23, Surabaya",
    lat: -7.3210,
    lng: 112.7620,
    status: "unassigned",
    priority: "low",
    estimatedArrival: null,
    packageCount: 3,
    timeSlot: "14:00 - 17:00",
    notes: "Titip di customer service",
  },
];

// ── Database Seeder ────────────────────────────────────────────────────────────
async function seedDatabase() {
  if (!isFirestoreReady) return;
  try {
    // Always upsert production users
    const users = [
      {
        id: "sby-c01",
        email: "budi@nusaroute.ai",
        name: "Budi Santoso",
        role: "courier",
        region: "Surabaya Timur",
      },
      {
        id: "sby-c02",
        email: "agus@nusaroute.ai",
        name: "Agus Setiawan",
        role: "courier",
        region: "Surabaya Selatan",
      },
      {
        id: "sby-c03",
        email: "eko@nusaroute.ai",
        name: "Eko Prasetyo",
        role: "courier",
        region: "Surabaya Utara",
      },
      {
        id: "admin-01",
        email: "dispatcher@nusaroute.ai",
        name: "Sarah Sarah",
        role: "dispatcher",
        region: "Surabaya Central",
      },
    ];

    for (const u of users) {
      await db
        .collection("users")
        .doc(u.id)
        .set(
          {
            ...u,
            password: hashPassword("nusaroute2026"), // Hashed password for production
          },
          { merge: true },
        );
    }

    // Always upsert deliveries so updated fields take effect immediately
    for (const d of DEMO_DELIVERIES) {
      await db.collection("deliveries").doc(d.id).set(d);
    }
    console.log(
      `✅ Production Seed complete: ${users.length} users & ${DEMO_DELIVERIES.length} deliveries.`,
    );
  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
  }
}

// ── Init Firebase ──────────────────────────────────────────────────────────────
if (FIREBASE_PROJECT_ID) {
  try {
    const cert = {
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    };

    if (cert.projectId && cert.clientEmail && cert.privateKey) {
      admin.initializeApp({ credential: admin.credential.cert(cert) });
      db = admin.firestore();
      isFirestoreReady = true;
      console.log(`✅ Firebase Admin connected to project: ${cert.projectId}`);
      seedDatabase(); // Run upsert seeder on every server start
    }
  } catch (err) {
    console.error("❌ Firebase connection error:", err.message);
  }
} else {
  console.warn(
    "⚠️  Firebase credentials not set. Using in-memory storage mode.",
  );
}

// ── In-memory fallback store ───────────────────────────────────────────────────
const memoryStore = {
  reports: [],
  deliveries: JSON.parse(JSON.stringify(DEMO_DELIVERIES)), // deep clone
};

import crypto from "crypto";

/**
 * Basic Hash helper for passwords (without external dependencies)
 */
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

/**
 * Authenticate user (Courier/Dispatcher)
 */
export async function loginUser(email, password) {
  const hashedPassword = hashPassword(password);

  if (isFirestoreReady) {
    try {
      const snap = await db
        .collection("users")
        .where("email", "==", email)
        .where("password", "==", hashedPassword)
        .limit(1)
        .get();

      if (!snap.empty) {
        const userData = snap.docs[0].data();
        return { success: true, user: { id: snap.docs[0].id, ...userData } };
      }
    } catch (err) {
      console.error("Login error:", err.message);
    }
  } else {
    // Fallback for memory mode (Using hashed password check)
    const productionUsers = [
      {
        id: "sby-c01",
        email: "budi@nusaroute.ai",
        password: hashPassword("nusaroute2026"),
        name: "Budi Santoso",
        role: "courier",
      },
      {
        id: "sby-c02",
        email: "agus@nusaroute.ai",
        password: hashPassword("nusaroute2026"),
        name: "Agus Setiawan",
        role: "courier",
      },
      {
        id: "sby-c03",
        email: "eko@nusaroute.ai",
        password: hashPassword("nusaroute2026"),
        name: "Eko Prasetyo",
        role: "courier",
      },
      {
        id: "admin-01",
        email: "dispatcher@nusaroute.ai",
        password: hashPassword("nusaroute2026"),
        name: "Sarah Sarah",
        role: "dispatcher",
      },
    ];

    const user = productionUsers.find(
      (u) => u.email === email && u.password === hashedPassword,
    );
    if (user) {
      const { password: _, ...userData } = user;
      return { success: true, user: userData };
    }
  }
  return { success: false, error: "Email atau kata sandi salah." };
}

/**
 * Save an incident report to Firestore or memory.
 */
export async function saveIncidentReport(reportData) {
  const doc = {
    ...reportData,
    createdAt: new Date().toISOString(),
    status: "ai_processed",
  };

  if (isFirestoreReady) {
    try {
      const ref = await db.collection("incident_reports").add(doc);
      return { id: ref.id, ...doc };
    } catch (err) {
      console.error("Firestore write error:", err.message);
    }
  }

  // Fallback: in-memory
  const id = `REPORT-${Date.now()}`;
  const saved = { id, ...doc };
  memoryStore.reports.unshift(saved);
  return saved;
}

/**
 * Fetch active deliveries for a specific courier.
 */
export async function getDeliveries(courierId) {
  if (isFirestoreReady) {
    try {
      const snap = await db
        .collection("deliveries")
        .where("courierId", "==", courierId)
        .get();
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (docs.length > 0) return docs;
    } catch (err) {
      console.error("Firestore getDeliveries error:", err.message);
    }
  }
  return memoryStore.deliveries.filter(
    (d) => !d.courierId || d.courierId === courierId,
  );
}

/**
 * Fetch ALL deliveries across all couriers (for Dispatcher Dashboard).
 */
export async function getAllDeliveries() {
  if (isFirestoreReady) {
    try {
      const snap = await db
        .collection("deliveries")
        .orderBy("estimatedArrival")
        .limit(200)
        .get();
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (docs.length > 0) return docs;
    } catch (err) {
      console.error("Firestore getAllDeliveries error:", err.message);
    }
  }
  return memoryStore.deliveries;
}

/**
 * Fetch a single delivery by id.
 */
export async function getDeliveryById(deliveryId) {
  if (isFirestoreReady) {
    try {
      const doc = await db.collection("deliveries").doc(deliveryId).get();
      if (doc.exists) return { id: doc.id, ...doc.data() };
    } catch (err) {
      console.error("Firestore getDeliveryById error:", err.message);
    }
  }

  return memoryStore.deliveries.find((d) => d.id === deliveryId) || null;
}

/**
 * Add a new delivery to Firestore or memory store.
 */
export async function addDelivery(deliveryData) {
  const doc = {
    ...deliveryData,
    createdAt: new Date().toISOString(),
  };

  if (isFirestoreReady) {
    try {
      const ref = await db.collection("deliveries").add(doc);
      return { id: ref.id, ...doc };
    } catch (err) {
      console.error("Firestore addDelivery error:", err.message);
    }
  }

  // Fallback: in-memory
  const id = `SBY-${Date.now().toString().slice(-6)}`;
  const newDelivery = { id, ...doc };
  memoryStore.deliveries.push(newDelivery);
  return newDelivery;
}

/**
 * Update delivery status after AI re-routing or courier action.
 */
export async function updateDeliveryStatus(deliveryId, updates) {
  if (isFirestoreReady) {
    try {
      await db.collection("deliveries").doc(deliveryId).update(updates);
      return true;
    } catch (err) {
      console.error("Firestore update error:", err.message);
    }
  }

  // Fallback: update in-memory
  const idx = memoryStore.deliveries.findIndex((d) => d.id === deliveryId);
  if (idx !== -1) {
    memoryStore.deliveries[idx] = {
      ...memoryStore.deliveries[idx],
      ...updates,
    };
  }
  return true;
}

/**
 * Fetch all incident reports (for Dispatcher Dashboard).
 */
export async function getAllReports() {
  if (isFirestoreReady) {
    try {
      const snap = await db
        .collection("incident_reports")
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error("Firestore getAllReports error:", err.message);
    }
  }
  return memoryStore.reports;
}

/**
 * Save Courier FCM Token.
 */
export async function saveFcmToken(userId, token) {
  if (isFirestoreReady) {
    try {
      await db.collection("users").doc(userId).update({ fcmToken: token });
      return true;
    } catch (err) {
      console.error("Firestore saveFcmToken error:", err.message);
    }
  } else {
    console.warn(
      "[firebase-admin] FCM tokens are not saved in memory mode. Please configure Firebase keys for real push notifications.",
    );
  }
  return true;
}

/**
 * Apply Pickup Hub and send FCM Push Notification.
 */
export async function applyPickupHubToDeliveries(hub) {
  const { deliveryIds, label, reason } = hub;

  if (!deliveryIds || deliveryIds.length === 0)
    return { success: false, error: "No deliveries to update" };

  let targetCourierId = null;

  // Update deliveries
  if (isFirestoreReady) {
    try {
      const batch = db.batch();
      for (const id of deliveryIds) {
        const ref = db.collection("deliveries").doc(id);
        const snap = await ref.get();
        if (snap.exists) {
          if (!targetCourierId) targetCourierId = snap.data().courierId;
          batch.update(ref, { pickupHub: { label, reason } });
        }
      }
      await batch.commit();
    } catch (err) {
      console.error("Firestore apply hub error:", err.message);
    }
  } else {
    // Memory mode update
    deliveryIds.forEach((id) => {
      const idx = memoryStore.deliveries.findIndex((d) => d.id === id);
      if (idx !== -1) {
        if (!targetCourierId)
          targetCourierId = memoryStore.deliveries[idx].courierId;
        memoryStore.deliveries[idx].pickupHub = { label, reason };
      }
    });
  }

  // Send FCM Push Notification
  if (isFirestoreReady && targetCourierId) {
    try {
      const userSnap = await db.collection("users").doc(targetCourierId).get();
      if (userSnap.exists) {
        const token = userSnap.data().fcmToken;
        if (token) {
          const message = {
            notification: {
              title: `📦 Hub Baru: ${label}`,
              body: `Instruksi Dispatcher: Parkir di sini untuk ${deliveryIds.length} paket.`,
            },
            token: token,
          };
          const response = await admin.messaging().send(message);
          console.log("Successfully sent FCM message:", response);
        } else {
          console.warn(`User ${targetCourierId} has no FCM token saved.`);
        }
      }
    } catch (err) {
      console.error("Error sending FCM message:", err.message);
    }
  } else {
    console.warn(
      `[firebase-admin] Skipping FCM push notification. Firestore not configured or no targetCourierId.`,
    );
  }

  return { success: true };
}

export { isFirestoreReady };
