# 🚀 NusaRoute AI - Auto Setup Guide

Panduan lengkap untuk setup otomatis configuration project menggunakan Google Cloud CLI.

## Prerequisites ✅

Pastikan Anda sudah menginstall:

- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)
- Node.js v16+

## Step 1: Authenticate dengan Google Cloud

```bash
gcloud auth login
```

Browser akan terbuka, login dengan akun Google Anda.

## Step 2: Retrieve Credentials

Kumpulkan informasi berikut sebelum menjalankan setup script:

### 📋 Informasi yang Diperlukan:

#### 1. **Google Cloud Project ID**

```bash
# Lihat project yang tersedia
gcloud projects list

# Set project aktif
gcloud config set project YOUR_PROJECT_ID
```

#### 2. **Gemini API Key**

```bash
# Buat API key
gcloud services enable aiplatform.googleapis.com
```

Dapatkan API Key dari: [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)

#### 3. **Firebase Credentials**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select atau create project (gunakan project ID yang sama)
3. Buat Firestore database jika belum ada:
   - Buka [Firestore Databases](https://console.cloud.google.com/firestore/databases)
   - Klik **Create database**
   - Pilih **Firestore Native mode**
   - Pilih lokasi database
4. Download Service Account JSON:
   - Project Settings → Service Accounts → Generate new private key
5. Copy nilai `private_key` dari file JSON tersebut untuk mengisi `FIREBASE_PRIVATE_KEY`

#### 4. **Google Maps API Key**

1. [Enable Maps API](https://console.cloud.google.com/apis/library)
2. [Get API Key](https://console.cloud.google.com/apis/credentials)

---

## Step 3: Jalankan Setup Script

```bash
# Dari root project directory
node setup-config.js
```

Script akan interaktif menanyakan informasi dan otomatis generate:

- ✅ `backend/.env`
- ✅ `frontend/.env.local`

---

## Step 4: Verifikasi Setup

```bash
# Backend
cd backend
cat .env  # Verify konfigurasi

# Frontend
cd frontend
cat .env.local  # Verify konfigurasi
```

---

## Step 5: Install Dependencies & Run

```bash
# Backend
cd backend
npm install
npm run dev  # Port 3000

# Terminal baru - Frontend
cd frontend
npm install
npm run dev  # Port 5173
```

---

## ⚙️ Environment Variables Reference

### Backend (.env)

```env
NODE_ENV=development
GEMINI_API_KEY=sk-...              # Gemini API Key
GEMINI_MODEL=gemini-2.5-flash-preview-05-20
FIREBASE_PROJECT_ID=your-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-....iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN..."
PORT=3000
USE_MOCK_AI=false
```

### Frontend (.env.local)

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...
VITE_API_BASE_URL=http://localhost:3000
```

---

## 🔒 Security Best Practices

✅ **DO:**

- Keep `.env` dan `.env.local` dalam `.gitignore`
- Rotate API keys regularly
- Use different keys untuk development/production

❌ **DON'T:**

- Commit `.env` files ke git
- Share credentials di public
- Use production keys untuk testing

---

## 🆘 Troubleshooting

### Error: `gcloud: command not found`

```bash
# Install Google Cloud SDK
# macOS
brew install --cask google-cloud-sdk

# Windows - Download dari https://cloud.google.com/sdk/docs/install
# Linux
curl https://sdk.cloud.google.com | bash
```

### Error: `Not authenticated`

```bash
gcloud auth login
```

### Firestore database not found

1. Buka [Firestore Databases](https://console.cloud.google.com/firestore/databases)
2. Klik **Create database**
3. Pilih **Firestore Native mode** dan lokasi database
4. Jalankan ulang `npm run setup`

### Missing credentials?

Edit `.env` files secara manual:

```bash
# Backend
nano backend/.env

# Frontend
nano frontend/.env.local
```

### API keys not working?

1. Verify di [Google Cloud Console](https://console.cloud.google.com)
2. Check API sudah enabled
3. Check restrictions (IP, Referer, etc)

### Error: `MapsRequestError: DIRECTIONS_ROUTE: REQUEST_DENIED`

1. Pastikan [Directions API (Legacy)](https://console.cloud.google.com/apis/library/directions-backend.googleapis.com) sudah enabled di project yang sama.
2. Pastikan [Maps JavaScript API](https://console.cloud.google.com/apis/library/maps-backend.googleapis.com) juga enabled.
3. Periksa API key restrictions di Google Cloud Console, lalu izinkan penggunaan untuk Maps JavaScript API dan Directions API.

---

## 📚 Useful Commands

```bash
# Check authentication status
gcloud auth list

# View current project
gcloud config get-value project

# List all projects
gcloud projects list

# Enable APIs
gcloud services enable aiplatform.googleapis.com
gcloud services enable firebase.googleapis.com

# View credentials
gcloud auth application-default print-access-token

# Logout
gcloud auth revoke
```

---

## 🔗 Resources

- [Google Cloud CLI Docs](https://cloud.google.com/cli)
- [Gemini API Docs](https://ai.google.dev)
- [Firebase Setup](https://firebase.google.com/docs/setup)
- [Google Maps API](https://developers.google.com/maps)

---

**Last Updated:** May 2026
**Status:** ✅ Automated Setup Ready
