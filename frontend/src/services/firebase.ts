import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { FRONTEND_CONFIG, hasValidFirebaseConfig } from "../config/app-config";

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let isFirebaseReady = false;

try {
  if (hasValidFirebaseConfig) {
    app = getApps().length > 0 ? getApp() : initializeApp(FRONTEND_CONFIG.firebase);
    db = getFirestore(app);
    isFirebaseReady = true;
  } else {
    console.info("[Firebase] Client SDK inactive until valid VITE_FIREBASE_* env vars are configured.");
  }
} catch (err) {
  console.warn("[Firebase] Client SDK initialization skipped:", err);
}

export { app, db, isFirebaseReady };
