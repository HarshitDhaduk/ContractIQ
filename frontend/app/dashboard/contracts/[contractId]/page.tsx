"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ClauseRisk, type ExtractedClause, type Redline } from "@/lib/api";
import { useToast } from "@/components/toast";
import { ArrowLeft, Loader2, X, BookOpen, Zap } from "lucide-react";
import { ContractSkeleton } from "@/components/Skeleton";
import { DocViewer } from "@/components/DocViewer";

interface Props { params: Promise<{ contractId: string }> }

interface AnnotatedClause {
  clause_type: string;
  original_text: string;
  page_ref: number[];
  is_standard: boolean;
  deviation_summary: string | null;
  risk_score: number;
  risk_level: "HIGH" | "MEDIUM" | "LOW";
  risk_category?: string;
  explanation: string;
  recommended_action: string;
  redline?: Redline;
}

function merge(clauses: ExtractedClause[], risks: ClauseRisk[], redlines: Redline[]): AnnotatedClause[] {
  return risks.map((r) => {
    const c = clauses.find((x) => x.clause_type === r.clause_type);
    const rl = redlines.find((x) => x.clause_type === r.clause_type);
    return {
      clause_type: r.clause_type,
      original_text: c?.original_text || rl?.original_text || "",
      page_ref: c?.page_ref || [],
      is_standard: c?.is_standard ?? true,
      deviation_summary: c?.deviation_summary || null,
      risk_score: r.risk_score ?? 0,
      risk_level: r.risk_level ?? (r.risk_score >= 70 ? "HIGH" : r.risk_score >= 40 ? "MEDIUM" : "LOW"),
      risk_category: r.risk_category,
      explanation: r.explanation ?? "",
      recommended_action: r.recommended_action ?? "ACCEPT",
      redline: rl,
    };
  });
}

/* ── Score Tile ──────────────────────────────────────────────────────── */
const TILE_COLORS = {
  HIGH:   "bg-red-500/20 border-red-500/30 hover:bg-red-500/30 hover:border-red-500/50",
  MEDIUM: "bg-amber-500/15 border-amber-500/25 hover:bg-amber-500/25 hover:border-amber-500/40",
  LOW:    "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/35",
};
const TILE_TEXT = {
  HIGH:   "text-red-300",
  MEDIUM: "text-amber-300",
  LOW:    "text-emerald-300",
};
const TILE_SCORE = {
  HIGH:   "text-red-100",
  MEDIUM: "text-amber-100",
  LOW:    "text-emerald-100",
};

function ScoreTile({ clause, selected, onClick }: { clause: AnnotatedClause; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg border text-left transition-all duration-200 min-w-[140px] ${TILE_COLORS[clause.risk_level]} ${
        selected ? "ring-2 ring-white/40 scale-[1.03] shadow-lg" : ""
      }`}
    >
      <p className={`text-[10px] font-bold uppercase tracking-wider leading-tight mb-1 ${TILE_TEXT[clause.risk_level]}`}>
        {clause.clause_type.replace(/_/g, " ")}
      </p>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-black leading-none ${TILE_SCORE[clause.risk_level]}`}>{clause.risk_score}</span>
        <span className={`text-[10px] font-bold opacity-40 ${TILE_TEXT[clause.risk_level]}`}>/100</span>
      </div>
    </button>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────── */
export default function ContractReviewPage({ params }: Props) {
  const { contractId } = use(params);
  const { idToken } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<AnnotatedClause | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [viewTab, setViewTab] = useState<"analysis" | "original" | "source">("analysis");
  const detailRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to detail panel when a clause is selected
  useEffect(() => {
    if (selected && detailRef.current) {
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [selected]);

  const { data: contract } = useQuery({
    queryKey: ["contract-detail", contractId],
    queryFn: () => api.getContractDetails(contractId, idToken),
  });
  const { data: risk, isLoading: riskLoading } = useQuery({
    queryKey: ["contract-risk", contractId],
    queryFn: () => api.getContractRisk(contractId, idToken),
  });
  const { data: clauseBundle } = useQuery({
    queryKey: ["contract-clauses", contractId],
    queryFn: () => api.getContractClauses(contractId, idToken),
  });
  const { data: redlineData } = useQuery({
    queryKey: ["contract-redlines", contractId],
    queryFn: () => api.getContractRedlines(contractId, idToken),
  });
  const { data: job } = useQuery({
    queryKey: ["job-for-contract", contract?.job_id],
    queryFn: () => api.getJob(contract!.job_id!, idToken),
    enabled: !!contract?.job_id,
  });
  const { data: playbook } = useQuery({
    queryKey: ["playbook", job?.playbook_id],
    queryFn: () => api.getPlaybook(job!.playbook_id!, idToken),
    enabled: !!job?.playbook_id,
  });

  const redlines = redlineData ?? [];

  const mutation = useMutation({
    mutationFn: (action: "APPROVE" | "OVERRIDE" | "ESCALATE") =>
      api.reviewContract(contractId, { action, notes: decisionNote, job_id: contract?.job_id }, idToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-risk", contractId] });
      toast("Review decision submitted!", "success");
    },
    onError: (e: unknown) => toast(e instanceof Error ? e.message : "Failed", "error"),
  });

  if (riskLoading) return <ContractSkeleton />;
  if (!risk) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
          <h2 className="text-lg font-bold text-slate-300 mb-2">Analyzing Document...</h2>
          <p className="text-slate-500 text-sm max-w-md mb-6">AI agents are extracting clauses and scoring risks.</p>
          <Link href="/dashboard/jobs" className="btn-secondary text-sm">Back to Jobs</Link>
        </div>
      </div>
    );
  }

  const annotated = merge(clauseBundle?.clauses || [], risk.clause_risks || [], redlines);
  const sorted = [...annotated].sort((a, b) => b.risk_score - a.risk_score);
  const critical = sorted.filter((c) => c.risk_level === "HIGH" || c.risk_level === "MEDIUM");
  const acceptable = sorted.filter((c) => c.risk_level === "LOW");
  const missingClauses = clauseBundle?.missing_clauses || [];
  const riskColor = risk.contract_risk_score >= 70 ? "text-red-400 bg-red-500/15" :
    risk.contract_risk_score >= 40 ? "text-amber-400 bg-amber-500/15" : "text-emerald-400 bg-emerald-500/15";

  // Base URL for the proxy
  const baseUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/v1"}/contracts/${contractId}/download`;

  const renderDocViewer = (label: string, type: "original" | "redline") => {
    // Determine the URL and filename
    const downloadUrl = `${baseUrl}?doc_type=${type}`;
    // If we request redline, we assume it's a docx.
    const filename = type === "redline" 
      ? `${(contract?.filename || "document").split(".")[0]}_redlined.docx` 
      : contract?.filename || "";
      
    // Only show viewer if there's an original gcs_uri available as a baseline
    const canView = !!contract?.gcs_uri;

    return (
      <div className="w-full h-full p-4 flex flex-col">
        <div className="flex-1 rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
          <DocViewer url={canView ? downloadUrl : null} filename={filename} label={label} />
        </div>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col -m-6">
      {/* ═══ HEADER ═══ */}
      <div className="h-14 border-b border-white/[0.08] bg-slate-950/60 backdrop-blur-md px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <Link href={contract?.job_id ? `/dashboard/jobs/${contract.job_id}` : "/dashboard/jobs"} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-black text-white leading-none">Contract Review</h1>
            <p className="text-[9px] text-slate-500 font-mono tracking-widest mt-0.5">{contractId}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {playbook && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <BookOpen className="w-3 h-3 text-violet-400" />
              <span className="text-[10px] font-bold text-violet-300">{playbook.name}</span>
            </div>
          )}
          <div className="flex bg-white/5 p-0.5 rounded-lg">
            {(["original", "analysis", "source"] as const).map((tab) => (
              <button key={tab} onClick={() => setViewTab(tab)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                  viewTab === tab ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >{tab === "original" ? "Original Doc" : tab === "analysis" ? "AI Analysis" : "Redlined Doc"}</button>
            ))}
          </div>
          <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 font-black text-sm ${riskColor}`}>
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{risk.contract_risk_score >= 70 ? "HIGH" : risk.contract_risk_score >= 40 ? "MED" : "LOW"}</span>
            {Math.round(risk.contract_risk_score)}
          </div>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className="flex-1 overflow-hidden">
        {viewTab !== "analysis" ? renderDocViewer(viewTab === "original" ? "Original Document" : "AI Redlined", viewTab === "original" ? "original" : "redline") : (
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

              {/* ── 1. EXECUTIVE SUMMARY ──────────────────────────── */}
              <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Executive Summary</p>
                <p className="text-[13px] text-slate-200 leading-relaxed mb-4">{risk.executive_summary}</p>
                {risk.critical_flags?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {risk.critical_flags.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 uppercase tracking-wide">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                        {f.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
                {risk.recommended_action && (
                  <p className={`text-[11px] font-black uppercase tracking-wider ${risk.recommended_action === "REJECT" ? "text-red-400" : risk.recommended_action === "NEGOTIATE" ? "text-amber-400" : "text-emerald-400"}`}>Overall Recommendation: {risk.recommended_action}</p>
                )}
              </div>

              {/* ── 2. RISK HEATMAP ───────────────────────────────── */}
              <div className="p-6 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-5">Risk Heatmap</p>
                {critical.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3">Critical Vulnerabilities</p>
                    <div className="flex flex-wrap gap-3">
                      {critical.map((c) => (<ScoreTile key={c.clause_type} clause={c} selected={selected?.clause_type === c.clause_type} onClick={() => setSelected(selected?.clause_type === c.clause_type ? null : c)} />))}
                    </div>
                  </div>
                )}
                {acceptable.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3">Acceptable Terms</p>
                    <div className="flex flex-wrap gap-3">
                      {acceptable.map((c) => (<ScoreTile key={c.clause_type} clause={c} selected={selected?.clause_type === c.clause_type} onClick={() => setSelected(selected?.clause_type === c.clause_type ? null : c)} />))}
                    </div>
                  </div>
                )}
                {missingClauses.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-white/[0.05]">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Missing Clauses</p>
                    <div className="flex flex-wrap gap-2">
                      {missingClauses.map((c) => (<span key={c} className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[10px] font-bold text-slate-400 uppercase">{c.replace(/_/g, " ")}</span>))}
                    </div>
                  </div>
                )}
              </div>

              {/* ═══ EXPANDED DETAIL PANEL ═══ */}
              {selected && (
                <div ref={detailRef} className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Detail Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">
                        {selected.clause_type.replace(/_/g, " ")}
                      </h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        selected.risk_level === "HIGH" ? "bg-red-500/20 text-red-400" :
                        selected.risk_level === "MEDIUM" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"
                      }`}>
                        {selected.risk_level} {selected.risk_score}
                      </span>
                      {!selected.is_standard && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-violet-500/15 text-violet-400 border border-violet-500/20">
                          <Zap className="w-2.5 h-2.5" /> Deviation
                        </span>
                      )}
                    </div>
                    <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="px-6 py-5 space-y-5">
                    {/* Explanation */}
                    <div className="flex items-start gap-3">
                      <div className={`w-1 rounded-full self-stretch shrink-0 ${
                        selected.risk_level === "HIGH" ? "bg-red-500" : selected.risk_level === "MEDIUM" ? "bg-amber-500" : "bg-emerald-500"
                      }`} />
                      <p className="text-[13px] text-slate-200 leading-relaxed italic">
                        &ldquo;{selected.explanation}&rdquo;
                      </p>
                    </div>

                    {/* Action */}
                    <div className={`px-4 py-2.5 rounded-lg font-bold text-[12px] uppercase tracking-wider ${
                      selected.recommended_action === "BLOCK" || selected.recommended_action === "ESCALATE"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : selected.recommended_action === "NEGOTIATE"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}>
                      Advice: {selected.recommended_action}
                    </div>

                    {/* Original text */}
                    {selected.original_text && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Original Clause Text</p>
                        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                          <p className="text-[12px] text-slate-300 leading-relaxed">{selected.original_text}</p>
                          {selected.page_ref.length > 0 && (
                            <p className="text-[9px] text-slate-600 font-mono mt-2">Page {selected.page_ref.join(", ")}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Playbook deviation */}
                    {!selected.is_standard && selected.deviation_summary && (
                      <div>
                        <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <BookOpen className="w-3 h-3" /> Playbook Deviation
                        </p>
                        <div className="p-4 rounded-lg bg-violet-500/[0.04] border border-violet-500/15">
                          <p className="text-[12px] text-violet-300/80 leading-relaxed">{selected.deviation_summary}</p>
                        </div>
                      </div>
                    )}

                    {/* Redline */}
                    {selected.redline && (
                      <div>
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Proposed Redline</p>
                        <div className="space-y-3">
                          {selected.redline.original_text && (
                            <div className="p-4 rounded-lg bg-red-500/[0.05] border border-red-500/15">
                              <p className="text-[9px] font-bold text-red-400/60 uppercase mb-1.5">Original Text</p>
                              <p className="text-[12px] text-red-300/70 leading-relaxed italic line-through decoration-red-500/30">
                                {selected.redline.original_text}
                              </p>
                            </div>
                          )}
                          <div className="p-4 rounded-lg bg-emerald-500/[0.05] border border-emerald-500/15">
                            <p className="text-[9px] font-bold text-emerald-400/60 uppercase mb-1.5">
                              {selected.redline.original_text ? "AI Suggestion" : "New Clause (AI Generated)"}
                            </p>
                            <p className="text-[12px] text-emerald-300 leading-relaxed font-medium">{selected.redline.proposed_text}</p>
                          </div>
                          <p className="text-[11px] text-slate-500 italic">
                            <span className="text-blue-400/60 font-bold not-italic uppercase mr-1">Rationale:</span>
                            {selected.redline.rationale}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Executive summary already shown at top */}

              {/* ── Decision Panel ────────────────────────────────── */}
              <div className="p-5 rounded-xl border border-white/[0.08] bg-slate-950/60 backdrop-blur-sm">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3">Counsel Review &amp; Disposition</p>
                <div className="flex items-end gap-3">
                  <textarea
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="Add review comments, conditions, or rationale..."
                    rows={1}
                    className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500/40 resize-none"
                  />
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => mutation.mutate("APPROVE")} disabled={mutation.isPending}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-xl transition-all shadow-lg disabled:opacity-50">
                      Approve
                    </button>
                    <button onClick={() => mutation.mutate("OVERRIDE")} disabled={mutation.isPending}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold rounded-xl transition-all shadow-lg disabled:opacity-50">
                      Negotiate
                    </button>
                    <button onClick={() => mutation.mutate("ESCALATE")} disabled={mutation.isPending}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold rounded-xl transition-all shadow-lg disabled:opacity-50">
                      Escalate
                    </button>
                  </div>
                </div>
              </div>

              <div className="h-4" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
