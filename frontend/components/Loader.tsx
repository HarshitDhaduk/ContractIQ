"use client";

import { Loader2 } from "lucide-react";

interface LoaderProps {
  fullScreen?: boolean;
  message?: string;
}

export function Loader({ fullScreen = false, message = "Loading..." }: LoaderProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4 p-8 animate-in fade-in duration-500">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
        <Loader2 className="w-6 h-6 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
      </div>
      <p className="text-sm font-medium text-slate-400 tracking-wide animate-pulse">
        {message}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0f1e]/80 backdrop-blur-md">
        {content}
      </div>
    );
  }

  return (
    <div className="w-full min-h-[400px] flex items-center justify-center">
      {content}
    </div>
  );
}
