# 🤖 AGENTS.md — NusaRoute AI Developer & Agent Guidelines

Selamat datang di repositori **NusaRoute AI** (Proyek Praktikum DevFest Cloud Surabaya 2026 — *Workshop Developers Advanced 2*).
Dokumen ini dirancang sebagai panduan resmi bagi **AI Coding Agent** (seperti Google Antigravity IDE Agent, Cursor, Claude Code) saat mendampingi developer atau peserta workshop mengelola, mengembangkan, dan mengonfigurasi proyek ini.

---

## 🧭 Ikhtisar Proyek

* **Nama Proyek:** NusaRoute AI
* **Tema:** Smart Urban Mobility & Autonomous Logistics (Kota Surabaya)
* **Arsitektur Utama:**
  * **Backend:** Express.js 5 + TypeScript (Node.js 22 LTS) di `backend/src/server.ts`
  * **Frontend:** React 18 + Vite 8 + TypeScript + Tailwind CSS PWA di `frontend/src/`
  * **AI Reasoning Core:** Google Gemini 3.8 Flash via SDK resmi `@google/genai` (Multimodal Ingestion di RAM buffer + Strict JSON `responseSchema`)
  * **Algoritma Spasial:** Nearest-Neighbor TSP Solver ($O(n^2)$) berbasis formula Haversine
  * **Database & Cloud:** Cloud Firestore Standard Edition (`asia-southeast2` Jakarta) & Google Cloud Run

---

## 🛠️ Tugas Otomasi Agen: Setup Proyek & Konfigurasi Lingkungan

Jika pengguna (peserta workshop) meminta Anda untuk **"setup project"**, **"siapkan environment"**, atau **"konfigurasi gcloud"**, lakukan prosedur berikut secara otonom:

### 1. Verifikasi Prasyarat
Periksa apakah tool dasar sudah tersedia di sistem:
* `node -v` (Wajib Node.js 22 LTS atau lebih baru; versi 18 dan 20 sudah EOL)
* `npm -v` (Versi 10+)
* `gcloud --version`
* `git --version`

### 2. Eksekusi Setup Konfigurasi
* Anda dapat menjalankan wizard otomatis yang sudah tersedia di proyek:
  ```bash
  npm run setup
  ```
  Atau, jika pengguna menginginkan bantuan langsung via CLI, Anda dapat membantu:
  1. Memeriksa login: `gcloud auth list` (jika belum login, ingatkan pengguna menjalankan `gcloud auth login`).
  2. Memeriksa project aktif: `gcloud config get-value project`.
  3. Mengaktifkan layanan yang dibutuhkan:
     ```bash
     gcloud services enable firestore.googleapis.com run.googleapis.com aiplatform.googleapis.com generativelanguage.googleapis.com maps-backend.googleapis.com directions-backend.googleapis.com
     ```
  4. Membantu memastikan berkas `backend/.env` dan `frontend/.env.local` telah terisi sesuai template di `.env.example`.

### 3. Validasi & Pengujian
Selalu jalankan skrip validasi proyek setelah membuat atau mengubah berkas konfigurasi:
```bash
npm run validate
```
Pastikan seluruh variabel lingkungan terverifikasi dengan benar.

---

## 📦 Perintah Kerja Penting (Workflows)

| Perintah | Deskripsi |
|---|---|
| `npm run install:all` | Menginstal seluruh dependensi monorepo (root, backend, dan frontend). |
| `npm run setup` | Menjalankan wizard otomatis penyiapan project Google Cloud dan `.env`. |
| `npm run validate` | Memverifikasi kelengkapan variabel lingkungan di backend dan frontend. |
| `npm run dev` | Menjalankan backend (Port 3000) dan frontend (Port 5173) secara bersamaan. |
| `npm run codelab` | Menjalankan server lokal materi panduan Google Codelabs di port 8080. |
| `npm run codelab:export` | Meng-compile ulang naskah Codelab markdown ke HTML menggunakan Google CLAAT. |

---

## ⚠️ Aturan Arsitektur & Prinsip Rekayasa (Strict Rules)

1. **Strict Type Safety:** Seluruh kode backend dan frontend harus lolos kompilasi TypeScript (`npx tsc --noEmit`) dengan 0 error. Jangan gunakan tipe `any` sembarangan; gunakan tipe yang sudah didefinisikan di `backend/src/types/index.ts`.
2. **Model Gemini Resmi:** Gunakan selalu model `gemini-3.8-flash` melalui SDK resmi `@google/genai`. Jangan mengembalikan ke model preview lama.
3. **Zero Disk I/O untuk Multimodal:** Ingest file foto dan audio langsung melalui `multer.memoryStorage()` ke buffer RAM, tanpa pernah menulis file sementara ke hard disk container.
4. **Data Riil Surabaya:** Tetap gunakan 15 koordinat nyata Surabaya (`DEL-001` s.d. `DEL-015`) dan 10 zona kemacetan nyata Surabaya di `traffic-agent.ts`. Jangan menggantinya dengan data tiruan acak (*dummy*).
5. **Mode Default Live:** Konfigurasi default sistem adalah `USE_MOCK_AI=false`. Mock mode hanya digunakan sebagai *fallback graceful degradation* jika koneksi internet terputus.
