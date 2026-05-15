#!/usr/bin/env node

/**
 * NusaRoute AI - Fully Automated Setup Configuration
 * Uses Google Cloud CLI to auto-retrieve all credentials
 *
 * Requirements:
 * - Google Cloud CLI installed: https://cloud.google.com/sdk/docs/install
 * - Authenticated: gcloud auth login
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) =>
  new Promise((resolve) => rl.question(query, resolve));

// ─── COLORS FOR TERMINAL ─────────────────────────────────────────────────
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
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg) =>
    console.log(`\n${colors.bright}${colors.blue}→ ${msg}${colors.reset}`),
};

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────
function runCommand(cmd, description, silent = false) {
  try {
    if (!silent) {
      log.info(`Retrieving: ${description}...`);
    }
    const result = execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return result;
  } catch (error) {
    const stderr = error?.stderr?.toString().trim();
    const stdout = error?.stdout?.toString().trim();
    const details = stderr || stdout || error.message || "unknown error";
    log.error(`${description} failed: ${details}`);
    return null;
  }
}

function saveEnvFile(filePath, envVars) {
  const content = Object.entries(envVars)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  fs.writeFileSync(filePath, content, "utf-8");
  log.success(`Created: ${filePath}`);
}

function validateEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    log.error(`File not found: ${filePath}`);
    return false;
  }
  log.success(`Verified: ${filePath}`);
  return true;
}

// ─── MAIN SETUP LOGIC ────────────────────────────────────────────────────
async function setup() {
  console.log(`
${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════╗${colors.reset}
${colors.bright}${colors.cyan}║   NusaRoute AI - Fully Automated Setup                 ║${colors.reset}
${colors.bright}${colors.cyan}║   Powered by Google Cloud CLI                          ║${colors.reset}
${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════╝${colors.reset}
  `);

  // Step 1: Check gcloud authentication
  log.step("Step 1: Checking Google Cloud CLI Authentication");
  let account;
  try {
    account = runCommand("gcloud config get-value account", "Account", true);
    if (!account) {
      log.error("Step 1 failed: not authenticated. Run: gcloud auth login");
      process.exit(1);
    }
    log.success(`Authenticated as: ${account}`);
  } catch (error) {
    log.error(
      `Step 1 failed: Google Cloud CLI not installed or not available: ${error.message}`,
    );
    process.exit(1);
  }

  // Step 2: Select or create Google Cloud Project
  log.step("Step 2: Select Google Cloud Project");
  let projectId = runCommand(
    "gcloud config get-value project",
    "Default Project",
    true,
  );

  if (!projectId) {
    log.info("No default project set. Fetching available projects...");
    try {
      const projectsOutput = runCommand(
        'gcloud projects list --format="table[no-heading](projectId,name)" --limit=20',
        "Projects",
        true,
      );

      const projectList = projectsOutput
        ? projectsOutput.split("\n").filter((p) => p.trim())
        : [];

      console.log(`\n${colors.cyan}${colors.bright}Options:${colors.reset}`);
      projectList.forEach((line, idx) => {
        console.log(`  ${colors.cyan}${idx + 1}.${colors.reset} ${line}`);
      });
      console.log(
        `  ${colors.cyan}${projectList.length + 1}.${colors.reset} ${colors.yellow}Create a new project${colors.reset}`,
      );
      console.log(
        `  ${colors.cyan}${projectList.length + 2}.${colors.reset} ${colors.yellow}Enter project ID manually${colors.reset}`,
      );

      const choice = await question(
        `\n${colors.bright}Select option (1-${projectList.length + 2}): ${colors.reset}`,
      );
      const selectedIdx = parseInt(choice) - 1;

      if (selectedIdx === projectList.length) {
        // Create new project
        log.info(
          `Visit: ${colors.cyan}https://console.cloud.google.com/projectcreate${colors.reset}`,
        );
        const openConsole = await question(
          `${colors.bright}Open Google Cloud Console to create new project? (y/n): ${colors.reset}`,
        );

        if (openConsole.toLowerCase() === "y") {
          try {
            const platform = process.platform;
            if (platform === "win32") {
              execSync("start https://console.cloud.google.com/projectcreate");
            } else if (platform === "darwin") {
              execSync('open "https://console.cloud.google.com/projectcreate"');
            } else {
              execSync(
                'xdg-open "https://console.cloud.google.com/projectcreate"',
              );
            }
          } catch (error) {
            log.warn("Could not open browser automatically");
          }
        }

        projectId = await question(
          `${colors.bright}Enter your new project ID: ${colors.reset}`,
        );
        if (!projectId) {
          log.error("Project ID is required");
          process.exit(1);
        }
      } else if (selectedIdx === projectList.length + 1) {
        // Manual entry
        projectId = await question(
          `${colors.bright}Enter project ID: ${colors.reset}`,
        );
        if (!projectId) {
          log.error("Project ID is required");
          process.exit(1);
        }
      } else if (selectedIdx >= 0 && selectedIdx < projectList.length) {
        // Select from list
        projectId = projectList[selectedIdx].split(/\s+/)[0];
      } else {
        log.error("Invalid selection");
        process.exit(1);
      }

      try {
        execSync(`gcloud config set project ${projectId}`, { stdio: "pipe" });
        log.success(`Project set to: ${projectId}`);
      } catch (setProjectError) {
        const details =
          setProjectError?.stderr?.toString().trim() || setProjectError.message;
        log.error(
          `Step 2 failed: unable to set project ${projectId}: ${details}`,
        );
        process.exit(1);
      }
    } catch (error) {
      const details = error?.stderr?.toString().trim() || error.message;
      log.error(`Step 2 failed: unable to fetch projects: ${details}`);
      projectId = await question(
        `${colors.bright}Enter project ID manually: ${colors.reset}`,
      );
      if (!projectId) {
        process.exit(1);
      }
    }
  } else {
    log.success(`Using project: ${projectId}`);
  }

  // Step 3: Auto-generate Gemini API Key
  log.step("Step 3: Configuring Gemini API Key");

  log.info("Enabling AI Platform API...");
  try {
    execSync(
      `gcloud services enable aiplatform.googleapis.com generativelanguage.googleapis.com --project=${projectId}`,
      { stdio: "pipe" },
    );
  } catch (error) {
    const details = error?.stderr?.toString().trim() || error.message;
    log.error(`Step 3 failed: could not enable AI APIs: ${details}`);
  }

  log.info("Creating Gemini API Key...");
  const geminiKeyOutput = runCommand(
    `gcloud services api-keys create --display-name="Gemini API Key" --project=${projectId} --format=json`,
    "Gemini API Key",
    false,
  );

  let geminiKey = null;
  if (geminiKeyOutput) {
    try {
      const geminiKeyJson = JSON.parse(geminiKeyOutput);
      geminiKey = geminiKeyJson.keyString;
    } catch (e) {
      log.warn("Could not parse Gemini API Key from gcloud output");
    }
  }

  if (!geminiKey) {
    log.warn("Could not auto-create Gemini API Key");
    console.log(`
${colors.cyan}Get your Gemini API Key from Google AI Studio:${colors.reset}
${colors.dim}→ Visit: https://aistudio.google.com/apikey${colors.reset}
${colors.dim}→ Click "Get API Key" and copy it${colors.reset}
    `);

    const openStudio = await question(
      `${colors.bright}Open Google AI Studio in browser? (y/n): ${colors.reset}`,
    );

    if (openStudio.toLowerCase() === "y") {
      try {
        const platform = process.platform;
        const url = "https://aistudio.google.com/apikey";
        if (platform === "win32") {
          execSync(`start ${url}`);
        } else if (platform === "darwin") {
          execSync(`open "${url}"`);
        } else {
          execSync(`xdg-open "${url}"`);
        }
        log.info("Opening Google AI Studio...");
      } catch (error) {
        log.warn("Could not open browser automatically");
      }
    }

    geminiKey = await question(
      `${colors.bright}Paste your Gemini API Key: ${colors.reset}`,
    );

    if (!geminiKey) {
      log.error("Gemini API Key is required");
      process.exit(1);
    }
  }

  log.success("Gemini API Key configured");

  // Step 4: Enable required APIs
  log.step("Step 4: Enabling Google Cloud APIs");
  const requiredApis = [
    "firebase.googleapis.com",
    "firestore.googleapis.com",
    "maps-backend.googleapis.com",
    "directions-backend.googleapis.com",
  ];

  for (const api of requiredApis) {
    try {
      runCommand(
        `gcloud services enable ${api} --project=${projectId}`,
        `Enable ${api}`,
      );
    } catch (error) {
      log.warn(`Could not enable ${api} - may already be enabled`);
    }
  }

  // Step 4.5: Verify Firestore database exists
  log.step("Step 4.5: Verifying Firestore Database");
  let firestoreDatabase = runCommand(
    `gcloud firestore databases describe --database="(default)" --project=${projectId} --format="value(name)"`,
    "Firestore default database",
    true,
  );

  if (firestoreDatabase) {
    log.success(`Firestore database ready: ${firestoreDatabase}`);
  } else {
    log.warn(
      "Firestore default database not found. It must be created once in the Google Cloud Console.",
    );
    console.log(`
${colors.cyan}Create your Firestore database:${colors.reset}
${colors.dim}→ Open: https://console.cloud.google.com/firestore/databases?project=${projectId}${colors.reset}
${colors.dim}→ Click 'Create database'${colors.reset}
${colors.dim}→ Choose Firestore Native mode${colors.reset}
${colors.dim}→ Select a location for your data${colors.reset}
${colors.dim}→ After it is created, return here and press Enter to continue${colors.reset}
    `);

    await question(
      `${colors.bright}Press Enter after Firestore database is created: ${colors.reset}`,
    );

    firestoreDatabase = runCommand(
      `gcloud firestore databases describe --database="(default)" --project=${projectId} --format="value(name)"`,
      "Firestore default database verification",
      true,
    );

    if (!firestoreDatabase) {
      log.error(
        "Step 4.5 failed: Firestore database is still not available. Please create it in the Console before continuing.",
      );
      process.exit(1);
    }

    log.success(`Firestore database ready: ${firestoreDatabase}`);
  }

  // Step 5: Auto-create and retrieve Firebase Credentials
  log.step("Step 5: Configuring Firebase Credentials");

  const firebaseProjectId = projectId; // Usually same as GCP project

  log.info("Creating/retrieving Firebase service account...");
  let serviceAccountEmail = runCommand(
    `gcloud iam service-accounts list --project=${projectId} --filter="displayName:firebase" --format="value(email)" --limit=1`,
    "Service Account",
    true,
  );

  if (!serviceAccountEmail) {
    // Create new service account for Firebase
    serviceAccountEmail = `firebase-admin@${projectId}.iam.gserviceaccount.com`;
    try {
      execSync(
        `gcloud iam service-accounts create firebase-admin --display-name="Firebase Admin" --project=${projectId}`,
        { stdio: "pipe" },
      );
      log.success(`Created service account: ${serviceAccountEmail}`);
    } catch (error) {
      const details = error?.stderr?.toString().trim() || error.message;
      log.error(
        `Step 5 failed: could not create service account ${serviceAccountEmail}: ${details}`,
      );
    }
  }

  // Generate and retrieve private key
  let firebasePrivateKey = runCommand(
    `gcloud iam service-accounts keys list --iam-account=${serviceAccountEmail} --project=${projectId} --format="value(name)" --limit=1`,
    "Service Account Key",
    true,
  );

  if (!firebasePrivateKey) {
    // Create new key
    log.info("Creating service account key...");
    const keyFile = path.join(process.cwd(), ".firebase-key.json");
    try {
      execSync(
        `gcloud iam service-accounts keys create ${keyFile} --iam-account=${serviceAccountEmail} --project=${projectId}`,
        { stdio: "pipe" },
      );
      const keyContent = fs.readFileSync(keyFile, "utf-8");
      const keyJson = JSON.parse(keyContent);
      firebasePrivateKey = keyJson.private_key;
      firebasePrivateKey = firebasePrivateKey
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n");
      fs.unlinkSync(keyFile);
      log.success("Firebase service account key created and retrieved");
    } catch (error) {
      const details = error?.stderr?.toString().trim() || error.message;
      log.error(
        `Step 5 failed: could not create service account key for ${serviceAccountEmail}: ${details}`,
      );
      firebasePrivateKey = null;
    }
  }

  // Retrieve Firebase API Key from project
  let firebaseApiKey = runCommand(
    `gcloud services api-keys list --project=${projectId} --filter="displayName:Firebase" --format="value(keyString)" --limit=1`,
    "Firebase API Key",
    true,
  );

  if (!firebaseApiKey) {
    // Create new API key for Firebase
    log.info("Creating Firebase API Key...");
    const fbKeyOutput = runCommand(
      `gcloud services api-keys create --display-name="Firebase Web Key" --project=${projectId} --format=json`,
      "Step 5 Firebase API Key creation",
      true,
    );

    if (fbKeyOutput) {
      try {
        const fbKeyJson = JSON.parse(fbKeyOutput);
        firebaseApiKey = fbKeyJson.keyString || fbKeyJson.name;
      } catch (e) {
        firebaseApiKey = fbKeyOutput;
      }
    }
  }

  if (firebaseApiKey && !firebaseApiKey.startsWith("operations/")) {
    log.success("Firebase credentials configured");
  } else {
    log.error(
      "Step 5 failed: Firebase API Key not available or invalid format",
    );
    firebaseApiKey = null;
  }

  // Step 6: Auto-create and retrieve Google Maps API Key
  log.step("Step 6: Configuring Google Maps API");

  log.info("Creating/retrieving Google Maps API Key...");
  let mapsApiKey = runCommand(
    `gcloud services api-keys list --project=${projectId} --filter="displayName:Maps" --format="value(keyString)" --limit=1`,
    "Maps API Key",
    true,
  );

  if (!mapsApiKey) {
    // Create new API key for Maps
    log.info("Creating Google Maps API Key...");
    const mapsKeyOutput = runCommand(
      `gcloud services api-keys create --display-name="Google Maps Web Key" --project=${projectId} --format=json`,
      "Step 6 Google Maps API Key creation",
      true,
    );

    if (mapsKeyOutput) {
      try {
        const mapsKeyJson = JSON.parse(mapsKeyOutput);
        mapsApiKey = mapsKeyJson.keyString || mapsKeyJson.name;
      } catch (e) {
        mapsApiKey = mapsKeyOutput;
      }
    }
  }

  if (mapsApiKey && !mapsApiKey.startsWith("operations/")) {
    log.success("Google Maps API Key configured");
  } else {
    log.error(
      "Step 6 failed: Google Maps API Key not available or invalid format",
    );
    mapsApiKey = null;
  }

  // Step 7: Auto-retrieve Firebase Messaging Credentials
  log.step("Step 7: Retrieving Firebase Messaging Credentials");

  // Auto-retrieve Firebase Sender ID (Project Number)
  let messagingSenderId = runCommand(
    `gcloud projects describe ${firebaseProjectId} --format="value(projectNumber)"`,
    "Firebase Project Number",
    true,
  );

  if (!messagingSenderId) {
    log.warn("Could not auto-retrieve Firebase Sender ID");
    console.log(`
${colors.cyan}Get your Firebase Sender ID (Project Number):${colors.reset}
${colors.dim}→ Visit: https://console.firebase.google.com/project/${firebaseProjectId}${colors.reset}
${colors.dim}→ Go to: Project Settings → General${colors.reset}
${colors.dim}→ Copy the 'Project Number'${colors.reset}
    `);
    messagingSenderId = await question(
      `${colors.bright}Paste your Firebase Sender ID (or press Enter to skip): ${colors.reset}`,
    );
    if (!messagingSenderId) {
      messagingSenderId = null;
    }
  }

  if (messagingSenderId) {
    log.success(`Firebase Sender ID retrieved: ${messagingSenderId}`);
  } else {
    log.warn("Firebase Sender ID not available");
  }

  // Auto-retrieve or prompt for App ID
  log.info("Note: Firebase App ID must be obtained from Firebase Console");
  console.log(`
${colors.cyan}Get your Firebase App ID:${colors.reset}
${colors.dim}→ Visit: https://console.firebase.google.com/project/${firebaseProjectId}${colors.reset}
${colors.dim}→ Go to: Project Settings → Your apps → Web app${colors.reset}
${colors.dim}→ Copy the 'appId' value${colors.reset}
  `);

  let appId = await question(
    `${colors.bright}Paste your Firebase App ID (or press Enter to skip): ${colors.reset}`,
  );

  if (!appId) {
    log.warn("Firebase App ID not provided - you can add manually later");
    appId = null;
  } else {
    log.success(`Firebase App ID configured`);
  }

  // Step 8: Create Backend .env
  log.step("Step 8: Creating Backend Configuration");

  const backendEnv = {
    NODE_ENV: "development",
    GEMINI_API_KEY: geminiKey,
    GEMINI_MODEL: "gemini-2.5-flash-preview-05-20",
    FIREBASE_PROJECT_ID: firebaseProjectId,
    FIREBASE_CLIENT_EMAIL: serviceAccountEmail,
    FIREBASE_PRIVATE_KEY: firebasePrivateKey,
    PORT: "3000",
    USE_MOCK_AI: "false",
  };

  const backendEnvPath = path.join(process.cwd(), "backend", ".env");
  saveEnvFile(backendEnvPath, backendEnv);

  // Step 9: Create Frontend .env.local
  log.step("Step 9: Creating Frontend Configuration");

  const frontendEnv = {
    VITE_FIREBASE_API_KEY: firebaseApiKey,
    VITE_FIREBASE_AUTH_DOMAIN: `${firebaseProjectId}.firebaseapp.com`,
    VITE_FIREBASE_PROJECT_ID: firebaseProjectId,
    VITE_FIREBASE_STORAGE_BUCKET: `${firebaseProjectId}.appspot.com`,
    VITE_FIREBASE_MESSAGING_SENDER_ID: messagingSenderId,
    VITE_FIREBASE_APP_ID: appId,
    VITE_GOOGLE_MAPS_API_KEY: mapsApiKey,
    VITE_API_BASE_URL: "http://localhost:3000",
  };

  const frontendEnvPath = path.join(process.cwd(), "frontend", ".env.local");
  saveEnvFile(frontendEnvPath, frontendEnv);

  // Step 10: Validation
  log.step("Step 10: Validating Configuration");

  const backendValid = validateEnvFile(backendEnvPath);
  const frontendValid = validateEnvFile(frontendEnvPath);

  if (backendValid && frontendValid) {
    log.success("All configurations created successfully! ✨");

    console.log(`
${colors.bright}${colors.green}╔════════════════════════════════════════════════════════╗${colors.reset}
${colors.bright}${colors.green}║              Setup Complete! 🚀                        ║${colors.reset}
${colors.bright}${colors.green}╚════════════════════════════════════════════════════════╝${colors.reset}

${colors.bright}Project: ${colors.cyan}${projectId}${colors.reset}
${colors.bright}Account: ${colors.cyan}${account}${colors.reset}

${colors.bright}Next Steps:${colors.reset}

1. ${colors.cyan}Validate Configuration${colors.reset}
   npm run validate

2. ${colors.bright}Install Dependencies${colors.reset}
   npm install:all

3. ${colors.bright}Start Development${colors.reset}
   npm run dev

${colors.yellow}⚠ Important Notes:${colors.reset}
   • Keep .env files out of version control (already in .gitignore)
   • Files created:
     ✓ backend/.env
     ✓ frontend/.env.local
   • Update Firebase Sender ID & App ID manually if not provided
    `);
  } else {
    log.error("Some configurations failed to create");
    process.exit(1);
  }

  rl.close();
}

// ─── RUN SETUP ──────────────────────────────────────────────────────────
setup().catch((error) => {
  log.error(`Setup failed: ${error.message}`);
  process.exit(1);
});
