import React, { useState, useRef, useCallback } from "react";
import {
  TrashIcon,
  MapPinIcon,
  CameraIcon,
  MicIcon,
  SendIcon,
  AlertIcon,
} from "./UiIcons";

interface IncidentReporterProps {
  onSubmit: (data: { photoFile: File | null; audioBlob: Blob | null; location: string }) => void;
  isLoading: boolean;
  onClose?: () => void;
}

function WaveVisualizer({ isRecording }: { isRecording: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1.5 h-8">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all ${
            isRecording ? "wave-bar" : "bg-text-dim/20 h-1.5"
          }`}
        />
      ))}
    </div>
  );
}

function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export default function IncidentReporter({ onSubmit, isLoading }: IncidentReporterProps) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [location, setLocation] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation(`GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        setIsDetectingLocation(false);
      },
      () => {
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setPhoto(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = getSupportedAudioMimeType();
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const finalMime = recorder.mimeType || preferredMime || "audio/webm";
        setAudioBlob(new Blob(chunksRef.current, { type: finalMime }));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => {
          if (d >= 60) {
            stopRecording();
            return d;
          }
          return d + 1;
        });
      }, 1000);
    } catch (err) {
      console.warn("Microphone access failed", err);
    }
  }, [stopRecording]);

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const loadSample = async (type: "traffic" | "flood" | "voice") => {
    if (type === "traffic") {
      try {
        const res = await fetch("/samples/sample-incident-traffic.jpg");
        const blob = await res.blob();
        const file = new File([blob], "foto-macet-wonokromo.jpg", { type: "image/jpeg" });
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(blob));
        setLocation("Jl. Wonokromo No. 12, Surabaya (Depan Pasar Wonokromo)");
      } catch (err) {
        console.warn("Failed to load sample traffic", err);
      }
    } else if (type === "flood") {
      try {
        const res = await fetch("/samples/sample-incident-flood.jpg");
        const blob = await res.blob();
        const file = new File([blob], "foto-banjir-darmo.jpg", { type: "image/jpeg" });
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(blob));
        setLocation("Jl. Raya Darmo, Surabaya (Genangan Air 40cm)");
      } catch (err) {
        console.warn("Failed to load sample flood", err);
      }
    } else if (type === "voice") {
      try {
        const res = await fetch("/samples/sample-voice.mp3");
        const blob = await res.blob();
        setAudioBlob(blob);
        setLocation("Jl. Wonokromo Surabaya (Pesan Suara Kurir)");
      } catch (err) {
        console.warn("Failed to load sample voice", err);
      }
    }
  };

  const canSubmit = Boolean(photo || audioBlob);

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Title */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-theme/60">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <AlertIcon className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h2 className="text-base font-bold text-text-main leading-tight">
            Laporan Hambatan Lapangan
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Wajib sertakan minimal 1 bukti: <span className="font-semibold text-text-main">Foto</span> atau <span className="font-semibold text-text-main">Suara</span> (bisa keduanya)
          </p>
        </div>
      </div>

      {/* Quick Test Samples */}
      <div className="bg-theme-surface/60 border border-theme/40 rounded-xl p-3">
        <p className="text-[11px] font-semibold text-text-dim uppercase tracking-wider mb-2">
          ⚡ Sampel Cepat Pengujian:
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadSample("traffic")}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-surface hover:bg-main text-text-main border border-theme transition-colors flex items-center gap-1.5 active:scale-95"
          >
            🚗 Foto Macet Wonokromo
          </button>
          <button
            type="button"
            onClick={() => loadSample("flood")}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-surface hover:bg-main text-text-main border border-theme transition-colors flex items-center gap-1.5 active:scale-95"
          >
            🌊 Foto Banjir Darmo
          </button>
          <button
            type="button"
            onClick={() => loadSample("voice")}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-surface hover:bg-main text-text-main border border-theme transition-colors flex items-center gap-1.5 active:scale-95"
          >
            🎙️ Suara Kurir Nyata
          </button>
        </div>
      </div>

      {/* GPS Location Input */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-text-muted">
          Lokasi Hambatan
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="cth. Jl. Basuki Rahmat, banjir 30cm"
            className="flex-1 min-h-[44px] bg-surface border border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-sans"
          />
          <button
            type="button"
            onClick={detectLocation}
            disabled={isDetectingLocation}
            className="min-w-[44px] min-h-[44px] px-3 bg-surface hover:bg-main border border-theme rounded-xl text-xs font-semibold text-text-muted hover:text-text-main flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-sm active:scale-95"
            title="Gunakan GPS perangkat"
            aria-label="Deteksi lokasi GPS"
          >
            <MapPinIcon className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">GPS</span>
          </button>
        </div>
      </div>

      {/* Photo Capture */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-text-main">
            Bukti Foto Lapangan
          </label>
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              photo
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : audioBlob
                ? "bg-theme-surface text-text-dim border border-theme"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            }`}
          >
            {photo ? "✓ Foto Siap" : audioBlob ? "Opsional (ada suara)" : "Wajib minimal salah satu"}
          </span>
        </div>
        {photoPreview ? (
          <div className="relative rounded-xl overflow-hidden border border-theme aspect-video bg-main">
            <img
              src={photoPreview}
              alt="Bukti Kejadian"
              className="w-full h-full object-cover"
            />
            <button
              onClick={clearPhoto}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
              type="button"
              aria-label="Hapus foto"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-6 rounded-xl border border-dashed border-theme hover:border-primary/50 bg-main/50 hover:bg-main flex flex-col items-center justify-center gap-1.5 text-text-muted hover:text-text-main transition-colors"
          >
            <CameraIcon className="w-6 h-6 text-primary" />
            <span className="text-xs font-medium">Ketuk untuk mengambil atau unggah foto</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="hidden"
        />
      </div>

      {/* Voice Report */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-text-main">
            Laporan Suara Kurir
          </label>
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              audioBlob
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : photo
                ? "bg-theme-surface text-text-dim border border-theme"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            }`}
          >
            {audioBlob ? "✓ Suara Siap" : photo ? "Opsional (ada foto)" : "Wajib minimal salah satu"}
          </span>
        </div>
        {audioBlob ? (
          <div className="p-3.5 rounded-xl bg-surface border border-theme flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
              <MicIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-text-main block">
                Rekaman Suara Siap ({fmt(recordingDuration || 1)})
              </span>
              <audio controls src={URL.createObjectURL(audioBlob)} className="w-full h-7 mt-1.5" />
            </div>
            <button
              onClick={() => setAudioBlob(null)}
              className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
              type="button"
              aria-label="Hapus rekaman suara"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            className={`p-3.5 rounded-xl border transition-colors ${
              isRecording ? "border-red-500/40 bg-red-500/5" : "border-theme bg-surface"
            }`}
          >
            <WaveVisualizer isRecording={isRecording} />
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-theme/60">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                aria-label={isRecording ? "Hentikan rekaman suara" : "Mulai rekam suara"}
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-95 ${
                  isRecording
                    ? "bg-red-600 text-white animate-pulse"
                    : "bg-primary/10 text-primary hover:bg-primary/20"
                }`}
                type="button"
              >
                {isRecording ? <span className="w-3.5 h-3.5 rounded-sm bg-white" /> : <MicIcon className="w-5 h-5" />}
              </button>
              <div className="text-xs">
                {isRecording ? (
                  <p className="font-semibold text-red-600 dark:text-red-400 font-mono">
                    Merekam... {fmt(recordingDuration)} / 1:00
                  </p>
                ) : (
                  <p className="font-medium text-text-main">
                    Ketuk mikrofon untuk rekam laporan suara
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Submit Action */}
      <div className="space-y-1.5 pt-1">
        <button
          onClick={() => onSubmit({ photoFile: photo, audioBlob, location })}
          disabled={!canSubmit || isLoading}
          className="w-full btn-sage min-h-[48px] py-3 text-sm font-semibold flex items-center justify-center gap-2"
          type="button"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>Memproses Laporan &amp; Analisis Rute...</span>
            </>
          ) : (
            <>
              <SendIcon className="w-4 h-4" />
              <span>Kirim Laporan Hambatan</span>
            </>
          )}
        </button>
        {!canSubmit ? (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center font-medium">
            ⚠️ Wajib menyertakan minimal 1 bukti: Foto atau Rekaman Suara.
          </p>
        ) : (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 text-center font-medium">
            ✓ Bukti multimodal terpenuhi ({photo && audioBlob ? "Foto + Suara siap dianalisis bersama" : photo ? "Foto siap dianalisis Gemini" : "Suara siap dianalisis Gemini"}).
          </p>
        )}
      </div>
    </div>
  );
}
