# Panduan Deployment NusaRoute AI ke Google Cloud Platform (GCP)

Aplikasi NusaRoute AI menggunakan arsitektur modern:
- **Frontend**: PWA di Firebase Hosting (CDN, HTTPS, Caching).
- **Backend**: API di Cloud Run (Serverless, Auto-scaling).
- **Database**: Firestore (NoSQL, Real-time).

---

## 1. Persiapan Akun & Project
1. Buat project baru di [Google Cloud Console](https://console.cloud.google.com/).
2. Aktifkan **Billing** untuk project tersebut.
3. Install [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) di komputer Anda.
4. Install [Firebase CLI](https://firebase.google.com/docs/cli#install_the_firebase_cli): `npm install -g firebase-tools`.

---

## 2. Deployment Backend (Cloud Run)
Cloud Run akan menjalankan server Node.js Anda dalam container.

1. Buka terminal di folder `backend/`.
2. Jalankan perintah build & deploy otomatis:
   ```bash
   gcloud run deploy nusaroute-api --source . --region asia-southeast2 --allow-unauthenticated
   ```
3. Pilih "Y" jika ditanya untuk membuat repository baru.
4. Setelah selesai, Anda akan mendapatkan **Service URL** (contoh: `https://nusaroute-api-xxx.a.run.app`).
5. **PENTING**: Buka Cloud Console, cari Cloud Run, pilih service `nusaroute-api`, masuk ke tab **Variables & Secrets**, dan tambahkan variabel dari file `.env` Anda (seperti `GEMINI_API_KEY`, dll).

---

## 3. Deployment Frontend (Firebase Hosting)
Firebase Hosting akan melayani file PWA Anda dengan kecepatan tinggi.

1. Buka folder `frontend/`.
2. Buat file `.env.production` (atau update `.env.local`) dengan URL backend baru Anda:
   ```env
   VITE_BACKEND_URL=https://nusaroute-api-xxx.a.run.app
   VITE_GOOGLE_MAPS_API_KEY=...
   VITE_FIREBASE_...
   ```
3. Jalankan build aplikasi:
   ```bash
   npm run build
   ```
4. Login ke Firebase dan hubungkan project:
   ```bash
   firebase login
   firebase init hosting
   ```
   *Pilih: "Use an existing project" -> pilih project GCP Anda.*
5. Jalankan deployment:
   ```bash
   firebase deploy --only hosting --project your-gcp-project-id
   ```

---

## 4. Sinkronisasi CORS (Keamanan)
Agar Frontend bisa mengakses Backend, Anda perlu mendaftarkan URL Frontend Anda ke Backend.

1. Setelah deploy Hosting selesai, Anda akan mendapatkan URL (contoh: `https://nusaroute-ai.web.app`).
2. Kembali ke Cloud Run console -> Service `nusaroute-api` -> **Variables**.
3. Tambahkan atau update variabel:
   - `CORS_ORIGIN`: `https://nusaroute-ai.web.app`

---

## Kesimpulan
Aplikasi Anda sekarang berjalan secara serverless di Google Cloud Platform.
- **Biaya**: Mendekati Rp 0 untuk penggunaan rendah (Free Tier Cloud Run & Firebase).
- **Keamanan**: Sudah otomatis menggunakan HTTPS.
- **PWA**: Siap diinstal di Android/iOS melalui URL Firebase Hosting tersebut.
