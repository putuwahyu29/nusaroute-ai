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

function check(condition, message) {
  if (condition) {
    console.log(`${colors.green}✓${colors.reset} ${message}`);
    return true;
  } else {
    console.log(`${colors.red}✗${colors.reset} ${message}`);
    return false;
  }
}

function validateEnvFile(filePath, requiredVars) {
  if (!fs.existsSync(filePath)) {
    console.log(`${colors.red}✗${colors.reset} File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"));

  const env = {};
  lines.forEach((line) => {
    const [key, ...rest] = line.split("=");
    env[key] = rest.join("=");
  });

  console.log(`\n${colors.cyan}${path.basename(filePath)}${colors.reset}:`);

  let allValid = true;
  requiredVars.forEach((varName) => {
    const value = env[varName];
    const isValid =
      value &&
      value.trim() !== "" &&
      !value.includes("your_") &&
      !value.includes("xxxxx");

    if (isValid) {
      const displayValue =
        value.length > 40 ? value.substring(0, 40) + "..." : value;
      console.log(
        `  ${colors.green}✓${colors.reset} ${varName}: ${displayValue}`,
      );
    } else {
      console.log(
        `  ${colors.red}✗${colors.reset} ${varName}: ${colors.yellow}NOT SET${colors.reset}`,
      );
      allValid = false;
    }
  });

  return allValid;
}

console.log(`
${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════╗${colors.reset}
${colors.bright}${colors.cyan}║   NusaRoute AI - Configuration Validator               ║${colors.reset}
${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════╝${colors.reset}
`);

let allPassed = true;

// Validate Backend
const backendEnvPath = path.join(__dirname, "backend", ".env");
const backendRequired = [
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "FIREBASE_PROJECT_ID",
];
const backendValid = validateEnvFile(backendEnvPath, backendRequired);
allPassed = allPassed && backendValid;

// Validate Frontend
const frontendEnvPath = path.join(__dirname, "frontend", ".env.local");
const frontendRequired = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_GOOGLE_MAPS_API_KEY",
];
const frontendValid = validateEnvFile(frontendEnvPath, frontendRequired);
allPassed = allPassed && frontendValid;

// Final status
console.log(`\n${colors.bright}${colors.cyan}Status:${colors.reset}`);
if (allPassed) {
  console.log(
    `${colors.green}✓${colors.reset} All configurations are valid! Ready to run.`,
  );
  console.log(`
${colors.cyan}Next steps:${colors.reset}
  npm install  # Install dependencies
  npm run dev  # Start backend
  # (in another terminal)
  npm run dev  # Start frontend
  `);
  process.exit(0);
} else {
  console.log(
    `${colors.red}✗${colors.reset} Some configurations are missing or invalid.`,
  );
  console.log(`
${colors.yellow}Fix missing variables by editing:${colors.reset}
  • backend/.env
  • frontend/.env.local

Or run setup again:
  node setup-config.js
  `);
  process.exit(1);
}
