import { GoogleGenAI, Type, createPartFromBase64 } from "@google/genai";
import { APP_CONFIG } from "../config/app-config.js";
import type {
  AIChatContext,
  AIChatResponse,
  AIDecision,
  Delivery,
  RouteOptimizationResult,
} from "../types/index.js";

const MODEL_NAME = APP_CONFIG.geminiModel;

let cachedClient: GoogleGenAI | null = null;
let clientInitAttempted = false;

function getGenAIClient(): GoogleGenAI | null {
  if (clientInitAttempted) {
    return cachedClient;
  }

  clientInitAttempted = true;
  const isMockForced = APP_CONFIG.useMockAi;
  const apiKey = APP_CONFIG.geminiApiKey;

  if (isMockForced) {
    console.log("[AI Agent] USE_MOCK_AI enabled. Running in simulation mode.");
    cachedClient = null;
    return null;
  }

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    console.warn("[AI Agent] GEMINI_API_KEY not configured. Running in MOCK fallback mode.");
    cachedClient = null;
    return null;
  }

  try {
    cachedClient = new GoogleGenAI({ apiKey });
    console.log(`[AI Agent] Gemini AI initialized successfully with model: ${MODEL_NAME}`);
    return cachedClient;
  } catch (error: any) {
    console.error("[AI Agent] Failed to initialize GoogleGenAI client:", error?.message || error);
    cachedClient = null;
    return null;
  }
}

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

const ROUTE_OPTIMIZATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    optimizedOrder: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Urutan ID paket aktif yang paling optimal dari awal sampai akhir",
    },
    reasoning: {
      type: Type.STRING,
      description: "Penjelasan ringkas alasan pemilihan urutan rute dalam Bahasa Indonesia",
    },
    totalEstimatedTime: {
      type: Type.STRING,
      description: "Estimasi total waktu pengiriman",
    },
    routeHighlights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Poin penting rute atau koridor jalan utama yang dilewati",
    },
  },
  required: ["optimizedOrder", "reasoning", "totalEstimatedTime"],
};

const SURABAYA_INCIDENT_SYSTEM_INSTRUCTION = `Anda adalah asisten operasi logistik cerdas untuk NusaRoute AI di KOTA SURABAYA, INDONESIA.
Tugas Anda adalah menganalisis foto dan/atau audio laporan kurir mengenai hambatan di jalan secara cepat, faktual, dan presisi.

Aturan Penting:
1. Hanya gunakan fakta yang terbukti pada foto atau audio. Jangan berhalusinasi atau berasumsi jika bukti tidak terlihat.
2. Gunakan nama jalan dan landmark nyata di Surabaya untuk rute pengalihan (contoh: Jl. Raya Darmo, Jl. Ahmad Yani, Jl. Basuki Rahmat, Jl. Tunjungan, Jl. Pemuda, Jl. Ngagel, Jl. Diponegoro, MERR, Bundaran Waru, Mayjen Sungkono).
3. Jika terdapat banjir > 25cm atau jalan tertutup total, instruksikan REROUTE atau REDIRECT_TO_HUB terdekat (misal: Hub Tunjungan, Hub Gubeng, Hub Ciputra World).
4. Berikan output dalam format JSON yang tepat sesuai skema yang telah ditentukan.`;

const SURABAYA_ROUTE_SYSTEM_INSTRUCTION = `Anda adalah pengatur rute logistik (TSP Solver) perkotaan untuk kurir motor di Kota Surabaya, Indonesia.
Tujuan: Urutkan titik pengiriman aktif agar jarak tempuh dan waktu tempuh minimal dengan memperhatikan:
- Prioritas: High > Medium > Low.
- Kedekatan geografis (koordinat lat/lng) agar tidak bolak-balik melintasi koridor padat.
- Window waktu pengiriman.`;

const SURABAYA_MOCK_INCIDENTS: Array<Omit<AIDecision, "model" | "processedAt" | "isMock">> = [
  {
    incidentType: "road_closure",
    incidentTypeLabel: "Jalan Ditutup (Proyek PDAM)",
    severity: "high",
    severityLabel: "Tinggi",
    analysis: "Terdeteksi penutupan badan jalan utama akibat pekerjaan galian pipa air PDAM. Akses kendaraan bermotor terhalang barikade seng dan alat berat.",
    analysisEn: "Main road closure detected due to municipal water utility pipe excavation. Barricades and heavy equipment block standard delivery vehicle access.",
    recommendation: "Putar balik segera. Ambil jalur alternatif melalui Jl. Raya Darmo -> Jl. Diponegoro -> Jl. Basuki Rahmat untuk menghindari simpul kemacetan.",
    recommendationEn: "U-turn immediately. Take detour via Jl. Raya Darmo -> Jl. Diponegoro -> Jl. Basuki Rahmat.",
    reroutePoints: ["Jl. Raya Darmo", "Jl. Diponegoro", "Jl. Basuki Rahmat"],
    estimatedDelay: 12,
    action: "REROUTE",
  },
  {
    incidentType: "traffic_jam",
    incidentTypeLabel: "Kemacetan Parah (Pasar dan Jam Sibuk)",
    severity: "medium",
    severityLabel: "Sedang",
    analysis: "Antrean padat merayap sepanjang kurang lebih 600 meter di sekitar Pasar Wonokromo. Aktivitas bongkar muat dan angkutan kota memperlambat laju kendaraan.",
    analysisEn: "Heavy congestion detected near Wonokromo Market stretching 600 meters due to loading activities and peak traffic.",
    recommendation: "Bypass Jl. Wonokromo dengan membelok ke arah Jl. Ngagel -> Jl. Pucang Anom -> Jl. Kertajaya. Menghemat estimasi 8-10 menit.",
    recommendationEn: "Bypass Wonokromo corridor via Jl. Ngagel -> Jl. Pucang Anom -> Jl. Kertajaya to save 8-10 minutes.",
    reroutePoints: ["Jl. Ngagel", "Jl. Pucang Anom", "Jl. Kertajaya"],
    estimatedDelay: 8,
    action: "REROUTE",
  },
  {
    incidentType: "flooding",
    incidentTypeLabel: "Banjir / Genangan Air",
    severity: "critical",
    severityLabel: "Kritis",
    analysis: "Genangan air setinggi sekitar 30-40 cm terdeteksi di badan jalan pasca hujan lebat. Kondisi tidak aman dilalui sepeda motor kurir bermuatan paket.",
    analysisEn: "Flash flood of 30-40 cm detected after heavy rainfall. Unsafe for motorbikes carrying delivery parcels.",
    recommendation: "Bahaya mogok. Alihkan sisa pengiriman ke Hub Konsolidasi terdekat di drop-off Ciputra World (Jl. Mayjen Sungkono No. 89) untuk koordinasi dispatcher.",
    recommendationEn: "Hazard warning. Redirect pending packages to nearest pickup hub at Ciputra World drop-off area.",
    reroutePoints: ["Jl. Mayjen Sungkono", "Hub Ciputra World"],
    estimatedDelay: 25,
    action: "REDIRECT_TO_HUB",
  },
  {
    incidentType: "accident",
    incidentTypeLabel: "Kecelakaan Lalu Lintas",
    severity: "high",
    severityLabel: "Tinggi",
    analysis: "Terjadi insiden kecelakaan kendaraan di lajur kanan, mengakibatkan penyempitan lajur dan antrean kendaraan yang cukup panjang.",
    analysisEn: "Traffic accident occupying the right lane causing a bottle-neck bottleneck and queuing.",
    recommendation: "Gunakan jalur frontage road sisi kiri atau berbelok ke arteri sekunder terdekat hingga petugas selesai melakukan evakuasi.",
    recommendationEn: "Divert to frontage road or take the nearest secondary arterial until clearance is complete.",
    reroutePoints: ["Frontage Road Ahmad Yani", "Jl. Jemursari"],
    estimatedDelay: 15,
    action: "REROUTE",
  },
];

function isRetryableGenAiError(err: any): boolean {
  const status = Number(err?.status ?? err?.code);
  const msg = String(err?.message || "").toLowerCase();
  // Fail fast on quota/daily limit exhaustion so executeWithModelFailover immediately cascades to next model
  if (status === 429 && (msg.includes("quota") || msg.includes("resource_exhausted") || msg.includes("limit exceeded"))) {
    return false;
  }
  // Only retry transient 5xx or general network errors
  if (Number.isFinite(status) && status >= 400 && status < 500 && status !== 429) {
    return false;
  }
  return true;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 600
): Promise<{ result: T; retries: number }> {
  let attempt = 0;
  while (true) {
    try {
      const result = await operation();
      return { result, retries: attempt };
    } catch (err: any) {
      attempt++;
      if (attempt > maxRetries || !isRetryableGenAiError(err)) throw err;
      const jitter = Math.random() * 200;
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
      console.warn(`[AI Agent Retry] Attempt ${attempt} failed (status=${err?.status ?? "network"}): ${err?.message || err}. Retrying in ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function executeWithModelFailover(
  client: GoogleGenAI,
  payloadBuilder: (modelName: string) => any
): Promise<{ response: any; activeModel: string; retries: number }> {
  // Urutan model failover: Gemini 3.8 Flash -> Gemini 3.1 Flash Lite -> Gemini Flash Latest
  const candidates = Array.from(
    new Set([MODEL_NAME, "gemini-3.1-flash-lite", "gemini-flash-lite-latest"])
  );
  let lastError: any = null;

  for (let i = 0; i < candidates.length; i++) {
    const currentModel = candidates[i];
    try {
      const { result, retries } = await withRetry(() =>
        client.models.generateContent(payloadBuilder(currentModel))
      );
      return { response: result, activeModel: currentModel, retries };
    } catch (err: any) {
      lastError = err;
      const status = Number(err?.status ?? err?.code);
      const msg = String(err?.message || "").toLowerCase();
      const isRecoverableError =
        status === 503 ||
        status === 404 ||
        status === 429 ||
        msg.includes("503") ||
        msg.includes("429") ||
        msg.includes("high demand") ||
        msg.includes("unavailable") ||
        msg.includes("quota exceeded") ||
        msg.includes("resource_exhausted") ||
        msg.includes("rate limit");

      if (isRecoverableError && i < candidates.length - 1) {
        const nextModel = candidates[i + 1];
        console.warn(
          `[AI Agent Failover] Model ${currentModel} mengalami kendala kuota/kapasitas (HTTP ${status || "Spike"}). Beralih otomatis ke cadangan: ${nextModel}...`
        );
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

function normalizeIncidentResult(
  data: any,
  isMock = false,
  modelName = MODEL_NAME
): AIDecision {
  return {
    ...data,
    incidentTypeLabelId: data.incidentTypeLabel || data.incidentType,
    analysisId: data.analysis,
    recommendationId: data.recommendation,
    isMock,
    model: modelName,
    processedAt: new Date().toISOString(),
    telemetry: data.telemetry,
  };
}

function generateContextualMock(hasPhoto: boolean, hasAudio: boolean): AIDecision {
  const base = { ...SURABAYA_MOCK_INCIDENTS[Math.floor(Math.random() * SURABAYA_MOCK_INCIDENTS.length)] };

  if (hasPhoto && !hasAudio) {
    base.analysis = `[Foto Lapangan] ${base.analysis}`;
  } else if (!hasPhoto && hasAudio) {
    base.analysis = `[Pesan Suara Kurir] Kurir melaporkan: ${base.analysis}`;
  } else if (hasPhoto && hasAudio) {
    base.analysis = `[Multimodal Foto + Audio] ${base.analysis} Audio kurir mengonfirmasi situasi tidak dapat dilalui.`;
  }

  return normalizeIncidentResult(base, true, "mock-simulator");
}

function mockOptimizeRoute(deliveries: Delivery[]): RouteOptimizationResult {
  const statusWeight: Record<string, number> = { in_transit: 0, pending: 1, rerouted: 2, delivered: 3 };
  const priorityWeight: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const sorted = [...deliveries].sort((a, b) => {
    const sDiff = (statusWeight[a.status] ?? 1) - (statusWeight[b.status] ?? 1);
    if (sDiff !== 0) return sDiff;

    const pDiff = (priorityWeight[a.priority] ?? 1) - (priorityWeight[b.priority] ?? 1);
    if (pDiff !== 0) return pDiff;

    return (a.estimatedArrival ?? "").localeCompare(b.estimatedArrival ?? "");
  });

  const activeStopsCount = deliveries.filter((d) => d.status !== "delivered").length;
  const estimatedMins = Math.max(15, activeStopsCount * 20);

  return {
    optimizedOrder: sorted.map((d) => d.id),
    reasoning: `Pengurutan deterministik: Status Aktif -> Prioritas (Tinggi > Sedang > Rendah) -> Estimasi Waktu. Total ${activeStopsCount} titik aktif di Surabaya.`,
    totalEstimatedTime: `${estimatedMins}-${estimatedMins + 15} menit`,
    routeHighlights: ["Koridor Utama Surabaya", "Klaster Prioritas Tinggi"],
    isMock: true,
    model: "rule-based-fallback",
    optimizedAt: new Date().toISOString(),
  };
}

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
    if (APP_CONFIG.useMockAi) {
      console.log("[AI Agent] Simulating incident analysis with mock scenario (USE_MOCK_AI=true)...");
      await new Promise((resolve) => setTimeout(resolve, 800));
      return generateContextualMock(hasPhoto, hasAudio);
    }
    throw new Error("GEMINI_API_KEY tidak dikonfigurasi dan USE_MOCK_AI=false.");
  }

  try {
    console.log(`[Gemini ${MODEL_NAME}] Analyzing multimodal incident (Photo: ${hasPhoto}, Audio: ${hasAudio})...`);

    const inputContextDescription =
      hasPhoto && hasAudio
        ? "Kurir melampirkan FOTO bukti jalan dan rekaman SUARA laporan langsung. Analisis korelasi keduanya."
        : hasPhoto
          ? "Kurir melampirkan FOTO bukti jalan tanpa suara. Analisis kondisi visual di foto."
          : "Kurir mengirim rekaman SUARA tanpa foto. Transkripsikan dan analisis laporan kurir.";

    const contentParts: any[] = [
      {
        text: `LAPORAN KENDALA LOGISTIK KURIR DI KOTA SURABAYA\n\nKonteks Masukan: ${inputContextDescription}\nInstruksi: Analisis hambatan, tentukan tingkat keparahan, dan berikan rekomendasi pengalihan rute alternatif dengan nama jalan Surabaya yang valid.`,
      },
    ];

    if (hasPhoto && photoBuffer) {
      contentParts.push(createPartFromBase64(photoBuffer.toString("base64"), photoMime));
    }

    if (hasAudio && audioBuffer) {
      contentParts.push(createPartFromBase64(audioBuffer.toString("base64"), audioMime));
    }

    const startTime = Date.now();
    const { response, activeModel, retries } = await executeWithModelFailover(
      client,
      (model) => ({
        model,
        contents: [{ role: "user", parts: contentParts }],
        config: {
          systemInstruction: SURABAYA_INCIDENT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: INCIDENT_RESPONSE_SCHEMA,
          temperature: 0.1,
        },
      })
    );

    const latencyMs = Date.now() - startTime;
    const rawJsonText =
      response.text?.trim() ||
      response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!rawJsonText) {
      throw new Error("Menerima respons kosong dari Gemini AI");
    }

    const parsedData = JSON.parse(rawJsonText);
    const usage = (response as any).usageMetadata;
    console.log(`[Gemini (${activeModel})] Decision: ${parsedData.action} (${parsedData.incidentType}) in ${latencyMs}ms | Tokens: ${usage?.totalTokenCount ?? "N/A"}`);

    const result = normalizeIncidentResult(parsedData, false, activeModel);
    result.telemetry = {
      latencyMs,
      promptTokens: usage?.promptTokenCount ?? 0,
      candidatesTokens: usage?.candidatesTokenCount ?? 0,
      totalTokens: usage?.totalTokenCount ?? 0,
      retryCount: retries,
    };
    return result;
  } catch (error: any) {
    console.error("[Gemini Incident Analysis Error]:", error?.message || error);
    // Graceful offline fallback: jangan gagalkan alur kerja kurir jika seluruh kuota cloud habis
    const fallback = generateContextualMock(hasPhoto, hasAudio);
    return {
      ...fallback,
      model: "offline-fallback-on-error",
      errorDetails: error?.message || String(error),
    };
  }
}

export async function optimizeDeliveryRoute(
  deliveries: Delivery[]
): Promise<RouteOptimizationResult> {
  if (!Array.isArray(deliveries) || deliveries.length === 0) {
    return {
      optimizedOrder: [],
      reasoning: "Tidak ada data paket untuk dioptimasi.",
      totalEstimatedTime: "0 menit",
      routeHighlights: [],
      isMock: true,
      model: "empty",
      optimizedAt: new Date().toISOString(),
    };
  }

  const client = getGenAIClient();
  const activeDeliveries = deliveries.filter((d) => d.status !== "delivered");
  const deliveredDeliveries = deliveries.filter((d) => d.status === "delivered");

  if (!client) {
    if (APP_CONFIG.useMockAi) {
      console.log("[AI Agent] Using deterministic rule-based route optimizer (USE_MOCK_AI=true)...");
      await new Promise((resolve) => setTimeout(resolve, 400));
      return mockOptimizeRoute(deliveries);
    }
    throw new Error("GEMINI_API_KEY tidak dikonfigurasi dan USE_MOCK_AI=false.");
  }

  try {
    console.log(`[Gemini ${MODEL_NAME}] Optimizing TSP route sequence for ${activeDeliveries.length} active stops...`);

    const compactStops = activeDeliveries.map((d) => ({
      id: d.id,
      recipient: d.recipient,
      lat: d.lat,
      lng: d.lng,
      priority: d.priority || "medium",
      timeSlot: d.timeSlot || d.estimatedArrival || "Fleksibel",
      packages: d.packageCount || 1,
    }));

    const userPrompt = `Tentukan urutan pengiriman optimal untuk ${compactStops.length} titik paket kurir berikut di Surabaya:\n${JSON.stringify(compactStops, null, 2)}`;

    const { response, activeModel } = await executeWithModelFailover(
      client,
      (model) => ({
        model,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: SURABAYA_ROUTE_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: ROUTE_OPTIMIZATION_SCHEMA,
          temperature: 0.1,
        },
      })
    );

    const rawJsonText =
      response.text?.trim() ||
      response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!rawJsonText) {
      throw new Error("Menerima respons kosong dari Gemini Route Optimizer");
    }

    const parsed = JSON.parse(rawJsonText);
    const returnedActiveIds = new Set(parsed.optimizedOrder || []);
    const missingActiveIds = activeDeliveries
      .map((d) => d.id)
      .filter((id) => !returnedActiveIds.has(id));

    const fullOptimizedOrder = [
      ...(parsed.optimizedOrder || []),
      ...missingActiveIds,
      ...deliveredDeliveries.map((d) => d.id),
    ];

    return {
      ...parsed,
      optimizedOrder: fullOptimizedOrder,
      isMock: false,
      model: MODEL_NAME,
      optimizedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error("[Gemini Route Optimizer Error]:", error?.message || error);
    if (!APP_CONFIG.useMockAi) {
      throw error;
    }
    const fallback = mockOptimizeRoute(deliveries);
    return {
      ...fallback,
      model: "rule-based-fallback-on-error",
      errorDetails: error?.message || String(error),
    };
  }
}

const SURABAYA_CHAT_SYSTEM_INSTRUCTION = `Anda adalah Asisten Telematika & Rute NusaRoute AI untuk kurir logistik di Kota Surabaya, Indonesia.
Tugas Anda: menjawab pertanyaan kurir secara ringkas, taktis, dan akurat berdasarkan data telematika real-time yang diberikan (daftar pengiriman aktif, 10 zona lalu lintas Surabaya, dan cuaca terkini).

Aturan:
1. Jawab selalu dalam Bahasa Indonesia yang jelas, ramah, dan langsung ke inti operasional (maksimal 4-6 kalimat atau poin ringkas).
2. Gunakan nama jalan, zona, dan data paket nyata dari konteks yang diberikan. Jangan mengarang data fiktif.
3. Jika ada kemacetan tinggi/kritis atau hujan lebat, sebutkan zona terdampak dan saran jalur bypass Surabaya (misal Jl. Raya Darmo, Jl. Diponegoro, MERR, Jl. Ngagel, Frontage Road Ahmad Yani).`;

function generateContextualChatFallback(message: string, context: AIChatContext): string {
  const lower = message.toLowerCase();
  const activeDeliveries = context.deliveries.filter((d) => d.status !== "delivered");
  const busyZones = context.trafficZones.filter(
    (z) => z.level === "high" || z.level === "critical"
  );

  const weatherMap: Record<string, string> = {
    sunny: "Cerah",
    cloudy: "Berawan",
    rain: "Hujan",
    heavy_rain: "Hujan Lebat",
  };
  const weatherLabel = weatherMap[context.weather.condition] || context.weather.condition;

  if (lower.includes("macet") || lower.includes("zona") || lower.includes("lalu lintas")) {
    if (busyZones.length > 0) {
      const zoneList = busyZones
        .slice(0, 4)
        .map((z) => `• ${z.name} (${z.area}) — ${z.label || z.level}`)
        .join("\n");
      return `Zona padat Surabaya terpantau saat ini:\n${zoneList}\n\nDisarankan menggunakan jalur alternatif seperti Jl. Diponegoro, Jl. Ngagel, atau koridor MERR jika melintas dekat area tersebut.`;
    }
    return "Pantauan 10 zona utama Surabaya saat ini relatif lancar hingga sedang. Tetap waspada di simpang Wonokromo, Tunjungan, dan Bundaran Waru saat jam sibuk.";
  }

  if (lower.includes("cuaca") || lower.includes("hujan")) {
    const advice =
      context.weather.condition === "rain" || context.weather.condition === "heavy_rain"
        ? "Gunakan jas hujan, amankan paket dengan pelindung anti-air, dan hindari titik rawan genangan seperti Jl. Mayjen Sungkono dan sekitar Wonokromo."
        : "Kondisi jalan kering dan mendukung percepatan pengantaran.";
    return `Cuaca Surabaya terkini: ${weatherLabel} (${context.weather.temp}°C).\n${advice}`;
  }

  if (lower.includes("prioritas") || lower.includes("urutan") || lower.includes("paket") || lower.includes("rute")) {
    if (activeDeliveries.length === 0) {
      return "Seluruh paket pada daftar Anda saat ini sudah berstatus terkirim. Hubungi dispatcher untuk penugasan kloter berikutnya.";
    }
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sorted = [...activeDeliveries].sort(
      (a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
    );
    const topStops = sorted
      .slice(0, 3)
      .map((d, i) => `${i + 1}. [${d.priority.toUpperCase()}] ${d.recipient} (${d.address})`)
      .join("\n");
    return `Terdapat ${activeDeliveries.length} paket aktif. Prioritas pengantaran terdekat yang disarankan:\n${topStops}\n\nGunakan fitur Optimasi Rute AI untuk mengurutkan seluruh titik secara otomatis.`;
  }

  return `Status Operasional Surabaya:\n• Paket aktif Anda: ${activeDeliveries.length} titik\n• Cuaca: ${weatherLabel} (${context.weather.temp}°C)\n• Zona padat: ${busyZones.length > 0 ? busyZones.map((z) => z.name).slice(0, 3).join(", ") : "Terpantau lancar"}\n\nSilakan tanyakan spesifik mengenai zona macet, cuaca, atau urutan prioritas paket Anda.`;
}

export async function chatWithAssistant(
  message: string,
  context: AIChatContext
): Promise<AIChatResponse> {
  const client = getGenAIClient();
  const activeDeliveries = context.deliveries.filter((d) => d.status !== "delivered");

  if (!client) {
    if (APP_CONFIG.useMockAi) {
      return {
        reply: generateContextualChatFallback(message, context),
        model: "telemetry-fallback",
        isMock: true,
        timestamp: new Date().toISOString(),
      };
    }
    throw new Error("GEMINI_API_KEY tidak dikonfigurasi dan USE_MOCK_AI=false.");
  }

  try {
    const contextSummary = {
      courierId: context.courierId,
      weather: context.weather,
      activeDeliveries: activeDeliveries.slice(0, 10).map((d) => ({
        id: d.id,
        recipient: d.recipient,
        address: d.address,
        status: d.status,
        priority: d.priority,
        timeSlot: d.timeSlot,
      })),
      trafficZones: context.trafficZones.map((z) => ({
        name: z.name,
        area: z.area,
        level: z.level,
        label: z.label,
        reason: z.reason,
      })),
    };

    const userPrompt = `Konteks Telematika Surabaya Saat Ini:\n${JSON.stringify(contextSummary, null, 2)}\n\nPertanyaan Kurir: ${message}`;

    const { response, activeModel } = await executeWithModelFailover(
      client,
      (model) => ({
        model,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: SURABAYA_CHAT_SYSTEM_INSTRUCTION,
          temperature: 0.3,
        },
      })
    );

    const replyText =
      response.text?.trim() ||
      response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!replyText) {
      throw new Error("Menerima respons kosong dari Gemini AI Chat");
    }

    return {
      reply: replyText,
      model: activeModel,
      isMock: false,
      timestamp: new Date().toISOString(),
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[Gemini AI Chat Error]:", errMsg);
    if (!APP_CONFIG.useMockAi) {
      throw error;
    }
    return {
      reply: generateContextualChatFallback(message, context),
      model: "telemetry-fallback-on-error",
      isMock: true,
      timestamp: new Date().toISOString(),
    };
  }
}
