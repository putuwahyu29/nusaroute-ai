# NusaRoute AI

Platform optimasi rute logistik cerdas untuk Kota Surabaya berbasis **Agentic AI (Google Gemini 3.8 Flash)**, **Google Maps Platform**, dan **Google Cloud Firestore**.

Aplikasi ini dikembangkan sebagai materi hands-on workshop pada acara **DevFest Cloud Surabaya 2026**.

---

## Dokumentasi Praktikum & Panduan Terkait
* [Panduan Praktikum Codelab (Markdown)](file:///E:/nusaroute-ai/codelab/nusaroute-ai-codelab.md)
* [Panduan Deployment Produksi Google Cloud](file:///E:/nusaroute-ai/DEPLOY.md)
* [Tautan Codelab Interaktif Online](https://s.id/codelabagus)

---

## Fitur Utama Sistem

1. **Analisis Insiden Multimodal (Foto & Suara)**
   * Kurir dapat memotret hambatan jalan (pohon tumbang, genangan air) atau merekam pesan suara bahasa Jawa Suroboyoan / Indonesia.
   * Kompatibel lintas perangkat (Desktop, Android Chrome `audio/webm`, dan iPhone iOS Safari `audio/mp4` / `audio/aac`).
   * Model **Gemini 3.8 Flash** mengekstrak lokasi, jenis hambatan, dan tingkat keparahan langsung ke format JSON baku (*Structured Outputs*) dalam tempo <2 detik.

2. **Siklus Kendali Agen Otonom (Agentic Loop)**
   * Sistem backend menjalankan proses pemantauan mandiri secara berkala (*Monitor &rarr; Evaluate &rarr; Decide &rarr; Act*).
   * Saat terdeteksi insiden jalan, agen secara mandiri menentukan tindakan pengalihan rute (`REROUTE`) dan memperbarui rute kurir terdampak di Firestore tanpa menunggu instruksi manual admin.

3. **Validasi Geofencing 200 Meter**
   * Menggunakan rumus matematika *Haversine* untuk menghitung jarak GPS kurir terhadap titik tujuan.
   * Tombol konfirmasi pengantaran otomatis terkunci jika kurir masih berjarak lebih dari 200 meter dari alamat penerima (dilindungi validasi server anti-bypass).

4. **Optimasi Rute Pengantaran (Nearest-Neighbor)**
   * Mengurutkan paket pengiriman kurir berdasarkan jarak terdekat untuk meminimalkan waktu tempuh dan jarak perjalanan hingga 19%.

5. **Titik Konsolidasi (Pos Singgah Pemukiman)**
   * Mengelompokkan paket-paket di gang sempit atau pemukiman padat Surabaya ke satu titik aman, sehingga kurir dapat memarkir motor dan mengantar paket dengan berjalan kaki.

6. **Penyegaran & Reset Data Demo (Seed & Reset)**
   * Tersedia fitur pengisian data awal (*Seed*) dan pemulihan status pengiriman (*Reset*) baik via terminal CLI (`npm run db:seed`, `npm run db:reset`) maupun via tombol **Reset Data Demo** di antarmuka Dispatcher.

---

## Arsitektur Sistem

NusaRoute AI menggunakan pola arsitektur **Decoupled Serverless 4-Tier**:

* **Tier 1 — Frontend (Client):** React 18, Vite, TypeScript, dan Tailwind CSS. Dihosting di **Firebase Hosting** agar aset web dimuat instan (<100ms) melalui Global CDN tanpa terkena *cold start*.
* **Tier 2 — Backend (Compute):** Node.js 22 LTS (Active LTS / Non-EOL) dan Express 5 TypeScript. Berjalan di **Google Cloud Run** secara *serverless* (otomatis mati ke Rp 0 saat tidak ada pengiriman dan otomatis *auto-scale* saat trafik tinggi).
* **Tier 3 — AI Intelligence Core:** **Gemini 3.8 Flash** via SDK resmi `@google/genai` dengan konfigurasi `temperature: 0.1` dan `responseSchema` agar hasil analisis selalu konsisten dan faktual.
* **Tier 4 — Basis Data & Peta:** **Google Cloud Firestore** untuk sinkronisasi data real-time kurir dan dispatcher, serta **Google Maps Platform** untuk visualisasi rute.

---

## Struktur Folder Repositori

```text
nusaroute-ai/
├── backend/                       # Layanan API Express & Logika AI
│   ├── src/
│   │   ├── server.ts              # Pintu masuk REST API & Middleware CORS
│   │   ├── config/
│   │   │   └── app-config.ts      # Validasi fail-fast konfigurasi & env
│   │   ├── services/
│   │   │   ├── ai-agent.ts         # Integrasi Gemini 3.8 Flash Multimodal
│   │   │   ├── autonomous-agent.ts # Siklus agen mandiri (Agentic Loop)
│   │   │   ├── traffic-agent.ts    # Rumus Haversine & TSP Nearest-Neighbor
│   │   │   └── firebase-admin.ts   # Koneksi Firebase Admin SDK & Auth
│   │   ├── scripts/
│   │   │   ├── seed-db.ts          # Pengisian data awal Firestore (Idempotent)
│   │   │   ├── reset-db.ts         # Reset status pengiriman ke kondisi awal
│   │   │   ├── register-user.ts    # Pendaftaran whitelist admin & kurir
│   │   │   ├── test-incident.ts    # Pengujian mandiri analisis foto via CLI
│   │   │   └── test-voice.ts       # Pengujian mandiri analisis audio via CLI
│   │   └── data/
│   │       ├── surabaya-zones.ts   # 10 titik rawan macet/banjir Surabaya
│   │       └── seed-data.ts        # Data awal 15 paket pengiriman
│   └── package.json
│
├── frontend/                      # Antarmuka Pengguna (Web PWA)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx        # Halaman Login Petugas (Dual Auth)
│   │   │   ├── CourierPage.tsx      # Antarmuka Kurir (Rute, Lapor, Paket, Geofencing)
│   │   │   └── AnalyticsPage.tsx    # Halaman Statistik Efisiensi Rute
│   │   ├── components/
│   │   │   ├── DispatcherDashboard.tsx # Dasbor Pemantauan Admin & Tombol Reset Demo
│   │   │   ├── IncidentReporter.tsx    # Formulir Foto & Suara (Cross-Platform Audio)
│   │   │   └── GoogleMap.tsx           # Komponen Peta Interaktif & Rute
│   │   └── services/
│   │       ├── api.ts                  # Klien HTTP Backend
│   │       └── firebase.ts             # Inisialisasi Firebase Web SDK
│   └── package.json
│
├── codelab/                       # Panduan Praktikum DevFest Surabaya 2026
│   ├── nusaroute-ai-codelab.md    # Naskah Codelab Sumber (Markdown)
│   ├── enhance-codelab.js         # Enhancer visual KaTeX & styling Codelab
│   └── serve.js                   # Server lokal Codelab cross-platform
├── deploy.js                      # Skrip automasi deployment terpadu (Cloud Run + Firebase)
├── setup-config.js                # Skrip wizard inisialisasi .env interaktif
├── validate-config.js             # Skrip validator kelengkapan konfigurasi
├── firebase.json                  # Konfigurasi Firebase Hosting & Firestore Rules
├── firestore.rules                # Aturan keamanan Zero-Trust Cloud Firestore
└── package.json                   # Konfigurasi workspace monorepo
```

---

## Panduan Menjalankan Aplikasi Secara Lokal

### 1. Prasyarat Sistem
* **Code Editor**: **Google Antigravity IDE** (disarankan untuk automasi AI Agent melalui berkas `AGENTS.md`) atau **Visual Studio Code**.
* **Node.js**: v22.x LTS (Active Long-Term Support, Non-EOL; Node.js 18 dan 20 sudah End-of-Life / EOL)
* **NPM**: v10.0.0 atau lebih baru (bawaan Node.js 22 LTS)
* **Gemini API Key**: Dapat dibuat secara gratis di [Google AI Studio](https://aistudio.google.com)
* **Google Maps API Key**: Aktifkan layanan *Maps JavaScript API* dan *Routes API* (standar rute modern Google Cloud 2026+; opsi legacy *Directions API* didukung sebagai fallback)

### 2. Instalasi Dependensi
Jalankan perintah berikut di direktori utama repositori:
```bash
npm run install:all
```

### 3. Konfigurasi Variabel Lingkungan (.env)
Gunakan skrip validator atau salin manual berkas konfigurasi di folder backend dan frontend:

```bash
# Validasi status kelengkapan konfigurasi
npm run validate
```

**Di folder `backend/.env`:**
```ini
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=rahasia_jwt_minimal_32_karakter_acak
API_KEY=kunci_api_scheduler_minimal_24_karakter
GEMINI_API_KEY=kunci_api_gemini_anda
GEMINI_MODEL=gemini-3.8-flash
USE_MOCK_AI=false
```
*(Jika belum memiliki API Key Gemini, Anda dapat mengatur `USE_MOCK_AI=true` untuk menjalankan mode simulasi tanpa internet).*

**Di folder `frontend/.env.local`:**
```ini
VITE_BACKEND_URL=http://localhost:3000
VITE_GOOGLE_MAPS_API_KEY=kunci_google_maps_anda
VITE_FIREBASE_API_KEY=kunci_firebase_web_anda
VITE_FIREBASE_AUTH_DOMAIN=nusarouteai-1f67f.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=nusarouteai
VITE_FIREBASE_APP_ID=id_aplikasi_firebase_web_anda
```

### 4. Pengisian & Reset Data Demo Awal
Sebelum menjalankan aplikasi, inisialisasi data paket dan akun pengguna awal ke Cloud Firestore:
```bash
npm run db:seed
```
Jika di tengah pengujian ingin mengembalikan seluruh paket ke status awal (*assigned/pending*):
```bash
npm run db:reset
```

### 5. Menjalankan Server Pengembangan
Jalankan frontend dan backend secara bersamaan:
```bash
npm run dev
```
* **Frontend:** Buka `http://localhost:5173` di browser.
* **Backend API:** Berjalan di `http://localhost:3000`.

---

## Akun Pengujian Default

Aplikasi menyediakan dua akun bawaan untuk pengujian alur peran (*Role-Based Access Control*):

| Peran (*Role*) | Username | Password | Deskripsi Tampilan |
| :--- | :--- | :--- | :--- |
| **Dispatcher (Admin)** | `dispatcher` | `nusaroute2026` | Layar monitor admin untuk melihat peta armada seluruh kota, membagi paket, dan tombol reset data demo. |
| **Kurir (Lapangan)** | `budi` | `nusaroute2026` | Tampilan kurir mobile dengan 3 tab navigasi: Rute, Lapor Hambatan (Foto & Audio), dan Daftar Paket dengan pengunci radius 200m. |

---

## Skrip Pengujian Cepat via Terminal

Anda dapat menguji fungsi kecerdasan buatan secara langsung melalui terminal tanpa membuka antarmuka web:
* **Uji Analisis Foto/Insiden:**
  ```bash
  npm run test:incident
  ```
* **Uji Analisis Rekaman Suara Kurir:**
  ```bash
  npm run test:voice
  ```

---

## Penyebaran ke Google Cloud (Deployment)

### Deployment Otomatis Terpadu (Direkomendasikan)
Skrip `deploy.js` secara interaktif menanyakan Custom Domain, mendeteksi nama hosting default dari Firebase, mengonfigurasi whitelist CORS, dan menyuntikkan seluruh environment variable tanpa ketik manual:

```bash
npm run deploy
```

Sub-perintah terpisah:
* `npm run deploy:backend` — Hanya deploy ulang kontainer backend ke Google Cloud Run dengan variabel lingkungan terbaru.
* `npm run deploy:frontend` — Hanya build dan publikasikan ulang frontend ke Firebase Hosting.
* `npm run deploy:scheduler` — Hanya sinkronisasi cron job di Google Cloud Scheduler.

### URL Layanan Aktif Produksi
* **Frontend Web App (Firebase Hosting):** [https://nusarouteai-1f67f.web.app](https://nusarouteai-1f67f.web.app) (dan `https://nusarouteai-1f67f.firebaseapp.com`)
* **Custom Domain:** `https://nusaroute-ai.web.id`
* **Backend REST API (Google Cloud Run):** [https://nusaroute-api-53yseh5gua-et.a.run.app/api/health](https://nusaroute-api-53yseh5gua-et.a.run.app/api/health)

Lihat panduan arsitektur dan konfigurasi deployment lengkap di [DEPLOY.md](file:///E:/nusaroute-ai/DEPLOY.md).
