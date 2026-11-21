# Panduan Deployment Produksi NusaRoute AI ke Google Cloud Platform (GCP)

Aplikasi NusaRoute AI menggunakan arsitektur serverless produksi:
- **Frontend**: React 18 PWA di **Firebase Hosting** (CDN global, HTTPS, caching).
- **Backend**: Express 5 non-root container di **Google Cloud Run** (stateless, `trust proxy`, fail-fast secret guard, HS256 JWT + RBAC).
- **Database & Auth**: **Cloud Firestore** (zero-trust `firestore.rules`) + **Firebase Authentication** (Dual Login: Username/Password `scrypt` & Login Google strict whitelist `GOOGLE_AUTO_REGISTER=false`).
- **Scheduler**: **Google Cloud Scheduler** memicu `POST /api/agent/tick` tiap 3 menit untuk evaluasi agen otonom multi-instance.

---

## Opsi Utama: Deployment Otomatis via Skrip Interaktif (`npm run deploy`)

NusaRoute AI menyediakan skrip automasi mandiri ([deploy.js](file:///E:/nusaroute-ai/deploy.js)) yang berjalan interaktif dan terintegrasi:

1. **Deteksi Domain Hosting Cerdas**: Mendeteksi otomatis ID situs default Firebase Hosting (contoh: proyek `nusarouteai` dialokasikan situs `nusarouteai-1f67f`, menghasilkan domain `https://nusarouteai-1f67f.web.app`).
2. **Dukungan Custom Domain Interaktif**: Menanyakan apakah Anda ingin mengaitkan Custom Domain (contoh: `nusaroute-ai.web.id`) atau menerima argumen CLI `--domain=nusaroute-ai.web.id`.
3. **Penyuntikan Rahasia Otomatis**: Membaca variabel produksi dari [backend/.env](file:///E:/nusaroute-ai/backend/.env), memvalidasinya, dan menyuntikkannya ke Google Cloud Run via berkas parameter sementara (*zero manual entry*).
4. **Whitelist CORS Dinamis**: Mengonfigurasi backend agar secara otomatis mengizinkan domain `*.web.app`, `*.firebaseapp.com`, dan Custom Domain yang Anda masukkan.
5. **Otomasi Cloud Scheduler & Frontend Build**: Menyiapkan cron job pemantau rute dan mempublikasikan frontend beserta aturan [firestore.rules](file:///E:/nusaroute-ai/firestore.rules).

```bash
# Jalankan wizard deployment interaktif
npm run deploy

# Atau deploy langsung dengan menyertakan Custom Domain
npm run deploy -- --domain=nusaroute-ai.web.id
```

### Sub-perintah Mandiri:
* `npm run deploy:backend` — Hanya deploy ulang kontainer backend ke Google Cloud Run dengan variabel lingkungan terbaru.
* `npm run deploy:frontend` — Hanya build dan publikasikan ulang frontend ke Firebase Hosting.
* `npm run deploy:scheduler` — Hanya sinkronisasi cron job di Google Cloud Scheduler.

---

## Memahami Alur Domain, CORS, dan Proxy

### Mengapa CORS Tetap Dikonfigurasi Jika Ada Proxy?
* **Saat Pengembangan Lokal (`npm run dev`)**: Vite bertindak sebagai reverse proxy lokal (`/api` diteruskan ke `http://localhost:3000`), sehingga browser menganggap request berasal dari origin yang sama.
* **Saat Produksi (Firebase Hosting & Cloud Run)**: Frontend PWA disajikan dari CDN Firebase Hosting (`https://nusarouteai-1f67f.web.app` atau `https://nusaroute-ai.web.id`), sedangkan REST API berada di Google Cloud Run (`https://nusaroute-api-xxx.asia-southeast2.run.app`). Karena kedua domain tersebut berbeda origin, browser mewajibkan pemeriksaan CORS (*preflight OPTIONS request*).
* **Solusi Otomatis NusaRoute AI**: File [backend/src/server.ts](file:///E:/nusaroute-ai/backend/src/server.ts) secara dinamis memeriksa origin request: jika berakhiran `.web.app`, `.firebaseapp.com`, merupakan `localhost`, atau cocok dengan `CUSTOM_DOMAIN`, backend langsung memberikan respons `HTTP 204 No Content` dengan header `Access-Control-Allow-Origin` yang sesuai.

### Mengakses Backend Produksi dari Domain / Lingkungan Lokal
Jika Anda ingin menguji frontend lokal (`localhost:5173`) atau custom domain lokal terhadap backend produksi Cloud Run:
1. Cukup ubah `VITE_BACKEND_URL` di [frontend/.env.local](file:///E:/nusaroute-ai/frontend/.env.local) menjadi URL Cloud Run Anda:
   ```ini
   VITE_BACKEND_URL=https://nusaroute-api-53yseh5gua-et.a.run.app
   ```
2. Jalankan `npm run dev --workspace=frontend`. Backend Cloud Run sudah mengizinkan origin `http://localhost:5173` secara bawaan.

---

## 1. Persiapan Akun & Project
1. Buat atau pilih project di [Google Cloud Console](https://console.cloud.google.com/).
2. Aktifkan **Billing** untuk layanan Cloud Run & Cloud Scheduler.
3. Pasang [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install) dan lakukan autentikasi (`gcloud auth login`).
4. Pastikan provider **Google** aktif di **Firebase Console → Authentication → Sign-in method** (atau jalankan `npm run setup`).

---

## 2. Inisialisasi & Reset Data Demo
Sebelum atau sesudah proses deployment, Anda dapat mengisi data awal atau mereset status pengiriman:

* **Pengisian Data Awal (Idempotent Seed)**:
  ```bash
  npm run db:seed
  ```
  Menyiapkan akun default (`dispatcher` & `budi`), 10 zona rawan kemacetan Surabaya, dan 15 paket pengantaran.

* **Penyegaran Status Pengiriman (Reset Demo)**:
  ```bash
  npm run db:reset
  ```
  Mengembalikan paket yang telah berstatus *delivered* menjadi *assigned/pending* untuk keperluan latihan workshop berikutnya. Operasi ini juga dapat dipicu langsung via tombol **Reset Data Demo** pada dasbor Dispatcher.

---

## 3. Deployment Manual Langkah demi Langkah (Opsional)

Jika Anda ingin men-deploy setiap komponen secara manual tanpa menggunakan skrip automasi:

### A. Deploy Backend (Google Cloud Run)
1. Buka terminal di folder `backend/`.
2. Berikan role yang dibutuhkan ke Service Account default (jika muncul error Cloud Build):
   ```bash
   PROJECT_NUMBER=$(gcloud projects describe <PROJECT_ID> --format="value(projectNumber)")
   gcloud projects add-iam-policy-binding <PROJECT_ID> \
     --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
     --role="roles/serviceusage.serviceUsageConsumer"
   gcloud projects add-iam-policy-binding <PROJECT_ID> \
     --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
     --role="roles/cloudbuild.builds.builder"
   ```
3. Deploy kontainer:
   ```bash
   gcloud run deploy nusaroute-api \
     --source . \
     --region asia-southeast2 \
     --allow-unauthenticated \
     --port 8080 \
     --memory 1Gi \
     --max-instances 3 \
     --set-env-vars "NODE_ENV=production,USE_MOCK_AI=false,GEMINI_MODEL=gemini-3.8-flash,ENABLE_AUTO_SEED=false,ENABLE_AGENT_LOOP=false,GOOGLE_AUTO_REGISTER=false"
   ```
4. Tambahkan secret produksi pada **Cloud Run → `nusaroute-api` → Edit & Deploy New Revision → Variables & Secrets**:
   - `JWT_SECRET`: string acak kuat minimal 32 karakter
   - `API_KEY`: string acak kuat minimal 24 karakter
   - `GEMINI_API_KEY`: Kunci API Gemini produksi
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
   - `CORS_ORIGIN`: Domain frontend Anda (misal `https://nusarouteai-1f67f.web.app`)
   - `CUSTOM_DOMAIN`: Domain kustom Anda (misal `https://nusaroute-ai.web.id`)

### B. Penjadwalan Autonomous Agent (Google Cloud Scheduler)
```bash
gcloud scheduler jobs create http nusaroute-agent-tick \
  --location=asia-southeast2 \
  --schedule="*/3 * * * *" \
  --uri="https://<CLOUD_RUN_URL>/api/agent/tick" \
  --http-method=POST \
  --headers="X-API-Key=<API_KEY_PRODUKSI>"
```

### C. Deploy Frontend & Firestore Rules (Firebase Hosting)
1. Perbarui `VITE_BACKEND_URL` di [frontend/.env.local](file:///E:/nusaroute-ai/frontend/.env.local) dengan URL Cloud Run yang didapat.
2. Build dan publikasikan:
   ```bash
   npm run build --workspace=frontend
   npx firebase-tools deploy --only firestore:rules,hosting --project <PROJECT_ID>
   ```
3. Daftarkan domain hosting Anda (`https://nusarouteai-1f67f.web.app` dan custom domain Anda) pada **Firebase Console → Authentication → Settings → Authorized domains**.

---

## 4. Konfigurasi Custom Domain (Contoh: nusaroute-ai.web.id)
1. Buka **Firebase Console → Hosting → Add custom domain**.
2. Masukkan nama domain Anda (misal: `nusaroute-ai.web.id`).
3. Masuk ke panel kontrol DNS registrar domain Anda, buat **A Record** yang mengarah ke IP yang disediakan Firebase Hosting.
4. Sertifikat SSL Let's Encrypt akan diterbitkan secara otomatis oleh Google dalam waktu 15–60 menit.
5. Pastikan domain terdaftar di **Firebase Authorized Domains** dan variabel `CUSTOM_DOMAIN` terisi di Cloud Run (sudah ditangani otomatis oleh `npm run deploy`).

---

## 5. Registrasi Awal Petugas (Whitelist)
Karena `GOOGLE_AUTO_REGISTER=false` secara default:
```bash
npm run user:add -- --email admin@domain-anda.com --name "Admin Utama" --role dispatcher
```
Atau gunakan endpoint `POST /api/users` (menggunakan Bearer JWT Dispatcher atau header `X-API-Key`).
