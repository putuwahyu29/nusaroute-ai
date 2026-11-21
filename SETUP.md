# 🚀 Panduan Konfigurasi Proyek — NusaRoute AI

Dokumentasi lengkap untuk melakukan setup kredensial dan konfigurasi lingkungan Google Cloud & Firebase. Anda dapat memilih antara **Metode Otomatis (Wizard CLI)** atau **Metode Manual Step-by-Step**.

---

## 📋 Prasyarat Sistem

Sebelum memulai, pastikan perangkat Anda telah terpasang:
1. **Google Cloud CLI (`gcloud`)**: [Panduan Instalasi gcloud](https://cloud.google.com/sdk/docs/install)
2. **Node.js**: Versi 22 LTS (Active LTS, Non-EOL; versi 18 dan 20 sudah EOL) (`node -v`)
3. **NPM**: Versi 10+ (`npm -v`)
4. **Git**: Versi 2.30+ (`git --version`)

---

## 🤖 Metode 1: Agentic Setup via Google Antigravity IDE (Paling Praktis)

Jika Anda membuka repositori ini menggunakan **Google Antigravity IDE** (atau IDE berkemampuan AI Agent), repositori ini telah dilengkapi berkas konfigurasi `AGENTS.md`.

Anda cukup membuka panel **Chat Antigravity** dan memberikan instruksi langsung:
> *"Antigravity, tolong baca AGENTS.md lalu bantu setup Google Cloud project untuk NusaRoute AI, aktifkan API yang dibutuhkan, dan siapkan file backend/.env serta frontend/.env.local."*

*(Siapkan **Gemini API Key** dan **Google Maps API Key** Anda, karena Antigravity akan menanyakannya untuk diisikan ke berkas `.env`).*

AI Agent di Antigravity IDE akan secara otonom memverifikasi autentikasi `gcloud`, membuatkan project, mengaktifkan API, mengunduh kredensial, dan menuliskan berkas `.env` untuk Anda.

---

## ⚡ Metode 2: Setup Otomatis Menggunakan Script CLI (Universal)

Metode ini menggunakan skrip interaktif yang secara otomatis mendeteksi akun, mengaktifkan API, dan mengenerate file `.env` di backend maupun frontend. Cocok untuk semua pengguna terminal atau VS Code biasa:

### Langkah 1: Login ke Akun Google Anda
```bash
gcloud auth login
```
*(Browser akan terbuka, pilih akun Google Anda dan setujui izin akses).*

### Langkah 2: Jalankan Script Setup
Dari direktori root proyek `nusaroute-ai`:
```bash
npm run setup
```

Script akan memandu Anda melalui terminal interaktif:
* Memeriksa autentikasi `gcloud`.
* Memindai project yang ada di akun Anda (atau membuat project baru langsung via CLI).
* Mengaktifkan seluruh API yang dibutuhkan (`firestore`, `identitytoolkit` untuk Login Google, `generativelanguage`, `maps-backend`, `routes`, `run`, dll.).
* Mengonfigurasi kunci Gemini API, Service Account Firebase, Maps API, Login Google (`firebase deploy --only auth`), serta secret `JWT_SECRET` & `API_KEY` dengan kebijakan ketat `GOOGLE_AUTO_REGISTER=false`.
* Otomatis menghasilkan `backend/.env` dan `frontend/.env.local`.

### Langkah 3: Daftarkan Email Google (Whitelist) & Verifikasi
```bash
npm run user:add -- --email nama.admin@gmail.com --name "Admin NusaRoute" --role dispatcher
npm run validate
```
Jika seluruh indikator berwarna hijau, sistem siap dijalankan (`npm run dev`).

---

## 🛠️ Metode 3: Setup Manual Step-by-Step (Tanpa Script)

Jika Anda tidak menggunakan script otomatis dan ingin menyiapkan seluruh komponen infrastruktur sendiri melalui terminal dan Google Cloud Console, ikuti urutan langkah di bawah ini:

### 1. Menyiapkan Google Cloud Project
Periksa apakah akun Google Anda sudah memiliki project yang dapat digunakan:
```bash
gcloud projects list
```

* **Jika sudah ada project:** Salin nilai `PROJECT_ID` dan jadikan aktif:
  ```bash
  gcloud config set project ID_PROJECT_ANDA
  ```
* **Jika belum ada project:** Buat project baru (ID harus unik secara global):
  ```bash
  gcloud projects create nusaroute-sby-2026 --name="NusaRoute AI"
  gcloud config set project nusaroute-sby-2026
  ```
  *(Atau buat melalui web di [console.cloud.google.com/projectcreate](https://console.cloud.google.com/projectcreate)).*

> ⚠️ **Catatan Mengenai Peringatan Quota Project (ADC):**  
> Jika muncul pesan `WARNING: Your active project does not match the quota project in your local Application Default Credentials file...`, **Anda dapat mengabaikannya sepenuhnya**. NusaRoute AI menggunakan kredensial Service Account terisolasi dan `GEMINI_API_KEY`, bukan ADC lokal. Tidak perlu menjalankan `set-quota-project`. Silakan langsung lanjutkan ke langkah berikutnya.

### 2. Mengaktifkan API Layanan Google Cloud

Pilih salah satu sesuai kondisi project Anda:

#### Opsi A: Jika Project Sudah Memiliki Billing Account (Lengkap untuk Cloud Run)
```bash
gcloud services enable \
  firestore.googleapis.com \
  run.googleapis.com \
  generativelanguage.googleapis.com \
  maps-backend.googleapis.com \
  routes.googleapis.com \
  directions-backend.googleapis.com
```

#### Opsi B: Jika Project Baru / Tanpa Billing Account (Khusus Mode Lokal & Free Tier)
Google Cloud mewajibkan akun penagihan aktif khusus untuk layanan container **`run.googleapis.com`**. Jika project Anda baru dibuat dan belum ditautkan kartu kredit/billing, gunakan perintah berikut:

```bash
# Aktifkan API yang tidak memerlukan billing container
gcloud services enable \
  generativelanguage.googleapis.com \
  firestore.googleapis.com \
  maps-backend.googleapis.com \
  routes.googleapis.com \
  directions-backend.googleapis.com
```
*(Cloud Run baru dibutuhkan di Langkah 9 saat deployment ke cloud. Untuk Langkah 1 s.d. 8, seluruh fitur AI Gemini 3.8 Flash, routing TSP, peta, dan geofencing berjalan 100% normal secara lokal).*

> 💡 **Troubleshooting Error `FAILED_PRECONDITION: Billing account not found`:**  
> Jika muncul error saat mengaktifkan `run.googleapis.com`:  
> 1. **Tetap Lanjut Gratis:** Gunakan **Opsi B** di atas (tanpa `run.googleapis.com`). Anda tetap dapat menyelesaikan seluruh praktikum lokal.  
> 2. **Jika Punya Billing Account:** Tautkan akun Anda via CLI:  
>    `gcloud billing accounts list`  
>    `gcloud billing projects link ID_PROJECT_ANDA --billing-account=ID_BILLING_ANDA`  
>    Atau melalui console web di [console.cloud.google.com/billing/linkedaccount](https://console.cloud.google.com/billing/linkedaccount).

#### Rincian API Google Cloud & Mengapa Wajib / Opsional Diaktifkan:

| Identifier API | Nama Layanan (Web Console) | Kategori | Mengapa Diaktifkan? (Peran Nyata di NusaRoute AI) |
|---|---|---|---|
| **`firestore.googleapis.com`** | Google Cloud Firestore API | **Wajib (Core)** | Database dokumen NoSQL di region `asia-southeast2` (Jakarta) untuk paket, akun, laporan insiden, serta persistensi state agen otonom (`agent_decisions`, `system_state`) melalui Firebase Admin SDK + zero-trust `firestore.rules`. |
| **`identitytoolkit.googleapis.com`** | Identity Toolkit API | **Wajib (Google Login)** | Mengaktifkan autentikasi **Masuk dengan Google** dan verifikasi server-side `verifyIdToken` (kebijakan default `GOOGLE_AUTO_REGISTER=false`). |
| **`run.googleapis.com`** | Cloud Run Admin API | **Wajib (Core)** | Infrastruktur serverless container untuk menjalankan backend Express.js dengan opsi `--no-cpu-throttling` agar daemon background 3 menit tidak dibekukan. |
| **`generativelanguage.googleapis.com`** | **Gemini API** *(Generative Language API)* | **Wajib (Core)** | Endpoint resmi publik untuk model **Gemini 3.8 Flash** guna memproses foto kemacetan jalan dan rekaman suara kurir via SDK `@google/genai`. |
| **`maps-backend.googleapis.com`** | Maps JavaScript API | **Wajib (Core)** | Rendering peta interaktif berbasis vektor di browser kurir dan dasbor dispatcher. |
| **`routes.googleapis.com`** | **Routes API** | **Wajib** | Layanan rute generasi terbaru Google Maps Platform untuk navigasi armada, rute alternatif, dan estimasi ETA real-time. |
| **`directions-backend.googleapis.com`** | Directions API *(Legacy)* | *Kompatibilitas / Fallback* | Layanan navigasi terdahulu sebagai cadangan otomatis. |
| **`secretmanager.googleapis.com`** | Secret Manager API | *Opsional (Enterprise)* | Standar keamanan enterprise untuk menyimpan API keys dan credentials. Pada workshop ini, variabel disimpan via *Environment Variables* standar (`.env` dan `--set-env-vars`) agar praktikum mudah dipahami. |
| **`aiplatform.googleapis.com`** | Vertex AI Platform API | *Opsional (Enterprise)* | Mengotorisasi kuota komputasi AI enterprise. Karena SDK `@google/genai` menggunakan API Key dari AI Studio, request diarahkan langsung ke `generativelanguage.googleapis.com`. |

### 3. Mendapatkan Kunci Gemini API (Google AI Studio)
1. Kunjungi **[aistudio.google.com](https://aistudio.google.com/)** dan login dengan akun Google Anda.
2. Klik tombol **Get API key** di sidebar kiri.
3. Klik **Create API key** → Pilih project Google Cloud Anda.
4. Salin string kunci API (format: `AIzaSy...`).
5. Buat atau buka berkas `backend/.env`, lalu tempel:
   ```env
   GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   USE_MOCK_AI=false
   GEMINI_MODEL=gemini-3.8-flash
   ```

### 4. Membuat Database Cloud Firestore di Region Jakarta
1. Buka [Google Cloud Console → Firestore](https://console.cloud.google.com/firestore).
2. Klik **Create Database**.
3. Atur konfigurasi berikut:
   - **Database ID**: `(default)`
   - **Edition**: **Standard Edition**
   - **Security rules**: **Open** (atau **Restrictive**)
   - **Location**: **`asia-southeast2` (Jakarta)**
4. Klik **Create Database**.

### 5. Membuat Service Account Key untuk Backend Express
Backend Express membutuhkan kredensial Service Account untuk hak akses baca/tulis ke Firestore:
1. Buka [IAM & Admin → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts).
2. Klik **+ Create Service Account**:
   - Nama Service Account: `nusaroute-backend-sa`
   - Klik **Create and Continue**.
3. Berikan Role: **Cloud Datastore User** (memberikan izin penuh ke Firestore).
4. Klik **Done**.
5. Klik akun service account yang baru dibuat → Masuk ke tab **Keys**.
6. Klik **Add Key** → **Create new key** → Pilih format **JSON** → Klik **Create**.
7. File `.json` akan otomatis terunduh. Buka file tersebut dengan text editor, lalu salin nilainya ke `backend/.env`:
   ```env
   FIREBASE_PROJECT_ID=id-project-anda
   FIREBASE_CLIENT_EMAIL=nusaroute-backend-sa@id-project-anda.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIB...-----END PRIVATE KEY-----\n"
   ```

### 6. Membuat Google Maps API Key
1. Buka [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Klik **+ Create Credentials** → pilih **API key**.
3. Pada opsi **API restrictions**, pilih **Restrict key** lalu centang:
   * **Maps JavaScript API**
   * **Routes API** *(Wajib — Standar Google Cloud 2026+)*
   * **Directions API (Legacy)** *(Opsional / kompatibilitas cadangan)*
4. Klik **Save** (atau **Create**).
5. Salin API key yang terbentuk (`AIzaSy...`).
6. Masukkan kunci ini ke dua tempat:
   * Pada `backend/.env`:
     ```env
     GOOGLE_MAPS_API_KEY=AIzaSy...
     ```
   * Pada `frontend/.env.local`:
     ```env
     VITE_GOOGLE_MAPS_API_KEY=AIzaSy...
     ```

### 7. Menyiapkan Firebase Web App & Login Google (Frontend)
Frontend React memerlukan kredensial Firebase Client SDK untuk **Login Google (Firebase Auth)** dan notifikasi push FCM (opsional):
1. Kunjungi **[console.firebase.google.com](https://console.firebase.google.com/)**.
2. Klik project Google Cloud Anda.
3. Di halaman utama, klik ikon **Web (`</>`)** untuk menambahkan aplikasi web baru.
4. Beri nama aplikasi (misal: `nusaroute-web`) → Klik **Register app**.
5. Firebase akan menampilkan objek konfigurasi `firebaseConfig`:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "project-id.firebaseapp.com",
     projectId: "project-id",
     storageBucket: "project-id.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef..."
   };
   ```
6. Salin nilai-nilai tersebut ke `frontend/.env.local`:
   ```env
   VITE_BACKEND_URL=http://localhost:3000
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=project-id
   VITE_FIREBASE_STORAGE_BUCKET=project-id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
   VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef...
   VITE_GOOGLE_MAPS_API_KEY=AIzaSy...
   ```

---

## 📑 Struktur Lengkap Berkas Environment

### Backend: `backend/.env`
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
API_KEY=<random-key-cloud-scheduler>
JWT_SECRET=<random-secret-minimal-32-karakter>
ENABLE_AUTO_SEED=true
ENABLE_AGENT_LOOP=true
GOOGLE_AUTO_REGISTER=false

> **Tips Menghasilkan String Acak untuk `API_KEY` dan `JWT_SECRET`:**  
> Jalankan perintah bawaan Node.js di terminal:  
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`  
> Jalankan dua kali: satu untuk `API_KEY`, dan satu lagi untuk `JWT_SECRET`.

GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxx
USE_MOCK_AI=false
GEMINI_MODEL=gemini-3.8-flash

FIREBASE_PROJECT_ID=nusaroute-sby-2026
FIREBASE_CLIENT_EMAIL=nusaroute-backend-sa@nusaroute-sby-2026.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIB...-----END PRIVATE KEY-----\n"

GOOGLE_MAPS_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Frontend: `frontend/.env.local`
```env
VITE_BACKEND_URL=http://localhost:3000
VITE_GOOGLE_MAPS_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxx

VITE_FIREBASE_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_FIREBASE_AUTH_DOMAIN=nusaroute-sby-2026.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=nusaroute-sby-2026
VITE_FIREBASE_STORAGE_BUCKET=nusaroute-sby-2026.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

---

## 🚀 Menjalankan Aplikasi

Setelah konfigurasi selesai:

```bash
# 1. Validasi konfigurasi
npm run validate

# 2. Instal seluruh dependensi monorepo
npm run install:all

# 3. Jalankan development server
npm run dev
```

Aplikasi dapat diakses di:
* **Frontend:** `http://localhost:5173`
* **Backend:** `http://localhost:3000`
* **Interactive Codelab:** `http://localhost:8080` (via `npm run codelab`)

---

## 🆘 Troubleshooting Umum

### 1. `gcloud: command not found`
Pastikan Google Cloud SDK sudah terpasang dan ditambahkan ke variabel `PATH` sistem Anda. Tutup dan buka kembali terminal setelah instalasi.

### 2. `Not authenticated`
Jalankan `gcloud auth login` dan pastikan Anda login dengan akun Google yang memiliki hak akses ke project GCP terkait.

### 3. `Routes API / Directions API: REQUEST_DENIED`
Pastikan **Routes API** (`routes.googleapis.com`) dan **Maps JavaScript API** sudah di-enable di project yang sama dan API key tidak dibatasi ke layanan yang salah (tambahkan `routes.googleapis.com` ke batasan API Key).

### 4. Firestore Database Error
Pastikan Anda memilih **Standard Edition** saat membuat database Firestore di Google Cloud Console dan lokasinya di `asia-southeast2` (Jakarta).
