/**
 * NusaRoute AI — AI Agent Service
 * Uses Google Gemini 2.5 Flash (multimodal) to analyze courier incident reports.
 * Falls back to mock responses when USE_MOCK_AI=true or API key is missing.
 */

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-05-20';

let genai = null;
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
  genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log(`✅ Gemini AI initialized with model: ${GEMINI_MODEL}`);
} else {
  console.warn('⚠️  GEMINI_API_KEY not set. Running in MOCK mode.');
}

const USE_MOCK = process.env.USE_MOCK_AI === 'true' || !genai;

// ─── MOCK RESPONSES ─────────────────────────────────────────────────────────
const MOCK_RESPONSES = [
  {
    incidentType: 'road_closure',
    incidentTypeLabel: 'Road Closure',
    incidentTypeLabelId: 'Jalan Ditutup',
    severity: 'high',
    severityLabel: 'High / Tinggi',
    analysis: 'Photo shows a barricade blocking the main road ahead. Road closure appears to be due to construction work. Audio confirms the courier is unable to proceed.',
    analysisId: 'Foto menunjukkan barikade yang memblokir jalan utama di depan. Penutupan jalan tampaknya akibat pekerjaan konstruksi pipa air PDAM. Kurir tidak dapat melanjutkan perjalanan.',
    recommendation: 'Re-route via Jl. Raya Darmo → Jl. Diponegoro → Jl. Basuki Rahmat. Estimated additional time: 12 minutes.',
    recommendationId: 'Putar balik dan ambil jalur alternatif melalui Jl. Raya Darmo → Jl. Diponegoro → Jl. Basuki Rahmat. Estimasi tambahan waktu: 12 menit.',
    reroutePoints: ['Jl. Raya Darmo', 'Jl. Diponegoro', 'Jl. Basuki Rahmat'],
    estimatedDelay: 12,
    affectedDeliveries: ['DEL-001', 'DEL-003'],
    action: 'REROUTE',
  },
  {
    incidentType: 'traffic_jam',
    incidentTypeLabel: 'Traffic Jam',
    incidentTypeLabelId: 'Kemacetan Parah',
    severity: 'medium',
    severityLabel: 'Medium / Sedang',
    analysis: 'Heavy traffic congestion detected near Wonokromo area. Queue extends approximately 500 meters due to market activity.',
    analysisId: 'Kemacetan parah terdeteksi di area Wonokromo. Antrean kendaraan sekitar 500 meter akibat aktivitas Pasar Wonokromo dan jam pulang kantor. Kendaraan bergerak sangat lambat.',
    recommendation: 'Proceed through Jl. Ngagel → Jl. Pucang Anom to bypass the congestion zone.',
    recommendationId: 'Hindari Jl. Wonokromo. Ambil jalur alternatif melalui Jl. Ngagel → Jl. Pucang Anom → Jl. Kertajaya untuk melewati zona kemacetan. Estimasi hemat 8 menit.',
    reroutePoints: ['Jl. Ngagel', 'Jl. Pucang Anom', 'Jl. Kertajaya'],
    estimatedDelay: 8,
    affectedDeliveries: ['DEL-002'],
    action: 'REROUTE',
  },
  {
    incidentType: 'flooding',
    incidentTypeLabel: 'Flooding',
    incidentTypeLabelId: 'Banjir / Genangan Air',
    severity: 'critical',
    severityLabel: 'Critical / Kritis',
    analysis: 'Significant road flooding detected. Water level appears to be approximately 30cm deep, unsafe for standard delivery vehicles.',
    analysisId: 'Banjir signifikan terdeteksi di jalan. Ketinggian air sekitar 30cm — tidak aman untuk motor dan kendaraan pengiriman standar. Kemungkinan akibat hujan lebat dan drainase tersumbat.',
    recommendation: 'Immediate re-routing required. Deliver remaining packages to nearest hub at Jl. Mayjen Sungkono (Ciputra World drop-off area).',
    recommendationId: 'BAHAYA — segera putar balik! Antarkan sisa paket ke titik hub terdekat di area drop-off Ciputra World (Jl. Mayjen Sungkono No. 89). Hubungi dispatcher untuk koordinasi penerima.',
    reroutePoints: ['Ciputra World Drop-off', 'Jl. Mayjen Sungkono No. 89'],
    estimatedDelay: 25,
    affectedDeliveries: ['DEL-001', 'DEL-002', 'DEL-003', 'DEL-004'],
    action: 'REDIRECT_TO_HUB',
  },
];

/**
 * Build the structured prompt for Gemini multimodal analysis.
 */
function buildPrompt(audioTranscript = '') {
  return `You are an intelligent logistics operations AI for NusaRoute AI, an urban last-mile delivery system operating in SURABAYA, INDONESIA.

A courier has reported an incident on the road. Analyze the attached photo (and audio transcript if available) to:
1. Identify the type of obstacle/incident
2. Assess its severity
3. Provide actionable re-routing recommendations using REAL SURABAYA street names

Context: The courier is delivering packages in Surabaya. Use real Surabaya street names (Jl. Raya Darmo, Jl. Ahmad Yani, Jl. Basuki Rahmat, Jl. Tunjungan, Jl. Gubeng, Jl. Mayjen Sungkono, etc.) for routing suggestions.

Audio Transcript: "${audioTranscript || 'No audio transcript available.'}"

Respond ONLY with a valid JSON object (no markdown) with this exact structure:
{
  "incidentType": "road_closure|traffic_jam|flooding|accident|other",
  "incidentTypeLabel": "Label jenis hambatan (Indonesian)",
  "severityLabel": "Tingkat keparahan (Rendah|Sedang|Tinggi|Kritis)",
  "analysis": "Analisis lengkap kejadian dalam Bahasa Indonesia (2-3 kalimat)",
  "analysisEn": "Detailed analysis in English (metadata)",
  "recommendation": "Rekomendasi re-routing atau tindakan spesifik dalam Bahasa Indonesia menggunakan nama jalan Surabaya",
  "recommendationEn": "Specific recommendation in English (metadata)",
  "reroutePoints": ["nama jalan Surabaya 1", "nama jalan Surabaya 2"],
  "estimatedDelay": <integer minutes>,
  "action": "REROUTE|WAIT|REDIRECT_TO_HUB|ESCALATE"
}`;
}

/**
 * Processes an incident report using Gemini multimodal AI.
 * @param {Buffer|null} photoBuffer - Image buffer (JPEG/PNG)
 * @param {Buffer|null} audioBuffer - Audio buffer (WebM/MP3/etc.)
 * @param {string} photoMime - MIME type of photo
 * @param {string} audioMime - MIME type of audio
 * @returns {Promise<Object>} Structured AI decision object
 */
export async function processIncidentReport(
  photoBuffer = null,
  audioBuffer = null,
  photoMime = 'image/jpeg',
  audioMime = 'audio/webm'
) {
  // ── MOCK MODE ───────────────────────────────────────────────────────────
  if (USE_MOCK) {
    console.log('🤖 [MOCK AI] Simulating Gemini analysis...');
    await new Promise((r) => setTimeout(r, 2000)); // Simulate network delay
    const mock = { ...MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)] };

    // Adjust mock based on what was actually sent
    if (!audioBuffer) {
      // Remove audio references from analysis if no audio was sent
      mock.analysis = mock.analysis.replace(/Audio[^.]*\./gi, '').trim();
      mock.analysisId = mock.analysisId.replace(/Audio[^.]*\./gi, '').replace(/Kurir tidak dapat melanjutkan perjalanan\./gi, '').trim();
    }
    if (!photoBuffer) {
      mock.analysis = mock.analysis.replace(/Photo[^.]*\./gi, 'Incident reported by courier.').trim();
      mock.analysisId = mock.analysisId.replace(/Foto[^.]*\./gi, 'Insiden dilaporkan oleh kurir.').trim();
    }

    return { ...mock, isMock: true, model: 'mock', processedAt: new Date().toISOString() };
  }

  // ── REAL GEMINI API ─────────────────────────────────────────────────────
  try {
    console.log(`🧠 [Gemini ${GEMINI_MODEL}] Processing multimodal incident report...`);

    // Build context-aware prompt
    const hasPhoto = !!photoBuffer;
    const hasAudio = !!audioBuffer;
    const inputContext = hasPhoto && hasAudio
      ? 'Kurir mengirim FOTO dan AUDIO. Analisis keduanya.'
      : hasPhoto
        ? 'Kurir mengirim FOTO saja (tanpa audio). Analisis hanya berdasarkan foto.'
        : 'Kurir mengirim AUDIO saja (tanpa foto). Analisis hanya berdasarkan audio.';

    const contentParts = [{ text: buildPrompt() + `\n\nKONTEKS INPUT: ${inputContext}\n\nPENTING: Hanya deskripsikan apa yang benar-benar terlihat di foto atau terdengar di audio. JANGAN mengarang informasi yang tidak ada di input. Jika hanya ada foto, jangan menyebut audio. Jika hanya ada audio, jangan menyebut foto.` }];

    if (photoBuffer) {
      contentParts.push({
        inlineData: {
          mimeType: photoMime,
          data: photoBuffer.toString('base64'),
        },
      });
    }

    if (audioBuffer) {
      contentParts.push({
        inlineData: {
          mimeType: audioMime,
          data: audioBuffer.toString('base64'),
        },
      });
    }

    const response = await genai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: contentParts }],
      config: {
        temperature: 0.2, // Lower temperature = less hallucination
        maxOutputTokens: 8192,
      },
    });

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Gemini raw response length:', rawText.length);
    
    if (!rawText) throw new Error('Empty text received from Gemini');

    // Robust JSON extraction
    let jsonText = rawText.trim();
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText.substring(firstBrace, lastBrace + 1);
    } else {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsed = JSON.parse(jsonText);

    return {
      ...parsed,
      isMock: false,
      model: GEMINI_MODEL,
      processedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('❌ Gemini API error:', err.message);
    // Graceful fallback to mock on API error
    const mock = { ...MOCK_RESPONSES[0] };
    if (!audioBuffer) {
      mock.analysisId = mock.analysisId.replace(/Audio[^.]*\./gi, '').replace(/Kurir tidak dapat melanjutkan perjalanan\./gi, '').trim();
    }
    return {
      ...mock,
      isMock: true,
      model: 'mock-fallback',
      error: err.message,
      processedAt: new Date().toISOString(),
    };
  }
}

// ─── MOCK: Route Optimizer Fallback ─────────────────────────────────────────
function mockOptimizeRoute(deliveries) {
  const statusOrder = { in_transit: 0, pending: 1, rerouted: 2, delivered: 3 };
  const priorityOrder = { high: 0, medium: 1, low: 2 };

  const sorted = [...deliveries].sort((a, b) => {
    // 1. By status
    const sDiff = (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
    if (sDiff !== 0) return sDiff;
    // 2. By priority
    const pDiff = (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
    if (pDiff !== 0) return pDiff;
    // 3. By estimatedArrival time
    return (a.estimatedArrival ?? '').localeCompare(b.estimatedArrival ?? '');
  });

  return {
    optimizedOrder: sorted.map((d) => d.id),
    reasoning: `Pengurutan standar: Status aktif → Prioritas (Tinggi > Sedang > Rendah) → Estimasi waktu. Total ${sorted.length} titik pengiriman.`,
    totalEstimatedTime: `${sorted.length * 25}–${sorted.length * 35} menit`,
    isMock: true,
    model: 'rule-based',
    optimizedAt: new Date().toISOString(),
  };
}

/**
 * Uses Gemini AI to optimize delivery route order.
 * @param {Array} deliveries - Array of delivery objects
 * @returns {Promise<Object>} Optimized order with reasoning
 */
export async function optimizeDeliveryRoute(deliveries) {
  if (USE_MOCK) {
    console.log('🤖 [MOCK AI] Using rule-based route optimization...');
    await new Promise((r) => setTimeout(r, 800));
    return mockOptimizeRoute(deliveries);
  }

  try {
    const active = deliveries.filter(d => d.status !== 'delivered');
    console.log(`🧠 [Gemini ${GEMINI_MODEL}] Optimizing route for ${active.length} active stops...`);

    // Compact data — only what Gemini needs for route decisions
    const stops = active.map((d) => ({
      id: d.id,
      lat: d.lat,
      lng: d.lng,
      priority: d.priority,
      time: d.estimatedArrival ?? '',
      pkgs: d.packageCount ?? 1,
    }));

    // Minimal, focused prompt — shorter = less chance of truncation
    const prompt = `You are a delivery route optimizer for Surabaya, Indonesia.
Optimize the order of these delivery stops to minimize travel distance while respecting priority and time windows.
Priority order: high > medium > low.

Stops (JSON):
${JSON.stringify(stops, null, 2)}

Reply with ONLY a raw JSON object (no markdown, no explanation outside JSON):
{"optimizedOrder":["id1","id2",...],"reasoning":"Brief explanation in Indonesian (1-2 sentences).","totalEstimatedTime":"X-Y menit","routeHighlights":["key point 1","key point 2"]}`;

    const response = await genai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    });

    // Robust text extraction
    const rawText = (response.candidates?.[0]?.content?.parts?.[0]?.text) || '';
    const trimmed = rawText.trim();

    console.log(`📦 Gemini optimize raw (${trimmed.length} chars):`, trimmed.substring(0, 100));

    if (!trimmed) throw new Error('Empty response from Gemini');

    // Extract JSON — handles: raw JSON, ```json...```, ```...```, or JSON embedded in text
    let jsonText = trimmed;
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText.substring(firstBrace, lastBrace + 1);
    } else {
      // Remove markdown code fences (any variant)
      jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }

    const parsed = JSON.parse(jsonText);

    // Validate required field
    if (!Array.isArray(parsed.optimizedOrder)) {
      throw new Error('Missing optimizedOrder array in Gemini response');
    }

    // Make sure all delivered IDs are appended at the end
    const deliveredIds = deliveries.filter(d => d.status === 'delivered').map(d => d.id);
    const fullOrder = [...parsed.optimizedOrder, ...deliveredIds];

    return {
      ...parsed,
      optimizedOrder: fullOrder,
      isMock: false,
      model: GEMINI_MODEL,
      optimizedAt: new Date().toISOString(),
    };

  } catch (err) {
    console.error('❌ Gemini optimize error:', err.message);
    // Graceful fallback to rule-based sorting
    const fallback = mockOptimizeRoute(deliveries);
    return { ...fallback, model: 'rule-based-fallback', error: err.message };
  }
}
