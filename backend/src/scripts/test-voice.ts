import fs from "fs";
import path from "path";
import { APP_CONFIG } from "../config/app-config.js";
import { processIncidentReport } from "../services/ai-agent.js";

// Menghasilkan buffer audio WAV PCM valid (2 detik, mono, 8kHz, 440Hz tone)
function generateSampleWav(durationSec = 2, sampleRate = 8000, freq = 440): Buffer {
  const numSamples = durationSec * sampleRate;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Tulis sampel gelombang audio
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t) * 16000;
    buffer.writeInt16LE(Math.round(sample), 44 + i * 2);
  }

  return buffer;
}

async function runVoiceTest() {
  console.log("==================================================");
  console.log(`TESTING ${APP_CONFIG.geminiModel.toUpperCase()} (${APP_CONFIG.useMockAi ? "SIMULATION" : "LIVE"}): VOICE NOTE KURIR`);
  console.log("==================================================\n");

  const startTime = Date.now();
  const candidates = [
    { p: path.resolve(process.cwd(), "test-fixtures/sample-voice.mp3"), mime: "audio/mp3" },
    { p: path.resolve(process.cwd(), "test-fixtures/sample-voice.wav"), mime: "audio/wav" },
    { p: path.resolve(process.cwd(), "../test-fixtures/sample-voice.mp3"), mime: "audio/mp3" },
    { p: path.resolve(process.cwd(), "../test-fixtures/sample-voice.wav"), mime: "audio/wav" },
    { p: path.resolve(process.cwd(), "frontend/public/samples/sample-voice.mp3"), mime: "audio/mp3" },
    { p: path.resolve(process.cwd(), "../frontend/public/samples/sample-voice.mp3"), mime: "audio/mp3" },
  ];

  let audioBuffer: Buffer | null = null;
  let audioMime = "audio/mp3";

  for (const c of candidates) {
    if (fs.existsSync(c.p)) {
      audioBuffer = fs.readFileSync(c.p);
      audioMime = c.mime;
      console.log(`🎙️ Memuat audio kurir nyata: ${path.basename(c.p)} (${audioBuffer.length} bytes)\n`);
      break;
    }
  }

  if (!audioBuffer) {
    console.log("ℹ️ Berkas audio kurir tidak ditemukan, membuat sinyal audio waveform sintetis...\n");
    audioBuffer = generateSampleWav(2);
    audioMime = "audio/wav";
  }

  try {
    const decision = await processIncidentReport(null, audioBuffer, "image/jpeg", audioMime);
    const duration = Date.now() - startTime;

    console.log("✅ HASIL ANALISIS VOICE NOTE (JSON):");
    console.log(JSON.stringify(decision, null, 2));
    console.log(`\n⏱️ Total Waktu: ${duration} ms`);
    console.log(`🤖 Model: ${decision.model}`);
    console.log(`🎙️ Analisis Suara: ${decision.analysis}`);
    console.log(`🚦 Rekomendasi Aksi: ${decision.action}`);
  } catch (error: any) {
    console.error("\n❌ Gagal menganalisis suara dengan Gemini AI:");
    console.error("   Detail Error:", error?.message || error);
    process.exit(1);
  }
}

runVoiceTest();
