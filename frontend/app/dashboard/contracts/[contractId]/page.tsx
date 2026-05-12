"use client";
import { use, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getClauses, getRisk, getRedlines, submitReview, getExportLinks } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, CheckCircle, XCircle, AlertTriangle, Download, ChevronDown } from "lucide-react";
import Link from "next/link";

const RISK_BG = { HIGH: "risk-bg-high", MEDIUM: "risk-bg-medium", LOW: "risk-bg-low" };
const RISK_TEXT = { HIGH: "risk-high", MEDIUM: "risk-medium", LOW: "risk-low" };

function RiskHeatmap({ risks }: { risks: any[] }) {
  const [selected, setSelected] = useState<any | null>(null);
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-300 mb-3">Clause Risk Heatmap</h3>
      <div className="grid grid-cols-5 gap-1.5">
        {risks.map((cr) => {
          const level = cr.risk_level as keyof typeof RISK_BG;
          return (
            <button
              key={cr.clause_type}
              onClick={() => setSelected(selected?.clause_type === cr.clause_type ? null : cr)}
              className={`px-2 py-2 rounded-lg text-xs font-medium text-left leading-tight transition-all ${RISK_BG[level] ?? "bg-white/5 text-slate-400"} ${selected?.clause_type === cr.clause_type ? "ring-2 ring-white/30" : ""}`}
            >
              {cr.clause_type.replace(/_/g, " ")}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.clause_type}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={`mt-3 p-4 rounded-xl ${RISK_BG[selected.risk_level as keyof typeof RISK_BG] ?? "bg-white/5"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-semibold text-sm ${RISK_TEXT[selected.risk_level as keyof typeof RISK_TEXT] ?? "text-white"}`}>
                  {selected.clause_type.replace(/_/g, " ")} — Score {selected.risk_score}/100
                </span>
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{selected.risk_category}</span>
              </div>
              <p className="text-sm text-slate-300 mb-2">{selected.explanation}</p>
              <span className="text-xs font-bold tracking-widest uppercase text-slate-400">
                Recommended: {selected.recommended_action}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ClausePanel({ clauses }: { clauses: any[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {clauses.map((c) => (
        <div key={c.clause_type} className="glass overflow-hidden">
          <button
            onClick={() => setOpen(open === c.clause_type ? null : c.clause_type)}
            className="w-full flex items-center gap-3 p-3 text-left"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${c.is_standard ? "bg-emerald-400" : "bg-amber-400"}`} />
            <span className="flex-1 text-sm font-medium text-slate-200">{c.clause_type.replace(/_/g, " ")}</span>
            {!c.is_standard && <span className="text-xs text-amber-400">Deviation</span>}
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open === c.clause_type ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {open === c.clause_type && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="px-4 pb-4 pt-1 text-sm text-slate-400 border-t border-white/8">
                  <p className="text-slate-300 leading-relaxed mb-2">{c.original_text}</p>
                  {c.deviation_summary && <p className="text-amber-300 text-xs">⚠ {c.deviation_summary}</p>}
                  {c.page_ref?.length > 0 && <p className="text-slate-500 text-xs mt-1">Pages: {c.page_ref.join(", ")}</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

export default function ContractReviewPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = use(params);
  const { idToken } = useAuth();
  const [tab, setTab] = useState<"risk" | "clauses" | "redlines">("risk");
  const [action, setAction] = useState<"APPROVE" | "OVERRIDE" | "ESCALATE">("APPROVE");
  const [notes, setNotes] = useState("");
  const [jobId, setJobId] = useState(""); // would come from URL query in production

  const { data: risk } = useQuery({ queryKey: ["risk", contractId], queryFn: () => getRisk(contractId, idToken), enabled: !!idToken });
  const { data: clauses } = useQuery({ queryKey: ["clauses", contractId], queryFn: () => getClauses(contractId, idToken), enabled: !!idToken });
  const { data: redlinesData } = useQuery({ queryKey: ["redlines", contractId], queryFn: () => getRedlines(contractId, idToken), enabled: !!idToken });
  const { data: exportLinks } = useQuery({ queryKey: ["exports", contractId], queryFn: () => getExportLinks(contractId, idToken), enabled: !!idToken });

  const reviewMutation = useMutation({
    mutationFn: () => submitReview(contractId, { job_id: jobId, contract_id: contractId, action, notes }, idToken),
  });

  const clauseRisks: any[] = risk?.clause_risks ?? [];
  const clauseList: any[] = clauses?.clauses ?? [];
  const redlines: any[] = redlinesData?.redlines ?? [];
  const score = risk?.contract_risk_score;

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-slate-500 text-sm mb-6">
        <Link href="/dashboard/jobs" className="hover:text-slate-300">Jobs</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-300 font-mono">{contractId}</span>
      </div>

      <div className="flex items-start gap-8">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Score header */}
          {score != null && (
            <div className="glass p-5 flex items-center gap-6">
              <div className={`text-5xl font-extrabold ${score >= 70 ? "text-red-400" : score >= 40 ? "text-amber-400" : "text-emerald-400"}`}>
                {score}
              </div>
              <div>
                <p className="text-white font-semibold">Contract Risk Score</p>
                <p className="text-slate-400 text-sm mt-0.5">{risk?.recommended_action}</p>
                <p className="text-sm text-slate-300 mt-2 max-w-lg">{risk?.executive_summary}</p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 p-1 glass rounded-xl w-fit">
            {(["risk", "clauses", "redlines"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}>
                {t} {t === "redlines" && redlines.length > 0 && `(${redlines.length})`}
              </button>
            ))}
          </div>

          {tab === "risk" && <RiskHeatmap risks={clauseRisks} />}
          {tab === "clauses" && <ClausePanel clauses={clauseList} />}
          {tab === "redlines" && (
            <div className="space-y-4">
              {redlines.length === 0 ? (
                <div className="glass p-8 text-center text-slate-400 text-sm">No redlines generated — no HIGH/MEDIUM risk clauses found.</div>
              ) : redlines.map((r: any, i: number) => (
                <div key={i} className="glass p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{r.clause_type.replace(/_/g," ")}</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-red-900/20 border border-red-500/20 rounded-lg">
                      <p className="text-xs text-red-400 font-semibold mb-1">Original</p>
                      <p className="text-slate-300 leading-relaxed">{r.original_text}</p>
                    </div>
                    <div className="p-3 bg-emerald-900/20 border border-emerald-500/20 rounded-lg">
                      <p className="text-xs text-emerald-400 font-semibold mb-1">Proposed</p>
                      <p className="text-slate-300 leading-relaxed">{r.proposed_text}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 italic">{r.rationale}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* HITL Review panel */}
        <div className="w-72 shrink-0 space-y-4">
          <div className="glass p-5 space-y-4">
            <h3 className="font-semibold text-white text-sm">Human Review</h3>
            <div className="space-y-2">
              {(["APPROVE", "OVERRIDE", "ESCALATE"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAction(a)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    action === a
                      ? a === "APPROVE" ? "bg-emerald-600/30 border-emerald-500/50 text-emerald-300"
                      : a === "ESCALATE" ? "bg-red-600/30 border-red-500/50 text-red-300"
                      : "bg-amber-600/30 border-amber-500/50 text-amber-300"
                      : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  {a === "APPROVE" ? <CheckCircle className="w-4 h-4" /> : a === "ESCALATE" ? <XCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {a}
                </button>
              ))}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)…"
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-xl bg-white/5 border border-white/10 text-slate-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
            <button
              onClick={() => reviewMutation.mutate()}
              disabled={reviewMutation.isPending || reviewMutation.isSuccess}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm transition-all"
            >
              {reviewMutation.isSuccess ? "✓ Decision Submitted" : reviewMutation.isPending ? "Submitting…" : "Submit Decision"}
            </button>
          </div>

          {/* Exports */}
          {exportLinks && (
            <div className="glass p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Downloads</p>
              {[
                { label: "JSON Export", key: "json_url" },
                { label: "Word Redlines", key: "docx_url" },
                { label: "PDF Summary", key: "pdf_url" },
              ].map(({ label, key }) => exportLinks[key] && (
                <a key={key} href={exportLinks[key]} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg glass glass-hover text-sm text-slate-300">
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
