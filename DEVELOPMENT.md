# 🛠️ Development & Technical Guide — NusaRoute AI

Dokumentasi teknis untuk developer yang ingin memahami arsitektur, cara kerja AI, dan menjalankan aplikasi di lingkungan lokal.

---

## 🏗️ Arsitektur Sistem

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND (React PWA)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ CourierPage  │  │ Dispatcher   │  │  AnalyticsPage     │  │
│  │ (Mobile)    │  │ Dashboard    │  │  (Agent Monitor)   │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬───────────┘  │
│         └────────────────┼────────────────────┘              │
│                          │ API Calls (fetch)                  │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     BACKEND (Express.js)                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    server.js (API Router)                 │ │
│  └───────┬──────────────┬──────────────────┬───────────────┘ │
│          │              │                  │                  │
│  ┌───────▼──────┐ ┌────▼─────────┐ ┌─────▼──────────────┐  │
│  │  ai-agent.js │ │traffic-agent │ │autonomous-agent.js │  │
│  │  (Gemini     │ │  .js         │ │ (Background Loop)  │  │
│  │  Multimodal) │ │ (Prediction) │ │ Monitor→Evaluate→  │  │
│  │              │ │              │ │ Decide→Act→Log     │  │
│  └──────────────┘ └──────────────┘ └────────────────────┘  │
│          │              │                  │                  │
│  ┌───────▼──────────────▼──────────────────▼───────────────┐ │
│  │              firebase-admin.js (Data Layer)               │ │
│  │         Firestore / In-Memory Fallback Store              │ │
│  └───────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                           │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ Google     │  │ Firebase     │  │ Firebase Cloud      │  │
│  │ Gemini AI  │  │ Firestore    │  │ Messaging (FCM)     │  │
│  └────────────┘  └──────────────┘  └─────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Cara Menjalankan di Lokal

### Prasyarat
- Node.js v18+
- npm v9+

### Instalasi

```bash
# Dari root project
npm run install:all

# Atau manual:
cd backend && npm install
cd ../frontend && npm install
```

### Konfigurasi Environment

```bash
# Otomatis (interaktif)
npm run setup

# Atau manual: copy .env.example → .env
cp backend/.env.example backend/.env
# Edit backend/.env dengan API keys Anda
```

### Menjalankan

```bash
# Jalankan kedua server sekaligus
npm run dev

# Atau terpisah:
# Terminal 1 - Backend (port 3000)
cd backend && npm run dev

# Terminal 2 - Frontend (port 5173)
cd frontend && npm run dev
```

### Mode Tanpa API Key (Mock Mode)

Jika belum punya Gemini API Key:
```env
# backend/.env
USE_MOCK_AI=true
```
Semua fitur AI akan menggunakan respons simulasi.

---

## 🧠 Detail Implementasi AI

### 1. AI Incident Agent (`services/ai-agent.js`)

**Input:** Foto (JPEG/PNG) + Audio (WebM) dari kurir
**Model:** Gemini 2.5 Flash (Multimodal)
**Output:** JSON terstruktur dengan keputusan

```json
{
  "incidentType": "flooding",
  "severityLabel": "Kritis",
  "analysis": "Banjir jalan setinggi 30cm...",
  "recommendation": "Re-routing segera via Jl. Mangga Besar...",
  "action": "REDIRECT_TO_HUB",
  "estimatedDelay": 25
}
```

**Fallback:** 3 mock responses (road_closure, traffic_jam, flooding) jika API gagal.

### 2. Traffic Agent (`services/traffic-agent.js`)

**10 Zona Surabaya yang dipantau:**
- Gubeng, Wonokromo, Tunjungan, Kenjeran, Waru
- Perak, MERR, Rungkut, Kembang Jepun, Darmo

**Logika prediksi:**
1. Cek cache (TTL 5 menit)
2. Jika Gemini tersedia → kirim prompt dengan jam + cuaca → parse JSON
3. Jika gagal → rule-based fallback (jam sibuk + weather impact)

**Weather impact:**
- `sunny` → 0% penalty
- `rain` → +1 level kemacetan
- `heavy_rain` → +2 level + banjir di zona rawan (Wonokromo, Kenjeran, MERR, Waru)

### 3. Autonomous Agent (`services/autonomous-agent.js`)

**Siklus setiap 3 menit:**

```
MONITOR    → Ambil data traffic + posisi semua delivery
EVALUATE   → Hitung ancaman (kurir mendekati zona macet)
DECIDE     → Buat keputusan:
             - AUTONOMOUS_REROUTE (kirim alert ke kurir)
             - HUB_OPTIMIZATION (reassess clustering)
             - LOAD_BALANCE (deteksi beban tidak merata)
             - STUCK_COURIER (kurir terjebak > 45 menit)
             - TRAFFIC_ADVISORY (kondisi kritis)
ACT        → Eksekusi: kirim FCM, update data, log
LOG        → Catat untuk analytics + learning
```

**Fitur Learning:**
- `feedbackLoop.recordPrediction()` — Catat akurasi per zona
- `feedbackLoop.getZoneAccuracy()` — Zona akurasi < 30% di-skip (kecuali critical)
- `courierCoordinator.analyzeWorkloads()` — Deteksi imbalance

### 4. Route Optimization

**Gemini mode:** Kirim koordinat + prioritas → AI return urutan optimal
**Fallback:** Sort by status → priority → estimatedArrival

### 5. Smart Pickup Hub Clustering

**Algoritma:**
1. Filter delivery yang punya lat/lng
2. Untuk setiap delivery, cari tetangga dalam radius 1.5 km
3. Jika ≥ 2 delivery berdekatan → buat cluster
4. Hitung centroid sebagai posisi hub
5. Jika Gemini tersedia → minta nama landmark Surabaya terdekat

---

## 🗺️ Google Maps Integration

### Courier Mode:
- Blue dot (posisi kurir) dengan smooth animation
- Pin hijau (tujuan aktif)
- Dot abu-abu kecil (tujuan lainnya)
- Kotak biru "P" (hub konsolidasi)
- Directions API (turn-by-turn navigation)
- Traffic layer (toggle on/off)

### Dispatcher Mode:
- Semua delivery sebagai dot berwarna (status-coded)
- Posisi kurir sebagai blue pulsing dot
- Incident markers (animasi pulse)
- Traffic layer (selalu aktif)
- Click marker → info window detail

### Perilaku Kamera:
- User bisa pan/zoom bebas tanpa map snap back
- Follow mode hanya aktif saat user klik "Lokasi Saya"
- Saat navigasi dimulai → zoom in sekali, lalu user bebas explore

---

## 🎨 Theme System

Menggunakan CSS Variables (bukan Tailwind `dark:` class):

```css
:root {
  --bg-main: #0f172a;      /* Dark mode default */
  --bg-surface: #1e293b;
  --text-main: #f8fafc;
  --primary: #52796f;
}

.light-mode {
  --bg-main: #f1f5f9;
  --bg-surface: #ffffff;
  --text-main: #020617;
  --primary: #083344;
}
```

Utility classes: `bg-main`, `bg-surface`, `text-text-main`, `text-text-muted`, `border-theme`

---

## 🔒 Keamanan

- **API Key Auth:** Header `X-API-Key` untuk semua endpoint (kecuali health & login)
- **Rate Limiting:** 100 req/menit umum, 5 req/menit untuk AI endpoints
- **Geofence:** Kurir harus dalam radius 200m untuk mark delivered
- **Password:** SHA-256 hashed (production: gunakan bcrypt)
- **CORS:** Hanya origin yang terdaftar

---

## 📊 Data Model

### Delivery
```json
{
  "id": "DEL-001",
  "courierId": "sby-c01" | null,
  "recipient": "Tunjungan Plaza 6",
  "address": "Jl. Embong Malang No. 21-31",
  "lat": -7.2625,
  "lng": 112.7389,
  "status": "unassigned" | "pending" | "in_transit" | "delivered" | "rerouted",
  "priority": "high" | "medium" | "low",
  "packageCount": 2,
  "timeSlot": "09:00 - 11:00",
  "notes": "Titip di concierge",
  "pickupHub": { "label": "Hub Tunjungan", "reason": "..." } | null,
  "isRerouted": false,
  "deliveryNote": "Diterima satpam" | null
}
```

### User
```json
{
  "id": "sby-c01",
  "email": "budi@nusaroute.ai",
  "name": "Budi Santoso",
  "role": "courier" | "dispatcher",
  "region": "Surabaya Timur"
}
```

### Traffic Zone
```json
{
  "id": "gubeng",
  "name": "Gubeng / Stasiun",
  "lat": -7.2652,
  "lng": 112.7523,
  "radius": 1.5,
  "level": "low" | "medium" | "high" | "critical",
  "reason": "Puncak kemacetan sore di Gubeng"
}
```

---

## 🧪 Testing

### Manual Testing Flow:
1. Start backend (`npm run dev` di folder backend)
2. Start frontend (`npm run dev` di folder frontend)
3. Login sebagai Dispatcher → Delegasi paket → Terapkan hub
4. Buka tab baru → Login sebagai Kurir Budi
5. Lihat paket muncul → Mulai navigasi → Test reroute (via simulation)
6. Mark delivered → Lihat completion summary

### API Testing:
```bash
# Health check
curl http://localhost:3000/api/health

# Login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dispatcher@nusaroute.ai","password":"nusaroute2026"}'

# Get all deliveries
curl http://localhost:3000/api/deliveries/all \
  -H "X-API-Key: nusaroute-dev-secret-key"

# Auto-assign
curl -X POST http://localhost:3000/api/deliveries/auto-assign \
  -H "X-API-Key: nusaroute-dev-secret-key"

# Agent status
curl http://localhost:3000/api/agent/status \
  -H "X-API-Key: nusaroute-dev-secret-key"
```

---

## 📦 Build & Deploy

```bash
# Build frontend
cd frontend && npm run build

# Build menghasilkan dist/ yang siap deploy ke Firebase Hosting
firebase deploy --only hosting

# Backend deploy ke Cloud Run
cd backend
gcloud run deploy nusaroute-api --source . --region asia-southeast2
```

Lihat [DEPLOY.md](DEPLOY.md) untuk panduan lengkap.

---

**Last Updated:** Mei 2026  
**Version:** 2.0.0
