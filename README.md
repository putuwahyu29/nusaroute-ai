# 🚚 NusaRoute AI — Solusi Logistik Pintar untuk Kota Surabaya

> **Tema:** Smart Urban Mobility & Logistics (Smart City)
> 
> Solusi berbasis **Agentic AI** untuk mengoptimalkan rute pengiriman di area padat penduduk guna mengurangi *operational drag*. Sistem ini secara mandiri memprediksi kemacetan dan mengubah rute kurir atau menentukan titik pick-up yang paling efisien agar proses logistik menjadi lebih ringan dan cepat.

---

## 📌 Apa itu NusaRoute AI?

NusaRoute AI adalah **asisten pengiriman pintar** yang menggunakan Kecerdasan Buatan (Agentic AI) untuk membantu kurir mengirim paket lebih cepat, lebih aman, dan lebih hemat di tengah padatnya lalu lintas Kota Surabaya.

Aplikasi ini bukan sekadar peta navigasi — melainkan **"rekan kerja digital"** yang proaktif memberikan solusi saat terjadi hambatan di jalan, **tanpa perlu intervensi manusia**.

---

## 👥 Pengguna Aplikasi (2 Role)

| Role | Fungsi |
|------|--------|
| **Dispatcher (Manajer Logistik)** | Memantau seluruh armada, mendelegasikan paket ke kurir, menerapkan hub konsolidasi, melihat analytics performa |
| **Kurir Lapangan** | Menerima tugas pengiriman, navigasi rute optimal, melaporkan hambatan, menerima instruksi reroute dari AI |

---

## 🌟 Fitur Utama

### 1. Delegasi Paket Otomatis (AI Auto-Assignment)
- Semua paket masuk ke sistem dengan status `unassigned`
- Dispatcher klik satu tombol → AI menghitung kurir terdekat untuk setiap paket berdasarkan jarak (haversine)
- Paket otomatis ditugaskan ke kurir yang paling efisien

### 2. Prediksi Kemacetan Pintar (Traffic Reasoning)
- AI memantau **10 zona kemacetan** di Surabaya (Wonokromo, Ahmad Yani, Gubeng, dll)
- Mempertimbangkan: jam sibuk, pola lalu lintas, dan kondisi cuaca
- Output: status per zona dalam bahasa Indonesia yang mudah dipahami

### 3. Peringatan Rute Proaktif (Proactive Rerouting)
- Sistem terus membandingkan rute aktif kurir dengan prediksi kemacetan
- Jika AI mendeteksi kurir akan masuk zona macet → **modal peringatan** muncul
- Kurir harus mengambil aksi (terima reroute / abaikan) sebelum melanjutkan

### 4. Laporan Hambatan Multimodal (Foto & Suara)
- Kurir cukup ambil **foto** (banjir, kecelakaan) atau kirim **rekaman suara**
- Google Gemini AI menganalisis secara multimodal dan memberikan keputusan:
  - `REROUTE` — Ubah rute
  - `REDIRECT_TO_HUB` — Alihkan ke titik hub terdekat
  - `WAIT` — Tunggu situasi membaik
  - `ESCALATE` — Eskalasi ke dispatcher

### 5. Optimasi Urutan Pengiriman (Route Optimization)
- Algoritma AI (TSP Solver) menghitung urutan pengiriman paling efisien
- Mempertimbangkan: prioritas paket, jarak, dan time window
- Menghemat waktu hingga 30% dibanding urutan manual

### 6. Titik Kumpul Pintar (Smart Pickup Hub)
- AI mengelompokkan paket yang lokasinya berdekatan (radius 1.5 km)
- Menyarankan **titik parkir tunggal** (hub) agar kurir distribusi jalan kaki
- Dispatcher klik "Terapkan" → instruksi langsung muncul di aplikasi kurir
- Marker hub (kotak biru "P") terlihat di peta kurir

### 7. Autonomous Agent Loop (Inti Agentic AI)
- Background loop berjalan **setiap 3 menit** tanpa intervensi manusia
- Siklus: **Monitor → Evaluate → Decide → Act → Log**
- Kemampuan otonom:
  - Auto-reroute kurir yang mendekati zona macet
  - Auto-assign hub saat clustering menguntungkan
  - Deteksi kurir yang terjebak (stuck detection)
  - Load balancing antar kurir
  - Kirim notifikasi FCM otomatis

### 8. Learning & Feedback Loop
- Setiap prediksi dan keputusan dicatat hasilnya
- Zona dengan akurasi rendah mendapat bobot lebih rendah (mengurangi false positive)
- Reroute success rate dilacak untuk continuous improvement

### 9. Multi-Courier Coordination
- Deteksi ketidakseimbangan beban antar kurir
- Saran reassignment otomatis
- Stuck courier detection (terjebak > 45 menit)

### 10. Analytics Dashboard (Operational Intelligence)
- Metrik pengurangan operational drag:
  - Reroute otomatis yang dilakukan
  - Waktu & jarak dihemat
  - CO₂ dikurangi
  - On-time delivery rate
  - Skor pengurangan operational drag (%)
- Grafik kemacetan per jam
- Timeline keputusan otonom agent
- Tab AI Learning (akurasi prediksi per zona)

---

## 🔄 Alur Kerja Aplikasi

```
┌─────────────────────────────────────────────────────────────┐
│                    DISPATCHER                                 │
├─────────────────────────────────────────────────────────────┤
│ 1. Login sebagai Dispatcher                                  │
│ 2. Lihat 15 paket (status: unassigned)                      │
│ 3. Klik "Delegasi Otomatis ke Kurir"                        │
│    → AI assign paket ke 3 kurir berdasarkan kedekatan       │
│ 4. Lihat tab "Smart Pickup"                                  │
│    → AI menemukan cluster paket berdekatan                  │
│    → Klik "Terapkan & Kirim ke Kurir"                       │
│ 5. Pantau peta: posisi kurir, titik pengiriman, traffic     │
│ 6. Lihat Analytics: metrik operational drag                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      KURIR                                    │
├─────────────────────────────────────────────────────────────┤
│ 1. Login sebagai Kurir                                       │
│ 2. Lihat paket yang sudah ditugaskan + instruksi hub        │
│ 3. Klik "Mulai Perjalanan" → navigasi turn-by-turn          │
│ 4. [AI AGENT] Deteksi macet di depan                        │
│    → Modal peringatan muncul (harus ambil aksi)             │
│    → Pilih "Terapkan Rute AI" atau "Abaikan"               │
│ 5. Sampai di lokasi (< 200m) → "Tandai Terkirim"           │
│    → Bisa tambah catatan (opsional)                         │
│ 6. Otomatis lanjut ke paket berikutnya                      │
│ 7. Jika ada hambatan → tab "Lapor" (foto/suara)            │
│    → AI analisis → modal rekomendasi muncul                 │
│ 8. Semua selesai → ringkasan performa hari ini              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 AUTONOMOUS AGENT (Background)                 │
├─────────────────────────────────────────────────────────────┤
│ • Berjalan setiap 3 menit tanpa intervensi                  │
│ • Monitor traffic → Evaluate ancaman → Decide tindakan      │
│ • Act: kirim notifikasi, update rute, log keputusan         │
│ • Learning: catat akurasi, kurangi false positive           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Teknologi yang Digunakan

| Layer | Teknologi | Fungsi |
|-------|-----------|--------|
| **AI Engine** | Google Gemini 2.5 Flash | Multimodal analysis (foto+audio), traffic reasoning, route optimization |
| **Frontend** | React 18 + Vite 5 | Mobile-first PWA, responsive UI |
| **Styling** | Tailwind CSS 3 | Dark/Light mode, custom theme system |
| **Peta** | Google Maps JavaScript API | Navigasi, directions, traffic layer, markers |
| **Backend** | Express.js 5 (Node.js) | REST API, AI orchestration, rate limiting |
| **Database** | Firebase Firestore | Real-time data, delivery tracking |
| **Notifikasi** | Firebase Cloud Messaging | Push notification ke kurir |
| **PWA** | vite-plugin-pwa | Installable, offline-capable |
| **Deploy** | Firebase Hosting + Cloud Run | CDN frontend, serverless backend |

---

## 📁 Struktur Proyek

```
nusaroute-ai/
├── backend/
│   ├── services/
│   │   ├── ai-agent.js            # Gemini multimodal incident analysis
│   │   ├── traffic-agent.js       # Traffic prediction & proactive rerouting
│   │   ├── autonomous-agent.js    # Autonomous agent loop + analytics
│   │   └── firebase-admin.js      # Firestore operations + demo data
│   ├── server.js                  # Express API server (semua endpoints)
│   ├── Dockerfile                 # Container untuk Cloud Run
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── GoogleMap.jsx          # Peta interaktif (courier + dispatcher mode)
│   │   │   ├── DispatcherDashboard.jsx # Dashboard dispatcher lengkap
│   │   │   ├── SmartHubAssignment.jsx  # UI smart pickup hub
│   │   │   ├── DeliveryList.jsx        # Daftar pengiriman kurir
│   │   │   ├── AIDecisionCard.jsx      # Card hasil analisis AI
│   │   │   ├── IncidentReporter.jsx    # Form laporan foto/suara
│   │   │   ├── MultiRouteAlternatives.jsx # Pilihan rute alternatif
│   │   │   ├── LocationPickerMap.jsx   # Peta pilih lokasi (dispatcher)
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── CourierPage.jsx        # Halaman utama kurir
│   │   │   ├── LoginPage.jsx         # Halaman login
│   │   │   └── AnalyticsPage.jsx     # Dashboard analytics & agent
│   │   ├── services/
│   │   │   └── api.js               # Semua API calls ke backend
│   │   ├── App.jsx                   # Role-based routing
│   │   └── index.css                 # Theme system (CSS variables)
│   ├── vite.config.js
│   └── package.json
├── README.md                         # Dokumentasi utama (file ini)
├── DEVELOPMENT.md                    # Panduan teknis developer
├── SETUP.md                          # Panduan konfigurasi API keys
├── DEPLOY.md                         # Panduan deployment ke GCP
└── firebase.json                     # Firebase Hosting config
```

---

## 🔌 API Endpoints

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| GET | `/api/health` | Health check server |
| POST | `/api/login` | Autentikasi user |
| GET | `/api/deliveries` | Ambil paket per kurir |
| GET | `/api/deliveries/all` | Semua paket (dispatcher) |
| POST | `/api/deliveries` | Tambah paket baru |
| POST | `/api/deliveries/auto-assign` | AI auto-assign ke kurir |
| POST | `/api/deliveries/optimize` | AI optimasi urutan rute |
| PATCH | `/api/deliveries/:id/status` | Update status + geofence check |
| POST | `/api/analyze-incident` | Analisis insiden multimodal (foto+audio) |
| GET | `/api/incidents` | Daftar laporan insiden |
| GET | `/api/smart/traffic` | Prediksi traffic 10 zona |
| POST | `/api/smart/pickup-points` | Rekomendasi hub konsolidasi |
| POST | `/api/smart/proactive-alert` | Deteksi rute terdampak macet |
| POST | `/api/smart/route-alternatives` | Generate rute alternatif AI |
| GET | `/api/smart/weather` | Prediksi cuaca |
| POST | `/api/smart/apply-hub` | Terapkan hub + kirim FCM |
| GET | `/api/agent/status` | Status autonomous agent |
| POST | `/api/agent/start` | Start agent |
| POST | `/api/agent/stop` | Stop agent |
| GET | `/api/analytics` | Data analytics dashboard |

---

## 🎯 Bagaimana Aplikasi Ini Menjawab Tema?

| Kriteria Tema | Implementasi |
|---|---|
| **Optimasi rute di area padat penduduk** | AI Route Optimization + Google Maps Directions |
| **Prediksi kemacetan secara mandiri** | 10 zona Surabaya + Gemini AI + rule-based fallback |
| **Mengubah rute kurir (proactive rerouting)** | Autonomous Agent + Modal peringatan + rute alternatif |
| **Titik pick-up paling efisien** | Smart Hub Clustering (radius 1.5 km) |
| **Agentic AI (otonom tanpa intervensi)** | Background loop 3 menit: Monitor → Evaluate → Decide → Act |
| **Mengurangi operational drag** | Analytics: waktu hemat, km hemat, CO₂, on-time rate |

---

## 🚀 Quick Start

```bash
# 1. Clone & install
git clone <repo-url>
cd nusaroute-ai
npm run install:all

# 2. Setup environment (ikuti panduan interaktif)
npm run setup

# 3. Jalankan development server
npm run dev
```

Aplikasi berjalan di:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

### Akun Demo:
| Email | Password | Role |
|-------|----------|------|
| `dispatcher@nusaroute.ai` | `nusaroute2026` | Dispatcher |
| `budi@nusaroute.ai` | `nusaroute2026` | Kurir |
| `agus@nusaroute.ai` | `nusaroute2026` | Kurir |
| `eko@nusaroute.ai` | `nusaroute2026` | Kurir |

---

## 📚 Dokumentasi Lanjutan

- **[DEVELOPMENT.md](DEVELOPMENT.md)** — Panduan teknis, arsitektur, dan cara kerja AI
- **[SETUP.md](SETUP.md)** — Konfigurasi Google Cloud, Firebase, dan API Keys
- **[DEPLOY.md](DEPLOY.md)** — Deployment ke production (Cloud Run + Firebase Hosting)

---

## 🏆 Keunggulan Kompetitif

1. **Benar-benar Agentic** — Bukan sekadar AI yang dipanggil saat diminta. Agent berjalan otonom di background, membuat keputusan sendiri.
2. **End-to-end visible** — Setiap keputusan AI bisa dilihat di Analytics (audit trail).
3. **Graceful degradation** — Berjalan tanpa API key (mock mode), tanpa Firebase (in-memory), tanpa GPS (manual input).
4. **Real Surabaya data** — 10 zona kemacetan nyata, alamat real, pola traffic realistis.
5. **Learning loop** — AI semakin akurat seiring waktu, mengurangi false positive.

---

**NusaRoute AI** — *Navigasi Lebih Pintar, Pengiriman Lebih Lancar.*

Made for Surabaya 🌳🛵
