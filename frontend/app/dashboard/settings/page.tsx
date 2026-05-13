"use client";

import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, LogOut, Bell } from "lucide-react";

export default function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
        <p className="text-slate-400 text-sm">Manage your account and preferences.</p>
      </div>

      {/* Profile card */}
      <div className="p-5 rounded-xl border border-white/[0.07] bg-white/[0.025] mb-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Account</p>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center text-lg font-bold text-blue-300">
            {user?.displayName?.[0] ?? user?.email?.[0] ?? "U"}
          </div>
          <div>
            <p className="font-medium text-white">{user?.displayName ?? "User"}</p>
            <p className="text-sm text-slate-400">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="p-5 rounded-xl border border-white/[0.07] bg-white/[0.025] mb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Authentication
        </div>
        <p className="text-sm text-slate-300">Signed in with Google via Firebase Auth.</p>
        <p className="text-xs text-slate-500 mt-1">All sessions use short-lived ID tokens — no stored credentials.</p>
      </div>

      {/* Notifications */}
      <div className="p-5 rounded-xl border border-white/[0.07] bg-white/[0.025] mb-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          <Bell className="w-3.5 h-3.5 text-blue-400" /> Notifications
        </div>
        <p className="text-sm text-slate-500">Slack HITL notifications are configured server-side via environment variables.</p>
      </div>

      <button
        onClick={logout}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all duration-150 text-sm font-medium"
      >
        <LogOut className="w-4 h-4" /> Sign out
      </button>
    </div>
  );
}
