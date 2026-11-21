import fs from "fs";
import path from "path";
import { APP_CONFIG } from "../config/app-config.js";
import { processIncidentReport } from "../services/ai-agent.js";

async function runIncidentTest() {
  console.log("==================================================");
  console.log(`TESTING ${APP_CONFIG.geminiModel.toUpperCase()} (${APP_CONFIG.useMockAi ? "SIMULATION" : "LIVE"}): MULTIMODAL INCIDENT`);
  console.log("==================================================\n");

  const startTime = Date.now();
  // Gunakan foto insiden nyata dari test-fixtures
  const candidatePaths = [
    { p: path.resolve(process.cwd(), "test-fixtures/sample-incident.jpg"), mime: "image/jpeg" },
    { p: path.resolve(process.cwd(), "test-fixtures/sample-incident-traffic.jpg"), mime: "image/jpeg" },
    { p: path.resolve(process.cwd(), "test-fixtures/sample-incident-flood.jpg"), mime: "image/jpeg" },
    { p: path.resolve(process.cwd(), "../test-fixtures/sample-incident.jpg"), mime: "image/jpeg" },
    { p: path.resolve(process.cwd(), "../test-fixtures/sample-incident-traffic.jpg"), mime: "image/jpeg" },
    { p: path.resolve(process.cwd(), "frontend/public/samples/sample-incident.jpg"), mime: "image/jpeg" },
    { p: path.resolve(process.cwd(), "../frontend/public/samples/sample-incident.jpg"), mime: "image/jpeg" },
  ];

  let photoBuffer: Buffer | null = null;
  let photoMime = "image/jpeg";

  for (const item of candidatePaths) {
    if (fs.existsSync(item.p)) {
      photoBuffer = fs.readFileSync(item.p);
      photoMime = item.mime;
      console.log(`📸 Memuat foto insiden nyata: ${path.basename(item.p)} (${photoBuffer.length} bytes)\n`);
      break;
    }
  }

  if (!photoBuffer) {
    console.log("ℹ️ Foto insiden tidak ditemukan, menggunakan 1x1 placeholder...");
    photoBuffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    photoMime = "image/png";
  }

  try {
    const decision = await processIncidentReport(photoBuffer, null, photoMime);
    const duration = Date.now() - startTime;

    console.log("✅ HASIL ANALISIS INSIDEN (JSON):");
    console.log(JSON.stringify(decision, null, 2));
    console.log(`\n⏱️ Total Waktu: ${duration} ms`);
    console.log(`🤖 Model: ${decision.model}`);
    console.log(`🚦 Rekomendasi Aksi: ${decision.action}`);
    console.log(`📍 Rute Pengalihan: ${decision.reroutePoints?.join(" -> ") || "N/A"}`);
  } catch (error: any) {
    console.error("\n❌ Gagal menganalisis insiden dengan Gemini AI:");
    console.error("   Detail Error:", error?.message || error);
    process.exit(1);
  }
}

runIncidentTest();
