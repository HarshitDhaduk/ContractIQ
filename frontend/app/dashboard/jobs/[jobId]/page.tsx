"use client";

import { use } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { RiskBadge } from "@/components/RiskBadge";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { Skeleton, TableRowSkeleton } from "@/components/Skeleton";

interface Props { params: Promise<{ jobId: string }> }

export default function JobDetailPage({ params }: Props) {
  const { jobId } = use(params);
  const { idToken } = useAuth();

  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api.getJob(jobId, idToken),
    refetchInterval: 2000,
  });

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["job-contracts", jobId],
    queryFn: () => api.getJobContracts(jobId, idToken),
    refetchInterval: 2000,
  });

  if (!job && isLoading) {
    return (
      <div className="max-w-5xl mx-auto animate-pulse">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="w-48 h-8" />
            <Skeleton className="w-32 h-4" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Skeleton className="lg:col-span-2 h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <Skeleton className="h-32 rounded-xl mb-8" />
        <div className="space-y-4">
          <Skeleton className="w-40 h-4" />
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.01] overflow-hidden shadow-xl">
            <div className="h-12 bg-white/[0.03] border-b border-white/[0.06]" />
            <div className="p-4 space-y-4">
              <Skeleton className="w-full h-10 rounded-lg" />
              <Skeleton className="w-full h-10 rounded-lg" />
              <Skeleton className="w-full h-10 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard/jobs" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white mb-1">
            Job <span className="font-mono text-blue-400 text-lg">{jobId}</span>
          </h1>
          {job && (
            <div className="flex items-center gap-3">
              <StatusBadge status={job.status} size="md" />
              <span className="text-xs text-slate-500">{job.contract_count} contracts</span>
              {job.overall_risk_score !== undefined && (
                <RiskBadge
                  level={job.overall_risk_score >= 70 ? "HIGH" : job.overall_risk_score >= 40 ? "MEDIUM" : "LOW"}
                  showScore={Math.round(job.overall_risk_score)}
                  size="md"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Execution Summary / Error Report */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 p-6 rounded-xl border border-white/[0.07] bg-white/[0.02] flex flex-col justify-between min-h-[160px]">
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Execution Summary</h3>
            {job?.status === "FAILED" && job.error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
                <p className="text-xs font-semibold text-red-400 mb-1">Failure Reason:</p>
                <p className="text-xs text-red-300 font-mono break-all">{job.error}</p>
              </div>
            )}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400">Pipeline Progress</span>
              <span className="text-xs text-slate-500">{job?.contracts_complete || 0} / {job?.contract_count || 0} completed</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-700"
                style={{ width: `${job?.contract_count > 0 ? (job.contracts_complete / job.contract_count) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl border border-white/[0.07] bg-white/[0.02]">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Batch Details</h3>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Reviewer</p>
              <p className="text-xs text-slate-300 truncate">{job?.reviewer_email || "Not specified"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">SLA</p>
                <p className="text-xs text-slate-300">{job?.sla_hours || 24}h</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Created</p>
                <p className="text-xs text-slate-300">{job ? new Date(job.created_at).toLocaleDateString() : "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Executive Summary */}
      <div className="mb-8 p-8 min-h-[180px] rounded-xl border border-blue-500/10 bg-blue-500/[0.02] relative overflow-hidden flex flex-col justify-center">
        {/* Responsive Circular Gauge / Icon - Centered vertically and contained within margins */}
        <div className="absolute top-1/2 -translate-y-1/2 right-4 sm:right-10 opacity-10 sm:opacity-40 pointer-events-none z-0">
          {job?.status === "COMPLETE" && job.overall_risk_score !== undefined ? (
            <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex flex-col items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="50%" cy="50%" r="45%" fill="none" stroke="currentColor" strokeWidth="10" className="text-white/5" />
                <circle
                  cx="50%"
                  cy="50%"
                  r="45%"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (283 * job.overall_risk_score) / 100}
                  className={job.overall_risk_score >= 70 ? "text-red-500" : job.overall_risk_score >= 40 ? "text-amber-500" : "text-emerald-500"}
                  strokeLinecap="round"
                />
              </svg>
              <span className="relative z-10 text-3xl sm:text-4xl font-black text-white">{Math.round(job.overall_risk_score)}</span>
              <span className="relative z-10 text-[8px] sm:text-[10px] font-black text-white/40 uppercase tracking-[0.2em] -mt-1">Risk Score</span>
            </div>
          ) : job?.status === "FAILED" ? (
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-red-500/10 flex items-center justify-center text-red-500/40">
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          ) : (
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-[6px] border-blue-500/10 border-t-blue-500 animate-spin" />
          )}
        </div>

        <div className="relative z-10 sm:pr-48"> {/* Increased padding to make room for larger gauge */}
          <h3 className="text-xs font-bold text-blue-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Global Executive Summary
          </h3>
          
          {!contracts.some(c => c.risk_report) && job?.status !== "FAILED" ? (
            <div className="space-y-4">
              <div className="space-y-3 max-w-full sm:max-w-md">
                <Skeleton className="w-full h-4 rounded-md" />
                <Skeleton className="w-[85%] h-4 rounded-md" />
                <Skeleton className="w-[60%] h-4 rounded-md" />
              </div>
              <div className="flex items-center gap-2 text-xs text-blue-400/60 font-medium italic animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                Initializing multi-agent analysis swarm...
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-200 text-base leading-relaxed max-w-2xl font-medium">
                {contracts.find(c => c.risk_report)?.risk_report?.executive_summary || 
                 "Analysis complete. Our AI agents have reviewed the batch and found no critical risks requiring immediate escalation."}
              </p>
              
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Batch Progress:</span>
                  <span className="text-xs text-blue-400 font-mono font-bold">
                    {job?.contracts_complete || 0} / {job?.contract_count || 0} Analyzed
                  </span>
                </div>
                
                {contracts.some(c => c.risk_report?.recommended_action) && (
                  <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
                    contracts.some(c => c.risk_report?.recommended_action === "REJECT") 
                      ? "bg-red-500/10 border-red-500/20 text-red-400" 
                      : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  }`}>
                    <span className="text-[10px] font-bold uppercase tracking-tight opacity-70">Primary Recommendation:</span>
                    <span className="text-xs font-bold uppercase">
                      {contracts.find(c => c.risk_report)?.risk_report?.recommended_action}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contracts table */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-sm font-semibold text-slate-300">Contract Analysis</h2>
        <span className="text-[10px] font-medium text-slate-500 uppercase">
          {job?.contract_count || contracts.length} Documents
        </span>
      </div>
      
      {isLoading && contracts.length === 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.01] overflow-x-auto shadow-xl">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider">File Name</th>
                <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider hidden sm:table-cell">Type</th>
                <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider">Risk</th>
                <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider hidden md:table-cell">Action</th>
                <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider hidden lg:table-cell">Redlines</th>
                <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              <TableRowSkeleton />
              <TableRowSkeleton />
              <TableRowSkeleton />
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && contracts.length === 0 && (
        <div className="text-center py-16 text-slate-500 text-sm border border-dashed border-white/5 rounded-xl">
          No contracts found for this job.
        </div>
      )}

      {contracts.length > 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.01] overflow-x-auto shadow-xl">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider">File Name</th>
                <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider hidden sm:table-cell">Type</th>
                <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider">Risk</th>
                <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider hidden md:table-cell">Action</th>
                <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider hidden lg:table-cell">Redlines</th>
                <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {contracts.map((c) => {
                const score = c.risk_report?.contract_risk_score ?? c.risk_score;
                const level = score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
                
                return (
                  <tr key={c.contract_id} className={`hover:bg-white/[0.025] transition-colors group ${c.is_placeholder ? "opacity-60 grayscale animate-pulse" : ""}`}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-slate-200 text-xs font-medium truncate max-w-[240px]">
                          {c.filename ?? c.file_name}
                          {c.is_placeholder && <span className="ml-2 text-[8px] text-blue-500 font-bold uppercase tracking-widest">Registering...</span>}
                        </span>
                        {c.page_count && <span className="text-[10px] text-slate-500">{c.page_count} pages</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5 uppercase">
                        {c.contract_type ?? "OTHER"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {score !== undefined ? (
                        <RiskBadge level={level} showScore={Math.round(score)} />
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {c.risk_report?.recommended_action ? (
                        <span className={`text-[10px] font-bold ${
                          c.risk_report.recommended_action === "REJECT" ? "text-red-400" :
                          c.risk_report.recommended_action === "NEGOTIATE" ? "text-amber-400" :
                          "text-emerald-400"
                        }`}>
                          {c.risk_report.recommended_action}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {c.redlines?.length ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span className="text-xs text-slate-300 font-medium">{c.redlines.length} edits</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                    <td className="px-6 py-4 text-right">
                      {!c.is_placeholder ? (
                        <Link
                          href={`/dashboard/contracts/${c.contract_id}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1 text-xs text-blue-400 font-bold hover:text-blue-300"
                        >
                          Details <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : (
                        <div className="text-[10px] text-slate-600 font-mono">WAITING</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
