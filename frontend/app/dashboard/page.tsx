"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { api, type Job, isProcessingStatus, isFailedStatus } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Upload, Briefcase, ArrowRight, FileText } from "lucide-react";
import { CardSkeleton, TableRowSkeleton } from "@/components/Skeleton";

export default function DashboardPage() {
  const { user, idToken } = useAuth();
  const { data: rawJobs, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api.listJobs(idToken),
    refetchInterval: 10000,
  });

  const jobs: Job[] = rawJobs?.jobs ?? [];
  const recent = jobs.slice(0, 5);
  const inProgress = jobs.filter((j: Job) =>
    isProcessingStatus(j.status) || j.status === "PENDING_REVIEW"
  ).length;
  const completed = jobs.filter((j: Job) => j.status === "COMPLETE").length;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">
          Welcome back{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}
        </h1>
        <p className="text-slate-400 text-sm">Here&apos;s what&apos;s happening with your contract reviews.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {isLoading && jobs.length === 0 ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          [
            { label: "Total Jobs",   value: jobs.length, icon: Briefcase, color: "text-blue-400" },
            { label: "In Progress",  value: inProgress,  icon: FileText,  color: "text-orange-400" },
            { label: "Completed",    value: completed,   icon: FileText,  color: "text-emerald-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="p-5 rounded-xl border border-white/[0.07] bg-white/[0.025]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-400">{label}</span>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="text-3xl font-bold text-white">{value}</div>
            </div>
          ))
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <Link
          href="/dashboard/upload"
          className="group flex items-center justify-between p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all duration-150"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <Upload className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Upload Contracts</p>
              <p className="text-xs text-slate-500">Batch review up to 100 PDFs</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
        </Link>
        <Link
          href="/dashboard/jobs"
          className="group flex items-center justify-between p-5 rounded-xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.04] transition-all duration-150"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">View All Jobs</p>
              <p className="text-xs text-slate-500">Track review progress</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
        </Link>
      </div>

      {/* Recent Jobs */}
      {(recent.length > 0 || isLoading) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Recent Jobs</h2>
            <Link href="/dashboard/jobs" className="text-xs text-blue-400 hover:text-blue-300">
              View all →
            </Link>
          </div>
          <div className="rounded-xl border border-white/[0.07] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Job ID</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Contracts</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && jobs.length === 0 ? (
                  <>
                    <TableRowSkeleton />
                    <TableRowSkeleton />
                    <TableRowSkeleton />
                  </>
                ) : (
                  recent.map((job, i) => (
                    <tr
                      key={job.job_id}
                      className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${
                        i === recent.length - 1 ? "border-b-0" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/jobs/${job.job_id}`}
                          className="font-mono text-xs text-blue-400 hover:text-blue-300"
                        >
                          {job.job_id.slice(0, 8)}…
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{job.contract_count}</td>
                      <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(job.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && jobs.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <Briefcase className="w-10 h-10 mx-auto mb-4 opacity-30" />
          <p className="text-sm mb-4">No jobs yet. Upload contracts to get started.</p>
          <Link href="/dashboard/upload" className="btn-primary">
            <Upload className="w-4 h-4" /> Upload Contracts
          </Link>
        </div>
      )}
    </div>
  );
}
