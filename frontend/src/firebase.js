import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app;
let messaging;

try {
  // Only initialize if config is somewhat valid to avoid crashes if .env is missing
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    // getMessaging must be called conditionally in some environments, but for PWA it's usually fine
    // However, it requires a secure context (HTTPS) or localhost
    if (typeof window !== 'undefined' && ('serviceWorker' in navigator)) {
        messaging = getMessaging(app);
    }
  } else {
    console.warn("⚠️ Firebase config is missing. FCM Push Notifications will not work.");
  }
} catch (error) {
  console.error("🔥 Firebase initialization error", error);
}

export { app, messaging, getToken, onMessage };
