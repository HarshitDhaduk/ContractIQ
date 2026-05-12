"use client";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { listJobs } from "@/lib/api";
import Link from "next/link";
import { motion } from "framer-motion";
import { Briefcase, Upload, Clock, CheckCircle, AlertTriangle } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  QUEUED: "text-slate-400 bg-slate-800",
  INGESTING: "text-blue-300 bg-blue-900/40",
  EXTRACTING: "text-blue-300 bg-blue-900/40",
  SCORING: "text-violet-300 bg-violet-900/40",
  REDLINING: "text-violet-300 bg-violet-900/40",
  PENDING_REVIEW: "text-orange-300 bg-orange-900/40",
  COMPLETE: "text-emerald-300 bg-emerald-900/40",
  FAILED: "text-red-300 bg-red-900/40",
};

export default function DashboardPage() {
  const { idToken, user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => listJobs(idToken),
    refetchInterval: 5000,
    enabled: !!idToken,
  });

  const jobs: any[] = data?.jobs ?? [];
  const total = jobs.length;
  const pending = jobs.filter((j) => j.status === "PENDING_REVIEW").length;
  const complete = jobs.filter((j) => j.status === "COMPLETE").length;

  const stats = [
    { label: "Total Jobs", value: total, icon: Briefcase, color: "text-indigo-400" },
    { label: "Awaiting Review", value: pending, icon: AlertTriangle, color: "text-orange-400" },
    { label: "Complete", value: complete, icon: CheckCircle, color: "text-emerald-400" },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Welcome back, {user?.displayName?.split(" ")[0]}</h1>
        <p className="text-slate-400 mt-1">Contract intelligence dashboard</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">{s.label}</span>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className="text-3xl font-bold text-white">{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mb-8">
        <Link href="/dashboard/upload">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-[0_0_20px_rgba(99,102,241,0.25)]">
            <Upload className="w-4 h-4" />
            New Batch Upload
          </button>
        </Link>
        <Link href="/dashboard/jobs">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass glass-hover text-slate-300 font-medium text-sm">
            <Briefcase className="w-4 h-4" />
            View All Jobs
          </button>
        </Link>
      </div>

      {/* Recent jobs */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Recent Jobs</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 glass shimmer rounded-xl" />)}
          </div>
        ) : jobs.length === 0 ? (
          <div className="glass p-12 flex flex-col items-center text-center">
            <Briefcase className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-slate-400 mb-4">No jobs yet. Upload contracts to get started.</p>
            <Link href="/dashboard/upload">
              <button className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all">
                Upload Contracts
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.slice(0, 10).map((job: any, i: number) => (
              <motion.div
                key={job.job_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link href={`/dashboard/jobs/${job.job_id}`}>
                  <div className="glass glass-hover p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm">{job.job_id}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {job.contract_count} contracts · {job.playbook_id}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-xs text-slate-500">
                        {job.created_at ? new Date(job.created_at).toLocaleDateString() : "—"}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_COLOR[job.status] ?? "text-slate-400"}`}>
                        {job.status?.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
