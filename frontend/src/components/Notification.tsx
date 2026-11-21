import React, { useEffect } from "react";
import { CheckIcon, AlertIcon, InfoIcon, XIcon } from "./UiIcons";

interface NotificationProps {
  message: string;
  type?: "success" | "error" | "info" | "warning";
  onClose: () => void;
  duration?: number;
}

export default function Notification({
  message,
  type = "info",
  onClose,
  duration = 4000,
}: NotificationProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const config = {
    success: {
      icon: <CheckIcon className="w-4 h-4 text-emerald-500" />,
      border: "border-emerald-500/30",
      title: "Sukses",
    },
    error: {
      icon: <AlertIcon className="w-4 h-4 text-red-500" />,
      border: "border-red-500/30",
      title: "Peringatan",
    },
    info: {
      icon: <InfoIcon className="w-4 h-4 text-sky-500" />,
      border: "border-sky-500/30",
      title: "Informasi Operasional",
    },
    warning: {
      icon: <AlertIcon className="w-4 h-4 text-amber-500" />,
      border: "border-amber-500/30",
      title: "Perhatian",
    },
  }[type] || {
    icon: <InfoIcon className="w-4 h-4 text-sky-500" />,
    border: "border-theme",
    title: "Notifikasi",
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] animate-slide-up w-full max-w-sm px-4">
      <div
        className={`flex items-start gap-3 p-3.5 rounded-xl border bg-surface shadow-lg ${config.border}`}
      >
        <div className="mt-0.5 shrink-0">{config.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-text-main leading-tight">
            {config.title}
          </p>
          <p className="text-xs text-text-muted mt-0.5 leading-snug">
            {message}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-main text-text-dim hover:text-text-main transition-colors shrink-0"
          type="button"
          aria-label="Tutup notifikasi"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
