"use client";

import { use, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type ClauseRisk } from "@/lib/api";
import { RiskBadge } from "@/components/RiskBadge";
import { useToast } from "@/components/toast";
import { ArrowLeft, ChevronRight, AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { Loader } from "@/components/Loader";
import { ContractSkeleton } from "@/components/Skeleton";

interface Props { params: Promise<{ contractId: string }> }

function RiskCell({ clause, onClick, selected }: { clause: ClauseRisk; onClick: () => void; selected: boolean }) {
  const level = clause.risk_level || (clause.risk_score >= 70 ? "HIGH" : clause.risk_score >= 40 ? "MEDIUM" : "LOW");
  const colors = {
    HIGH:   "bg-red-900/40 border-red-500/40 text-red-300 hover:bg-red-900/60 shadow-[0_0_15px_-5px_rgba(239,68,68,0.3)]",
    MEDIUM: "bg-amber-900/30 border-amber-500/30 text-amber-300 hover:bg-amber-900/50 shadow-[0_0_15px_-5px_rgba(245,158,11,0.2)]",
    LOW:    "bg-emerald-900/20 border-emerald-500/20 text-emerald-400 hover:bg-emerald-900/40",
  } as const;
  
  return (
    <button
      onClick={onClick}
      className={`p-2.5 rounded-lg border text-left transition-all duration-200 group relative overflow-hidden ${colors[level]} ${
        selected ? "ring-2 ring-white/50 scale-[1.02]" : "hover:scale-[1.02]"
      }`}
    >
      <div className="text-[9px] font-bold uppercase tracking-widest mb-1 leading-tight opacity-70 group-hover:opacity-100 transition-opacity">
        {clause.clause_type.replace(/_/g, " ")}
      </div>
      <div className="text-xl font-black leading-none flex items-baseline gap-0.5">
        {clause.risk_score}
        <span className="text-[10px] font-bold opacity-40">/100</span>
      </div>
    </button>
  );
}

export default function ContractReviewPage({ params }: Props) {
  const { contractId } = use(params);
  const { idToken } = useAuth();
  const qc = useQueryClient();
  const detailRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<ClauseRisk | null>(null);
  const [decisionNote, setDecisionNote] = useState("");

  const handleSelectClause = (clause: ClauseRisk) => {
    setSelected(clause);
    // Smooth scroll to detail section, centering it in view
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const { data: contract } = useQuery({
    queryKey: ["contract-detail", contractId],
    queryFn: () => api.getContractDetails(contractId, idToken),
  });

  const { data: risk, isLoading: riskLoading } = useQuery({
    queryKey: ["contract-risk", contractId],
    queryFn: () => api.getContractRisk(contractId, idToken),
  });

  const { data: redlines = [] } = useQuery({
    queryKey: ["contract-redlines", contractId],
    queryFn: () => api.getContractRedlines(contractId, idToken),
  });

  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (action: "APPROVE" | "OVERRIDE" | "ESCALATE") =>
      api.reviewContract(contractId, { action, notes: decisionNote }, idToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-risk", contractId] });
      toast("Review decision submitted!", "success");
    },
    onError: (e: unknown) => {
      toast(e instanceof Error ? e.message : "Failed to submit decision", "error");
    }
  });

  const selectedRedline = redlines.find((r) => r.clause_type === selected?.clause_type);

  const getLevel = (score: number) => score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";

  const highClauses = risk?.clause_risks?.filter((c: any) => (c.risk_level || getLevel(c.risk_score)) === "HIGH") ?? [];
  const medClauses  = risk?.clause_risks?.filter((c: any) => (c.risk_level || getLevel(c.risk_score)) === "MEDIUM") ?? [];
  const lowClauses  = risk?.clause_risks?.filter((c: any) => (c.risk_level || getLevel(c.risk_score)) === "LOW") ?? [];

  if (riskLoading) return <ContractSkeleton />;
  if (!risk) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard/jobs" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white mb-1">
              {contract?.filename || "Contract Review"}
            </h1>
            <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">{contractId}</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-300 mb-2">Analysis Not Ready</h2>
          <p className="text-slate-500 text-sm max-w-md mb-8">
            This contract is still being processed by our AI agents. Risk reports and redlines will appear here as soon as the pipeline finishes.
          </p>
          <Link href="/dashboard/jobs" className="btn-secondary text-sm">
            Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard/jobs" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white mb-0.5">
            {contract?.filename || "Contract Review"}
          </h1>
          <div className="flex items-center gap-2">
            <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">{contractId}</p>
            {contract?.page_count && (
              <span className="text-[10px] text-slate-600 border-l border-white/10 pl-2">{contract.page_count} pages</span>
            )}
          </div>
        </div>
        {risk && (
          <RiskBadge
            level={risk.contract_risk_score >= 70 ? "HIGH" : risk.contract_risk_score >= 40 ? "MEDIUM" : "LOW"}
            showScore={Math.round(risk.contract_risk_score)}
            size="md"
          />
        )}
      </div>

      {risk && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-6 px-1">
          {/* Left: Heatmap + Summary */}
          <div className="space-y-6">
            {/* Executive Summary */}
            <div className="p-5 rounded-xl border border-white/[0.07] bg-white/[0.025] shadow-lg shadow-black/20">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Executive Summary</p>
              <p className="text-sm text-slate-300 leading-relaxed font-medium">{risk.executive_summary}</p>
              {risk.critical_flags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {risk.critical_flags.map((flag, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 uppercase">
                      <AlertTriangle className="w-3 h-3" /> {flag.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Risk Heatmap */}
            <div className="p-5 rounded-xl border border-white/[0.07] bg-white/[0.025] shadow-lg shadow-black/20">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Risk Heatmap</p>
              <div className="space-y-6">
                {highClauses.length > 0 && (
                  <div>
                    <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-3">Critical Vulnerabilities</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                      {highClauses.map((c) => (
                        <RiskCell key={c.clause_type} clause={c} onClick={() => handleSelectClause(c)} selected={selected?.clause_type === c.clause_type} />
                      ))}
                    </div>
                  </div>
                )}
                {medClauses.length > 0 && (
                  <div>
                    <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-3">Negotiable Points</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                      {medClauses.map((c) => (
                        <RiskCell key={c.clause_type} clause={c} onClick={() => handleSelectClause(c)} selected={selected?.clause_type === c.clause_type} />
                      ))}
                    </div>
                  </div>
                )}
                {lowClauses.length > 0 && (
                  <div>
                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-3">Acceptable Terms</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                      {lowClauses.map((c) => (
                        <RiskCell key={c.clause_type} clause={c} onClick={() => handleSelectClause(c)} selected={selected?.clause_type === c.clause_type} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Clause detail + Decision */}
          <div ref={detailRef} className="space-y-4 scroll-mt-20">
            {/* Clause detail drawer */}
            {selected ? (
              <div className="p-6 rounded-xl border border-white/[0.08] bg-white/[0.03] shadow-xl ring-1 ring-white/5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 mb-1 tracking-widest">{selected.clause_type.replace(/_/g, " ").toUpperCase()}</p>
                    <RiskBadge level={selected.risk_level || getLevel(selected.risk_score)} showScore={selected.risk_score} size="md" />
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1 rounded-md hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-300 mb-4 leading-relaxed italic border-l-2 border-white/10 pl-3">"{selected.explanation}"</p>
                
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 mb-6 font-medium leading-relaxed">
                  <span className="font-bold text-amber-400 uppercase tracking-tighter mr-1">Advice:</span> {selected.recommended_action}
                </div>

                {selectedRedline && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">Proposed Redline</p>
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl bg-red-500/5 border border-red-500/10 group">
                        <p className="text-[9px] text-red-500/60 font-bold mb-2 uppercase tracking-tighter">Original Text</p>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-mono italic">{selectedRedline.original_text || "Clause not present in original document."}</p>
                      </div>
                      <div className="flex items-center justify-center">
                        <div className="h-4 w-px bg-white/10" />
                      </div>
                      <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                        <p className="text-[9px] text-emerald-400 font-bold mb-2 uppercase tracking-tighter">AI Suggestion</p>
                        <p className="text-xs text-slate-200 leading-relaxed font-medium">{selectedRedline.proposed_text}</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/5 text-[10px] text-slate-400 leading-relaxed">
                      <span className="font-bold text-blue-400/60 uppercase mr-1">Rationale:</span> {selectedRedline.rationale}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-10 rounded-xl border border-dashed border-white/10 bg-white/[0.01] text-center">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Click a clause in the heatmap to inspect AI insights and redlines.</p>
              </div>
            )}

            {/* Decision bar */}
            <div className="p-6 rounded-xl border border-white/[0.07] bg-white/[0.025] shadow-lg">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Final Decision</p>
              <textarea
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder="Add reviewer notes (e.g., 'Escalated to legal', 'Business case approved')..."
                rows={3}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all resize-none mb-4 shadow-inner"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  { action: "APPROVE"  as const, label: "Approve",   color: "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/10" },
                  { action: "OVERRIDE" as const, label: "Override",  color: "bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/10" },
                  { action: "ESCALATE" as const, label: "Escalate",  color: "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/10" },
                ]).map(({ action, label, color }) => (
                  <button
                    key={action}
                    onClick={() => mutation.mutate(action)}
                    disabled={mutation.isPending}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 ${color}`}
                  >
                    {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
