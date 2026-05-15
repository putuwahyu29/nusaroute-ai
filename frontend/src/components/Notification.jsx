import React, { useEffect } from "react";
import { CheckIcon, AlertIcon, RobotIcon } from "./UiIcons.jsx";

/**
 * Modern Toast Notification Component
 * @param {Object} props
 * @param {string} props.message - The message to show
 * @param {string} props.type - 'success', 'error', 'info'
 * @param {Function} props.onClose - Callback when closed or timed out
 */
export default function Notification({ message, type = "success", onClose, duration = 4000 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const icons = {
    success: <CheckIcon className="w-5 h-5 text-green-500" />,
    error: <AlertIcon className="w-5 h-5 text-red-500" />,
    info: <RobotIcon className="w-5 h-5 text-blue-500" />,
  };

  const bgColors = {
    success: "bg-green-500/10 border-green-500/20",
    error: "bg-red-500/10 border-red-500/20",
    info: "bg-blue-500/10 border-blue-500/20",
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] animate-slide-up">
      <div className={`flex items-center gap-4 px-6 py-4 rounded-3xl border backdrop-blur-xl shadow-2xl ${bgColors[type]} min-w-[320px] max-w-[90vw]`}>
        <div className="shrink-0">
          {icons[type]}
        </div>
        <div className="flex-1">
          <p className="text-xs font-black text-text-main leading-tight uppercase tracking-wide">
            {type === 'success' ? 'Sistem Berhasil' : type === 'error' ? 'Peringatan Sistem' : 'Analisis AI'}
          </p>
          <p className="text-[11px] text-text-muted font-bold mt-0.5 leading-relaxed">
            {message}
          </p>
        </div>
        <button 
          onClick={onClose}
          className="ml-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5 text-text-muted transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
