"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { RiskBadge } from "@/components/RiskBadge";
import { Upload, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { Loader } from "@/components/Loader";
import { TableRowSkeleton } from "@/components/Skeleton";

export default function JobsPage() {
  const { idToken } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["jobs", currentPage],
    queryFn: () => api.listJobs(idToken, currentPage, itemsPerPage),
    refetchInterval: 5000,
  });

  const jobs = data?.jobs || [];
  const totalCount = data?.total || 0;

  const [rerunning, setRerunning] = useState<string | null>(null);

  const handleRerun = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation(); // Prevent row click
    setRerunning(jobId);
    try {
      await api.rerunJob(jobId, idToken);
      toast("Job rerun triggered successfully.", "success");
      refetch();
    } catch (e) {
      toast("Failed to trigger rerun", "error");
    } finally {
      setRerunning(null);
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const paginatedJobs = jobs; // Already paginated by server

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Review Jobs</h1>
          <p className="text-slate-400 text-sm">Monitor and manage your contract review batches.</p>
        </div>
        <Link href="/dashboard/upload" className="btn-primary text-sm w-full sm:w-auto justify-center">
          <Upload className="w-4 h-4" /> New Batch
        </Link>
      </div>

      {isLoading && jobs.length === 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.01] overflow-x-auto shadow-2xl mt-8">
          <table className="w-full text-sm min-w-[800px]">
             <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                  <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider">Job ID</th>
                  <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider hidden sm:table-cell">Contracts</th>
                  <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider">Progress</th>
                  <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider hidden md:table-cell">Risk Score</th>
                  <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider hidden lg:table-cell">Created</th>
                  <th className="text-right px-6 py-4" />
                </tr>
              </thead>
            <tbody>
              <TableRowSkeleton />
              <TableRowSkeleton />
              <TableRowSkeleton />
              <TableRowSkeleton />
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && jobs.length === 0 && (
        <div className="text-center py-20 rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
          <p className="text-slate-500 mb-4">No jobs found in your account.</p>
          <Link href="/dashboard/upload" className="btn-primary mx-auto">
            <Upload className="w-4 h-4" /> Upload Contracts
          </Link>
        </div>
      )}

      {jobs.length > 0 && (
        <>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.01] overflow-x-auto shadow-2xl">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                  <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider">Job ID</th>
                  <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider hidden sm:table-cell">Contracts</th>
                  <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider">Progress</th>
                  <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider hidden md:table-cell">Risk Score</th>
                  <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs text-slate-500 font-bold uppercase tracking-wider hidden lg:table-cell">Created</th>
                  <th className="text-right px-6 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {paginatedJobs.map((job) => (
                  <tr 
                    key={job.job_id} 
                    onClick={() => router.push(`/dashboard/jobs/${job.job_id}`)}
                    className="hover:bg-white/[0.03] transition-all cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-blue-400 group-hover:text-blue-300 transition-colors">{job.job_id}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 hidden sm:table-cell">{job.contract_count}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${job.contract_count > 0 ? (job.contracts_complete / job.contract_count) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-slate-500">{job.contracts_complete}/{job.contract_count}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      {job.overall_risk_score !== undefined ? (
                        <RiskBadge
                          level={job.overall_risk_score >= 70 ? "HIGH" : job.overall_risk_score >= 40 ? "MEDIUM" : "LOW"}
                          showScore={Math.round(job.overall_risk_score)}
                        />
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={job.status} /></td>
                    <td className="px-6 py-4 text-xs text-slate-500 hidden lg:table-cell">
                      {new Date(job.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={(e) => handleRerun(e, job.job_id)}
                          disabled={rerunning === job.job_id}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 transition-all disabled:opacity-30 border border-white/5 hover:border-blue-500/20"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${rerunning === job.job_id ? 'animate-spin' : ''}`} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Retry</span>
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 px-2">
              <p className="text-xs text-slate-500">
                Showing <span className="text-slate-300">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="text-slate-300">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of <span className="text-slate-300">{totalCount}</span> results
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-slate-400 hover:bg-white/5 disabled:opacity-30 transition-all"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                        currentPage === i + 1 
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                          : 'text-slate-500 hover:bg-white/5'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-slate-400 hover:bg-white/5 disabled:opacity-30 transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
