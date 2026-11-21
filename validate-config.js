#!/usr/bin/env node

/**
 * Validate NusaRoute AI Configuration
 * Checks if all required environment variables are properly set
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function parseEnv(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const env = {};
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  });
  return env;
}

function validateEnvFile(filePath, checks) {
  if (!fs.existsSync(filePath)) {
    console.log(`${colors.red}[ERR]${colors.reset} File tidak ditemukan: ${filePath}`);
    return false;
  }

  const env = parseEnv(filePath);
  console.log(`\n${colors.cyan}${path.relative(__dirname, filePath)}${colors.reset}:`);

  let allValid = true;
  checks.forEach(({ name, validator, optional = false }) => {
    const value = env[name];
    const basicValid =
      Boolean(value) &&
      value.trim() !== "" &&
      !value.includes("your_") &&
      !value.includes("your-") &&
      !value.includes("YOUR_KEY_HERE") &&
      !value.includes("xxxxx") &&
      !value.includes("000000000000");

    const isValid = basicValid && (validator ? validator(value) : true);

    if (isValid) {
      const displayValue =
        name.includes("PRIVATE_KEY")
          ? "[PEM PRIVATE KEY SET]"
          : name === "JWT_SECRET" || name === "API_KEY"
            ? "[SECRET SET]"
            : value.length > 42
              ? value.substring(0, 42) + "..."
              : value;
      console.log(`  ${colors.green}[OK]${colors.reset}   ${name}: ${displayValue}`);
    } else if (optional) {
      console.log(`  ${colors.yellow}[WARN]${colors.reset} ${name}: belum diisi (opsional)`);
    } else {
      const hint =
        name === "FIREBASE_PRIVATE_KEY" && value && !value.includes("BEGIN PRIVATE KEY")
          ? "format tidak valid (harus berisi PEM -----BEGIN PRIVATE KEY-----)"
          : "BELUM DIATUR / PLACEHOLDER";
      console.log(`  ${colors.red}[ERR]${colors.reset}  ${name}: ${colors.yellow}${hint}${colors.reset}`);
      allValid = false;
    }
  });

  return allValid;
}

console.log(`\n${colors.bright}${colors.cyan}NusaRoute AI - Configuration & Runtime Validator${colors.reset}`);

// Validasi runtime Node.js LTS (Non-EOL)
const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
let runtimeValid = true;
if (nodeMajor < 22) {
  console.log(`\nRuntime: ${colors.red}[ERR]${colors.reset} Node.js ${process.version} terdeteksi.`);
  console.log(`  ${colors.yellow}[PERINGATAN]${colors.reset} Node.js 18 dan 20 sudah End-of-Life (EOL).`);
  console.log(`  Gunakan versi Active LTS: Node.js 22 LTS (atau lebih baru).\n`);
  runtimeValid = false;
} else {
  console.log(`Runtime: ${colors.green}[OK]${colors.reset} Node.js ${process.version} (Active LTS / Non-EOL)`);
}

const backendEnvPath = path.join(__dirname, "backend", ".env");
let isMockAI = false;
if (fs.existsSync(backendEnvPath)) {
  const bEnv = parseEnv(backendEnvPath);
  if (bEnv.USE_MOCK_AI === "true") isMockAI = true;
}

const backendChecks = [
  ...(isMockAI ? [] : [{ name: "GEMINI_API_KEY" }]),
  { name: "GEMINI_MODEL" },
  { name: "FIREBASE_PROJECT_ID" },
  { name: "FIREBASE_CLIENT_EMAIL", validator: (v) => v.includes("@") },
  { name: "FIREBASE_PRIVATE_KEY", validator: (v) => v.includes("BEGIN PRIVATE KEY") },
  { name: "JWT_SECRET", optional: true },
  { name: "API_KEY", optional: true },
  { name: "CORS_ORIGIN", optional: true },
];

const backendValid = validateEnvFile(backendEnvPath, backendChecks);
if (isMockAI && fs.existsSync(backendEnvPath)) {
  console.log(`  ${colors.yellow}[INFO]${colors.reset} USE_MOCK_AI=true (mode simulasi aktif; GEMINI_API_KEY opsional)`);
}
if (fs.existsSync(backendEnvPath)) {
  const bEnv = parseEnv(backendEnvPath);
  const autoReg = bEnv.GOOGLE_AUTO_REGISTER === "true";
  console.log(
    `  ${colors.cyan}[INFO]${colors.reset} GOOGLE_AUTO_REGISTER=${autoReg ? "true (auto-register courier)" : "false (strict whitelist — tidak membuat akun baru otomatis)"}`
  );
}

let frontendEnvPath = path.join(__dirname, "frontend", ".env.local");
if (!fs.existsSync(frontendEnvPath)) {
  const altPath = path.join(__dirname, "frontend", ".env");
  if (fs.existsSync(altPath)) frontendEnvPath = altPath;
}

const frontendChecks = [
  { name: "VITE_BACKEND_URL" },
  { name: "VITE_FIREBASE_API_KEY" },
  { name: "VITE_FIREBASE_AUTH_DOMAIN" },
  { name: "VITE_FIREBASE_PROJECT_ID" },
  { name: "VITE_FIREBASE_APP_ID", optional: true },
  { name: "VITE_GOOGLE_MAPS_API_KEY" },
];

const frontendValid = validateEnvFile(frontendEnvPath, frontendChecks);
const allPassed = runtimeValid && backendValid && frontendValid;

console.log(`\n${colors.bright}${colors.cyan}Status:${colors.reset}`);
if (allPassed) {
  console.log(`${colors.green}[OK]${colors.reset} Seluruh konfigurasi valid dan siap dijalankan.\n`);
  console.log(`Langkah berikutnya:`);
  console.log(`  npm run install:all  # Instal seluruh dependensi monorepo`);
  console.log(`  npm run dev          # Jalankan backend (port 3000) & frontend (port 5173)\n`);
  process.exit(0);
} else {
  console.log(`${colors.red}[ERR]${colors.reset} Masih ada variabel konfigurasi yang belum lengkap atau tidak valid.\n`);
  console.log(`Perbaiki file berikut atau jalankan ulang wizard:`);
  console.log(`  - backend/.env`);
  console.log(`  - frontend/.env.local`);
  console.log(`  - npm run setup\n`);
  process.exit(1);
}
