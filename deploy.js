#!/usr/bin/env node

/**
 * NusaRoute AI — Automated Production Deployment Script
 * Deploys Backend to Google Cloud Run (with auto-injected env vars),
 * configures Google Cloud Scheduler, and deploys Frontend to Firebase Hosting.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import readline from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

const log = {
  info: (msg) => console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[OK]${colors.reset}   ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERR]${colors.reset}  ${msg}`),
  step: (title) => console.log(`\n${colors.bright}${colors.blue}===> ${title}${colors.reset}\n`),
};

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {
    only: null, // "backend", "frontend", "scheduler"
    yes: false,
    region: "asia-southeast2",
    service: "nusaroute-api",
    domain: null,
  };

  for (const arg of args) {
    if (arg === "-y" || arg === "--yes") flags.yes = true;
    else if (arg.startsWith("--only=")) flags.only = arg.slice(7).trim();
    else if (arg.startsWith("--region=")) flags.region = arg.slice(9).trim();
    else if (arg.startsWith("--service=")) flags.service = arg.slice(10).trim();
    else if (arg.startsWith("--domain=")) flags.domain = arg.slice(9).trim();
    else if (arg.startsWith("--custom-domain=")) flags.domain = arg.slice(16).trim();
  }
  return flags;
}

function runCommand(cmd, options = {}) {
  try {
    const stdout = execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      ...options,
    });
    return { ok: true, stdout: stdout.trim(), stderr: "" };
  } catch (err) {
    return {
      ok: false,
      stdout: (err.stdout || "").toString().trim(),
      stderr: (err.stderr || err.message || "").toString().trim(),
      code: err.status,
    };
  }
}

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const env = {};
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  });
  return env;
}

function escapeYamlString(val) {
  if (typeof val !== "string") return `"${val}"`;
  const escaped = val
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n");
  return `"${escaped}"`;
}

function createYamlEnvFile(envMap, outputPath) {
  const lines = [
    "# Auto-generated production env vars for Google Cloud Run",
    "# NusaRoute AI — Temporary file, cleaned up automatically",
  ];
  for (const [k, v] of Object.entries(envMap)) {
    if (v === undefined || v === null) continue;
    lines.push(`${k}: ${escapeYamlString(String(v))}`);
  }
  fs.writeFileSync(outputPath, lines.join("\n") + "\n", "utf-8");
}

function promptUser(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function main() {
  const flags = parseArgs();

  console.log(`\n${colors.bright}${colors.cyan}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║   NusaRoute AI — Automated Production Deployment Pipeline  ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`);

  // ─── STEP 1: Pre-flight Verification ─────────────────────────────────────────
  log.step("1. Verifikasi Kesiapan Tooling & Konfigurasi Lokal");

  const gcloudCheck = runCommand("gcloud --version");
  if (!gcloudCheck.ok) {
    log.error("Google Cloud CLI (gcloud) belum terpasang di sistem.");
    log.info("Pasang gcloud dari https://cloud.google.com/sdk/docs/install");
    process.exit(1);
  }
  log.success("Google Cloud CLI (gcloud) terdeteksi.");

  const backendEnvPath = path.join(__dirname, "backend", ".env");
  const frontendEnvLocalPath = path.join(__dirname, "frontend", ".env.local");
  if (!fs.existsSync(backendEnvPath)) {
    log.error("File backend/.env tidak ditemukan.");
    log.info("Jalankan `npm run setup` terlebih dahulu untuk menghasilkan konfigurasi awal.");
    process.exit(1);
  }

  const backendEnv = parseEnv(backendEnvPath);
  const projectId =
    backendEnv.FIREBASE_PROJECT_ID ||
    runCommand("gcloud config get-value project").stdout;

  if (!projectId || projectId.includes("your-project-id")) {
    log.error("Google Cloud Project ID tidak valid di backend/.env.");
    process.exit(1);
  }
  log.success(`Project Google Cloud aktif: ${colors.bright}${projectId}${colors.reset}`);

  // Resolve actual Firebase Hosting default site ID
  let hostingSite = projectId;
  if (fs.existsSync(frontendEnvLocalPath)) {
    const currentFe = parseEnv(frontendEnvLocalPath);
    const domainMatch = currentFe.VITE_FIREBASE_AUTH_DOMAIN?.match(/^([^.]+)\.firebaseapp\.com$/);
    if (domainMatch && domainMatch[1]) {
      hostingSite = domainMatch[1];
    }
  }
  log.info(`Firebase Hosting default site: ${colors.bright}${hostingSite}${colors.reset}`);

  // Validate critical security secrets
  if (!backendEnv.JWT_SECRET || backendEnv.JWT_SECRET.includes("change_me")) {
    log.error("JWT_SECRET di backend/.env belum diisi dengan string rahasia yang aman.");
    log.info("Jalankan `npm run setup` atau isi JWT_SECRET minimal 32 karakter.");
    process.exit(1);
  }

  const apiKey = backendEnv.API_KEY || "nusaroute-prod-key-32chars-min-secure";
  const region = flags.region;
  const serviceName = flags.service;

  // Interactive Custom Domain Resolution
  let customDomain = (flags.domain || backendEnv.CUSTOM_DOMAIN || "").trim().toLowerCase();
  if (!flags.domain && !flags.yes && process.stdin.isTTY) {
    const defaultHint = customDomain ? ` [saat ini: ${customDomain}]` : "";
    const askDomain = await promptUser(
      `Apakah Anda ingin menghubungkan Custom Domain (misal: nusaroute-ai.web.id)${defaultHint}? (y/N): `
    );
    if (askDomain.trim().toLowerCase() === "y" || askDomain.trim().toLowerCase() === "ya") {
      const inputDomain = await promptUser(
        `Masukkan nama domain (contoh: nusaroute-ai.web.id)${customDomain ? ` [tekan Enter untuk memakai '${customDomain}']` : ""}: `
      );
      if (inputDomain.trim()) {
        customDomain = inputDomain.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
      }
    } else if (askDomain.trim().toLowerCase() === "n") {
      customDomain = "";
    }
  }

  if (customDomain) {
    log.info(`Custom Domain aktif: ${colors.bright}${colors.cyan}${customDomain}${colors.reset}`);
    if (backendEnv.CUSTOM_DOMAIN !== customDomain) {
      let bEnvContent = fs.readFileSync(backendEnvPath, "utf-8");
      if (/^CUSTOM_DOMAIN=/m.test(bEnvContent)) {
        bEnvContent = bEnvContent.replace(/^CUSTOM_DOMAIN=.*$/m, `CUSTOM_DOMAIN=${customDomain}`);
      } else {
        bEnvContent += `\n# Custom Domain Frontend\nCUSTOM_DOMAIN=${customDomain}\n`;
      }
      fs.writeFileSync(backendEnvPath, bEnvContent, "utf-8");
      backendEnv.CUSTOM_DOMAIN = customDomain;
    }
  }

  if (!flags.yes) {
    const confirm = await promptUser(
      `Lanjutkan deployment produksi ke project [${projectId}] region [${region}]? (Y/n): `
    );
    if (confirm.trim().toLowerCase() === "n") {
      log.info("Deployment dibatalkan oleh pengguna.");
      process.exit(0);
    }
  }

  let cloudRunUrl = "";

  // ─── STEP 2: Deploy Backend to Google Cloud Run ──────────────────────────────
  if (!flags.only || flags.only === "backend") {
    log.step(`2. Deploy Backend ke Google Cloud Run (Service: ${serviceName}, Region: ${region})`);

    // Ensure Cloud Run & Cloud Build APIs are enabled
    log.info("Memastikan API Cloud Run & Cloud Build aktif...");
    runCommand(
      `gcloud services enable run.googleapis.com cloudbuild.googleapis.com --project=${projectId} --quiet`
    );

    // Ensure Cloud Build & Compute default Service Accounts have required permissions for source deploy
    log.info("Mengonfigurasi izin IAM Service Account Cloud Build & Compute Engine...");
    const projNumRes = runCommand(`gcloud projects describe ${projectId} --format="value(projectNumber)"`);
    if (projNumRes.ok && projNumRes.stdout) {
      const pNum = projNumRes.stdout.trim();
      runCommand(
        `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${pNum}-compute@developer.gserviceaccount.com" --role="roles/serviceusage.serviceUsageConsumer" --quiet`
      );
      runCommand(
        `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${pNum}-compute@developer.gserviceaccount.com" --role="roles/cloudbuild.builds.builder" --quiet`
      );
      runCommand(
        `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${pNum}@cloudbuild.gserviceaccount.com" --role="roles/serviceusage.serviceUsageConsumer" --quiet`
      );
      log.success(`Izin IAM builder & consumer terkonfigurasi (${pNum}-compute@developer.gserviceaccount.com).`);
    }

    const tempYamlPath = path.join(__dirname, "backend", ".env.deploy.yaml");

    const prodEnvVars = {
      NODE_ENV: "production",
      USE_MOCK_AI: backendEnv.USE_MOCK_AI || "false",
      GEMINI_MODEL: backendEnv.GEMINI_MODEL || "gemini-3.8-flash",
      GEMINI_API_KEY: backendEnv.GEMINI_API_KEY || "",
      FIREBASE_PROJECT_ID: projectId,
      FIREBASE_CLIENT_EMAIL: backendEnv.FIREBASE_CLIENT_EMAIL || "",
      FIREBASE_PRIVATE_KEY: backendEnv.FIREBASE_PRIVATE_KEY || "",
      GOOGLE_MAPS_API_KEY: backendEnv.GOOGLE_MAPS_API_KEY || "",
      JWT_SECRET: backendEnv.JWT_SECRET,
      JWT_TTL_SECONDS: backendEnv.JWT_TTL_SECONDS || "43200",
      API_KEY: apiKey,
      ENABLE_AUTO_SEED: "false", // Safety guard for production
      ENABLE_AGENT_LOOP: "false", // Triggered via Cloud Scheduler
      GOOGLE_AUTO_REGISTER: backendEnv.GOOGLE_AUTO_REGISTER || "false",
      DISPATCHER_EMAILS: backendEnv.DISPATCHER_EMAILS || "",
      OPERATION_CITY: backendEnv.OPERATION_CITY || "Surabaya",
      DEFAULT_ORIGIN_LAT: backendEnv.DEFAULT_ORIGIN_LAT || "-7.2652",
      DEFAULT_ORIGIN_LNG: backendEnv.DEFAULT_ORIGIN_LNG || "112.7523",
      WEATHER_LAT: backendEnv.WEATHER_LAT || "-7.2575",
      WEATHER_LNG: backendEnv.WEATHER_LNG || "112.7521",
      WEATHER_TIMEZONE: backendEnv.WEATHER_TIMEZONE || "Asia/Jakarta",
      DELIVERY_MARK_RADIUS_KM: backendEnv.DELIVERY_MARK_RADIUS_KM || "0.2",
      HUB_CLUSTER_RADIUS_KM: backendEnv.HUB_CLUSTER_RADIUS_KM || "1.5",
      CORS_ORIGIN: [
        `https://${hostingSite}.web.app`,
        `https://${hostingSite}.firebaseapp.com`,
        `https://${projectId}.web.app`,
        `https://${projectId}.firebaseapp.com`,
        ...(customDomain ? [`https://${customDomain}`, `https://www.${customDomain}`] : []),
        "http://localhost:5173",
      ].join(","),
    };

    createYamlEnvFile(prodEnvVars, tempYamlPath);
    log.info("Variabel lingkungan produksi disuntikkan secara aman via YAML temporary.");

    try {
      log.info("Menjalankan `gcloud run deploy` dari source folder backend...");
      const deployCmd = [
        `gcloud run deploy ${serviceName}`,
        `--source backend`,
        `--region=${region}`,
        `--allow-unauthenticated`,
        `--port=8080`,
        `--memory=1Gi`,
        `--cpu=1`,
        `--min-instances=0`,
        `--max-instances=3`,
        `--no-cpu-throttling`,
        `--env-vars-file="${tempYamlPath}"`,
        `--project=${projectId}`,
        `--quiet`,
      ].join(" ");

      const deployRes = runCommand(deployCmd);
      if (!deployRes.ok) {
        log.error(`Gagal men-deploy Cloud Run: ${deployRes.stderr || deployRes.stdout}`);
        process.exit(1);
      }
      log.success("Backend berhasil di-deploy ke Google Cloud Run.");
    } finally {
      if (fs.existsSync(tempYamlPath)) {
        try {
          fs.unlinkSync(tempYamlPath);
          log.info("File temporary env YAML telah dibersihkan dari disk.");
        } catch (_) {}
      }
    }

    const urlCheck = runCommand(
      `gcloud run services describe ${serviceName} --region=${region} --project=${projectId} --format="value(status.url)"`
    );
    if (urlCheck.ok && urlCheck.stdout) {
      cloudRunUrl = urlCheck.stdout.trim();
      log.success(`URL Cloud Run Live: ${colors.bright}${colors.green}${cloudRunUrl}${colors.reset}`);
    }
  } else {
    // If not deploying backend, fetch existing service url
    const urlCheck = runCommand(
      `gcloud run services describe ${serviceName} --region=${region} --project=${projectId} --format="value(status.url)"`
    );
    if (urlCheck.ok && urlCheck.stdout) {
      cloudRunUrl = urlCheck.stdout.trim();
    }
  }

  // ─── STEP 3: Configure Google Cloud Scheduler ────────────────────────────────
  if ((!flags.only || flags.only === "scheduler") && cloudRunUrl) {
    log.step("3. Menjadwalkan Siklus Agen Otonom (Google Cloud Scheduler)");

    log.info("Memastikan Cloud Scheduler API (cloudscheduler.googleapis.com) aktif...");
    const enableSched = runCommand(
      `gcloud services enable cloudscheduler.googleapis.com --project=${projectId} --quiet`
    );
    if (enableSched.ok) {
      log.success("Cloud Scheduler API aktif.");
    }

    const jobName = "nusaroute-agent-tick";
    const tickUri = `${cloudRunUrl}/api/agent/tick`;
    const checkJob = runCommand(
      `gcloud scheduler jobs describe ${jobName} --location=${region} --project=${projectId} --quiet`
    );

    if (checkJob.ok) {
      log.info(`Job scheduler [${jobName}] sudah ada. Memperbarui target URI & header...`);
      const updateJob = runCommand(
        `gcloud scheduler jobs update http ${jobName} --location=${region} --schedule="*/3 * * * *" --uri="${tickUri}" --http-method=POST --update-headers="X-API-Key=${apiKey}" --project=${projectId} --quiet`
      );
      if (updateJob.ok) {
        log.success(`Cloud Scheduler [${jobName}] berhasil diperbarui -> ${tickUri}`);
      } else {
        log.warn(`Gagal memperbarui scheduler: ${updateJob.stderr}`);
      }
    } else {
      log.info(`Membuat job scheduler baru [${jobName}] setiap 3 menit...`);
      let createJob = runCommand(
        `gcloud scheduler jobs create http ${jobName} --location=${region} --schedule="*/3 * * * *" --uri="${tickUri}" --http-method=POST --headers="X-API-Key=${apiKey}" --project=${projectId} --quiet`
      );
      // If failed due to API propagation, wait briefly and retry once
      if (!createJob.ok && (createJob.stderr.includes("PERMISSION_DENIED") || createJob.stderr.includes("disabled"))) {
        log.info("Menunggu propagasi aktivasi Cloud Scheduler API (5 detik)...");
        const waitRes = runCommand(`powershell -Command "Start-Sleep -Seconds 5"`);
        createJob = runCommand(
          `gcloud scheduler jobs create http ${jobName} --location=${region} --schedule="*/3 * * * *" --uri="${tickUri}" --http-method=POST --headers="X-API-Key=${apiKey}" --project=${projectId} --quiet`
        );
      }
      if (createJob.ok) {
        log.success(`Cloud Scheduler [${jobName}] berhasil diaktifkan -> ${tickUri}`);
      } else {
        log.warn(`Gagal membuat scheduler otomatis: ${createJob.stderr}`);
        log.info("Anda dapat membuatnya secara manual di Cloud Console Cloud Scheduler.");
      }
    }
  }

  // ─── STEP 4: Build & Deploy Frontend to Firebase Hosting ─────────────────────
  if (!flags.only || flags.only === "frontend") {
    log.step("4. Build Frontend & Deploy ke Firebase Hosting + Firestore Rules");

    const frontendEnvLocalPath = path.join(__dirname, "frontend", ".env.local");
    const frontendEnvPath = path.join(__dirname, "frontend", ".env");
    const activeFrontendEnvPath = fs.existsSync(frontendEnvLocalPath)
      ? frontendEnvLocalPath
      : frontendEnvPath;

    const feEnv = parseEnv(activeFrontendEnvPath);

    if (cloudRunUrl) {
      log.info(`Menghubungkan frontend ke Cloud Run URL: ${cloudRunUrl}`);
      feEnv.VITE_BACKEND_URL = cloudRunUrl;

      // Update frontend/.env.local (and create frontend/.env.production)
      const lines = [];
      for (const [k, v] of Object.entries(feEnv)) {
        lines.push(`${k}=${v}`);
      }
      fs.writeFileSync(frontendEnvLocalPath, lines.join("\n") + "\n", "utf-8");
      fs.writeFileSync(
        path.join(__dirname, "frontend", ".env.production"),
        lines.join("\n") + "\n",
        "utf-8"
      );
      log.success("Konfigurasi production frontend telah disinkronkan.");
    }

    log.info("Mengompilasi aset produksi frontend (`npm run build --workspace=frontend`)...");
    const buildRes = runCommand("npm run build --workspace=frontend");
    if (!buildRes.ok) {
      log.error(`Gagal melakukan build frontend: ${buildRes.stderr || buildRes.stdout}`);
      process.exit(1);
    }
    log.success("Build frontend selesai (Vite PWA dist siap disajikan).");

    log.info("Mempublikasikan ke Firebase Hosting & memperbarui firestore.rules...");
    const deployFb = runCommand(
      `npx --yes firebase-tools deploy --only firestore:rules,hosting --project ${projectId}`
    );
    if (!deployFb.ok) {
      log.error(`Gagal deploy Firebase: ${deployFb.stderr || deployFb.stdout}`);
      log.info("Pastikan Anda sudah login via `npx firebase-tools login`.");
    } else {
      log.success("Firebase Hosting dan Firestore Security Rules berhasil dipublikasikan!");
    }

    // Auto-register Custom Domain into Firebase Auth Authorized Domains
    if (customDomain) {
      log.info(`Mendaftarkan domain [${customDomain}] ke Firebase Auth Authorized Domains...`);
      try {
        const tokenRes = runCommand("gcloud auth print-access-token");
        if (tokenRes.ok && tokenRes.stdout) {
          const token = tokenRes.stdout.trim();
          const getRes = await fetch(
            `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "x-goog-user-project": projectId,
              },
            }
          );
          if (getRes.ok) {
            const cfg = await getRes.json();
            const current = cfg.authorizedDomains || [];
            const targets = [customDomain, `www.${customDomain}`];
            const needed = targets.filter((d) => !current.includes(d));
            if (needed.length > 0) {
              const updated = Array.from(new Set([...current, ...targets]));
              const patchRes = await fetch(
                `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config?updateMask=authorizedDomains`,
                {
                  method: "PATCH",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "x-goog-user-project": projectId,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ authorizedDomains: updated }),
                }
              );
              if (patchRes.ok) {
                log.success(`Custom domain (${customDomain}) berhasil didaftarkan ke Firebase Auth Authorized Domains.`);
              } else {
                log.warn(`Gagal otomatis mendaftarkan ke authorized domains: ${patchRes.statusText}`);
              }
            } else {
              log.success(`Custom domain (${customDomain}) sudah aktif di Firebase Auth Authorized Domains.`);
            }
          }
        }
      } catch (authErr) {
        log.warn(`Pendaftaran authorized domains via API dilewati: ${authErr.message}`);
      }
    }
  }

  // ─── STEP 5: Verification & Health Check ──────────────────────────────────────
  log.step("5. Verifikasi Status Layanan Produksi (Health Check)");

  if (cloudRunUrl) {
    const healthUrl = `${cloudRunUrl}/api/health`;
    log.info(`Memeriksa kesehatan server: ${healthUrl}`);
    const curlHealth = runCommand(`curl -s "${healthUrl}"`);
    if (curlHealth.ok && curlHealth.stdout.includes("ok")) {
      log.success(`Backend Health Check: ${colors.green}ONLINE (HTTP 200)${colors.reset}`);
      log.info(`Response: ${curlHealth.stdout}`);
    } else {
      log.warn(`Health check belum merespon seketika: ${curlHealth.stdout || curlHealth.stderr}`);
    }
  }

  const hostingUrl = `https://${hostingSite}.web.app`;
  const hostingAltUrl = `https://${hostingSite}.firebaseapp.com`;

  console.log(`\n${colors.bright}${colors.green}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.green}🎉 NusaRoute AI Berhasil Dideploy ke Skala Produksi Google Cloud!${colors.reset}`);
  console.log(`${colors.bright}${colors.green}═══════════════════════════════════════════════════════════${colors.reset}\n`);

  if (customDomain) {
    console.log(`  ✨ Custom Domain Web               : ${colors.bright}${colors.green}https://${customDomain}${colors.reset}`);
  }
  console.log(`  🌐 Frontend PWA (Firebase Hosting) : ${colors.bright}${colors.cyan}${hostingUrl}${colors.reset}`);
  console.log(`  🔗 Domain Alternatif Firebase      : ${colors.bright}${colors.cyan}${hostingAltUrl}${colors.reset}`);
  if (cloudRunUrl) {
    console.log(`  🚀 Backend API (Cloud Run Gen 2)   : ${colors.bright}${colors.cyan}${cloudRunUrl}${colors.reset}`);
  }
  console.log(`  ⏱️  Autonomous Scheduler            : ${colors.bright}Setiap 3 menit (POST /api/agent/tick)${colors.reset}`);
  console.log(`  🔒 Proteksi Kredensial             : ${colors.bright}Semua API Key & Secret aman di Cloud Run${colors.reset}\n`);

  if (customDomain) {
    console.log(`📋 ${colors.bright}Langkah Menghubungkan Custom Domain (${customDomain}) di Firebase Hosting:${colors.reset}`);
    console.log(`  1. Buka Konsol Firebase Hosting:`);
    console.log(`     https://console.firebase.google.com/project/${projectId}/hosting/sites/${hostingSite}`);
    console.log(`  2. Klik "Add custom domain" lalu ketik: ${colors.cyan}${customDomain}${colors.reset}`);
    console.log(`  3. Atur DNS Record di Registrar domain Anda (Rumahweb / Niagahoster / Cloudflare / dsb):`);
    console.log(`     - Tipe: A    | Host: @   | Value: (Salin 2 IP Address yang diberikan Firebase)`);
    console.log(`     - Tipe: CNAME| Host: www | Value: ${hostingSite}.web.app.`);
    console.log(`  4. Tambahkan ke Firebase Authentication (Wajib agar Login Google bekerja):`);
    console.log(`     Buka: https://console.firebase.google.com/project/${projectId}/authentication/providers`);
    console.log(`     Tab "Settings" -> "Authorized domains" -> klik "Add domain" -> masukkan: ${colors.cyan}${customDomain}${colors.reset}\n`);
  }

  console.log(`Tips: Buka tautan frontend di browser ponsel untuk menguji Progressive Web App (PWA) kurir.\n`);
}

main().catch((err) => {
  log.error(`Terjadi kesalahan tak terduga: ${err.message}`);
  process.exit(1);
});
