"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle2, AlertCircle, X, Loader2, Info } from "lucide-react";

type ToastType = "success" | "error" | "info" | "loading";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (type !== "loading") {
      setTimeout(() => dismiss(id), 5000);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
    loading: <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />,
  };

  const bgColors = {
    success: "bg-emerald-500/10 border-emerald-500/20",
    error: "bg-red-500/10 border-red-500/20",
    info: "bg-blue-500/10 border-blue-500/20",
    loading: "bg-slate-500/10 border-white/10",
  };

  return (
    <div 
      className={`
        pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md 
        animate-in fade-in slide-in-from-right-8 duration-300 min-w-[300px] max-w-md
        ${bgColors[toast.type]}
      `}
    >
      <div className="flex-shrink-0">{icons[toast.type]}</div>
      <p className="text-sm font-medium text-slate-200 flex-1">{toast.message}</p>
      <button 
        onClick={onDismiss}
        className="text-slate-500 hover:text-slate-300 transition-colors p-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
