import React, { useState, useRef, useEffect } from "react";
import { sendAIChat } from "../services/api";
import { SendIcon, UserIcon, XIcon, CompassIcon, NavigationIcon } from "./UiIcons";

interface AIChatAssistantProps {
  courierId?: string;
  onClose: () => void;
}

interface ChatMessage {
  role: "ai" | "user";
  text: string;
  timestamp: string;
  source?: string;
}

export default function AIChatAssistant({ courierId = "unknown", onClose }: AIChatAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "ai",
      text: "Halo! Saya asisten telematika NusaRoute. Tanyakan info seputar kondisi rute tercepat, kemacetan Surabaya, atau koordinasi pengiriman hari ini.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", text, timestamp: new Date().toISOString() }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await sendAIChat(text, courierId);
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: res.reply, timestamp: new Date().toISOString() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Maaf, terjadi kendala saat memproses permintaan. Silakan coba kembali.", timestamp: new Date().toISOString() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = [
    "Zona Surabaya mana yang macet?",
    "Rute tercepat ke tujuan aktif?",
    "Prakiraan cuaca terkini?",
    "Urutan paket prioritas?",
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center animate-fade-in p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md animate-slide-up flex flex-col max-h-[82vh] bg-surface border border-theme rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-theme bg-main shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <CompassIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold text-text-main">
              Konsultasi Telematika & Rute
            </h3>
            <p className="text-[11px] text-text-muted">Asisten Lapangan Operasional</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl hover:bg-surface text-text-muted hover:text-text-main transition-colors flex items-center justify-center shrink-0"
            type="button"
            aria-label="Tutup"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 text-xs">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl p-3 leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-white rounded-br-none"
                    : "bg-main border border-theme text-text-main rounded-bl-none"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 opacity-75 text-[10px] font-semibold">
                  {msg.role === "ai" ? (
                    <>
                      <NavigationIcon className="w-3 h-3 text-primary" />
                      <span>Asisten Lapangan</span>
                    </>
                  ) : (
                    <>
                      <UserIcon className="w-3 h-3" />
                      <span>Kurir</span>
                    </>
                  )}
                </div>
                <p className="font-normal whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-text-muted text-xs p-2">
              <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="font-medium">Menganalisis kondisi lapangan...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions & Input */}
        <div className="p-3 border-t border-theme bg-main shrink-0 space-y-2.5">
          <div className="relative">
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 pr-6 scrollbar-hide">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(s)}
                  className="px-3 py-1.5 min-h-[34px] rounded-lg bg-surface border border-theme text-text-muted hover:text-text-main hover:border-primary/50 text-xs font-medium whitespace-nowrap transition-colors shadow-sm shrink-0"
                  type="button"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-main to-transparent" />
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tanyakan status lalu lintas atau saran rute..."
              className="flex-1 min-h-[44px] bg-surface border border-theme rounded-xl px-3.5 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-sans"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-11 h-11 rounded-xl btn-sage flex items-center justify-center shrink-0 disabled:opacity-50"
              type="button"
              aria-label="Kirim pertanyaan"
            >
              <SendIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
