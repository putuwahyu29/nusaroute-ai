import React, { useState, useRef, useEffect } from "react";
import { sendAIChat } from "../services/api.js";
import { RobotIcon, SendIcon } from "./UiIcons.jsx";

/**
 * AIChatAssistant — Floating AI chat for couriers.
 * Couriers can ask questions in natural language about routes, traffic, deliveries.
 */
export default function AIChatAssistant({ courierId, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Halo! Saya asisten AI NusaRoute. Tanyakan apa saja tentang rute, kemacetan, atau pengiriman Anda hari ini.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    // Add user message
    setMessages((prev) => [...prev, { role: "user", text, timestamp: new Date().toISOString() }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await sendAIChat(text, courierId);
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: res.reply, timestamp: res.timestamp, source: res.source },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Maaf, terjadi kesalahan. Coba lagi.", timestamp: new Date().toISOString() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Quick suggestion chips
  const suggestions = [
    "Zona mana yang macet?",
    "Rute tercepat sekarang?",
    "Cuaca hari ini?",
    "Paket prioritas mana dulu?",
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Chat Container */}
      <div className="relative z-10 w-full max-w-md mx-4 mb-4 sm:mb-0 animate-slide-up flex flex-col max-h-[80vh] bg-surface border border-theme rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-theme bg-main shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
            <RobotIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black text-text-main">Asisten AI</h3>
            <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider">Kecerdasan NusaRoute</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface border border-theme flex items-center justify-center text-text-muted hover:text-red-500 transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide min-h-0">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-white rounded-br-md"
                    : "bg-main border border-theme text-text-main rounded-bl-md"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-main border border-theme rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips (only show when few messages) */}
        {messages.length <= 2 && !isLoading && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => { setInput(s); setTimeout(handleSend, 50); }}
                className="px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-bold text-primary hover:bg-primary/20 active:scale-95 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-3 py-3 border-t border-theme bg-main shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tanya AI tentang rute, macet, cuaca..."
              disabled={isLoading}
              className="flex-1 bg-surface border border-theme rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-muted/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 active:scale-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            >
              <SendIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
