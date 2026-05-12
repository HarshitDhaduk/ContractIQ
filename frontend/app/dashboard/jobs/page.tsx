"use client";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { listJobs } from "@/lib/api";
import Link from "next/link";
import { motion } from "framer-motion";
import { Briefcase, Clock, ChevronRight } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  QUEUED: "text-slate-400 bg-slate-800",
  INGESTING: "text-blue-300 bg-blue-900/40",
  EXTRACTING: "text-blue-300 bg-blue-900/40",
  SCORING: "text-violet-300 bg-violet-900/40",
  REDLINING: "text-violet-300 bg-violet-900/40",
  PENDING_REVIEW: "text-orange-300 bg-orange-900/40",
  APPROVED: "text-emerald-300 bg-emerald-900/40",
  COMPLETE: "text-emerald-300 bg-emerald-900/40",
  FAILED: "text-red-300 bg-red-900/40",
};

export default function JobsPage() {
  const { idToken } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => listJobs(idToken),
    refetchInterval: 5000,
    enabled: !!idToken,
  });
  const jobs: any[] = data?.jobs ?? [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Jobs</h1>
          <p className="text-slate-400 mt-1">All contract review batches</p>
        </div>
        <Link href="/dashboard/upload">
          <button className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all">
            + New Batch
          </button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 glass shimmer rounded-xl" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="glass p-16 flex flex-col items-center text-center">
          <Briefcase className="w-14 h-14 text-slate-600 mb-4" />
          <p className="text-slate-400 mb-4">No jobs yet.</p>
          <Link href="/dashboard/upload">
            <button className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all">
              Upload Contracts
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job: any, i: number) => {
            const progress = job.contract_count > 0
              ? Math.round((job.contracts_complete / job.contract_count) * 100) : 0;
            return (
              <motion.div key={job.job_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/dashboard/jobs/${job.job_id}`}>
                  <div className="glass glass-hover p-5 flex items-center gap-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-semibold text-indigo-300">{job.job_id}</code>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${STATUS_COLORS[job.status] ?? ""}`}>
                          {job.status?.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {job.contract_count} contracts · Playbook: {job.playbook_id}
                      </p>
                      {/* Progress bar */}
                      {job.contract_count > 0 && job.status !== "QUEUED" && job.status !== "COMPLETE" && (
                        <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden w-48">
                          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 text-xs">
                      <Clock className="w-3.5 h-3.5" />
                      {job.created_at ? new Date(job.created_at).toLocaleString() : "—"}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
