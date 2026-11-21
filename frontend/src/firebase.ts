import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type Auth,
} from "firebase/auth";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported as isMessagingSupported,
  Messaging,
} from "firebase/messaging";
import { FRONTEND_CONFIG, hasValidFirebaseConfig } from "./config/app-config";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let messaging: Messaging | undefined;

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const hasValidMessagingConfig = Boolean(
  FRONTEND_CONFIG.firebase.appId &&
    !FRONTEND_CONFIG.firebase.appId.includes("000000000000") &&
    FRONTEND_CONFIG.firebase.messagingSenderId &&
    !FRONTEND_CONFIG.firebase.messagingSenderId.includes("000000000000")
);

try {
  if (hasValidFirebaseConfig) {
    app = getApps().length > 0 ? getApp() : initializeApp(FRONTEND_CONFIG.firebase);
    auth = getAuth(app);
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      hasValidMessagingConfig
    ) {
      void isMessagingSupported()
        .then((supported) => {
          if (supported && app) {
            messaging = getMessaging(app);
          }
        })
        .catch(() => {
          // FCM push unavailable in current browser privacy context
        });
    }
  } else {
    console.warn("[Firebase] Config is not set. Google Sign-In & FCM Push Notifications disabled.");
  }
} catch (error) {
  console.error("[Firebase] Initialization error:", error);
}

export const isGoogleAuthAvailable = Boolean(auth);

export async function signInWithGooglePopup(): Promise<string> {
  if (!auth) {
    throw new Error(
      "Firebase Auth belum dikonfigurasi. Lengkapi VITE_FIREBASE_* di frontend/.env terlebih dahulu."
    );
  }
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    return await credential.user.getIdToken();
  } catch (err: any) {
    const code = err?.code as string | undefined;
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      throw new Error("Popup Login Google ditutup sebelum proses selesai.");
    }
    if (code === "auth/popup-blocked") {
      throw new Error("Popup diblokir oleh browser. Izinkan popup untuk domain ini lalu coba lagi.");
    }
    if (code === "auth/unauthorized-domain") {
      throw new Error(
        "Domain ini belum terdaftar di Firebase Console (Authentication -> Settings -> Authorized domains)."
      );
    }
    throw new Error(err?.message || "Gagal masuk dengan akun Google.");
  }
}

export async function signOutFirebase(): Promise<void> {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch {
    // Ignore sign-out errors if user logged in via password-only flow
  }
}

export { app, auth, messaging, getToken, onMessage };
