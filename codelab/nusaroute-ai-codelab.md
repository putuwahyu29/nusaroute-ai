summary: Panduan Hands-on Workshop DevFest Cloud Surabaya 2026: Membangun Multimodal Agent Logistik dengan Gemini, Google Maps, Cloud Firestore & Cloud Run
id: nusaroute-ai-codelab
categories: Cloud, AI, Web
tags: devfest, gemini, googlemaps, cloudrun, firestore, mcp, antigravity, surabaya
status: Published
authors: I Putu Agus Wahyu Dupayana
Feedback Link: https://github.com/putuwahyu29/nusaroute-ai/issues

# Membangun NusaRoute AI: Multimodal Agentic Logistics dengan Gemini, Google Maps, Firestore & Cloud Run

## Pengenalan & Arsitektur Sistem
Duration: 05:00

Workshop **DevFest Cloud Surabaya 2026** ini memandu peserta merancang dan mengimplementasikan **NusaRoute AI**. Platform logistik cerdas ini mengoptimalkan rute pengiriman paket di wilayah Kota Surabaya menggunakan AI multimodal.

<aside class="special">
<p><strong>Ringkasan Workshop: Tujuan, Ruang Lingkup &amp; Hasil Akhir</strong><br>
<strong>1. Tujuan:</strong> Memahami cara kerja sistem AI multimodal yang menganalisis foto kemacetan dan pesan suara kurir, lalu memperbarui rute navigasi dan database secara otomatis.<br>
<strong>2. Ruang Lingkup:</strong> Platform <strong>NusaRoute AI</strong> fullstack (Node.js 22 LTS / Express 5 + React 18 PWA) untuk 15 titik pengiriman di Surabaya dengan antarmuka Kurir, Dispatcher, dan Analitik.<br>
<strong>3. Hasil Akhir:</strong> Aplikasi web siap produksi dengan alur: laporan kendala kurir &rarr; analisis AI Gemini &rarr; visualisasi rute baru di Google Maps &amp; validasi radius 200 meter &rarr; sinkronisasi data real-time ke Cloud Firestore.</p>
</aside>

### Apa yang Akan Anda Pelajari & Bangun?
1. **Analisis Multimodal dengan AI**: Menggunakan **Google Gemini 3.8 Flash** untuk menganalisis foto kemacetan jalan dan voice note kurir menjadi data terstruktur (JSON).
2. **Google Maps Platform & Validasi Jarak**: Mengintegrasikan **Routes API** (standar navigasi rute modern Google Cloud) dan Maps JavaScript API, menampilkan garis rute pengalihan pada peta interaktif, serta memvalidasi batas jarak 200 meter menggunakan formula Haversine.
3. **Cloud Firestore & Keamanan Data**: Mengatur database NoSQL di region Jakarta (`asia-southeast2`) yang hanya dapat diakses melalui backend aman (Firebase Admin SDK), didukung dua opsi login (**Username/Password** dan **Akun Google**), serta Role-Based Access Control (RBAC).
4. **Optimasi Rute & Ketahanan Sistem**: Menerapkan algoritma Nearest-Neighbor TSP solver, mekanisme exponential backoff, dan graceful shutdown.
5. **Deployment Serverless**: Men-deploy backend kontainer ke **Google Cloud Run** dan frontend React 18 PWA ke **Firebase Hosting**.

### Mengapa Agentic AI, Bukan Sekadar Chatbot?
Chatbot konvensional bersifat pasif karena hanya merespons input teks pengguna. Sebaliknya, **Agentic AI** beroperasi secara mandiri dan proaktif melalui siklus 4 tahap:
- **Monitor**: Memantau kondisi lalu lintas, cuaca live (Open-Meteo), dan status rute setiap 3 menit.
- **Evaluate**: Mendeteksi potensi kemacetan pada zona dinamis di Cloud Firestore (`traffic_zones`, studi kasus 10 zona rawan Surabaya).
- **Decide**: Menentukan rute pengalihan dan pengumpulan paket di pos singgah terdekat (*Smart Hub*).
- **Act**: Memperbarui instruksi navigasi kurir, menyimpan keputusan agen ke Firestore, dan memperbarui peta pemantau dispatcher.

### Spektrum Evolusi AI: Di Mana Posisi Agentic AI?
Untuk memahami posisi teknologi ini, perhatikan bagaimana paradigma AI berevolusi:

| Kategori AI | Karakteristik Utama | Contoh Kasus | **Catatan** |
| :--- | :--- | :--- | :--- |
| **Rule-Based (Berbasis Aturan)** | Logika kaku berbasis aturan percabangan `if-else` | Sistem tilang elektronik sederhana | Tidak adaptif terhadap situasi baru di luar skenario yang telah diprogram secara statis. |
| **Predictive ML** | Prediksi angka/kategori dari data historis | Estimasi waktu tempuh (ETA) rata-rata | Tidak bisa bernalar dan tidak memahami foto atau suara. |
| **Generative AI (Chatbot)** | Menghasilkan teks/gambar berdasarkan prompt | Chatbot customer service | Bersifat **pasif**; hanya menjawab saat ditanya, tidak bisa aksi nyata. |
| **Agentic AI (NusaRoute)** | Otonom, memiliki persepsi, nalar, & aksi | Asisten navigasi otonom Surabaya | Bergantung koneksi internet & kuota API; kompleksitas implementasi lebih tinggi. |

### 4 Kapabilitas Utama NusaRoute AI:
1. **Persepsi**: Memproses foto kemacetan dan voice note kurir langsung di RAM buffer (*zero disk I/O*).
2. **Penalaran**: Model Gemini 3.8 Flash menilai tingkat keparahan hambatan, memutuskan tindakan pengalihan rute (`REROUTE`), dan memperkirakan waktu keterlambatan.
3. **Aksi**: Sistem memanggil **Google Routes API** untuk menghitung rute alternatif baru dan langsung memperbarui data di Cloud Firestore.
4. **Otonomi**: Sistem memantau kondisi rute dan cuaca secara berkala setiap 3 menit (melalui proses latar belakang atau Cloud Scheduler), lalu memperbarui status ke Firestore.

### Rasional Arsitektur & Pemilihan Model Gemini 3.8 Flash

Mengapa NusaRoute AI dibangun dengan arsitektur 4-Tier Serverless dan model **Gemini 3.8 Flash**? Keputusan desain ini berakar pada rekomendasi resmi *Google Cloud Architecture Framework* dan kebutuhan operasional kurir di lapangan.

![Diagram Alur Arsitektur Serverless NusaRoute AI](img/nusaroute-serverless-architecture.png)

#### 1. Rasional Arsitektur: Mengapa Decoupled (Firebase Hosting + Cloud Run)?
- **Bebas *cold start* pada Antarmuka Kurir**: Frontend React 18 PWA disajikan melalui jaringan **Firebase Hosting Global CDN**. Saat kurir membuka aplikasi di ponsel, antarmuka langsung dimuat dalam tempo **<100 milidetik** tanpa menunggu kontainer backend bangun dari status tidur.
- **Efisiensi Biaya *scale-to-zero***: Backend Express 5 TypeScript dijalankan di **Google Cloud Run**. Saat tidak ada kurir aktif di luar jam operasional, kontainer otomatis diskalakan ke nol sehingga biaya komputasi menjadi **Rp 0** (*pay-as-you-go*).
- **Serverless Reverse Proxy (Satu Domain & Eliminasi CORS)**: Melalui aturan `rewrites` di `firebase.json`, Firebase Hosting merutekan path `/api/**` langsung ke Cloud Run di region Jakarta (`asia-southeast2`).
  - **Satu Custom Domain Terpadu**: Frontend (`nusaroute-ai.web.id`) dan API backend (`nusaroute-ai.web.id/api`) berada di bawah domain yang sama, menghemat biaya Cloud Load Balancer (~$18/bulan) tanpa konfigurasi multi-subdomain terpisah.
  - **Zero CORS Overhead**: Berjalan secara *same-origin* sehingga browser kurir tidak perlu mengirimkan *preflight OPTIONS request*, memangkas latensi jaringan sebesar 50–100 ms.
  - **Dual-Path Access**: Backend Cloud Run tetap dilengkapi middleware CORS dinamis, sehingga Cloud Scheduler dan pengujian terminal/curl tetap dapat memanggil URL Cloud Run secara direct.
- **Isolasi Keamanan Kunci Rahasia**: Berkas browser kurir tidak pernah menyimpan `GEMINI_API_KEY` maupun berkas *Service Account* Firestore. Seluruh kredensial rahasia dan pemrosesan data biner (foto dan audio kurir di RAM) diisolasi aman di lingkungan serverless Cloud Run.
- **Mengapa Bukan VM Instance (Compute Engine)?** VM menagih biaya sewa flat 24 jam nonstop meskipun sistem sedang menganggur di malam hari, serta memerlukan pemeliharaan sistem operasi Linux, konfigurasi Nginx, dan perpanjangan sertifikat SSL manual.
- **Mengapa Bukan Kontainer Monolitik?** Menyatukan berkas frontend statis ke dalam satu kontainer backend Cloud Run akan memboroskan kuota komputasi CPU dan menyebabkan kurir mengalami *blank screen* 3–5 detik setiap kali kontainer mengalami *cold start*.

#### Tabel Evaluasi Perbandingan Arsitektur Sistem

Berikut matriks perbandingan komprehensif antara arsitektur NusaRoute AI dengan berbagai alternatif arsitektur lain:

| Parameter Arsitektur | Opsi A: Monolitik VM / VPS (Compute Engine) | Opsi B: Kontainer Monolitik (Frontend + Backend di Cloud Run) | Opsi C: Microservices Kubernetes (Google GKE) | Opsi D: Decoupled Serverless (NusaRoute AI: Firebase + Cloud Run) |
| :--- | :--- | :--- | :--- | :--- |
| **Kecepatan Buka Web (UI)** | Rata-rata (tergantung lokasi fisik server) | **Lambat**: Terkena *cold start* (layar putih 3–5s saat bangun) | Cepat (via Ingress CDN) | **Sangat Cepat**: <100ms via Global Edge CDN (Bebas *cold start*) |
| **Biaya saat Menganggur (*Idle*)** | **Boros**: Bayar sewa flat 24/7 | **Hemat**: Otomatis *scale-to-zero* ($0) | **Sangat Mahal**: Minimal sewa klaster & node | **Paling Hemat**: *scale-to-zero* (Rp 0 saat di luar jam kerja) |
| **Beban Pemeliharaan (*Ops Overhead*)** | **Tinggi**: Urus OS Linux, Nginx, patch, SSL manual | Rendah (Fully Managed) | **Sangat Tinggi**: Manajemen pod, ingress, & YAML | **Nol (*Zero Ops*)**: Dikelola penuh secara serverless oleh Google |
| **Ketahanan Lonjakan Trafik (*Spike*)** | Terbatas (perlu konfigurasi load balancer manual) | Otomatis Instan | Otomatis (via Horizontal Pod Autoscaler) | **Otomatis Instan**: Menggandakan kontainer dalam hitungan detik |
| **Keamanan Kunci Rahasia AI** | Tergantung konfigurasi server | Aman di dalam kontainer | Aman via Kubernetes Secrets | **Sangat Aman**: Kunci API terisolasi di Cloud Run & Secret Manager |
| **Keputusan Evaluasi** | ❌ **Ditolak** (biaya boros & repot pemeliharaan) | ❌ **Ditolak** (UI kurir lambat akibat *cold start*) | ❌ **Ditolak** (terlalu rumit / *over-engineering*) | ✅ **DIPILIH**: Keseimbangan terbaik performa, biaya, dan kemudahan |

#### 2. Rasional Model AI: Mengapa Memilih Gemini 3.8 Flash?
- **Kecepatan Latensi Operasional (< 2 Detik)**: Kurir di jalan raya memerlukan pembaruan navigasi seketika. Varian Flash dioptimalkan untuk inferensi waktu-nyata (*low-latency* rata-rata 1–1,8 detik), berbeda dengan varian Pro yang membutuhkan waktu penalaran 5–10 detik.
- **Native Multimodal (Foto + Suara Sekaligus)**: Gemini 3.8 Flash memproses foto rintangan jalan dan rekaman suara kurir secara langsung dalam satu payload permintaan API. Tidak diperlukan alat perantara terpisah seperti Computer Vision atau Speech-to-Text yang dapat menambah latensi dan *single point of failure*.
- **Kapasitas Kuota & Efisiensi Biaya Token**: Varian Flash menawarkan batas *Requests Per Minute* (RPM) dan kuota token yang jauh lebih longgar dan ekonomis di Google AI Studio / GCP. Hal ini menjamin kelancaran sesi live demo tanpa risiko tercekik batas kuota (*429 Rate Limit Exceeded*).
- **Deterministik & Integritas Format**: Konfigurasi **`temperature: 0.1`** meminimalkan variasi output acak, sedangkan **`responseSchema` (Structured Outputs JSON Schema)** mengunci enum tindakan (`REROUTE`, `WAIT`, `REDIRECT_TO_HUB`, `ESCALATE`). Format di luar skema otomatis ditolak backend sehingga integritas data tetap terjamin.

### Google Cloud Best Practice Matrix: Anti-Pattern vs. Recommended Practice

Workshop ini dirancang dengan mengacu pada prinsip **Google Cloud Well-Architected Framework**. Tabel berikut membedah perbedaan antara praktik umum yang keliru (*anti-pattern*) dengan standar arsitektur terbaik (*best practice*) yang diterapkan pada NusaRoute AI:

| Produk Google | ❌ Anti-Pattern (Praktik Keliru / Rawan Masalah) | ✅ Google Cloud Best Practice (Diterapkan di NusaRoute AI) |
| :--- | :--- | :--- |
| **Google Gemini API** | Prompt teks bebas (*free-form*) tanpa skema terstruktur, atau memakai model Pro lambat (5–10s) untuk sistem navigasi kurir. | **Gemini 3.8 Flash + Structured Outputs (`responseSchema`) + `temperature: 0.1`**: Inferensi multimodal instan (<2 detik) langsung dari RAM buffer (*zero disk I/O*) dengan format data deterministik. |
| **Google Cloud Run** | Menjalankan VM Compute Engine 24/7 yang menagih sewa flat saat idle malam hari, atau kontainer tanpa pembatas autoscaling. | **Google Cloud Run (Region Jakarta `asia-southeast2`) + *Scale-to-Zero***: Biaya komputasi Rp 0 saat di luar jam operasional, auto-scale instan saat lonjakan pesanan, dengan batas aman `--max-instances 3`. |
| **Firebase Hosting + Cloud Run** | Memisahkan frontend dan backend pada domain berbeda, memerlukan sewa Cloud Load Balancer (~$18/bulan) dan memicu latensi *CORS preflight*. | **Serverless Reverse Proxy (`firebase.json rewrites: /api/**`)**: Menggabungkan Web & API di bawah satu domain, mengeliminasi biaya Load Balancer dan bebas overhead latensi CORS. |
| **Google Maps Platform** | Memanggil Routes API / Directions API terus-menerus tanpa filter, memboroskan kuota dan biaya API per request. | **Hybrid Spatial Filtering**: Validasi geofencing awal via formula **Haversine ($O(n^2)$)** lokal di backend. Routes API hanya dipanggil ketika rute kurir benar-benar terdampak kemacetan. |
| **Cloud Firestore** | Membuka akses database langsung dari browser publik tanpa aturan keamanan, atau memakai database relasional yang lambat saat *cold start*. | **Firebase Admin SDK Terisolasi di Backend + Region Jakarta (`asia-southeast2`)**: Akses database hanya melalui API backend terotentikasi, meminimalkan latensi jaringan dan menjamin integritas data. |
| **Google Cloud Scheduler** | Menjalankan *timer loop* internal (`setInterval`) di dalam server kontainer yang berisiko duplikasi eksekusi saat multi-instance. | **Managed Serverless Cron**: Memanggil endpoint `POST /api/agent/tick` tiap 3 menit via Cloud Scheduler terpusat dengan otentikasi header `X-API-Key`. |
| **Google Cloud Logging** | Menggunakan `console.log` teks biasa yang tidak dapat difilter atau dianalisis saat terjadi insiden di Cloud Run. | **Structured JSON Logging**: Memancarkan log berstandar Google Cloud Logging (`httpRequest`, `severity`, `latencySec`) yang dapat langsung di-query di *Cloud Logs Explorer*. |

### Studi Kasus Nyata: Smart Urban Logistics Kota Surabaya

Mengapa studi kasus ini relevan dan aplikatif untuk dipraktikkan?
1. **Toponimi & Kondisi Lapangan Nyata**: Sistem menggunakan 15 koordinat pengantaran riil Surabaya (`DEL-001` s.d. `DEL-015`) dan 10 zona rawan macet serta genangan air Surabaya (Wonokromo, Mayjen Sungkono, Ahmad Yani, Darmo, Kertajaya).
2. **Mitigasi Masalah Operasional Kurir**:
   - **Keselamatan Pengemudi**: Kurir tidak perlu mengetik teks di jalan raya. Cukup kirim **Voice Note langsung ke Gemini** untuk pelaporan rintangan.
   - **Pencegahan Fraud (Penyelesaian Fiktif)**: Tombol konfirmasi pengiriman dikunci otomatis jika kurir belum berada dalam **radius fisik 200 meter (Geofencing Haversine)** dari alamat tujuan.
   - **Efisiensi Bahan Bakar**: Algoritma **Nearest-Neighbor TSP Solver** mengurutkan pengantaran sehingga menghemat ~19% jarak tempuh bolak-balik kurir.

---

## Prasyarat Alat (Tooling) & Setup Repositori
Duration: 12:00

Sebelum memulai praktikum, pastikan lingkungan kerja dan alat-alat esensial berikut telah siap di laptop Anda.

### 1. Checklist Prasyarat Alat (Tooling Checklist)

Untuk mengikuti workshop hands-on ini secara maksimal, Anda memerlukan alat-alat berikut:

| Alat / Tool | Versi Minimum | Deskripsi & Peran | Tautan Unduh / Panduan |
| :--- | :--- | :--- | :--- |
| **Google Antigravity IDE** *(Disarankan)* | Versi Terbaru | Editor berkemampuan Agentic AI buatan Google DeepMind dengan autonomous agent, workspace terintegrasi, dan inspeksi kode langsung. *(Dapat juga menggunakan VS Code)* | [antigravity.google](https://antigravity.google) / [code.visualstudio.com](https://code.visualstudio.com) |
| **Google Cloud CLI (`gcloud`)** | Versi 450.0.0+ | CLI resmi Google Cloud untuk autentikasi GCP, enable API, pengelolaan IAM, dan deploy Cloud Run. | [cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install) |
| **Node.js & NPM** | Node.js 22 LTS (Active LTS) / NPM 10+ | Runtime JavaScript/TypeScript modern yang didukung resmi (Node.js 18 dan versi di bawahnya sudah End-of-Life / EOL). | [nodejs.org](https://nodejs.org) |
| **Git** | Versi 2.30+ | Version control untuk clone repositori starter. | [git-scm.com](https://git-scm.com) |
| **Gemini API Key** | - | Kunci API gratis untuk model Gemini 3.8 Flash. | [aistudio.google.com](https://aistudio.google.com) |

---

### 2. Panduan Instalasi Cepat Tooling

#### A. Verifikasi Node.js dan Git
Buka terminal (PowerShell, Command Prompt, atau Terminal macOS/Linux) dan jalankan:
```bash
node -v   # Wajib versi LTS aktif (Node.js 22.x LTS atau lebih baru; Node 18 & 20 sudah EOL)
npm -v    # Versi 10.x atau lebih baru (bawaan Node.js 22 LTS)
git --version
```
Jika belum terpasang, pasang Node.js 22 LTS (Active Long-Term Support) dari [nodejs.org](https://nodejs.org) dan Git dari [git-scm.com](https://git-scm.com).

#### B. Instalasi & Autentikasi Google Cloud CLI (`gcloud`)
Tool `gcloud` sangat penting untuk mengaktifkan API GCP dan men-deploy kontainer ke Cloud Run:

* **Windows:** Unduh dan jalankan installer resmi [Google Cloud SDK](https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe).
* **macOS:** Pasang via Homebrew:
  ```bash
  brew install --cask google-cloud-sdk
  ```
* **Linux:** Jalankan skrip instalasi otomatis:
  ```bash
  curl https://sdk.cloud.google.com | bash
  exec -l $SHELL
  ```

Setelah instalasi `gcloud` selesai, ikuti alur berurutan berikut untuk autentikasi dan penyiapan Google Cloud Project:

**Langkah a: Autentikasi Akun Google Anda**
```bash
gcloud auth login
```
(Perintah ini akan membuka jendela browser. Pilih akun Google/Gmail Anda dan klik **Allow**).

**Langkah b: Menyiapkan Google Cloud Project (Pilih salah satu kondisi):**

* **Kondisi 1 — Jika Anda SUDAH memiliki project di Google Cloud:**
  Periksa daftar project yang tersedia di akun Anda:
  ```bash
  gcloud projects list
  ```
  Salin nilai dari kolom `PROJECT_ID` (contoh: `my-logistics-441209`), lalu tetapkan sebagai project aktif:
  ```bash
  gcloud config set project my-logistics-441209
  ```

* **Kondisi 2 — Jika belum memiliki project (Buat project baru):**
  Project ID harus **unik secara global** (6–30 karakter huruf kecil, angka, dan tanda strip `-`).
  * **Opsi Terminal (CLI):**
    ```bash
    # Ganti 'nusaroute-sby-2026' dengan ID unik Anda
    gcloud projects create nusaroute-sby-2026 --name="NusaRoute AI"
    gcloud config set project nusaroute-sby-2026
    ```
  * **Opsi Web Console (GUI):**
    Buka [Cloud Resource Manager](https://console.cloud.google.com/cloud-resource-manager) (atau langsung ke [console.cloud.google.com/projectcreate](https://console.cloud.google.com/projectcreate)), klik **+ Create project**, buat project baru, lalu aktifkan via `gcloud config set project <PROJECT_ID>`.

![Halaman Manage Resources & Create Project di Google Cloud Console](img/gcp-manage-resources.png)

**Langkah c: Memilih & Menautkan Billing Account ke Project (Disarankan untuk Cloud Run & API Produksi)**

Agar layanan seperti **Cloud Run**, **Cloud Scheduler**, dan kuota produksi Google Maps/Firestore dapat diaktifkan tanpa error `Billing account not found`, tautkan Billing Account (termasuk kredit workshop DevFest atau GCP Free Trial) ke project Anda:

* **Opsi Terminal (CLI):**
  ```bash
  # 1. Tampilkan daftar Billing Account yang tersedia & aktif (OPEN = True)
  gcloud billing accounts list

  # 2. Tautkan Billing Account ke project Anda
  #    Ganti <PROJECT_ID> dan <BILLING_ACCOUNT_ID> (format: XXXXXX-XXXXXX-XXXXXX)
  gcloud billing projects link <PROJECT_ID> \
    --billing-account=<BILLING_ACCOUNT_ID>
  ```

* **Opsi Web Console (GUI):**
  1. Buka [Google Cloud Console → Billing → Projects](https://console.cloud.google.com/billing/projects) lalu pastikan Anda berada di tab **Your projects**.
  2. Cari baris project Anda → klik ikon titik tiga (**⋮**) pada kolom **Actions** → pilih **Change billing**.
  3. Pilih **Billing account** yang ingin digunakan (misal kredit workshop/trial aktif) → klik **Set account**.

![Halaman Billing Account Management (Your Projects) di Google Cloud Console](img/gcp-billing-projects.png)

<aside class="tip">
<p><strong>Belum Punya Billing Account?</strong> Anda tetap dapat melewati Langkah c ini untuk menyelesaikan praktikum lokal (Langkah 1–8) menggunakan API yang tidak membutuhkan billing container. Penautan Billing Account baru wajib dilakukan sebelum men-deploy ke Google Cloud Run pada Langkah 9.</p>
</aside>

<aside class="tip">
<p><strong>Informasi Kredensial ADC:</strong> Jika terminal memunculkan pesan <code>WARNING: Your active project does not match the quota project in your local Application Default Credentials file</code>, abaikan pesan tersebut. NusaRoute AI menggunakan kredensial Service Account terisolasi dan Gemini API Key langsung, sehingga perintah <code>set-quota-project</code> tidak diperlukan.</p>
</aside>

<aside class="special">
<p><strong>Opsi Wizard Setup Otomatis:</strong> Sebagai alternatif eksekusi perintah gcloud secara manual, jalankan <code>npm run setup</code> setelah kloning repositori. Skrip interaktif akan mendeteksi akun dan mengonfigurasi project Google Cloud secara terpadu.</p>
</aside>

#### C. Buka Proyek dengan Google Antigravity IDE
Buka **Google Antigravity IDE** (atau VS Code). Antigravity IDE sangat direkomendasikan untuk workshop ini karena dilengkapi asisten AI terintegrasi yang memahami konteks repositori, struktur proyek frontend & backend, serta mampu membantu verifikasi kode secara langsung.

---

### 3. Clone Repositori Starter
Buka terminal di Antigravity IDE dan clone repositori resmi workshop:

```bash
git clone https://github.com/putuwahyu29/nusaroute-ai.git
cd nusaroute-ai
```

### 4. Instal Seluruh Dependensi Proyek (Frontend & Backend)
Proyek ini menggabungkan backend TypeScript Express 5 dan frontend React 18/Vite dalam satu repositori. Jalankan satu perintah berikut di root untuk menginstal semua dependensi sekaligus:

```bash
npm run install:all
```

### 5. Konfigurasi File Environment
Salin template konfigurasi lingkungan untuk backend dan frontend:

```bash
# Salin konfigurasi backend
cp backend/.env.example backend/.env

# Salin konfigurasi frontend (Vite membaca .env.local atau .env)
cp frontend/.env.example frontend/.env.local
```

<aside class="special">
<p><strong>Mode Simulasi Lokal (Mock Mode):</strong> Untuk pengujian offline tanpa API key eksternal, atur <code>USE_MOCK_AI=true</code> di <code>backend/.env</code>. Seluruh fungsi backend, algoritma rute, dan antarmuka web tetap beroperasi penuh secara lokal.</p>
</aside>

---

## Konfigurasi Cloud Firestore & Ekosistem Google Cloud
Duration: 15:00

Pada bagian ini, kita akan mengatur database real-time **Cloud Firestore** dan mengaktifkan seluruh API ekosistem Google Cloud.

### Pilihan A: Setup Otomatis dengan Bantuan AI (Google Antigravity IDE)
Jika Anda membuka proyek ini menggunakan **Google Antigravity IDE** (atau editor berkemampuan AI), repositori ini telah dilengkapi panduan `AGENTS.md`. Anda tidak perlu menjalankan perintah konfigurasi satu per satu secara manual.

Buka panel **Chat Antigravity** dan ketik instruksi berikut:
> *"Baca panduan AGENTS.md, lalu bantu setup Google Cloud project untuk NusaRoute AI. Aktifkan API yang dibutuhkan, siapkan service account Firestore, dan buatkan file backend/.env serta frontend/.env.local."*

> **Catatan:** Saat proses berjalan, asisten AI Antigravity akan menanyakan **Gemini API Key** dari Google AI Studio dan **Google Maps API Key** Anda untuk disimpan ke dalam berkas konfigurasi.

AI Agent di Antigravity IDE akan secara otomatis:
1. Memeriksa status login akun Anda melalui `gcloud auth list`.
2. Mendeteksi project yang ada atau membuatkan project baru.
3. Mengaktifkan seluruh API layanan yang dibutuhkan (`firestore`, `identitytoolkit`, `generativelanguage`, `maps-backend`, `routes`, `run`).
4. Menyiapkan kredensial Service Account dan mengisi file `.env` di backend maupun frontend.
5. Menjalankan `npm run validate` untuk memastikan semua konfigurasi siap digunakan.

---

### Pilihan B: Setup Terpandu Melalui Terminal (Skrip Interaktif)
Jika Anda menggunakan editor teks biasa (seperti VS Code standar) atau terminal, gunakan skrip interaktif yang telah kami sediakan:

1. Pastikan Anda sudah login ke Google Cloud CLI:
   ```bash
   gcloud auth login
   ```
2. Jalankan skrip interaktif di root repositori:
   ```bash
   npm run setup
   ```
   Skrip `setup-config.js` akan secara otomatis menanyakan project dan Billing Account Anda, mengaktifkan API yang dibutuhkan, membuat Service Account dan kunci akses, mengonfigurasi Firebase Web App dan Login Google, serta mengisi file `.env` di backend dan frontend (`frontend/.env.local`).
3. Jalankan verifikasi:
   ```bash
   npm run validate
   ```

---

### Pilihan C: Setup Manual Langkah demi Langkah

Setiap langkah konfigurasi infrastruktur di bawah ini menyediakan dua cara: **Melalui Terminal (CLI)** untuk proses yang cepat dan otomatis, atau **Melalui Konsol Web (GUI)** langsung di browser.

#### 1. Mengaktifkan API Layanan Google Cloud

* **Opsi Terminal (CLI):**
  * **Dengan Billing Account** *(lengkap termasuk Cloud Run)*:
    ```bash
    gcloud services enable \
      firestore.googleapis.com \
      identitytoolkit.googleapis.com \
      run.googleapis.com \
      cloudbuild.googleapis.com \
      cloudscheduler.googleapis.com \
      generativelanguage.googleapis.com \
      maps-backend.googleapis.com \
      routes.googleapis.com \
      directions-backend.googleapis.com \
      apikeys.googleapis.com
    ```
  * **Tanpa Billing Account** *(mode lokal Langkah 1–8)*:
    ```bash
    gcloud services enable \
      firestore.googleapis.com \
      identitytoolkit.googleapis.com \
      generativelanguage.googleapis.com \
      maps-backend.googleapis.com \
      routes.googleapis.com \
      directions-backend.googleapis.com \
      apikeys.googleapis.com
    ```

* **Opsi Web Console (GUI):**
  Buka [APIs & Services → Library](https://console.cloud.google.com/apis/library), cari lalu klik **Enable** untuk: **Google Cloud Firestore API**, **Identity Toolkit API** *(Firebase Auth / Login Google)*, **Gemini API** *(Generative Language API)*, **Maps JavaScript API**, **Routes API**, **Directions API** *(opsional sebagai fallback)*, **API Keys API**, serta **Cloud Run Admin API**, **Cloud Build API**, dan **Cloud Scheduler API** *(jika billing aktif)*.

![Google Cloud API Library](img/gcp-apis-library.png)

<aside class="warning">
<p><strong>Penanganan Error Billing Account:</strong> Jika muncul <code>FAILED_PRECONDITION: Billing account not found</code> saat mengaktifkan <code>run.googleapis.com</code>, gunakan perintah tanpa Cloud Run. Layanan Cloud Run baru diperlukan pada Langkah 9 (Deployment Produksi).</p>
</aside>

| Identifier API | Nama Layanan (Web Console) | Kategori | Peran & Kegunaan di NusaRoute AI |
| :--- | :--- | :--- | :--- |
| **`firestore.googleapis.com`** | Google Cloud Firestore API | **Wajib** | Database NoSQL dokumen real-time (`asia-southeast2` Jakarta) untuk menyimpan data `users`, `deliveries`, `incident_reports`, `traffic_zones`, `agent_decisions`, dan `system_state` melalui Firebase Admin SDK. |
| **`identitytoolkit.googleapis.com`** | Identity Toolkit API | **Wajib (Auth)** | Fondasi backend Firebase Authentication untuk provider **Masuk dengan Google** serta verifikasi token JWT pengguna secara server-side (`verifyIdToken`). |
| **`generativelanguage.googleapis.com`** | **Gemini API** *(Generative Language API)* | **Wajib** | Endpoint inferensi kecerdasan buatan **Gemini 3.8 Flash** yang menganalisis foto kemacetan dan pesan suara kurir secara langsung menjadi data JSON terstruktur (*Structured Outputs*). |
| **`maps-backend.googleapis.com`** | Maps JavaScript API | **Wajib** | Menampilkan peta interaktif pada browser, penanda armada kurir, poligon zona kemacetan/banjir, dan visualisasi jalur pengantaran. |
| **`routes.googleapis.com`** | **Routes API** | **Wajib** | Layanan rute Google Maps Platform modern untuk menghitung navigasi armada presisi, perbandingan rute alternatif hijau/merah, estimasi waktu tempuh (ETA), dan matriks jarak. |
| **`directions-backend.googleapis.com`** | Directions API | *Opsional* | Endpoint kalkulasi rute cadangan (*fallback*) jika kuota Routes API mencapai batas. |
| **`apikeys.googleapis.com`** | API Keys API | **Wajib (CLI)** | Mengotomatisasi pembuatan, inspeksi, dan pembatasan (*API Key restriction*) kredensial Maps & Gemini via skrip atau perintah terminal `gcloud services api-keys`. |
| **`run.googleapis.com`** | Cloud Run Admin API | **Produksi** | Menjalankan server backend Express secara serverless di Jakarta dengan kapabilitas *scale-to-zero* (biaya $0 saat idle) dan auto-scaling instan saat menerima trafik. |
| **`cloudbuild.googleapis.com`** | Cloud Build API | **Produksi** | Mesin pembuat kontainer serverless yang membangun image Docker backend langsung dari source code lokal (`--source .`) sebelum diluncurkan ke Cloud Run. |
| **`cloudscheduler.googleapis.com`** | Cloud Scheduler API | **Produksi** | Layanan cron job serverless terkelola yang secara berkala (tiap 3 menit) memicu siklus agen otonom (`POST /api/agent/tick`), mencegah duplikasi perulangan (*loop*) pada arsitektur multi-instance. |
| **`secretmanager.googleapis.com`** | Secret Manager API | *Opsional* | Penyimpanan rahasia dan kunci privat terenkripsi tingkat enterprise (opsional jika menyimpan variabel lingkungan di luar berkas `.env`). |

#### 2. Membuat Database Cloud Firestore (Region Jakarta)

* **Opsi Terminal (CLI):**
  ```bash
  gcloud firestore databases create \
    --database="(default)" \
    --location=asia-southeast2 \
    --type=firestore-native
  ```

* **Opsi Web Console (GUI):**
  1. Buka [Google Cloud Console → Firestore](https://console.cloud.google.com/firestore) → klik **Create a Firestore database**.
  2. Atur **Database ID** `(default)`, **Edition** `Standard Edition`, **Security rules** `Open` (atau `Restrictive`), dan **Location** `asia-southeast2 (Jakarta)` → klik **Create Database**.

![Halaman Cloud Firestore Databases di GCP Console](img/gcp-firestore.png)

#### 3. Membuat Service Account Key untuk Backend Express

* **Opsi Terminal (CLI)** *(ganti `[PROJECT_ID]` dengan ID project Google Cloud Anda)*:
  ```bash
  # 1. Buat Service Account
  gcloud iam service-accounts create nusaroute-backend-sa \
    --display-name="NusaRoute Backend SA"

  # 2. Berikan role Cloud Datastore User (Firestore) & Firebase Auth Viewer
  gcloud projects add-iam-policy-binding <PROJECT_ID> \
    --member="serviceAccount:nusaroute-backend-sa@<PROJECT_ID>.iam.gserviceaccount.com" \
    --role="roles/datastore.user"

  gcloud projects add-iam-policy-binding <PROJECT_ID> \
    --member="serviceAccount:nusaroute-backend-sa@<PROJECT_ID>.iam.gserviceaccount.com" \
    --role="roles/firebaseauth.viewer"

  # 3. Unduh file kunci JSON (tunggu ~5 detik jika baru saja membuat SA agar IAM tersinkron)
  gcloud iam service-accounts keys create backend/service-account.json \
    --iam-account="nusaroute-backend-sa@<PROJECT_ID>.iam.gserviceaccount.com"
  ```

* **Opsi Web Console (GUI):**
  1. Buka [IAM & Admin → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) → klik **+ Create service account**.
  2. Isi nama `nusaroute-backend-sa` → berikan role **Cloud Datastore User** → klik **Done**.
  3. Klik akun tersebut → tab **Keys** → **Add Key** → **Create new key** → pilih **JSON** → **Create**.

![Halaman IAM & Admin Service Accounts di GCP Console](img/gcp-service-accounts.png)

* **Konfigurasi `backend/.env`** *(salin nilai dari file JSON, pastikan file JSON tidak di-commit ke Git)*:
  ```env
  FIREBASE_PROJECT_ID=id-project-anda
  FIREBASE_CLIENT_EMAIL=nusaroute-backend-sa@id-project-anda.iam.gserviceaccount.com
  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIB...-----END PRIVATE KEY-----\n"
  ```

#### 4. Membuat Kunci Gemini API

* **Opsi Terminal (CLI):**
  ```bash
  gcloud services api-keys create \
    --display-name="NusaRoute Gemini Key" \
    --api-target=service=generativelanguage.googleapis.com \
    --format="value(response.keyString)"
  ```

> **Catatan:** Jika kebijakan organisasi/project mewajibkan Authorization Key terikat Service Account, tambahkan `--service-account="nusaroute-backend-sa@<PROJECT_ID>.iam.gserviceaccount.com"` dengan perintah `gcloud beta services api-keys create`.

* **Opsi Web Console (GUI — Google AI Studio):**
  1. Buka [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → klik **Create API key**.
  2. Pilih project Google Cloud Anda lalu salin kunci yang terbentuk (`AIzaSy...`).

![Halaman API Keys di Google AI Studio](img/aistudio-apikey.png)

* **Konfigurasi `backend/.env`:**
  ```env
  GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  USE_MOCK_AI=false
  GEMINI_MODEL=gemini-3.8-flash
  ```

#### 5. Membuat Kunci Google Maps API

* **Opsi Terminal (CLI):**
  ```bash
  gcloud services api-keys create \
    --display-name="NusaRoute Maps Key" \
    --api-target=service=maps-backend.googleapis.com \
    --api-target=service=routes.googleapis.com \
    --api-target=service=directions-backend.googleapis.com \
    --format="value(response.keyString)"
  ```

* **Opsi Web Console (GUI):**
  1. Buka [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) → **+ Create credentials** → **API key**.
  2. Pada **API restrictions**, pilih **Restrict key** → centang **Maps JavaScript API**, **Routes API**, serta **Directions API** *(opsional)* → klik **Save/Create** → salin kunci (`AIzaSy...`).

![Halaman APIs & Services Credentials di GCP Console](img/gcp-credentials.png)

* **Konfigurasi `.env`:**
  - `frontend/.env.local` *(Wajib — digunakan `GoogleMap.tsx` untuk rendering peta & Routes API di browser)*: `VITE_GOOGLE_MAPS_API_KEY=AIzaSy...`
  - `backend/.env` *(Opsional — cadangan untuk integrasi Maps sisi server)*: `GOOGLE_MAPS_API_KEY=AIzaSy...`

#### 6. Mendaftarkan Web App Firebase (Client SDK)

* **Opsi Terminal (CLI):**
  ```bash
  # 1. Login Firebase CLI (tanpa instalasi global via npx)
  npx firebase-tools login

  # 2. Aktifkan layanan Firebase pada GCP Project Anda
  npx firebase-tools projects:addfirebase <PROJECT_ID>

  # 3. Daftarkan aplikasi Web baru
  npx firebase-tools apps:create WEB nusaroute-web --project <PROJECT_ID>

  # 4. Cetak objek konfigurasi SDK (apiKey, authDomain, appId, dll.)
  npx firebase-tools apps:sdkconfig WEB --project <PROJECT_ID>
  ```

* **Opsi Web Console (GUI):**
  1. Buka [console.firebase.google.com](https://console.firebase.google.com/) → pilih project GCP Anda (atau klik **Add project** untuk mengimpor project GCP yang ada).
  2. Pada **Project Overview**, klik **+ Add app** lalu pilih platform **Web** → beri nama `nusaroute-web` → klik **Register app** → salin nilai `firebaseConfig`.

![Halaman Project Overview di Firebase Console](img/firebase-console.png)

* **Konfigurasi `frontend/.env.local`:**
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

<aside class="tip">
<p><strong>Prioritas File Environment Vite:</strong> Vite selalu memprioritaskan <code>frontend/.env.local</code> di atas <code>frontend/.env</code>. Pastikan tidak ada nilai placeholder dummy yang tertinggal di salah satunya; skrip <code>npm run setup</code> dan <code>npm run validate</code> otomatis menjaga keduanya sinkron dan bebas nilai placeholder.</p>
</aside>

#### 7. Aktivasi Login Google (Firebase Authentication) & Whitelist Akun

NusaRoute AI menyediakan **2 opsi login** — **Username/Email + Password** (berbasis `scrypt`) dan **Masuk dengan Google (Firebase Auth)**. Demi keamanan produksi, kebijakan default aplikasi adalah `GOOGLE_AUTO_REGISTER=false`: **Login Google TIDAK membuat akun baru secara otomatis**. Hanya alamat email Google yang sudah terdaftar di koleksi Firestore `users` yang diizinkan masuk (email asing otomatis ditolak dengan `403 Forbidden`).

* **Opsi Terminal (CLI):**
  1. Tambahkan blok `auth` pada `firebase.json` di root repositori (atau jalankan `npm run setup` yang menulis blok ini secara otomatis):
     ```json
     "auth": {
       "providers": {
         "emailPassword": true,
         "googleSignIn": {
           "oAuthBrandDisplayName": "NusaRoute AI",
           "supportEmail": "email-anda@gmail.com",
           "authorizedRedirectUris": [
             "https://<PROJECT_ID>.firebaseapp.com/__/auth/handler",
             "http://localhost:5173"
           ]
         }
       }
     }
     ```
  2. Deploy konfigurasi provider Authentication ke Firebase via CLI, lalu daftarkan email Google petugas ke koleksi Firestore `users` memakai **`npm run user:add`**:
     ```bash
     # 1. Aktifkan Google Sign-In di Firebase Auth via CLI
     npx firebase-tools deploy --only auth --project <PROJECT_ID>

     # 2. Daftarkan email Google sebagai Dispatcher (Google-only, tanpa password lokal)
     npm run user:add -- --email nama.admin@gmail.com --name "Nama Admin" --role dispatcher

     # 3. Daftarkan email Google sebagai Kurir (Dual Login: Google + Username/Password)
     npm run user:add -- --email kurir.sby@gmail.com --name "Budi Santoso" --role courier --username budi --password "SandiKuat2026!"
     ```

* **Opsi Web Console (GUI):**
  1. Buka [Firebase Console → Authentication → Sign-in method](https://console.firebase.google.com/project/_/authentication/providers) → klik **Add new provider** → pilih **Google** → aktifkan (*Enable*), isi *Support email*, lalu klik **Save**.
  2. Pada tab **Settings → Authorized domains**, pastikan `localhost` (dan domain produksi `*.web.app` / custom domain Anda) sudah terdaftar agar popup Login Google berjalan tanpa error `auth/unauthorized-domain`.
  3. Tambahkan email petugas ke koleksi `users` melalui endpoint admin `POST /api/users` (dengan Bearer JWT Dispatcher / `X-API-Key`) atau via `npm run user:add`.

![Halaman Firebase Authentication Sign-in Method di Firebase Console](img/firebase-auth.png)

#### 8. Pengisian & Penyegaran Data Demo Database (Seed & Reset)

Untuk keperluan pengujian mandiri dan demonstrasi, NusaRoute AI menyediakan dua mekanisme pengelolaan basis data:

1. **Inisialisasi Aman (Seed / Idempotent)**:
   Saat backend berjalan (`ENABLE_AUTO_SEED=true`), fungsi `seedDatabase()` hanya mengisi data jika koleksi masih kosong, tanpa menimpa data yang sedang aktif:
   * Koleksi `users`: 4 akun awal dengan kata sandi terenkripsi aman (`budi`, `agus`, `eko`, `dispatcher`).
   * Koleksi `deliveries`: 15 titik pengiriman awal di Surabaya (`DEL-001` s.d. `DEL-015`).
   * Koleksi `traffic_zones`: 10 zona rawan kemacetan awal.

2. **Penyegaran Total Data Demo (Reset Database)**:
   Setelah simulasi pengiriman berjalan (paket berstatus `delivered` atau teralokasi ke kurir), Anda dapat mengembalikan seluruh data demo ke kondisi awal kapan pun:
   * Mengembalikan seluruh 15 paket pengiriman ke status `unassigned`.
   * Menghapus paket pengiriman kustom tambahan.
   * Mengembalikan 10 zona rawan macet standar Surabaya.
   * Memastikan akun pengguna demo aktif dengan kata sandi default (`nusaroute2026`).
   * Menghapus riwayat laporan insiden uji coba dan keputusan agen sementara.

* **Opsi Terminal (CLI):**
  ```bash
  # 1. Inisialisasi aman koleksi yang kosong (tanpa menimpa data aktif)
  npm run db:seed

  # 2. Reset / pulihkan seluruh data demo ke kondisi awal (dengan konfirmasi)
  npm run db:reset

  # (Tambahkan flag -f untuk melewati konfirmasi interaktif: npm run db:reset -- -f)
  ```

* **Opsi Web Console (GUI):**
  1. **Dasbor Dispatcher**: Buka dasbor di `http://localhost:5173` (atau domain web produksi Anda), masuk sebagai `dispatcher`, lalu klik tombol **Reset Data Demo** pada panel aksi kiri untuk menyegarkan data seketika.
  2. **Firestore Studio**: Buka [Google Cloud Console → Firestore Studio](https://console.cloud.google.com/firestore) atau [Firebase Console → Firestore Database](https://console.firebase.google.com/) untuk melihat dan memverifikasi dokumen secara visual.

---

### Contoh Lengkap Berkas Konfigurasi Hasil Setup Manual

Setelah menyelesaikan seluruh langkah di atas, pastikan kedua file konfigurasi Anda memiliki struktur lengkap seperti berikut:

#### A. File `backend/.env`
```env
# Server, CORS & Production Security
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
API_KEY=ganti_dengan_random_api_key_cloud_scheduler
JWT_SECRET=ganti_dengan_random_jwt_secret_32_karakter
ENABLE_AUTO_SEED=true
ENABLE_AGENT_LOOP=true
GOOGLE_AUTO_REGISTER=false

# Wilayah Operasi & Koordinat Lokasi (Dinamis — dapat disesuaikan per kota)
OPERATION_CITY=Surabaya
DEFAULT_ORIGIN_LAT=-7.2652
DEFAULT_ORIGIN_LNG=112.7523
WEATHER_TIMEZONE=Asia/Jakarta

# Google Gemini AI
GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxx
USE_MOCK_AI=false
GEMINI_MODEL=gemini-3.8-flash

# Firebase Admin SDK (Service Account)
FIREBASE_PROJECT_ID=nusaroute-sby-2026
FIREBASE_CLIENT_EMAIL=nusaroute-backend-sa@nusaroute-sby-2026.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIB...-----END PRIVATE KEY-----\n"

# Google Maps API
GOOGLE_MAPS_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

<aside class="tip">
<p><strong>Cara Menghasilkan Nilai Acak Aman untuk API_KEY dan JWT_SECRET:</strong></p>
<p>Nilai <code>API_KEY</code> (untuk otorisasi pemicu Cloud Scheduler) dan <code>JWT_SECRET</code> (untuk enkripsi token login pengguna) adalah string rahasia buatan Anda sendiri (minimal 32 karakter). Anda dapat menghasilkannya secara instan dengan menjalankan perintah bawaan Node.js di terminal:</p>
<pre><code language="bash">node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"</code></pre>
<p>Jalankan perintah tersebut dua kali: hasil pertama disalin ke <code>API_KEY</code>, dan hasil kedua disalin ke <code>JWT_SECRET</code>.</p>
</aside>

#### B. File `frontend/.env.local`
```env
# Backend API URL
VITE_BACKEND_URL=http://localhost:3000

# Google Maps API
VITE_GOOGLE_MAPS_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Firebase Client Web SDK
VITE_FIREBASE_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_FIREBASE_AUTH_DOMAIN=nusaroute-sby-2026.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=nusaroute-sby-2026
VITE_FIREBASE_STORAGE_BUCKET=nusaroute-sby-2026.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

---

### Matriks Koordinasi Kunci API & Konfigurasi (.env)

Agar frontend dan backend dapat saling berkomunikasi serta terhubung ke layanan Google Cloud, berikut adalah panduan pemetaan variabel yang perlu dikoordinasikan:

| Variabel | Berkas Target | Fungsi & Penjelasan | Di Mana Mendapatkannya? |
| :--- | :--- | :--- | :--- |
| **`GEMINI_API_KEY`** | `backend/.env` | Kunci akses model Gemini 3.8 Flash untuk menganalisis foto dan rekaman suara kurir. *(Tersimpan aman di backend, tidak pernah terekspos ke browser)*. | [aistudio.google.com](https://aistudio.google.com/) → **Get API Key** |
| **`USE_MOCK_AI`** | `backend/.env` | Saklar mode AI (`false` untuk analisis langsung Gemini 3.8 Flash, `true` untuk mode simulasi offline tanpa kuota API). | Setel `false` saat mengisi `GEMINI_API_KEY` asli. |
| **`VITE_GOOGLE_MAPS_API_KEY`** | `frontend/.env.local` | Menampilkan peta interaktif dan petunjuk arah navigasi (termasuk rute pengalihan hijau) langsung di `GoogleMap.tsx`. | Google Cloud Console → Credentials atau `gcloud services api-keys create`. |
| **`GOOGLE_MAPS_API_KEY`** | `backend/.env` | *(Opsional)* Variabel cadangan di backend jika ingin memanggil Maps dari sisi server. | Kunci yang sama dengan Maps API di atas. |
| **`VITE_BACKEND_URL`** | `frontend/.env.local` | Alamat server backend Express (default lokal: `http://localhost:3000`). | Port backend yang aktif di mesin lokal atau Cloud Run URL. |
| **`CORS_ORIGIN`** | `backend/.env` | Daftar alamat frontend yang diizinkan mengakses backend (default: `http://localhost:5173`). | Port Vite dev server. |
| **`FIREBASE_*` (Admin SDK)** | `backend/.env` | Kredensial Service Account (`PROJECT_ID`, `CLIENT_EMAIL`, `PRIVATE_KEY`) untuk database Firestore & verifikasi token login Google. | Google Cloud Console → IAM & Admin → Service Accounts → Keys (JSON). |
| **`VITE_FIREBASE_*` (Web SDK)** | `frontend/.env.local` | Kredensial client Firebase Web SDK untuk fitur Masuk dengan Google (Firebase Authentication). | Firebase Console → Project Settings → General → Web Apps. |
| **`JWT_SECRET` & `API_KEY`** | `backend/.env` | Kunci pengaman token sesi login (`JWT_SECRET`) dan kunci komunikasi Cloud Scheduler (`API_KEY`). Dilengkapi pengecekan otomatis saat startup agar keamanan terjamin. | Dibuat otomatis oleh `npm run setup` atau acak 32 karakter. |
| **`GOOGLE_AUTO_REGISTER`** | `backend/.env` | Kebijakan whitelist Login Google (`false` = default ketat, tidak membuat akun baru otomatis; daftarkan akun lewat `npm run user:add`). | Setel `false` di produksi. |
| **`OPERATION_CITY`** & **`DEFAULT_ORIGIN_*`** | `backend/.env` | Kota operasional, koordinat depot/cuaca Open-Meteo, dan timezone dinamis agar aplikasi dapat dipakai di kota mana pun tanpa ubah kode. | Konfigurasi mandiri sesuai wilayah operasi. |

---

### Verifikasi Konfigurasi (`npm run validate`)

Setelah melengkapi seluruh berkas konfigurasi `backend/.env` dan `frontend/.env.local`, jalankan skrip validator dari root direktori proyek untuk memastikan seluruh API Key dan kredensial sudah siap tanpa kesalahan:

```bash
npm run validate
```

Skrip validator otomatis memeriksa:
* Format dan integritas kunci Gemini API, Google Maps API, dan Firebase Client SDK.
* Format kunci privat Service Account Firestore (`-----BEGIN PRIVATE KEY-----`).
* Kekuatan acak rahasia keamanan produksi (`JWT_SECRET` dan `API_KEY`).
* Kebijakan keamanan login Google (`GOOGLE_AUTO_REGISTER=false`).

Jika seluruh indikator menampilkan status **`[OK]` hijau**, seluruh konfigurasi telah terverifikasi dan siap digunakan.

---

## Analisis Foto Hambatan Jalan Menjadi Data Terstruktur
Duration: 15:00

Pada bagian ini, kita akan mengimplementasikan analisis multimodal menggunakan Google Gen AI SDK (`@google/genai`) dan model **Google Gemini 3.8 Flash**:

### File Target
Buka file: `backend/src/services/ai-agent.ts`

### 1. Memahami Skema Data Keluaran AI (Structured Outputs)
Agar format data keluaran dari Gemini selalu konsisten dan siap diproses oleh sistem peta maupun database, kita menggunakan fitur **Structured Outputs** dengan skema JSON berikut:

```typescript
import { GoogleGenAI, Type, createPartFromBase64 } from "@google/genai";

const INCIDENT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    action: {
      type: Type.STRING,
      enum: ["REROUTE", "WAIT", "REDIRECT_TO_HUB", "ESCALATE"],
      description: "Tindakan operasional yang disarankan untuk kurir",
    },
    severity: {
      type: Type.STRING,
      enum: ["low", "medium", "high", "critical"],
      description: "Tingkat keparahan hambatan dalam format standar",
    },
    severityLabel: {
      type: Type.STRING,
      enum: ["Rendah", "Sedang", "Tinggi", "Kritis"],
      description: "Label tingkat keparahan dalam Bahasa Indonesia",
    },
    incidentType: {
      type: Type.STRING,
      enum: ["road_closure", "traffic_jam", "flooding", "accident", "other"],
      description: "Klasifikasi jenis hambatan di lapangan",
    },
    incidentTypeLabel: {
      type: Type.STRING,
      description: "Deskripsi jenis hambatan",
    },
    analysis: {
      type: Type.STRING,
      description: "Analisis situasi lapangan yang objektif dalam Bahasa Indonesia",
    },
    analysisEn: {
      type: Type.STRING,
      description: "Detailed analysis in English for operational metadata logging",
    },
    recommendation: {
      type: Type.STRING,
      description: "Saran rute atau penanganan taktis kurir dengan nama jalan nyata di Surabaya",
    },
    recommendationEn: {
      type: Type.STRING,
      description: "Actionable recommendation in English",
    },
    reroutePoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Daftar nama jalan alternatif di Surabaya untuk bypass hambatan",
    },
    estimatedDelay: {
      type: Type.INTEGER,
      description: "Estimasi keterlambatan dalam satuan menit",
    },
  },
  required: [
    "action",
    "severity",
    "severityLabel",
    "incidentType",
    "incidentTypeLabel",
    "analysis",
    "recommendation",
    "reroutePoints",
    "estimatedDelay",
  ],
};
```

### 2. Implementasi `processIncidentReport`
Fungsi ini memproses buffer foto di RAM tanpa menyimpannya ke disk server:

```typescript
export async function processIncidentReport(
  photoBuffer: Buffer | null = null,
  audioBuffer: Buffer | null = null,
  photoMime = "image/jpeg",
  audioMime = "audio/webm"
): Promise<AIDecision> {
  const client = getGenAIClient();
  const hasPhoto = Boolean(photoBuffer && photoBuffer.length > 0);
  const hasAudio = Boolean(audioBuffer && audioBuffer.length > 0);

  if (!client) {
    return generateContextualMock(hasPhoto, hasAudio);
  }

  const contentParts: any[] = [
    {
      text: "LAPORAN KENDALA LOGISTIK KURIR DI KOTA SURABAYA\nInstruksi: Analisis hambatan visual dan/atau audio, tentukan tingkat keparahan, dan berikan rute pengalihan nama jalan Surabaya.",
    },
  ];

  if (hasPhoto && photoBuffer) {
    contentParts.push(createPartFromBase64(photoBuffer.toString("base64"), photoMime));
  }

  if (hasAudio && audioBuffer) {
    contentParts.push(createPartFromBase64(audioBuffer.toString("base64"), audioMime));
  }

  const response = await client.models.generateContent({
    model: APP_CONFIG.geminiModel,
    contents: [{ role: "user", parts: contentParts }],
    config: {
      systemInstruction: SURABAYA_INCIDENT_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: INCIDENT_RESPONSE_SCHEMA,
      temperature: 0.1,
    },
  });

  const parsedData = JSON.parse(response.text.trim());
  return normalizeIncidentResult(parsedData, false, APP_CONFIG.geminiModel);
}
```

> **Ketentuan Validasi Bukti Multimodal (Zero-Hallucination Guard):**
> Kurir **wajib menyertakan minimal 1 bukti lapangan** (Foto atau Voice Note), atau **keduanya sekaligus** untuk akurasi optimal. Jika bukti kosong, backend (`POST /api/analyze-incident`) otomatis menolak permintaan (`HTTP 400: At least one file is required`) dan tombol *Kirim Laporan Hambatan* pada UI terkunci (*disabled*) demi mencegah halusinasi AI tanpa data faktual.

---

## Pemrosesan Pesan Suara Kurir Menjadi Data Terstruktur
Duration: 15:00

Untuk mendukung keselamatan kurir saat berkendara di lapangan, sistem menyediakan fitur pelaporan berbasis pesan suara (*voice note*). Audio dikirim dan dianalisis langsung di memori server:

### Native Audio Processing (Tanpa Pipeline Speech-to-Text Perantara)
Gemini 3.8 Flash memproses audio buffer secara native tanpa pipeline konversi teks terpisah (Speech-to-Text):
- **End-to-End Multimodal**: Sinyal suara dianalisis langsung oleh model dalam satu pass, memangkas latensi transkripsi.
- **Konteks Lokal**: Memahami intonasi, bahasa informal kurir, serta toponimi jalanan lokal Surabaya (Wonokromo, Darmo, Mayjen Sungkono, dll.).
- **Structured Output**: Menghasilkan respon JSON terstruktur dengan waktu inferensi <2 detik.

### Pengujian di Antarmuka Kurir
1. Buka browser di `http://localhost:5173`, lalu masuk dengan akun Kurir (username `budi` dengan kata sandi dev default `nusaroute2026`, atau klik **Masuk dengan Google** memakai email kurir yang sudah didaftarkan via `npm run user:add`).
2. Ketuk tab **Lapor** pada bilah navigasi bawah (*Bottom Navigation*). Perhatikan bahwa bagian atas dan navigasi bawah tetap persisten sehingga kurir dapat berpindah antar-tab (`Rute` ↔ `Lapor` ↔ `Paket`) dengan mudah menggunakan satu tangan.
3. Pada bagian **Laporan Suara**, ketuk tombol mikrofon (`44×44px`) untuk merekam pesan suara kendala lapangan (misal: *"Lapor posko, Wonokromo macet total ada pohon tumbang di lajur kiri"*), lalu ketuk stop untuk menyelesaikan rekaman.
4. Klik **Kirim Laporan Hambatan** (tombol otomatis aktif begitu minimal 1 foto atau rekaman suara dilampirkan). Perhatikan bagaimana audio diproses di RAM via *Multer MemoryStorage* dan Gemini 3.8 Flash menghasilkan JSON instruksi operasional secara instan.

---

## Integrasi Google Maps Platform & Geofencing Radius 200m
Duration: 15:00

Keputusan rute dari AI dihubungkan dengan Google Maps Platform untuk menampilkan visualisasi rute alternatif, sekaligus memvalidasi kehadiran fisik kurir (geofencing) sebelum pesanan dapat diselesaikan.

### File Target
1. **Logika Perhitungan Rute & Pengalihan Jalan**: `backend/src/services/traffic-agent.ts`
2. **Rendering Navigasi Google Maps**: `frontend/src/components/GoogleMap.tsx`
3. **Validasi Batas Radius Lokasi Kurir**: `frontend/src/pages/CourierPage.tsx`

---

### 1. Deteksi Dini Bahaya & Rekomendasi Rute Alternatif (Backend)
Pada `backend/src/services/traffic-agent.ts`, fungsi `proactiveReroute` memindai setiap paket yang berpotensi melintasi zona kritis kemacetan atau banjir:

```typescript
export function proactiveReroute(
  deliveries: Delivery[],
  trafficZones: TrafficZone[]
): Array<{
  delivery: Delivery;
  threatZone: TrafficZone;
  suggestedAction: "REROUTE" | "REDIRECT_TO_HUB";
  message: string;
}> {
  const criticalZones = trafficZones.filter((z) => z.level === "high" || z.level === "critical");
  const alerts: Array<{
    delivery: Delivery;
    threatZone: TrafficZone;
    suggestedAction: "REROUTE" | "REDIRECT_TO_HUB";
    message: string;
  }> = [];

  for (const delivery of deliveries) {
    if (delivery.status === "delivered" || !delivery.lat || !delivery.lng) continue;

    for (const zone of criticalZones) {
      const dist = haversineKm(delivery.lat, delivery.lng, zone.lat, zone.lng);
      if (dist != null && dist <= zone.radius) {
        alerts.push({
          delivery,
          threatZone: zone,
          suggestedAction: zone.level === "critical" ? "REDIRECT_TO_HUB" : "REROUTE",
          message: `Pengiriman ke ${delivery.recipient} terdampak ${zone.name} (${zone.level === "critical" ? "Macet Total" : "Padat"}). ${zone.reason || ""}`,
        });
        break;
      }
    }
  }

  return alerts;
}
```

Jika terdeteksi macet, fungsi `generateRouteAlternatives` menghitung jarak koridor terdampak secara dinamis via Haversine dan meminta **Gemini 3.8 Flash** menyusun 2 opsi jalur bypass nyata di Surabaya sesuai koordinat paket (atau menggunakan kalkulasi geometris saat `USE_MOCK_AI=true`):

```typescript
export async function generateRouteAlternatives(
  delivery: Delivery,
  threatZone: TrafficZone
): Promise<{
  originalRoute: { path: string[]; durationMins: number; risk: string };
  alternatives: Array<{ name: string; via: string; durationMins: number; distanceKm: number; isRecommended: boolean }>;
  isSimulated?: boolean;
}> {
  const rawDistKm =
    haversineKm(threatZone.lat, threatZone.lng, delivery.lat, delivery.lng) ?? 2.5;
  const baseRoadKm = Math.max(1.2, parseFloat((rawDistKm * 1.3 + threatZone.radius * 0.6).toFixed(1)));
  const congestedSpeedKmh = threatZone.level === "critical" ? 9 : 14;
  const originalDurationMins = Math.max(8, Math.round((baseRoadKm / congestedSpeedKmh) * 60));

  const client = getGenAIClient();
  if (client) {
    // Mode Live: Gemini 3.8 Flash menyusun rute bypass jalan nyata Surabaya (JSON)
    const result = await client.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.1, responseMimeType: "application/json" },
    });
    // ... parsing & normalisasi alternatif rute
  }

  // Mode Simulasi (USE_MOCK_AI=true): kalkulasi geometris berbasis Haversine
  const bypass1Km = parseFloat((baseRoadKm * 1.15).toFixed(1));
  const bypass2Km = parseFloat((baseRoadKm * 1.32).toFixed(1));
  return {
    originalRoute: { path: [threatZone.name, delivery.address], durationMins: originalDurationMins, risk: threatZone.level || "high" },
    alternatives: [
      { name: `Bypass Sekunder (${threatZone.area})`, via: `Hindari radius ${threatZone.radius} km ${threatZone.name}`, durationMins: Math.max(5, Math.round((bypass1Km / 26) * 60)), distanceKm: bypass1Km, isRecommended: true },
      { name: "Koridor Lingkar Alternatif", via: `Lingkar luar ${threatZone.area}`, durationMins: Math.max(6, Math.round((bypass2Km / 24) * 60)), distanceKm: bypass2Km, isRecommended: false },
    ],
    isSimulated: true,
  };
}
```

---

### 2. Rendering Navigasi Google Maps di Browser (Frontend)
Pada `frontend/src/components/GoogleMap.tsx`, navigasi mengintegrasikan **Google Routes API v2** (`routes.googleapis.com/directions/v2:computeRoutes`) untuk menghitung rute berbasis kondisi lalu lintas riil (*traffic-aware*), dilengkapi dekoder polyline dan rendering native `google.maps.Polyline`:

```typescript
// 1. Panggil Google Routes API v2 (computeRoutes) dengan preferensi lalu lintas riil
const routesData = await fetchModernRoutesApi(origin, destination, apiKey);

if (routesData?.routes && routesData.routes.length > 0) {
  // Decode string polyline terkompresi dari Routes API v2
  const pts = decodeGooglePolyline(routesData.routes[routeIndex].polyline.encodedPolyline);

  // Render garis rute pada peta
  customPolylineRef.current = new window.google.maps.Polyline({
    path: pts,
    strokeColor: "#10b981",
    strokeWeight: 6,
    strokeOpacity: 0.95,
    map,
    zIndex: 50,
  });
} else {
  // 2. Jalur visual langsung saat offline
  customPolylineRef.current = new window.google.maps.Polyline({
    path: [origin, destination],
    strokeColor: "#10b981",
    strokeWeight: 4,
    strokeOpacity: 0.7,
    map,
    zIndex: 50,
  });
}
```

---

### 3. Geofencing 200 Meter dengan Formula Haversine
Untuk memastikan kurir benar-benar tiba di lokasi pengantaran sebelum menandai pesanan selesai, sistem menerapkan validasi geofencing berbasis **Formula Haversine**:

<aside class="special">
<p><strong>Formula Jarak Lingkaran Besar (Great-Circle Distance — Haversine)</strong></p>
<div class="math-display-container">
[[MATH_HAVERSINE_FORMULA]]
</div>
<div class="math-legend-list">
<p><strong>Keterangan Notasi &amp; Aturan Validasi:</strong></p>
<ul>
  <li><code>lat₁, lng₁</code>: Titik koordinat posisi GPS kurir saat ini (derajat desimal).</li>
  <li><code>lat₂, lng₂</code>: Titik koordinat alamat tujuan penerima paket (derajat desimal).</li>
  <li><code>Δlat = lat₂ - lat₁</code>, <code>Δlng = lng₂ - lng₁</code> (dikonversi ke radian: <code>rad = deg × π / 180</code>).</li>
  <li><code>R = 6.371 km</code>: Radius rata-rata kelengkungan bumi.</li>
  <li><code>d</code>: Jarak lurus permukaan bumi (dalam kilometer).</li>
  <li><strong>Aturan Geofencing</strong>: Tombol <em>"Tandai Terkirim"</em> hanya aktif jika kurir berada dalam radius <code>d ≤ 0.20 km</code> (≤ 200 meter dari koordinat tujuan).</li>
</ul>
</div>
</aside>

Fungsi Haversine di `backend/src/services/traffic-agent.ts`:
```typescript
export function haversineKm(
  lat1: number | null | undefined,
  lng1: number | null | undefined,
  lat2: number | null | undefined,
  lng2: number | null | undefined
): number | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371; // Radius bumi dalam kilometer
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

Pada `frontend/src/pages/CourierPage.tsx`, tombol penyelesaian pengiriman terkunci otomatis (*disabled*) dengan ikon gembok jika kurir berada di luar radius 200 meter:

```typescript
// Batas radius kehadiran fisik kurir (konfigurabel via env, default 200m / 0.2 km)
const DELIVERY_MARK_RADIUS_KM = FRONTEND_CONFIG.deliveryMarkRadiusKm;

// Evaluasi status penguncian tombol secara real-time
const canMarkDelivered =
  !!activeDelivery &&
  activeDelivery.status !== "delivered" &&
  activeDistanceKm != null &&
  activeDistanceKm <= DELIVERY_MARK_RADIUS_KM;

const markDeliveredReason = !activeDelivery
  ? "Tidak ada tujuan aktif"
  : activeDelivery.status === "delivered"
  ? "Pengiriman sudah selesai"
  : activeDistanceKm == null
  ? "Lokasi kurir belum tersedia"
  : activeDistanceKm > DELIVERY_MARK_RADIUS_KM
  ? `Masih ${activeDeliveryDistanceLabel} dari lokasi tujuan`
  : "Siap ditandai terkirim";
```

Ketika kurir tiba dalam jarak ≤ 200 meter dari rumah/gedung penerima, status tombol secara otomatis berubah menjadi hijau aktif (*"Tandai Terkirim"*).

---

### 4. Alur Kerja Antarmuka Kurir di Lapangan

Antarmuka Kurir (`frontend/src/pages/CourierPage.tsx`) dirancang khusus untuk operasional pengiriman di lapangan dengan 3 tab navigasi utama:

- **Rute**: Menampilkan rute navigasi aktif Google Maps dan kartu alamat tujuan saat ini.
- **Lapor**: Memungkinkan kurir mengunggah foto rintangan atau merekam suara saat menghadapi kemacetan/hambatan jalan.
- **Paket**: Daftar seluruh paket pengiriman, fitur optimasi rute terdekat (*Nearest Neighbor*), dan tombol konfirmasi yang tervalidasi radius 200 meter.

![Tampilan Antarmuka Kurir NusaRoute AI](img/courier-mobile-ui.png)

---

## Uji Coba End-to-End & Live Demo
Duration: 15:00

Jalankan skenario pengujian berikut untuk memverifikasi fungsionalitas end-to-end sistem:

### Skenario Uji A: Antarmuka Web Interaktif (GUI — Dispatcher & Kurir)
1. Buka 2 jendela browser secara berdampingan (gunakan satu jendela normal dan satu jendela **Incognito / Private Window** agar sesi JWT pengguna tidak saling menimpa). Aplikasi menyediakan **2 opsi login** — **Username/Email + Password** (`POST /api/login`, kata sandi dev default `nusaroute2026`) maupun **Masuk dengan Google** (`POST /api/login/google` via Firebase Auth) yang sama-sama menerbitkan **HS256 JWT + RBAC**:
   - **Jendela 1 (Dispatcher)**: Buka `http://localhost:5173`, masuk dengan username `dispatcher` (`dispatcher@nusaroute.ai`) atau klik **Masuk dengan Google** memakai email yang sudah didaftarkan via `npm run user:add -- --role dispatcher`. Jika paket awal masih berstatus `unassigned`, klik tombol **Auto-Assign** agar sistem membagikan paket ke kurir terdekat secara otomatis berbasis koordinat hub dinamis.
   - **Jendela 2 (Kurir — Incognito)**: Buka `http://localhost:5173`, masuk dengan username `budi` (`budi@nusaroute.ai`) atau klik **Masuk dengan Google** memakai email kurir yang sudah didaftarkan via `npm run user:add -- --role courier`.

![Tampilan Dasbor Dispatcher NusaRoute AI](img/dispatcher-dashboard.png)

2. Di antarmuka kurir:
   - Pada tab **Rute**, periksa rute navigasi dan kartu tujuan aktif yang menampilkan alamat penerima.
   - Pada tab **Paket**, klik **Optimalkan Rute** untuk melihat pengurutan titik terdekat (*Nearest-Neighbor*) + *AI Route Insight*, lalu amati tombol konfirmasi terkirim yang terkunci otomatis jika jarak GPS > 200m.
3. Ketuk tab **Lapor** pada navigasi bawah:
   - Ambil/unggah foto kemacetan atau rekam pesan suara via tombol mikrofon.
   - Klik tombol **Kirim Laporan Hambatan**.
4. Perhatikan respons sistem dalam tempo <2 detik:
   - Gemini 3.8 Flash mengekstrak insiden ke JSON.
   - Perubahan rute dan keputusan agen disimpan ke Cloud Firestore (`deliveries`, `incident_reports`, `agent_decisions`) melalui Firebase Admin SDK dengan pembatasan peran (RBAC) dan aturan keamanan database Firestore yang ketat.
   - Di kedua layar, rute merah otomatis berubah menjadi rute hijau alternatif.
   - Papan analitik menampilkan estimasi penghematan jarak dan waktu berdasarkan rute terdekat (*Nearest-Neighbor*) dan pengelompokan pos singgah (*Smart Hub*).

### Skenario Uji B: Eksekusi Cepat via Terminal (CLI)
Anda juga dapat menguji kemampuan penalaran multimodal model langsung dari terminal tanpa harus membuka browser:

```bash
# 1. Uji analisis foto kemacetan jalan dengan Gemini
npm run test:incident

# 2. Uji analisis rekaman suara kurir secara langsung
npm run test:voice
```
Skrip ini akan memproses sampel foto/audio di memori RAM dan mencetak struktur JSON hasil penalaran AI beserta kecepatan waktu eksekusinya.

### Skenario Uji C: Penyegaran & Reset Data Demo (CLI & GUI)
Setelah Anda selesai melakukan demo pengiriman, pengalihan rute, atau pengubahan status paket menjadi *delivered*, Anda dapat mengembalikan seluruh sistem ke kondisi awal untuk presentasi berikutnya:

* **Opsi Terminal (CLI):**
  ```bash
  npm run db:reset
  # atau mode instan tanpa konfirmasi interaktif:
  npm run db:reset -- -f
  ```

* **Opsi Web Console (GUI):**
  Masuk ke dasbor Dispatcher (`http://localhost:5173`), lalu klik tombol **Reset Data Demo** pada menu panel aksi kiri (*sidebar*). Seluruh 15 paket pengiriman akan langsung kembali ke status *unassigned* dan riwayat laporan sementara dibersihkan.

---

## Algoritma Optimasi Rute & Ketahanan Sistem
Duration: 08:00

Selain kapabilitas AI, sistem memanfaatkan algoritma optimasi rute matematis dan pola ketahanan (*resilience*) untuk menjaga performa aplikasi:

### 1. Nearest-Neighbor TSP Solver
Pada `backend/src/services/traffic-agent.ts`, sistem menyusun urutan pengantaran optimal menggunakan algoritma *Nearest-Neighbor*:
* **Mekanisme Kerja**: Berangkat dari koordinat awal kurir (misal: Stasiun Gubeng), sistem menghitung jarak Haversine ke setiap paket yang belum diantar, lalu memilih titik terdekat berikutnya secara sekuensial ($O(n^2)$).
* **Hasil Benchmark**: Pada 15 titik simulasi pengiriman Surabaya (`DEL-001` s.d. `DEL-015`), algoritma ini memangkas total jarak tempuh dari `27,16 km` menjadi `21,97 km` (menghemat `5,19 km` atau ~19% jarak bolak-balik).

Uji algoritma via terminal atau cURL (endpoint backend dilindungi Bearer JWT Dispatcher atau header `x-api-key`):
```bash
curl -X POST http://localhost:3000/api/deliveries/tsp-benchmark \
  -H "Content-Type: application/json" \
  -H "x-api-key: <API_KEY_DI_BACKEND_ENV>" \
  -d '{"origin": {"lat": -7.2652, "lng": 112.7523}}'
```

### 2. Telemetri Latensi & Audit Kuota Token
Pada berkas `backend/src/services/ai-agent.ts`, setiap respons dari Gemini 3.8 Flash mencatat informasi performa sistem:
* **Waktu Respon (`latencyMs`)**: Rata-rata 1.200 hingga 1.800 ms untuk memproses foto dan rekaman suara.
* **Penggunaan Token**: Mencatat `promptTokenCount` dan `candidatesTokenCount` dari `response.usageMetadata` untuk audit kapasitas penggunaan API.

### 3. Ketahanan Sistem: Percobaan Ulang Bertahap (Exponential Backoff)
Untuk mengantisipasi gangguan jaringan sementara atau pembatasan kuota (HTTP 429), fungsi `withRetry` di `backend/src/services/ai-agent.ts` menerapkan sistem percobaan ulang bertahap (*exponential backoff*) dengan variasi jeda acak:

<aside class="special">
<p><strong>Formula Percobaan Ulang Bertahap dengan Jeda Acak (Random Jitter)</strong></p>
<div class="math-display-container">
[[MATH_BACKOFF_FORMULA]]
</div>
<div class="math-legend-list">
<p><strong>Keterangan Parameter &amp; Penjelasan:</strong></p>
<ul>
  <li><code>t_delay</code>: Durasi total jeda waktu sebelum percobaan ulang berikutnya (milidetik).</li>
  <li><code>t_base = 600 ms</code>: Interval jeda dasar (<code>baseDelayMs = 600</code> di <code>ai-agent.ts</code>).</li>
  <li><code>attempt</code>: Indeks urutan percobaan ulang (<code>1, 2</code> dengan batas <code>maxRetries = 2</code>).</li>
  <li><code>t_jitter</code>: Variasi jeda acak (<code>0–200 ms</code> via <code>Math.random() * 200</code>) untuk mencegah *thundering herd problem* (lonjakan permintaan serentak yang membebani server saat beberapa klien melakukan retry bersamaan).</li>
</ul>
</div>
</aside>

---

## Deployment Produksi (Cloud Run & Firebase Hosting)
Duration: 07:00

Tahap akhir adalah deployment backend dan frontend ke infrastruktur serverless Google Cloud produksi. Anda dapat memilih antara **Pilihan A: Deployment Otomatis via Skrip** (sangat cepat, otomatis menyuntikkan seluruh variabel lingkungan dari file `backend/.env` ke Cloud Run tanpa perlu entri manual) atau **Pilihan B: Deployment Manual Langkah demi Langkah** (untuk memahami alur konfigurasi infrastruktur secara mendalam).

---

### Pilihan A: Deployment Otomatis via Skrip (`npm run deploy`) — Direkomendasikan

NusaRoute AI menyediakan skrip automasi deployment mandiri (`deploy.js`) yang secara terpadu:
1. Membaca konfigurasi produksi dari `backend/.env` dan menyuntikkannya langsung ke Google Cloud Run via berkas parameter aman (*zero manual typing*).
2. Mengonfigurasi otomatis izin IAM build (`roles/serviceusage.serviceUsageConsumer` dan `roles/cloudbuild.builds.builder`) pada default Compute Service Account, lalu membangun dan men-deploy backend kontainer ke **Google Cloud Run** di region `asia-southeast2` (Jakarta) dengan status *scale-to-zero* dan *Fail-Fast Secret Guard*.
3. Mengonfigurasi **Google Cloud Scheduler** (`POST /api/agent/tick` setiap 3 menit) menggunakan URL Cloud Run dan `API_KEY` produksi yang aktif.
4. Memperbarui `VITE_BACKEND_URL` pada frontend, mengompilasi bundel produksi (`npm run build --workspace=frontend`), dan mempublikasikannya ke CDN **Firebase Hosting** beserta aturan keamanan `firestore.rules`.
5. Memverifikasi status kesehatan server (*Health Check*) ke endpoint `/api/health`.

Jalankan perintah berikut dari root direktori proyek:

```bash
npm run deploy
```

> **Tips Sub-perintah Mandiri:**
> Jika Anda hanya ingin men-deploy satu komponen secara terpisah, gunakan opsi berikut:
> - `npm run deploy:backend` — Hanya deploy ulang backend ke Google Cloud Run dengan variabel lingkungan terbaru.
> - `npm run deploy:frontend` — Hanya build dan publikasikan ulang frontend ke Firebase Hosting.
> - `npm run deploy:scheduler` — Hanya sinkronisasi cron job di Google Cloud Scheduler.

---

### Pilihan B: Deployment Manual Langkah demi Langkah

Jika Anda ingin memahami detail konfigurasi setiap layanan atau melakukan kustomisasi parameter infrastruktur secara langsung, ikuti langkah manual berikut:

#### 1. Konfigurasi Izin IAM Service Account untuk Cloud Build

Deployment backend Cloud Run berbasis source code (`--source .`) memanfaatkan Cloud Build di latar belakang. Berikan hak akses *builder* dan *consumer* ke *default compute service account*:

```bash
# Dapatkan Project Number
PROJECT_NUMBER=$(gcloud projects describe <PROJECT_ID> --format="value(projectNumber)")

# Berikan role consumer & builder ke default compute service account
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/serviceusage.serviceUsageConsumer"

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"
```

#### 2. Deploy Backend ke Google Cloud Run

* **Opsi Terminal (CLI):**
  ```bash
  cd backend
  gcloud run deploy nusaroute-api \
    --source . \
    --region asia-southeast2 \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3 \
    --set-env-vars "NODE_ENV=production,USE_MOCK_AI=false,GEMINI_MODEL=gemini-3.8-flash,ENABLE_AUTO_SEED=false,ENABLE_AGENT_LOOP=false,GOOGLE_AUTO_REGISTER=false"
  ```

<aside class="tip">
<p><strong>Rasional Penentuan Spesifikasi Kontainer (Container Sizing Guide):</strong></p>
<ul>
  <li><strong><code>--cpu 1</code></strong>: Backend Express/Node.js bersifat <em>single-threaded event loop</em> dan beban kerja (<em>workload</em>) didominasi oleh operasi <em>I/O-Bound</em> (menunggu respons Gemini API, Firestore, dan Google Maps). Alokasi 1 vCPU sudah optimal untuk melayani puluhan <em>concurrent requests</em> tanpa pemborosan komputasi.</li>
  <li><strong><code>--memory 1Gi</code></strong>: Mengalokasikan RAM yang cukup untuk baseline runtime Node.js (~100 MiB), buffer parsing payload base64 gambar/audio kurir (~3–5 MiB per request aktif), serta ruang aman (<em>headroom</em>) bagi <em>garbage collector</em> V8 agar terhindar dari error <em>Out Of Memory (OOM)</em>.</li>
  <li><strong><code>--min-instances 0</code></strong>: Memanfaatkan fitur <em>scale-to-zero</em> serverless sehingga biaya komputasi adalah $0 saat tidak ada trafik.</li>
  <li><strong><code>--max-instances 3</code></strong>: Bertindak sebagai <em>budget guardrail</em> (pengaman anggaran) yang membatasi autoscaling horizontal agar lonjakan trafik tidak menimbulkan pembengkakan biaya tak terduga.</li>
</ul>
</aside>

* **Opsi Web Console (GUI):**
  1. Buka [Google Cloud Console → Cloud Run](https://console.cloud.google.com/run), klik **+ Deploy container** (atau **Create service** / **Connect repo** untuk deploy langsung dari repositori GitHub).
  2. Atur **Service name** ke `nusaroute-api`, **Region** ke `asia-southeast2 (Jakarta)`, dan aktifkan opsi **Allow unauthenticated invocations**.
  3. Pada bagian **Container, Networking, Security**, set **Container port** ke `8080`, **CPU allocation** ke *CPU is always allocated* (setara opsi `--no-cpu-throttling`), dan **Maximum instances** ke `3`.
  4. Tambahkan variabel lingkungan pada tab **Variables & Secrets** (atau impor dari Secret Manager) → klik **Create**.

![Halaman Services Cloud Run di Google Cloud Console](img/gcp-cloud-run.png)

> **Konfigurasi Environment Variables di Cloud Run:**
> Variabel `PORT` bersifat *reserved* dan disuntikkan otomatis oleh Cloud Run via `--port 8080` (jangan dimasukkan ke `--set-env-vars`). Tambahkan variabel berikut via Secret Manager / tab **Variables & Secrets** (*Edit & Deploy New Revision*):
> * `GEMINI_API_KEY`: Kunci API Gemini Anda
> * `USE_MOCK_AI`: `false` (atau `true` hanya untuk mode simulasi tanpa API key)
> * `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
> * `JWT_SECRET`: Kunci acak kuat (≥32 karakter) untuk menandatangani token HS256 JWT per pengguna
> * `API_KEY`: Kunci acak kuat untuk autentikasi *machine-to-machine* (Cloud Scheduler → `POST /api/agent/tick`)
> * `ENABLE_AUTO_SEED`: `false` (default aman di produksi agar tidak menimpa data live)
> * `ENABLE_AGENT_LOOP`: `false` (disarankan untuk multi-instance Cloud Run; jadwalkan Google Cloud Scheduler memanggil `POST /api/agent/tick` tiap 3 menit dengan header `X-API-Key`)
> * `GOOGLE_AUTO_REGISTER`: `false` (default ketat — Login Google TIDAK membuat akun baru; hanya email yang sudah terdaftar via `npm run user:add` atau `POST /api/users` yang boleh masuk). Set `true` hanya jika ingin mengizinkan registrasi mandiri sebagai `courier`.

<aside class="special">
<p><strong>Catatan Teknis Cloud Run &amp; Penyimpanan Status Agen:</strong></p>
<ul>
<li><strong>Penyimpanan Firestore + Cloud Scheduler</strong>: Riwayat keputusan agen (<code>agent_decisions</code>) dan data statistik disimpan ke Firestore sehingga tidak hilang saat server kontainer sedang berhenti otomatis karena tidak ada permintaan (<em>scale-to-zero</em>). Untuk multi-instance produksi, set <code>ENABLE_AGENT_LOOP=false</code> dan pemicu tunggal via Cloud Scheduler ke <code>POST /api/agent/tick</code>.</li>
<li><strong><code>--no-cpu-throttling</code></strong>: Diperlukan hanya jika Anda memilih menjalankan perulangan pemantauan internal (<code>ENABLE_AGENT_LOOP=true</code>) pada satu server.</li>
<li><strong><code>--max-instances 3</code></strong>: Membatasi skala horizontal instans secara terkontrol untuk mencegah lonjakan biaya saat terjadi peningkatan trafik tak terduga.</li>
<li><strong>Keamanan Kontainer &amp; Validasi Konfigurasi</strong>: <code>Dockerfile</code> berjalan dengan pengguna non-root (<code>USER node</code>) dan dilengkapi <code>HEALTHCHECK</code>; backend membaca header <code>trust proxy</code> untuk pencatatan IP asli pada pembatas laju (<em>rate limiter</em>), serta menerapkan validasi yang menolak inisialisasi jika <code>JWT_SECRET</code> atau <code>API_KEY</code> belum memenuhi standar keamanan produksi.</li>
<li><strong>Graceful Shutdown</strong>: Backend menangani sinyal <code>SIGTERM</code> dari Cloud Run untuk menghentikan timer daemon sebelum instance ditutup.</li>
</ul>
</aside>

Salin URL Service yang dihasilkan (contoh: `https://nusaroute-api-xxx.asia-southeast2.run.app`).

#### 3. Penjadwalan Siklus Agen Otonom (Google Cloud Scheduler)

Pada arsitektur produksi Cloud Run multi-instance, perulangan internal latar belakang (`ENABLE_AGENT_LOOP=false`) dinonaktifkan guna menghindari duplikasi eksekusi agen di beberapa kontainer sekaligus. Sebagai gantinya, pemicu eksekusi agen berkala diserahkan ke **Google Cloud Scheduler** untuk memanggil endpoint `POST /api/agent/tick` setiap 3 menit:

* **Opsi Terminal (CLI):**
  ```bash
  # Pastikan Cloud Scheduler API telah aktif
  gcloud services enable cloudscheduler.googleapis.com

  # Daftarkan job scheduler pemanggil agen otonom
  gcloud scheduler jobs create http nusaroute-agent-tick \
    --location=asia-southeast2 \
    --schedule="*/3 * * * *" \
    --uri="https://<CLOUD_RUN_URL>/api/agent/tick" \
    --http-method=POST \
    --headers="X-API-Key=<API_KEY_PRODUKSI>"
  ```

* **Opsi Web Console (GUI):**
  1. Buka [Google Cloud Console → Cloud Scheduler](https://console.cloud.google.com/cloudscheduler) → klik **+ Create job** (atau **Buat Tugas**).
  2. Masukkan **Name** `nusaroute-agent-tick`, **Region** `asia-southeast2 (Jakarta)`, dan **Frequency (Cron)** `*/3 * * * *` (setiap 3 menit) dengan Timezone `Jakarta (WIB)`.
  3. Pada bagian **Configure execution**, pilih target **HTTP**, masukkan URL `https://<CLOUD_RUN_URL>/api/agent/tick`, dan metode **POST**.
  4. Klik **Add a header**: masukkan Name `X-API-Key` dan Value `<API_KEY_PRODUKSI>` Anda.
  5. Klik **Create** untuk mengaktifkan pemanggilan agen otonom secara berkala.

![Halaman Cloud Scheduler di Google Cloud Console](img/gcp-cloud-scheduler.png)

#### 4. Deploy Frontend ke Firebase Hosting

1. Perbarui `frontend/.env.local` (atau `frontend/.env`):
   ```env
   VITE_BACKEND_URL=https://nusaroute-api-xxx.asia-southeast2.run.app
   VITE_GOOGLE_MAPS_API_KEY=AIzaSy...
   ```
2. Berkas `firebase.json` di **root repositori** telah mengonfigurasi arsitektur **Serverless Reverse Proxy**:
   ```json
   "rewrites": [
     {
       "source": "/api/**",
       "run": {
         "serviceId": "nusaroute-api",
         "region": "asia-southeast2"
       }
     },
     {
       "source": "**",
       "destination": "/index.html"
     }
   ]
   ```
   *Rasional Arsitektur*: Direktif ini merutekan seluruh panggilan `/api/**` langsung ke Cloud Run Jakarta. Saat Anda mengaitkan custom domain (contoh: `nusaroute-ai.web.id`), baik frontend maupun API backend berada di domain yang sama (*same-origin*), mengeliminasi *preflight CORS* dan menghemat biaya *Cloud Load Balancer*.
3. Publikasikan hasil build ke jaringan CDN Firebase:
   * **Opsi Terminal (CLI)** *(dari root direktori repositori)*:
     ```bash
     # Dari root direktori repositori:
     npm run build --workspace=frontend
     npx firebase-tools deploy --only firestore:rules,hosting --project <PROJECT_ID>
     ```
   * **Opsi Web Console (GUI — Inisialisasi & Monitoring):**
     1. Buka [Firebase Console → Hosting](https://console.firebase.google.com/project/_/hosting), klik **Get started** untuk mengaktifkan situs Hosting pada project Anda jika baru pertama kali.
     2. Melalui dasbor Hosting, Anda dapat memantau riwayat rilis (*Release history*), mengonfigurasi *Custom domain*, serta menyalin URL produksi default Anda (misalnya: `https://<SITE_ID>.web.app` seperti `https://nusarouteai-1f67f.web.app` yang dialokasikan Firebase).

![Halaman Firebase Hosting di Firebase Console](img/firebase-hosting.png)

<aside class="tip">
<p><strong>Menghubungkan Custom Domain Pribadi (contoh: nusaroute-ai.web.id):</strong></p>
<p>Dengan menghubungkan custom domain utama ke Firebase Hosting yang memiliki aturan <em>rewrite</em> ke Cloud Run, Anda memperoleh 3 keuntungan arsitektur utama: (1) <strong>Satu domain tunggal</strong> untuk Web (<code>nusaroute-ai.web.id</code>) dan API (<code>nusaroute-ai.web.id/api</code>), (2) <strong>Bebas hambatan CORS</strong> karena beroperasi <em>same-origin</em>, dan (3) <strong>Efisiensi biaya</strong> tanpa perlu menyewa <em>Cloud Load Balancer</em> (~$18/bulan).</p>
<ol>
<li>Buka <strong>Firebase Console → Hosting</strong>, klik <strong>Add custom domain</strong>, lalu ketik nama domain Anda (misal: <code>nusaroute-ai.web.id</code>).</li>
<li>Tambahkan <strong>A Record</strong> pada panel DNS registrar domain Anda sesuai IP yang tertera di konsol Firebase (misal: <code>199.36.158.100</code>). Pastikan proxy Cloudflare diset ke <strong>DNS Only</strong> (ikon awan abu-abu). Google otomatis memverifikasi TXT challenge dan menerbitkan sertifikat SSL gratis dalam 15–60 menit.
<p><img src="img/firebase-custom-domain.png" alt="Pengaturan Custom Domain di Firebase Hosting Console" style="max-width:100%; border-radius:8px; margin-top:8px; margin-bottom:12px; border:1px solid #dadce0;" /></p>
</li>
<li><strong>Mendaftarkan Domain ke Firebase Auth (Authorized Domains):</strong>
<p>Google OAuth mewajibkan whitelist domain asal agar tombol <em>Login dengan Google</em> tidak ditolak dengan error <code>auth/unauthorized-domain</code>. Ada dua cara untuk mendaftarkannya:</p>
<ul>
<li><strong>Opsi A: Otomatis via Deployment Script / REST API (Rekomendasi)</strong><br/>
Skrip <code>npm run deploy</code> (pada <code>deploy.js</code>) secara otomatis memanggil Google Cloud Identity Toolkit v2 API untuk mendaftarkan domain Anda ke whitelist tanpa perlu membuka browser:
<pre><code class="language-bash"># Contoh pemanggilan REST API di balik layar:
TOKEN=$(gcloud auth print-access-token)
curl -X PATCH &quot;https://identitytoolkit.googleapis.com/v2/projects/&lt;PROJECT_ID&gt;/config?updateMask=authorizedDomains&quot; \
  -H &quot;Authorization: Bearer $TOKEN&quot; \
  -H &quot;x-goog-user-project: &lt;PROJECT_ID&gt;&quot; \
  -H &quot;Content-Type: application/json&quot; \
  -d '{&quot;authorizedDomains&quot;: [&quot;localhost&quot;, &quot;&lt;PROJECT_ID&gt;.firebaseapp.com&quot;, &quot;&lt;PROJECT_ID&gt;.web.app&quot;, &quot;nusaroute-ai.web.id&quot;, &quot;www.nusaroute-ai.web.id&quot;]}'
</code></pre>
</li>
<li><strong>Opsi B: Manual via Web Console (GUI)</strong><br/>
1. Buka <a href="https://console.firebase.google.com/project/_/authentication/settings">Firebase Console → Authentication → Settings</a>.<br/>
2. Gulir ke bagian <strong>Authorized domains</strong> (Domain resmi).<br/>
3. Klik tombol <strong>Add domain</strong> (Tambahkan domain).<br/>
4. Masukkan nama domain: <code>nusaroute-ai.web.id</code> lalu klik <strong>Save</strong>.<br/>
5. Ulangi untuk subdomain <code>www.nusaroute-ai.web.id</code>.
<p><img src="img/firebase-authorized-domains.png" alt="Halaman Authorized Domains di Firebase Console" style="max-width:100%; border-radius:8px; margin-top:10px; border:1px solid #dadce0;" /></p>
</li>
</ul>
</li>
<li>Skrip <code>npm run deploy</code> juga secara otomatis menyuntikkan Custom Domain ke whitelist CORS backend Cloud Run (memastikan direct access via Cloud Scheduler tetap aman).</li>
</ol>
</aside>

#### 5. Verifikasi Status Layanan Produksi

Pastikan kedua layanan (Cloud Run dan Firebase Hosting) bekerja normal setelah deployment:

* **Opsi Web Browser (GUI):**
  Buka endpoint *Health Check* publik langsung di tab browser Anda:
  ```
  https://nusaroute-api-xxx.asia-southeast2.run.app/api/health
  ```
  Respon JSON valid akan menampilkan status `{"status":"ok","environment":"production",...}`.

* **Opsi Terminal (CLI):**
  Gunakan perintah `curl` dengan menyertakan header `x-api-key` untuk memverifikasi endpoint analitik dan siklus agen yang terlindungi:
  ```bash
  # 1. Cek status daemon pemantau trafik & agen
  curl -H "x-api-key: <API_KEY_PRODUKSI>" \
    https://nusaroute-api-xxx.asia-southeast2.run.app/api/agent/status

  # 2. Cek analitik pengiriman & ringkasan rute
  curl -H "x-api-key: <API_KEY_PRODUKSI>" \
    https://nusaroute-api-xxx.asia-southeast2.run.app/api/analytics

  # 3. Uji coba pemanggilan siklus pemicu agen (simulasi Cloud Scheduler)
  curl -X POST -H "x-api-key: <API_KEY_PRODUKSI>" \
    https://nusaroute-api-xxx.asia-southeast2.run.app/api/agent/tick
  ```

#### 6. Monitoring & Observabilitas Produksi (Cloud Monitoring, Cloud Logging & Firebase Analytics)

Cloud Run dan Firebase Hosting menyediakan tiga pilar observabilitas (*metrics*, *logs*, dan *telemetry*) secara terpadu:

##### A. Google Cloud Monitoring (Dasbor Metrik Serverless)
Cloud Run secara otomatis mengumpulkan metrik performa kontainer *out-of-the-box* tanpa beban CPU tambahan. Navigasi ke **Cloud Run** → pilih service **`nusaroute-api`** → tab **METRICS** untuk memantau:

* **Request Count & Latency**: Volume panggilan per detik serta latensi respon (P50 dan P95/P99 saat inferensi multimodal Gemini).
* **Container Instances**: Grafik autoscaling dari `0` (idle) hingga `3` saat terjadi lonjakan laporan insiden.
* **CPU & Memory Utilization**: Konsumsi RAM kontainer Node.js (umumnya 70–120 MB, jauh di bawah batas 1 GiB).
* **Container Billable Time**: Waktu eksekusi aktif kontainer yang ditagihkan per milidetik.

##### B. Google Cloud Logging (Structured JSON Logging)
Backend NusaRoute AI memancarkan log berformat JSON standar ke `stdout`/`stderr` yang dapat ditelusuri di [Google Cloud Logs Explorer](https://console.cloud.google.com/logs/viewer):

```sql
resource.type="cloud_run_revision"
resource.labels.service_name="nusaroute-api"
severity >= WARNING
```

Setiap log request mencatat field `httpRequest` (status HTTP, IP kurir, user agent, durasi latensi) dan `severity` (`INFO`, `WARNING`, atau `ERROR`). Bila Gemini mengalami limit kuota Free Tier (HTTP 429), log mencatat event `[AI Agent Failover]` saat sistem mengalihkan permintaan ke model cadangan (`gemini-3.1-flash-lite`).

##### C. Endpoint Telemetri Langsung (`/api/monitoring`)
NusaRoute AI mengekspos endpoint telemetri real-time yang dapat diakses publik tanpa token:

* **URL Telemetri**: `https://<CLOUD_RUN_URL>/api/monitoring` atau `https://nusaroute-ai.web.id/api/monitoring`
* **Contoh Output JSON**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-11-20T17:46:57.938Z",
    "uptime": {
      "seconds": 3600,
      "formatted": "1h 0m 0s"
    },
    "system": {
      "nodeVersion": "v25.6.0",
      "platform": "linux",
      "memory": {
        "rssMb": 83.39,
        "heapUsedMb": 46.84
      }
    },
    "cloudRun": {
      "service": "nusaroute-api",
      "region": "asia-southeast2"
    },
    "ai": {
      "provider": "Google Gemini (Generative Language API)",
      "primaryModel": "gemini-3.8-flash",
      "mode": "live",
      "failoverCandidates": [
        "gemini-3.8-flash",
        "gemini-3.1-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-3-flash-preview"
      ],
      "isMockAi": false
    },
    "metrics": {
      "totalRequests": 142,
      "status2xx": 140,
      "status4xx": 2,
      "status5xx": 0,
      "successRatePercent": 98.6
    }
  }
  ```

##### D. Firebase Hosting Analytics & Edge Monitoring
Pantau frontend PWA di [Firebase Console → Hosting](https://console.firebase.google.com/project/_/hosting):

* **Data Transfer Out**: Volume bandwidth aset statis yang didistribusikan ke ponsel kurir.
* **Requests**: Jumlah permintaan halaman web dan service worker (`sw.js`).
* **CDN Cache Hit Ratio**: Rasio aset terkompilasi Vite yang disajikan dari edge CDN Fastly terdekat.
* **Status Custom Domain**: Pantau status sertifikat SSL (`CERT_VALIDATING` → `HOST_ACTIVE`) dan kepemilikan DNS.

---

## Ringkasan & Sumber Belajar
Duration: 05:00

Anda telah menyelesaikan seluruh tahapan workshop NusaRoute AI.

### Rangkuman Materi Pembelajaran
- **Agentic AI vs Chatbot Biasa**: Memahami bagaimana agen otonom dapat memantau situasi secara mandiri (*Monitor*), mengevaluasi data (*Evaluate*), mengambil keputusan rute (*Decide*), dan mengeksekusi tindakan (*Act*) tanpa menunggu perintah manual.
- **Analisis Multimodal Gemini 3.8 Flash**: Memproses laporan foto rintangan jalan dan rekaman suara kurir secara langsung menjadi data terstruktur JSON tanpa memerlukan layanan Computer Vision atau speech-to-text terpisah.
- **Structured Outputs Terjamin**: Memanfaatkan JSON Schema bawaan Gemini untuk memastikan respons kecerdasan buatan selalu konsisten dan dapat diproses oleh sistem backend.
- **Integrasi Peta & Validasi Radius (Geofencing)**: Menggabungkan Google Maps Platform dengan perhitungan jarak Haversine (toleransi 200 meter) untuk memastikan kurir telah tiba di lokasi penerima sebelum menyelesaikan pengiriman.
- **Aplikasi Web Progresif (PWA)**: Menyediakan antarmuka kurir yang ringan dan responsif untuk memantau rute aktif serta melaporkan insiden lapangan secara instan.
- **Penyimpanan Data Real-Time Firestore**: Mengelola data paket, kurir, zona kemacetan, dan log keputusan agen secara aman di Google Cloud Firestore.
- **Standar Keamanan Aplikasi Modern**: Menerapkan autentikasi ganda (Google Sign-In terverifikasi & sandi scrypt), otorisasi berbasis peran (Role-Based Access Control), serta perlindungan token JWT.
- **Optimasi Algoritma Pengiriman**: Menghemat jarak dan waktu tempuh hingga 19% menggunakan pendekatan *Nearest Neighbor* dan pengelompokan alamat (*clustering*).
- **Penyebaran Skala Produksi (Deployment)**: Menjalankan backend serverless di Google Cloud Run dan frontend di Firebase Hosting dengan biaya efisien dan skalabilitas tinggi.

### Production Readiness Checklist: Menuju Skala Jutaan Pengguna

NusaRoute AI yang dibangun pada workshop ini mengimplementasikan fondasi arsitektur produksi modern. Apabila tim engineering Anda berencana membawa sistem ini ke skala komersial publik dengan jutaan pengguna aktif, berikut rekomendasi langkah penyempurnaannya:

| Komponen Sistem | Implementasi Workshop (Hands-on) | Standar Rilis Publik (Enterprise Scale) |
| :--- | :--- | :--- |
| **Komunikasi Real-time** | HTTP Polling berkala dari peramban client. | **Firestore `onSnapshot` / Server-Sent Events (SSE)** untuk pembaruan status kurir secara instan tanpa membebani kuota *read* database. |
| **Distributed Rate Limiting** | *In-memory Map* per kontainer Node.js. | **Google Cloud Memorystore (Redis)** atau **Google Cloud Armor WAF** untuk perlindungan rate limit terpusat antar-kontainer Cloud Run. |
| **Ketahanan Jaringan Kurir** | Mengandalkan koneksi seluler aktif. | **Offline-First Persistence (IndexedDB + Background Sync API)** sehingga kurir di *blindspot* / basement tetap dapat memperbarui status paket secara lokal. |
| **Verifikasi Bukti Pengantaran** | Validasi radius GPS 200m (Haversine). | **Proof of Delivery (POD)**: Penambahan foto paket di lokasi penerima + tanda tangan digital pelanggan di layar ponsel kurir. |
| **Optimalisasi Biaya API (FinOps)** | Pemanggilan live Maps & Gemini API. | **Geo-caching rute statis** pada Redis dan *client-side image compression* pada peramban sebelum dikirim ke Gemini untuk memangkas konsumsi token. |

### Tautan & Referensi Teknis
- **Repositori Proyek**: [github.com/putuwahyu29/nusaroute-ai](https://github.com/putuwahyu29/nusaroute-ai)
- **Dokumentasi Google Gen AI SDK**: [ai.google.dev](https://ai.google.dev)
- **Dokumentasi Google Cloud Run**: [cloud.google.com/run](https://cloud.google.com/run)

Dokumentasi ini disiapkan untuk sesi hands-on DevFest Cloud Surabaya 2026. Untuk pertanyaan teknis, pelaporan kendala, atau kontribusi kode, silakan akses repositori GitHub di atas.
