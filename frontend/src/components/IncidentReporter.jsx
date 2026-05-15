import React, { useState, useRef, useCallback } from "react";
import {
  TrashIcon,
  MapPinIcon,
  CameraIcon,
  MicIcon,
  SendIcon,
} from "./UiIcons.jsx";

function WaveVisualizer({ isRecording }) {
  return (
    <div className="flex items-center justify-center gap-1 h-10">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-full transition-all ${isRecording ? "wave-bar" : "bg-text-muted/10 h-2"}`}
        />
      ))}
    </div>
  );
}

export default function IncidentReporter({ onSubmit, isLoading }) {
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [location, setLocation] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-detect location on mount
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
      { enableHighAccuracy: true, timeout: 5000 },
    );
  }, []);

  const handlePhotoChange = (e) => {
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

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: "audio/webm" }));
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
    } catch {
      alert("Akses mikrofon ditolak.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    clearInterval(timerRef.current);
  }, []);

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const canSubmit = (photo || audioBlob) && !isLoading;

  return (
    <div className="space-y-5">
      {/* Location */}
      <div className="space-y-2">
        <label className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-black block ml-1 flex items-center gap-2">
          <MapPinIcon className="w-3.5 h-3.5" /> Lokasi Kejadian
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Contoh: Jl. Ahmad Yani (Depan DBL Arena)..."
            className="flex-1 bg-surface border border-theme rounded-2xl px-4 py-3 text-text-main text-sm font-medium
                       placeholder:text-text-muted/20 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
          />
          <button
            type="button"
            onClick={detectLocation}
            disabled={isDetectingLocation}
            className="px-3 py-3 bg-primary/10 border border-primary/20 rounded-2xl text-primary hover:bg-primary/20 active:scale-95 transition-all shrink-0 flex items-center justify-center"
            title="Deteksi lokasi otomatis dari GPS"
          >
            {isDetectingLocation ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <MapPinIcon className="w-5 h-5" />
            )}
          </button>
        </div>
        {!location && (
          <p className="text-[9px] text-text-muted ml-1 italic">
            Ketuk ikon 📍 untuk otomatis mengisi dari GPS Anda
          </p>
        )}
      </div>

      {/* Photo */}
      <div className="space-y-2">
        <label className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-black block ml-1 flex items-center gap-2">
          <CameraIcon className="w-3.5 h-3.5" /> Bukti Foto
        </label>
        {photoPreview ? (
          <div className="relative rounded-3xl overflow-hidden border-2 border-theme shadow-lg">
            <img
              src={photoPreview}
              alt="Preview"
              className="w-full h-56 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <button
              onClick={clearPhoto}
              className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-xl bg-red-500 text-white shadow-xl active:scale-90 transition-all"
            >
              <TrashIcon />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-32 rounded-3xl border-2 border-dashed border-theme hover:border-primary
                       bg-surface hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 shadow-sm group"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CameraIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center px-4">
              <p className="text-text-main text-xs font-black uppercase tracking-wider">
                Ambil Foto Situasi
              </p>
              <p className="text-text-muted text-[10px] font-bold">
                Pastikan objek terlihat jelas
              </p>
            </div>
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

      {/* Audio */}
      <div className="space-y-2">
        <label className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-black block ml-1 flex items-center gap-2">
          <MicIcon className="w-3.5 h-3.5" /> Laporan Suara (Opsional)
        </label>
        {audioBlob ? (
          <div className="p-5 rounded-3xl bg-primary/5 border-2 border-primary/20 flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
              <MicIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-main text-xs font-black uppercase tracking-tight">
                Rekaman Selesai
              </p>
              <audio
                controls
                src={URL.createObjectURL(audioBlob)}
                className="w-full h-8 mt-2"
              />
            </div>
            <button
              onClick={() => setAudioBlob(null)}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-red-500 hover:bg-red-500/10 transition-all active:scale-90"
            >
              <TrashIcon />
            </button>
          </div>
        ) : (
          <div
            className={`p-4 rounded-3xl border-2 transition-all shadow-sm ${isRecording ? "border-red-500/40 bg-red-500/5" : "border-theme bg-surface"}`}
          >
            <WaveVisualizer isRecording={isRecording} />
            <div className="flex items-center gap-4 mt-3">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-90 shadow-lg
                  ${isRecording ? "bg-red-500 shadow-red-500/40 animate-pulse" : "bg-primary/10 border border-primary/20 text-primary"}`}
              >
                {isRecording ? (
                  <span className="w-5 h-5 rounded-md bg-white shadow-inner" />
                ) : (
                  <MicIcon className="w-6 h-6" />
                )}
              </button>
              <div>
                {isRecording ? (
                  <>
                    <p className="text-red-500 text-xs font-black uppercase tracking-tighter">
                      Sedang Merekam... {fmt(recordingDuration)}
                    </p>
                    <p className="text-text-muted text-[10px] font-bold">
                      Ketuk kotak merah untuk berhenti
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-text-main text-xs font-black uppercase tracking-wider">
                      Rekam Suara
                    </p>
                    <p className="text-text-muted text-[10px] font-bold">
                      Jelaskan kondisi (maks 60d)
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={() => onSubmit({ photoFile: photo, audioBlob, location })}
        disabled={!canSubmit}
        className="w-full py-4 bg-primary text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-primary/30 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
      >
        {isLoading ? (
          <>
            <svg
              className="w-5 h-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Memproses Laporan...
          </>
        ) : (
          <>
            <SendIcon className="w-6 h-6" />
            Kirim Laporan AI
          </>
        )}
      </button>
    </div>
  );
}
