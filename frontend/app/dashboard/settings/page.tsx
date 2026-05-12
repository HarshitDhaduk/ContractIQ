"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Settings, Save, Shield } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [slackWebhook, setSlackWebhook] = useState("");
  const [autoThreshold, setAutoThreshold] = useState(30);
  const [slaHours, setSlaHours] = useState(24);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // In production, persist to Firestore org settings
    localStorage.setItem("ciq_settings", JSON.stringify({ slackWebhook, autoThreshold, slaHours }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Agent configuration and notification preferences.</p>
      </div>

      <div className="space-y-5">
        {/* Account */}
        <div className="glass p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Account</h2>
          <div className="flex items-center gap-3">
            {user?.photoURL && <img src={user.photoURL} className="w-10 h-10 rounded-full" alt="avatar" />}
            <div>
              <p className="text-white font-medium">{user?.displayName}</p>
              <p className="text-sm text-slate-400">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* HITL config */}
        <div className="glass p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4" />HITL Agent Configuration
          </h2>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Auto-Approve Threshold <span className="text-indigo-400">{autoThreshold}</span>
            </label>
            <input type="range" min={0} max={100} value={autoThreshold}
              onChange={(e) => setAutoThreshold(Number(e.target.value))}
              className="w-full accent-indigo-500" />
            <p className="text-xs text-slate-500 mt-1">
              Contracts with risk score ≤ {autoThreshold} are auto-approved without human review.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">SLA Hours</label>
            <input type="number" min={1} max={168} value={slaHours}
              onChange={(e) => setSlaHours(Number(e.target.value))}
              className="w-32 px-3 py-2 text-sm rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500" />
            <p className="text-xs text-slate-500 mt-1">
              Contracts not reviewed within {slaHours}h will be auto-escalated.
            </p>
          </div>
        </div>

        {/* Slack */}
        <div className="glass p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Slack Notifications</h2>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Webhook URL</label>
            <input
              value={slackWebhook}
              onChange={(e) => setSlackWebhook(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full px-3 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              When a HIGH-risk contract needs review, ContractIQ will ping this channel.
            </p>
          </div>
        </div>

        <button onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all">
          <Save className="w-4 h-4" />
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
