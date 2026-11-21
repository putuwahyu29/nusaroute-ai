#!/usr/bin/env node

/**
 * NusaRoute AI - Automated GCP & Firebase Configuration Wizard
 *
 * Requirements:
 * - Google Cloud CLI installed: https://cloud.google.com/sdk/docs/install
 * - Authenticated: gcloud auth login
 * - Optional (for full Web SDK auto-config): npx firebase-tools login
 */

import { execSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const log = {
  info: (msg) => console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[OK]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERR]${colors.reset} ${msg}`),
  step: (msg) => console.log(`\n${colors.bright}${colors.blue}==> ${msg}${colors.reset}`),
};

function runCommand(cmd, { silent = true } = {}) {
  try {
    const result = execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return { ok: true, stdout: result, stderr: "" };
  } catch (error) {
    const stderr = error?.stderr?.toString().trim() || "";
    const stdout = error?.stdout?.toString().trim() || "";
    if (!silent) {
      log.warn(stderr || stdout || error.message);
    }
    return { ok: false, stdout, stderr: stderr || error.message };
  }
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const env = {};
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    env[key] = val;
  });
  return env;
}

function saveEnvFile(filePath, envVars) {
  const content =
    Object.entries(envVars)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n";

  fs.writeFileSync(filePath, content, "utf-8");
  log.success(`File ditulis: ${filePath}`);
}

function isValidApiKey(val) {
  return typeof val === "string" && /^AIza[0-9A-Za-z_-]{20,}$/.test(val.trim());
}

function isRealApiKey(val) {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (
    trimmed === "your_gemini_api_key_here" ||
    trimmed === "your_google_maps_api_key_here" ||
    trimmed === "your_api_key_here" ||
    trimmed.startsWith("change_me") ||
    trimmed.includes("placeholder")
  ) {
    return false;
  }
  return isValidApiKey(trimmed);
}

function maskApiKey(key) {
  if (!key || key.length < 8) return "***";
  return key.slice(0, 6) + "..." + key.slice(-4);
}

function findOrCreateApiKey({ displayName, apiTargets = [], projectId, serviceAccount = null }) {
  // 1. Check existing key by display name and fetch its raw keyString via get-key-string
  const listRes = runCommand(
    `gcloud services api-keys list --project=${projectId} --format="json"`,
  );
  if (listRes.ok && listRes.stdout) {
    try {
      const keys = JSON.parse(listRes.stdout);
      if (Array.isArray(keys)) {
        const match = keys.find((k) => k.displayName === displayName);
        if (match && match.name) {
          const strRes = runCommand(
            `gcloud services api-keys get-key-string "${match.name}" --format="value(keyString)"`,
          );
          if (strRes.ok && isValidApiKey(strRes.stdout)) {
            log.success(`Menggunakan API Key yang sudah ada di GCP (${displayName})`);
            return strRes.stdout.trim();
          }
        }
      }
    } catch {
      // Fallback if JSON parse fails
    }
  }

  // 2. Create restricted API Key and extract response.keyString
  const targetFlags = apiTargets.map((t) => `--api-target=service=${t}`).join(" ");
  const createCmd = `gcloud services api-keys create --display-name="${displayName}" --project=${projectId} ${targetFlags} --format="value(response.keyString)"`;
  const createRes = runCommand(createCmd);

  if (createRes.ok && isValidApiKey(createRes.stdout)) {
    log.success(`API Key baru berhasil dibuat (${displayName})`);
    return createRes.stdout.trim();
  }

  // 3. Fallback for Authorization Key (bound to service account, e.g., Gemini API policy)
  if (serviceAccount) {
    const authKeyCmd = `gcloud beta services api-keys create --display-name="${displayName}" --project=${projectId} ${targetFlags} --service-account="${serviceAccount}" --format="value(response.keyString)"`;
    const authRes = runCommand(authKeyCmd);
    if (authRes.ok && isValidApiKey(authRes.stdout)) {
      log.success(`Authorization API Key terikat Service Account berhasil dibuat (${displayName})`);
      return authRes.stdout.trim();
    }
  }

  return null;
}

async function setup() {
  console.log(`\n${colors.bright}${colors.cyan}NusaRoute AI - Configuration Wizard (GCP & Firebase CLI)${colors.reset}`);

  // ─── STEP 1: Check gcloud authentication ─────────────────────────────────
  log.step("1. Memeriksa Autentikasi Google Cloud CLI");
  const accountRes = runCommand("gcloud config get-value account");
  if (!accountRes.ok || !accountRes.stdout) {
    log.error("Google Cloud CLI belum terpasang atau belum login.");
    log.info("Jalankan perintah berikut terlebih dahulu: gcloud auth login");
    rl.close();
    process.exit(1);
  }
  const account = accountRes.stdout;
  log.success(`Login aktif sebagai: ${account}`);

  // ─── STEP 2: Select or create GCP Project ────────────────────────────────
  log.step("2. Memilih / Membuat Google Cloud Project");
  const currentProjRes = runCommand("gcloud config get-value project");
  let projectId = currentProjRes.ok && currentProjRes.stdout !== "(unset)" ? currentProjRes.stdout : "";

  if (projectId) {
    const keep = await question(`Project aktif saat ini: ${colors.cyan}${projectId}${colors.reset}. Gunakan project ini? (Y/n): `);
    if (keep.trim().toLowerCase() === "n") {
      projectId = "";
    }
  }

  if (!projectId) {
    const listRes = runCommand('gcloud projects list --format="table[no-heading](projectId,name)" --limit=20');
    const projectList = listRes.ok && listRes.stdout ? listRes.stdout.split(/\r?\n/).filter((l) => l.trim()) : [];

    console.log("\nDaftar Project:");
    projectList.forEach((line, idx) => console.log(`  ${idx + 1}. ${line}`));
    console.log(`  ${projectList.length + 1}. Buat project baru via gcloud CLI`);
    console.log(`  ${projectList.length + 2}. Masukkan Project ID secara manual`);

    const choice = await question(`\nPilih opsi (1-${projectList.length + 2}): `);
    const selectedIdx = parseInt(choice, 10) - 1;

    if (selectedIdx >= 0 && selectedIdx < projectList.length) {
      projectId = projectList[selectedIdx].trim().split(/\s+/)[0];
    } else if (selectedIdx === projectList.length) {
      const suggestion = `nusaroute-sby-${Math.floor(1000 + Math.random() * 9000)}`;
      const inputId = await question(`Masukkan Project ID unik (contoh: ${suggestion}): `);
      projectId = inputId.trim() || suggestion;
      log.info(`Membuat project ${projectId}...`);
      const createRes = runCommand(`gcloud projects create ${projectId} --name="NusaRoute AI"`, { silent: false });
      if (!createRes.ok) {
        log.warn("Gagal membuat project lewat CLI. Buat melalui https://console.cloud.google.com/projectcreate lalu masukkan ID-nya.");
        projectId = (await question("Masukkan Project ID: ")).trim();
      } else {
        log.success(`Project ${projectId} berhasil dibuat.`);
      }
    } else if (selectedIdx === projectList.length + 1) {
      projectId = (await question("Masukkan Project ID: ")).trim();
    } else {
      log.error("Pilihan tidak valid.");
      rl.close();
      process.exit(1);
    }

    if (!projectId) {
      log.error("Project ID wajib diisi.");
      rl.close();
      process.exit(1);
    }

    const setRes = runCommand(`gcloud config set project ${projectId}`, { silent: false });
    if (!setRes.ok) {
      log.error(`Gagal menetapkan project aktif: ${projectId}`);
      rl.close();
      process.exit(1);
    }
  }
  log.success(`Project aktif: ${projectId}`);

  // ─── STEP 3: Check & Link Billing Account ────────────────────────────────
  log.step("3. Memeriksa & Menautkan Billing Account");
  const billingCheck = runCommand(
    `gcloud billing projects describe ${projectId} --format="value(billingEnabled)"`,
  );
  if (billingCheck.ok && billingCheck.stdout.toLowerCase() === "true") {
    log.success(`Billing Account sudah tertaut dan aktif pada project ${projectId}.`);
  } else {
    log.warn(`Project ${projectId} belum terhubung ke Billing Account aktif.`);
    const billingListRes = runCommand(
      'gcloud billing accounts list --filter="open=true" --format="value[separator=\'|\'](name,displayName)"',
    );
    const openBillingAccounts =
      billingListRes.ok && billingListRes.stdout
        ? billingListRes.stdout
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
              const [rawName, displayName] = line.split("|");
              const id = (rawName || "").replace(/^billingAccounts\//, "").trim();
              return { id, displayName: (displayName || id).trim() };
            })
            .filter((b) => b.id)
        : [];

    if (openBillingAccounts.length > 0) {
      console.log("\nDaftar Billing Account Aktif:");
      openBillingAccounts.forEach((b, idx) =>
        console.log(`  ${idx + 1}. ${b.displayName} (${b.id})`),
      );
      console.log(`  ${openBillingAccounts.length + 1}. Lewati untuk sekarang (mode lokal tanpa Cloud Run)`);
      const bChoice = await question(
        `\nPilih Billing Account untuk ditautkan (1-${openBillingAccounts.length + 1}): `,
      );
      const bIdx = parseInt(bChoice, 10) - 1;
      if (bIdx >= 0 && bIdx < openBillingAccounts.length) {
        const chosen = openBillingAccounts[bIdx];
        log.info(`Menautkan ${chosen.displayName} (${chosen.id}) ke ${projectId}...`);
        const linkRes = runCommand(
          `gcloud billing projects link ${projectId} --billing-account=${chosen.id}`,
          { silent: false },
        );
        if (linkRes.ok) {
          log.success(`Billing Account ${chosen.id} berhasil ditautkan ke ${projectId}.`);
        } else {
          log.warn("Gagal menautkan Billing Account via CLI. Anda dapat menautkannya di https://console.cloud.google.com/billing/projects");
        }
      } else {
        log.info("Penautan Billing Account dilewati (mode lokal).");
      }
    } else {
      log.info("Tidak ditemukan Billing Account aktif di akun ini. Melanjutkan mode lokal tanpa Cloud Run.");
    }
  }

  // ─── STEP 4: Enable Required APIs ────────────────────────────────────────
  log.step("4. Mengaktifkan API Layanan Google Cloud");
  const coreApis = [
    "apikeys.googleapis.com",
    "firestore.googleapis.com",
    "generativelanguage.googleapis.com",
    "maps-backend.googleapis.com",
    "routes.googleapis.com",
    "firebase.googleapis.com",
    "identitytoolkit.googleapis.com",
  ];

  log.info("Mengaktifkan 7 API inti modern (Firestore, Gemini, Maps JS, Routes API [Standar 2026+], API Keys, Firebase, Identity Toolkit Auth)...");
  const enableCore = runCommand(`gcloud services enable ${coreApis.join(" ")} --project=${projectId}`);
  if (enableCore.ok) {
    log.success("Seluruh API inti modern berhasil diaktifkan.");
  } else {
    log.warn("Aktivasi batch gagal; mencoba aktivasi satu per satu...");
    for (const api of coreApis) {
      const res = runCommand(`gcloud services enable ${api} --project=${projectId}`);
      if (res.ok) log.success(`Aktif: ${api}`);
      else log.warn(`Lewati ${api}: ${res.stderr.split("\n")[0]}`);
    }
  }

  // Coba aktifkan Directions API (Legacy) sebagai opsi kompatibilitas cadangan
  const legacyDirections = runCommand(`gcloud services enable directions-backend.googleapis.com --project=${projectId}`);
  if (legacyDirections.ok) {
    log.info("Aktif: directions-backend.googleapis.com (opsi kompatibilitas cadangan)");
  } else {
    log.info("directions-backend.googleapis.com dilewati (proyek menggunakan Routes API)");
  }

  // Serverless APIs (Cloud Run, Cloud Build, Cloud Scheduler) require billing account — enable gracefully if available
  const enableServerless = runCommand(
    `gcloud services enable run.googleapis.com cloudbuild.googleapis.com cloudscheduler.googleapis.com --project=${projectId}`
  );
  if (enableServerless.ok) {
    log.success("Aktif: run.googleapis.com, cloudbuild.googleapis.com, cloudscheduler.googleapis.com");
  } else {
    log.warn("API Serverless (Run/Build/Scheduler) dilewati (memerlukan Billing Account aktif; hanya dibutuhkan pada Langkah 9).");
  }

  // ─── STEP 5: Provision Cloud Firestore Database (asia-southeast2) ────────
  log.step("5. Memeriksa & Membuat Database Cloud Firestore (asia-southeast2)");
  let dbCheck = runCommand(
    `gcloud firestore databases describe --database="(default)" --project=${projectId} --format="value(name)"`,
  );

  if (dbCheck.ok && dbCheck.stdout) {
    log.success(`Database Firestore tersedia: ${dbCheck.stdout}`);
  } else {
    log.info("Membuat database Firestore (default) di region asia-southeast2 (Jakarta)...");
    const createDb = runCommand(
      `gcloud firestore databases create --database="(default)" --location=asia-southeast2 --type=firestore-native --project=${projectId}`,
    );
    if (createDb.ok) {
      log.success("Database Cloud Firestore (asia-southeast2) berhasil dibuat via CLI.");
    } else {
      log.warn(`Pembuatan otomatis via CLI gagal: ${createDb.stderr.split("\n")[0]}`);
      log.info(`Buka: https://console.cloud.google.com/firestore/databases?project=${projectId}`);
      log.info("Klik 'Create a Firestore database' -> Standard Edition -> Location: asia-southeast2 (Jakarta).");
      await question("Tekan Enter setelah database Firestore selesai dibuat di Console...");
    }
  }

  // ─── STEP 6: Service Account, IAM Role & PEM Private Key ─────────────────
  log.step("6. Mengonfigurasi Service Account & Kunci Admin Firestore");
  const saId = "nusaroute-backend-sa";
  const serviceAccountEmail = `${saId}@${projectId}.iam.gserviceaccount.com`;
  let justCreatedSa = false;

  const saCheck = runCommand(`gcloud iam service-accounts describe "${serviceAccountEmail}" --project=${projectId}`);
  if (!saCheck.ok) {
    const saCreate = runCommand(
      `gcloud iam service-accounts create ${saId} --display-name="NusaRoute Backend SA" --project=${projectId}`,
      { silent: false },
    );
    if (saCreate.ok) {
      justCreatedSa = true;
      log.success(`Service Account dibuat: ${serviceAccountEmail}`);
    } else {
      log.error(`Gagal membuat Service Account ${serviceAccountEmail}`);
    }
  } else {
    log.success(`Service Account sudah ada: ${serviceAccountEmail}`);
  }

  // Wait for GCP IAM eventual consistency when Service Account was just created
  if (justCreatedSa) {
    log.info("Menunggu propagasi IAM Google Cloud (eventual consistency)...");
    for (let attempt = 1; attempt <= 6; attempt++) {
      await sleep(3000);
      const ready = runCommand(
        `gcloud iam service-accounts describe "${serviceAccountEmail}" --project=${projectId}`,
      );
      if (ready.ok) break;
    }
  }

  // Always bind roles/datastore.user (Firestore) & roles/firebaseauth.viewer (Auth inspection)
  log.info("Memastikan role IAM (roles/datastore.user & roles/firebaseauth.viewer) terpasang pada Service Account...");
  let iamRes = { ok: false, stderr: "" };
  for (const role of ["roles/datastore.user", "roles/firebaseauth.viewer"]) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      iamRes = runCommand(
        `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${serviceAccountEmail}" --role="${role}" --quiet`,
      );
      if (iamRes.ok) break;
      await sleep(3000);
    }
    if (iamRes.ok) {
      log.success(`Role ${role} terkonfigurasi.`);
    } else {
      log.warn(`Gagal menetapkan IAM binding ${role}: ${iamRes.stderr.split("\n")[0]}`);
    }
  }

  // Ensure Cloud Build / Compute default Service Account has required permissions for Cloud Run source deploy
  const projNumRes = runCommand(`gcloud projects describe ${projectId} --format="value(projectNumber)"`);
  if (projNumRes.ok && projNumRes.stdout) {
    const pNum = projNumRes.stdout.trim();
    runCommand(
      `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${pNum}-compute@developer.gserviceaccount.com" --role="roles/serviceusage.serviceUsageConsumer" --quiet`
    );
    runCommand(
      `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${pNum}@cloudbuild.gserviceaccount.com" --role="roles/serviceusage.serviceUsageConsumer" --quiet`
    );
    runCommand(
      `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${pNum}-compute@developer.gserviceaccount.com" --role="roles/cloudbuild.builds.builder" --quiet`
    );
  }

  // Reuse valid existing PEM private key from backend/.env if matching project & SA
  const backendEnvPath = path.join(process.cwd(), "backend", ".env");
  const existingBackendEnv = parseEnvFile(backendEnvPath);
  const frontendEnvPath = path.join(process.cwd(), "frontend", ".env.local");
  const existingFrontendEnv = parseEnvFile(frontendEnvPath);
  let firebasePrivateKey = null;

  const hasValidExistingKey =
    existingBackendEnv.FIREBASE_PROJECT_ID === projectId &&
    existingBackendEnv.FIREBASE_CLIENT_EMAIL === serviceAccountEmail &&
    existingBackendEnv.FIREBASE_PRIVATE_KEY &&
    existingBackendEnv.FIREBASE_PRIVATE_KEY.includes("BEGIN PRIVATE KEY");

  if (hasValidExistingKey) {
    const reuse = await question("Kunci PEM FIREBASE_PRIVATE_KEY yang valid sudah ada di backend/.env. Gunakan kembali? (Y/n): ");
    if (reuse.trim().toLowerCase() !== "n") {
      firebasePrivateKey = existingBackendEnv.FIREBASE_PRIVATE_KEY;
      log.success("Menggunakan kembali FIREBASE_PRIVATE_KEY yang ada.");
    }
  }

  if (!firebasePrivateKey) {
    const tmpKeyFile = path.join(process.cwd(), ".sa-key-tmp.json");
    try {
      let keyRes = { ok: false, stderr: "" };
      for (let attempt = 1; attempt <= 6; attempt++) {
        keyRes = runCommand(
          `gcloud iam service-accounts keys create "${tmpKeyFile}" --iam-account="${serviceAccountEmail}" --project=${projectId}`,
          { silent: attempt < 6 },
        );
        if (keyRes.ok && fs.existsSync(tmpKeyFile)) break;
        if (attempt < 6) {
          log.info(`Menunggu propagasi IAM sebelum membuat kunci JSON (percobaan ${attempt}/6)...`);
          await sleep(4000);
        }
      }
      if (keyRes.ok && fs.existsSync(tmpKeyFile)) {
        const keyJson = JSON.parse(fs.readFileSync(tmpKeyFile, "utf-8"));
        if (keyJson.private_key && keyJson.private_key.includes("BEGIN PRIVATE KEY")) {
          const escaped = keyJson.private_key.replace(/\r?\n/g, "\\n");
          firebasePrivateKey = `"${escaped}"`;
          log.success("Kunci JSON Service Account berhasil dibuat dan diekstrak ke format .env.");
        }
      }
    } catch (err) {
      log.warn(`Gagal memproses kunci Service Account: ${err.message}`);
    } finally {
      if (fs.existsSync(tmpKeyFile)) {
        fs.unlinkSync(tmpKeyFile);
      }
    }
  }

  // ─── STEP 7: Gemini API Key ──────────────────────────────────────────────
  log.step("7. Mengonfigurasi Kunci Gemini API");
  let useMockAi = "false";
  let geminiKey = null;

  if (isRealApiKey(existingBackendEnv.GEMINI_API_KEY)) {
    const reuse = await question(
      `Ditemukan GEMINI_API_KEY yang valid di backend/.env (${maskApiKey(existingBackendEnv.GEMINI_API_KEY)}). Gunakan kembali? (Y/n): `,
    );
    if (reuse.trim().toLowerCase() !== "n") {
      geminiKey = existingBackendEnv.GEMINI_API_KEY;
      log.success("Menggunakan kembali GEMINI_API_KEY dari backend/.env.");
    }
  }

  if (!geminiKey) {
    geminiKey = findOrCreateApiKey({
      displayName: "NusaRoute Gemini Key",
      apiTargets: ["generativelanguage.googleapis.com"],
      projectId,
      serviceAccount: serviceAccountEmail,
    });
  }

  if (!geminiKey) {
    log.warn("Tidak dapat membuat Gemini API Key otomatis via CLI.");
    log.info("Ambil kunci secara manual di: https://aistudio.google.com/apikey");
    const manualKey = (await question("Tempel GEMINI_API_KEY (kosongkan untuk mengaktifkan Mode Simulasi / USE_MOCK_AI=true): ")).trim();
    if (manualKey) {
      geminiKey = manualKey;
    } else {
      useMockAi = "true";
      geminiKey = "your_gemini_api_key_here";
      log.warn("Mode simulasi lokal diaktifkan (USE_MOCK_AI=true).");
    }
  }

  // ─── STEP 8: Google Maps API Key ─────────────────────────────────────────
  log.step("8. Mengonfigurasi Kunci Google Maps API (Maps JS, Routes & Directions)");
  let mapsApiKey = null;
  const existingMapsKey = isRealApiKey(existingBackendEnv.GOOGLE_MAPS_API_KEY)
    ? existingBackendEnv.GOOGLE_MAPS_API_KEY
    : isRealApiKey(existingFrontendEnv.VITE_GOOGLE_MAPS_API_KEY)
      ? existingFrontendEnv.VITE_GOOGLE_MAPS_API_KEY
      : null;

  if (existingMapsKey) {
    const reuse = await question(
      `Ditemukan GOOGLE_MAPS_API_KEY yang valid di file .env (${maskApiKey(existingMapsKey)}). Gunakan kembali? (Y/n): `,
    );
    if (reuse.trim().toLowerCase() !== "n") {
      mapsApiKey = existingMapsKey;
      log.success("Menggunakan kembali GOOGLE_MAPS_API_KEY dari file .env.");
    }
  }

  if (!mapsApiKey) {
    mapsApiKey = findOrCreateApiKey({
      displayName: "NusaRoute Maps Key",
      apiTargets: [
        "maps-backend.googleapis.com",
        "directions-backend.googleapis.com",
        "routes.googleapis.com",
      ],
      projectId,
    });
  }

  if (!mapsApiKey) {
    log.warn("Tidak dapat membuat Google Maps API Key otomatis via CLI.");
    log.info(`Buat di: https://console.cloud.google.com/apis/credentials?project=${projectId}`);
    mapsApiKey = (await question("Tempel GOOGLE_MAPS_API_KEY (atau tekan Enter untuk lewati): ")).trim() || "your_google_maps_api_key_here";
  }

  // ─── STEP 9: Firebase Web App SDK & Google Sign-In Configuration ─────────
  log.step("9. Mengambil Konfigurasi Firebase Web SDK & Login Google");
  let fbConfig = {
    apiKey: null,
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: `${projectId}.appspot.com`,
    messagingSenderId: null,
    appId: null,
  };

  // Ensure Firebase CLI is authenticated and matches the GCP account
  const fbLoginCheck = runCommand("npx --yes firebase-tools login:list");
  const isFirebaseCliLoggedIn =
    fbLoginCheck.ok &&
    fbLoginCheck.stdout &&
    !fbLoginCheck.stdout.toLowerCase().includes("no authorized accounts");

  // Extract currently active Firebase account
  let fbActiveEmail = "";
  if (isFirebaseCliLoggedIn) {
    const match =
      fbLoginCheck.stdout.match(/Logged in as\s+([^\s\r\n]+)/i) ||
      fbLoginCheck.stdout.match(/\*\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (match) {
      fbActiveEmail = match[1].trim();
    }
  }

  const isAccountMismatch =
    isFirebaseCliLoggedIn &&
    fbActiveEmail &&
    account &&
    fbActiveEmail.toLowerCase() !== account.toLowerCase();

  if (!isFirebaseCliLoggedIn) {
    const doFbLogin = await question(
      "Firebase CLI belum login. Login ke Firebase CLI via browser sekarang agar Web SDK & Login Google otomatis terpasang? (Y/n): ",
    );
    if (doFbLogin.trim().toLowerCase() !== "n") {
      try {
        execSync("npx --yes firebase-tools login", { stdio: "inherit" });
      } catch {
        log.warn("Login Firebase CLI dibatalkan atau gagal; melanjutkan dengan fallback gcloud CLI.");
      }
    }
  } else if (isAccountMismatch) {
    log.warn(`Terdeteksi perbedaan akun:`);
    log.warn(` - Akun Google Cloud (Pemilik Project ${projectId}): ${colors.cyan}${account}${colors.reset}`);
    log.warn(` - Akun Firebase CLI aktif: ${colors.yellow}${fbActiveEmail}${colors.reset}`);

    // Check if the GCP account is already authorized in Firebase CLI
    if (fbLoginCheck.stdout.toLowerCase().includes(account.toLowerCase())) {
      log.info(`Mencoba beralih ke akun ${account} di Firebase CLI...`);
      const switchRes = runCommand(`npx --yes firebase-tools login:use ${account}`);
      if (switchRes.ok) {
        log.success(`Berhasil beralih akun Firebase CLI ke: ${account}`);
      } else {
        log.warn(`Gagal beralih otomatis: ${switchRes.stderr}`);
      }
    } else {
      const switchLogin = await question(
        `Firebase CLI perlu login menggunakan akun pemilik project (${colors.cyan}${account}${colors.reset}). Buka browser untuk login sekarang? (Y/n): `,
      );
      if (switchLogin.trim().toLowerCase() !== "n") {
        try {
          log.info(`Melakukan logout dari akun Firebase CLI sebelumnya (${fbActiveEmail})...`);
          try {
            execSync("npx --yes firebase-tools logout", { stdio: "inherit" });
          } catch {
            // Abaikan jika sudah logout
          }
          log.info(`Membuka browser untuk login ke akun ${account}...`);
          execSync("npx --yes firebase-tools login", { stdio: "inherit" });
          log.success("Login Firebase CLI berhasil diperbarui.");
        } catch {
          log.warn("Login Firebase CLI dibatalkan atau gagal; melanjutkan dengan opsi fallback.");
        }
      }
    }
  }

  log.info("Mencoba mengambil konfigurasi Web SDK via Firebase CLI (npx firebase-tools)...");
  const addFbRes = runCommand(`npx --yes firebase-tools projects:addfirebase ${projectId}`);
  if (!addFbRes.ok && addFbRes.stderr && !addFbRes.stderr.includes("already a Firebase project")) {
    log.warn(`Catatan penautan Firebase: ${addFbRes.stderr.split("\n")[0]}`);
  }
  let sdkRes = runCommand(`npx --yes firebase-tools apps:sdkconfig WEB --project ${projectId} --json`);

  if (!sdkRes.ok) {
    // Try registering Web App first if none exists
    const appCreateRes = runCommand(`npx --yes firebase-tools apps:create WEB nusaroute-web --project ${projectId} --json`);
    if (appCreateRes.ok) {
      sdkRes = runCommand(`npx --yes firebase-tools apps:sdkconfig WEB --project ${projectId} --json`);
    }
  }

  if (sdkRes.ok && sdkRes.stdout) {
    try {
      const parsed = JSON.parse(sdkRes.stdout);
      const cfg = parsed?.result?.sdkConfig || parsed?.sdkConfig || parsed;
      if (cfg && cfg.apiKey && cfg.appId) {
        fbConfig = {
          apiKey: cfg.apiKey,
          authDomain: cfg.authDomain || fbConfig.authDomain,
          projectId: cfg.projectId || projectId,
          storageBucket: cfg.storageBucket || fbConfig.storageBucket,
          messagingSenderId: cfg.messagingSenderId || null,
          appId: cfg.appId,
        };
        log.success("Konfigurasi Firebase Web SDK berhasil diambil otomatis via Firebase CLI.");
      }
    } catch {
      // Fall through to gcloud + manual fallback
    }
  }

  // Fallback if Firebase CLI is not logged in
  if (!fbConfig.messagingSenderId) {
    const projNumRes = runCommand(`gcloud projects describe ${projectId} --format="value(projectNumber)"`);
    if (projNumRes.ok && projNumRes.stdout) {
      fbConfig.messagingSenderId = projNumRes.stdout.trim();
    }
  }

  if (!fbConfig.apiKey && isRealApiKey(existingFrontendEnv.VITE_FIREBASE_API_KEY)) {
    fbConfig.apiKey = existingFrontendEnv.VITE_FIREBASE_API_KEY;
    log.success(`Menggunakan kembali VITE_FIREBASE_API_KEY dari frontend/.env.local (${maskApiKey(fbConfig.apiKey)})`);
  }

  if (!fbConfig.apiKey) {
    // Reuse Firebase auto-created browser key if present, else create targeted Firebase Auth/Web API key
    const fbBrowserKey = findOrCreateApiKey({
      displayName: "Browser key (auto created by Firebase)",
      apiTargets: ["identitytoolkit.googleapis.com", "firebase.googleapis.com"],
      projectId,
    });
    fbConfig.apiKey =
      fbBrowserKey ||
      findOrCreateApiKey({
        displayName: "NusaRoute Firebase Web Key",
        apiTargets: ["identitytoolkit.googleapis.com", "firebase.googleapis.com"],
        projectId,
      });
  }

  if (!fbConfig.appId && existingFrontendEnv.VITE_FIREBASE_APP_ID && !existingFrontendEnv.VITE_FIREBASE_APP_ID.includes("000000000000")) {
    fbConfig.appId = existingFrontendEnv.VITE_FIREBASE_APP_ID;
    log.success(`Menggunakan kembali VITE_FIREBASE_APP_ID dari frontend/.env.local (${fbConfig.appId})`);
  }

  if (!fbConfig.appId) {
    log.warn("Web App Firebase belum terdaftar melalui CLI.");
    log.info(`Buka: https://console.firebase.google.com/project/${projectId}/settings/general`);
    const inputAppId = (await question("Tempel Firebase appId (atau tekan Enter untuk melengkapi nanti): ")).trim();
    fbConfig.appId = inputAppId || "1:000000000000:web:0000000000000000";
  }

  const enableGoogleChoice = await question(
    "Aktifkan provider Login Google (Firebase Auth) otomatis via Firebase CLI? (Y/n): ",
  );

  if (enableGoogleChoice.trim().toLowerCase() !== "n") {
    const firebaseJsonPath = path.join(process.cwd(), "firebase.json");
    try {
      const fbJson = fs.existsSync(firebaseJsonPath)
        ? JSON.parse(fs.readFileSync(firebaseJsonPath, "utf-8"))
        : {};
      fbJson.auth = {
        providers: {
          emailPassword: true,
          googleSignIn: {
            oAuthBrandDisplayName: "NusaRoute AI",
            supportEmail: account,
            authorizedRedirectUris: [
              `https://${projectId}.firebaseapp.com/__/auth/handler`,
              "http://localhost:5173",
            ],
          },
        },
      };
      fs.writeFileSync(firebaseJsonPath, JSON.stringify(fbJson, null, 2) + "\n", "utf-8");
      log.info("Menjalankan `npx firebase-tools deploy --only auth`...");
      const authDeploy = runCommand(
        `npx --yes firebase-tools deploy --only auth --project ${projectId}`,
      );
      if (authDeploy.ok) {
        log.success("Provider Login Google berhasil diaktifkan di Firebase Authentication.");
      } else {
        log.warn("Deploy otomatis auth via CLI belum berhasil (Firebase CLI mungkin belum login atau perlu konfirmasi OAuth Consent Screen).");
        log.info(`Aktifkan manual di: https://console.firebase.google.com/project/${projectId}/authentication/providers`);
        log.info("Pastikan 'localhost' ada di Authentication -> Settings -> Authorized domains.");
      }
    } catch (err) {
      log.warn(`Gagal memperbarui konfigurasi auth: ${err.message}`);
    }
  } else {
    log.info("Aktivasi Login Google dilewati. Anda dapat mengaktifkannya kapan saja di Firebase Console.");
  }

  // ─── STEP 10: Write backend/.env & frontend/.env.local ───────────────────
  log.step("10. Menyimpan Berkas Environment & Secret Keamanan");

  const existingApiKey = existingBackendEnv.API_KEY;
  const resolvedApiKey =
    existingApiKey && !existingApiKey.includes("dev") && !existingApiKey.includes("change_me")
      ? existingApiKey
      : crypto.randomBytes(24).toString("hex");

  const existingJwtSecret = existingBackendEnv.JWT_SECRET;
  const resolvedJwtSecret =
    existingJwtSecret && !existingJwtSecret.includes("dev") && !existingJwtSecret.includes("change_me")
      ? existingJwtSecret
      : crypto.randomBytes(32).toString("hex");

  saveEnvFile(backendEnvPath, {
    PORT: "3000",
    NODE_ENV: "development",
    CORS_ORIGIN: "http://localhost:5173",
    API_KEY: resolvedApiKey,
    JWT_SECRET: resolvedJwtSecret,
    JWT_TTL_SECONDS: "43200",
    ENABLE_AUTO_SEED: "true",
    ENABLE_AGENT_LOOP: "true",
    GOOGLE_AUTO_REGISTER: "false",
    GEMINI_API_KEY: geminiKey,
    USE_MOCK_AI: useMockAi,
    GEMINI_MODEL: "gemini-3.8-flash",
    FIREBASE_PROJECT_ID: projectId,
    FIREBASE_CLIENT_EMAIL: serviceAccountEmail,
    FIREBASE_PRIVATE_KEY: firebasePrivateKey || '"-----BEGIN PRIVATE KEY-----\\nYOUR_KEY_HERE\\n-----END PRIVATE KEY-----\\n"',
    GOOGLE_MAPS_API_KEY: mapsApiKey,
  });

  const frontendEnvData = {
    VITE_BACKEND_URL: "http://localhost:3000",
    VITE_FIREBASE_API_KEY: fbConfig.apiKey || "your_api_key_here",
    VITE_FIREBASE_AUTH_DOMAIN: fbConfig.authDomain,
    VITE_FIREBASE_PROJECT_ID: fbConfig.projectId,
    VITE_FIREBASE_STORAGE_BUCKET: fbConfig.storageBucket,
    VITE_FIREBASE_MESSAGING_SENDER_ID: fbConfig.messagingSenderId || "000000000000",
    VITE_FIREBASE_APP_ID: fbConfig.appId,
    VITE_GOOGLE_MAPS_API_KEY: mapsApiKey,
  };
  saveEnvFile(frontendEnvPath, frontendEnvData);
  const frontendAltEnvPath = path.join(process.cwd(), "frontend", ".env");
  if (fs.existsSync(frontendAltEnvPath)) {
    saveEnvFile(frontendAltEnvPath, frontendEnvData);
  }

  // ─── STEP 11: Summary ────────────────────────────────────────────────────
  log.step("11. Setup Selesai");
  console.log(`
Project  : ${projectId}
Account  : ${account}
Files    : backend/.env, frontend/.env.local
Auth     : Dual Login (Username/Password scrypt + Google Sign-In)
Policy   : GOOGLE_AUTO_REGISTER=false (strict — hanya email terdaftar yang boleh login Google)

Langkah berikutnya:
  1. npm run validate     # Verifikasi seluruh variabel .env
  2. npm run user:add -- --email ${account} --name "Admin NusaRoute" --role dispatcher
                          # Daftarkan email Google Anda ke whitelist Firestore
  3. npm run install:all  # Instal dependensi backend & frontend (jika belum)
  4. npm run dev          # Jalankan backend (port 3000) & frontend (port 5173)
`);

  rl.close();
}

setup().catch((error) => {
  log.error(`Setup gagal: ${error.message}`);
  rl.close();
  process.exit(1);
});
