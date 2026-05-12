"use client";
import { use } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { getJob, listJobContracts } from "@/lib/api";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, AlertTriangle, CheckCircle, Clock } from "lucide-react";

const RISK_COLOR = { HIGH: "risk-bg-high", MEDIUM: "risk-bg-medium", LOW: "risk-bg-low" };
const RISK_TEXT = { HIGH: "risk-high", MEDIUM: "risk-medium", LOW: "risk-low" };

export default function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const { idToken } = useAuth();

  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getJob(jobId, idToken),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "COMPLETE" || s?.startsWith("FAILED") ? false : 4000;
    },
    enabled: !!idToken,
  });

  const { data: contractsData } = useQuery({
    queryKey: ["job-contracts", jobId],
    queryFn: () => listJobContracts(jobId, idToken),
    refetchInterval: 6000,
    enabled: !!idToken,
  });
  const contracts: any[] = contractsData?.contracts ?? [];

  const overallScore = contracts.length > 0
    ? Math.round(contracts.reduce((s: number, c: any) => s + (c.risk_score ?? 0), 0) / contracts.length)
    : null;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-slate-500 text-sm mb-3">
          <Link href="/dashboard/jobs" className="hover:text-slate-300 transition-colors">Jobs</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-300 font-mono">{jobId}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{job?.playbook_id ?? "—"}</h1>
            <p className="text-slate-400 text-sm mt-1">
              {job?.contract_count ?? 0} contracts · Reviewer: {job?.reviewer_email ?? "—"}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${
            job?.status === "COMPLETE" ? "text-emerald-300 bg-emerald-900/40" :
            job?.status === "PENDING_REVIEW" ? "text-orange-300 bg-orange-900/40" :
            "text-blue-300 bg-blue-900/40"
          }`}>
            {job?.status?.replace("_", " ") ?? "—"}
          </span>
        </div>
      </div>

      {/* Overall risk meter */}
      {overallScore !== null && (
        <div className="glass p-5 mb-6 flex items-center gap-6">
          <div className="text-center">
            <div className={`text-4xl font-extrabold ${
              overallScore >= 70 ? "text-red-400" : overallScore >= 40 ? "text-amber-400" : "text-emerald-400"
            }`}>{overallScore}</div>
            <div className="text-xs text-slate-400 mt-1">Batch Risk Score</div>
          </div>
          <div className="flex-1">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  overallScore >= 70 ? "bg-red-500" : overallScore >= 40 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${overallScore}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Low Risk</span><span>High Risk</span>
            </div>
          </div>
        </div>
      )}

      {/* Contract list */}
      <h2 className="text-lg font-semibold text-white mb-4">Contracts ({contracts.length})</h2>
      <div className="space-y-2">
        {contracts.map((c: any, i: number) => {
          const level = c.risk_level as keyof typeof RISK_COLOR;
          return (
            <motion.div key={c.contract_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link href={`/dashboard/contracts/${c.contract_id}`}>
                <div className="glass glass-hover p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.filename ?? c.contract_id}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {c.critical_flags?.slice(0, 3).map((f: string) => (
                        <span key={f} className="text-xs text-red-300 bg-red-900/30 px-1.5 py-0.5 rounded">
                          {f.replace("_", " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                  {c.risk_score != null && (
                    <div className="text-right">
                      <div className={`text-lg font-bold ${level ? RISK_TEXT[level] : "text-slate-300"}`}>
                        {c.risk_score}
                      </div>
                      <div className="text-xs text-slate-500">risk</div>
                    </div>
                  )}
                  {c.status === "PENDING_REVIEW" && (
                    <div className="flex items-center gap-1 text-orange-300 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Review needed
                    </div>
                  )}
                  {c.status === "COMPLETE" && (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </div>
              </Link>
            </motion.div>
          );
        })}
        {contracts.length === 0 && (
          <div className="glass p-10 flex flex-col items-center text-center">
            <Clock className="w-10 h-10 text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm">Pipeline running — contracts will appear here shortly.</p>
          </div>
        )}
      </div>
    </div>
  );
}
