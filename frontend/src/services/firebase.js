/**
 * NusaRoute AI — Firebase Client SDK
 * Initializes Firebase for real-time Firestore updates on the frontend.
 * Falls back gracefully when credentials are not configured.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// ── Firebase config from environment variables ─────────────────────────────
// To configure: copy .env.example to .env and fill in your Firebase values.
// Get these from Firebase Console -> Project Settings -> Your apps -> Web app
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || 'demo-api-key',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || 'demo.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || 'demo-project',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || 'demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '1:000000000000:web:0000000000000000',
};

let app = null;
let db = null;
let isFirebaseReady = false;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  isFirebaseReady = true;
} catch (err) {
  console.warn('⚠️ Firebase client not configured. Running without real-time sync.');
}

export { app, db, isFirebaseReady };
