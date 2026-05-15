importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// PENTING: Karena ini adalah file statis, Anda harus memasukkan konfigurasi Firebase 
// Anda secara manual di sini (tidak bisa membaca .env).
const firebaseConfig = {
  apiKey: "REPLACE_WITH_API_KEY",
  authDomain: "REPLACE_WITH_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_PROJECT_ID",
  storageBucket: "REPLACE_WITH_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_APP_ID"
};

try {
  // Coba inisialisasi hanya jika konfigurasi telah diubah dari nilai default
  if (firebaseConfig.apiKey !== "REPLACE_WITH_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage(function(payload) {
      console.log('[firebase-messaging-sw.js] Menerima pesan di background: ', payload);
      const notificationTitle = payload.notification?.title || 'NusaRoute AI';
      const notificationOptions = {
        body: payload.notification?.body || 'Anda mendapat instruksi baru.',
        icon: '/vite.svg', // Anda bisa mengganti dengan icon logo aplikasi
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  } else {
    console.warn("[firebase-messaging-sw.js] Harap masukkan firebaseConfig agar notifikasi background berjalan.");
  }
} catch(e) {
  console.log('[firebase-messaging-sw.js] Gagal inisialisasi Firebase:', e);
}
