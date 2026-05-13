"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck, ArrowRight, FileSearch, BarChart3,
  GitMerge, Users, Lock, Cpu, CheckCircle2, ChevronRight,
} from "lucide-react";

const FEATURES = [
  { icon: FileSearch, title: "Intelligent Extraction", desc: "40+ clause types identified in a single pass — no chunking, no retrieval loss." },
  { icon: BarChart3,  title: "Risk Scoring",           desc: "Every clause rated 0–100 against your firm's playbook with HIGH / MEDIUM / LOW flags." },
  { icon: GitMerge,   title: "AI Redlines",             desc: "Automated rewrites for non-standard clauses styled to your firm's precedents." },
  { icon: Users,      title: "Human-in-the-Loop",       desc: "Lawyers approve, override, or escalate from a structured review queue." },
  { icon: Lock,       title: "Governance Ready",        desc: "Audit trails, role-based access, and Firebase Auth with Google Sign-In." },
  { icon: Cpu,        title: "2M Token Context",        desc: "Entire contracts processed at once by Gemini — no information loss." },
];

const PIPELINE = [
  { n: "01", label: "Ingest",  desc: "Upload PDFs or DOCXs in batch" },
  { n: "02", label: "Extract", desc: "AI identifies all clause types" },
  { n: "03", label: "Score",   desc: "Risk-rated against your playbook" },
  { n: "04", label: "Redline", desc: "Rewrites for flagged clauses" },
  { n: "05", label: "Review",  desc: "Lawyer approves or escalates" },
  { n: "06", label: "Export",  desc: "JSON, DOCX, and PDF summary" },
];

const STATS = [
  { value: "2M",  label: "Token Context" },
  { value: "40+", label: "Clause Types" },
  { value: "6",   label: "AI Agents" },
  { value: "24h", label: "Review SLA" },
];

const TRUST_ITEMS = [
  "Firebase Auth with Google Sign-In",
  "Full audit trail on every contract action",
  "Human-in-the-loop approval gates",
  "Role-based access control",
  "Auto-approve only below configurable risk threshold",
  "Structured export for legal record-keeping",
];

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.1, 0.25, 1] as const }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FadeUpInView({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.1, 0.25, 1] as const }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  const handleMainAction = () => {
    if (user) router.push("/dashboard");
    else signInWithGoogle();
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── Fixed Nav ─────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06]" style={{ background: "rgba(10,15,30,0.85)", backdropFilter: "blur(14px)" }}>
        <div className="max-w-6xl mx-auto px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-semibold text-[15px] tracking-tight">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            ContractIQ
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors duration-150">Features</a>
            <a href="#pipeline" className="hover:text-white transition-colors duration-150">How it works</a>
            <a href="#trust"    className="hover:text-white transition-colors duration-150">Trust &amp; Security</a>
          </nav>
          {user ? (
            <Link href="/dashboard" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition-all max-w-[200px]">
              <div className="w-6 h-6 rounded-full bg-blue-600/30 flex items-center justify-center text-[10px] font-bold text-blue-400 uppercase shrink-0">
                {user.displayName?.[0] || user.email?.[0]}
              </div>
              <span className="text-xs font-medium text-slate-300 truncate">
                {user.displayName || user.email?.split('@')[0]}
              </span>
            </Link>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-white/10 text-slate-300 transition-all duration-150 hover:bg-white/5 hover:text-white"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="pt-[140px] pb-[112px] px-6">
        <div className="max-w-4xl mx-auto text-center">
          <FadeUp delay={0}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-xs font-medium text-blue-300 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Powered by Google ADK · Gemini Pro · 2M Token Context
            </div>
          </FadeUp>

          <FadeUp delay={0.08}>
            <h1 className="text-[52px] sm:text-[64px] lg:text-[76px] font-bold tracking-tight leading-[1.06] mb-6">
              AI-powered contract review
              <br />
              <span className="text-blue-400">built for legal teams.</span>
            </h1>
          </FadeUp>

          <FadeUp delay={0.16}>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Deploy a coordinated team of AI agents to extract, score, and redline hundreds of contracts
              in minutes — with full audit trails and human oversight.
            </p>
          </FadeUp>

          <FadeUp delay={0.24} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleMainAction}
              className="group inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors duration-150 text-sm"
            >
              {user ? "Go to Dashboard" : "Get started free"}
              <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
            </button>
            <a
              href="#pipeline"
              className="inline-flex items-center gap-2 px-6 py-3 border border-white/10 text-slate-300 hover:text-white hover:border-white/20 rounded-lg transition-all duration-150 text-sm"
            >
              See how it works
              <ChevronRight className="w-4 h-4" />
            </a>
          </FadeUp>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <section className="border-y border-white/[0.06] bg-white/[0.025]">
        <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s, i) => (
            <FadeUpInView key={i} delay={i * 0.06} className="text-center">
              <div className="text-3xl font-bold text-white mb-1">{s.value}</div>
              <div className="text-xs text-slate-500 uppercase tracking-widest">{s.label}</div>
            </FadeUpInView>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <FadeUpInView>
              <h2 className="text-3xl font-bold mb-3">Everything your legal team needs</h2>
              <p className="text-slate-400 text-sm max-w-lg mx-auto">
                From ingestion to export — a complete contract intelligence workflow with governance controls at every step.
              </p>
            </FadeUpInView>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <FadeUpInView key={i} delay={i * 0.05}>
                <div className="p-6 rounded-xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-200 group h-full">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors duration-200">
                    <Icon className="w-4 h-4 text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-sm text-white mb-2">{title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </FadeUpInView>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pipeline ──────────────────────────────────────────────────── */}
      <section id="pipeline" className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <FadeUpInView>
              <h2 className="text-3xl font-bold mb-3">The agent pipeline</h2>
              <p className="text-slate-400 text-sm">Six specialized agents, one coordinated workflow.</p>
            </FadeUpInView>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 border border-white/[0.07] rounded-2xl overflow-hidden">
            {PIPELINE.map(({ n, label, desc }, i) => (
              <FadeUpInView key={i} delay={i * 0.05}>
                <div
                  className="p-6 hover:bg-white/[0.03] transition-colors duration-200"
                  style={{
                    borderRight: i % 3 !== 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
                    borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  }}
                >
                  <div className="text-xs font-mono text-blue-500 mb-3">{n}</div>
                  <div className="font-semibold text-white text-sm mb-1">{label}</div>
                  <div className="text-xs text-slate-500">{desc}</div>
                </div>
              </FadeUpInView>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust & Security ──────────────────────────────────────────── */}
      <section id="trust" className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <FadeUpInView>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-10 md:p-14">
              <div className="flex flex-col md:flex-row gap-12 items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-4">
                    <ShieldCheck className="w-4 h-4" />
                    Trust &amp; Governance
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Built with compliance in mind</h2>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    ContractIQ is designed for regulated legal environments. Every action is logged,
                    every decision is traceable, and human reviewers remain in control at every critical step.
                  </p>
                </div>
                <div className="flex-1 space-y-3">
                  {TRUST_ITEMS.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeUpInView>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto text-center">
          <FadeUpInView>
            <h2 className="text-3xl font-bold mb-4">Ready to review smarter?</h2>
            <p className="text-slate-400 text-sm mb-8">
              Sign in with your Google account to start processing contracts in minutes.
            </p>
            <button
              onClick={handleMainAction}
              className="group inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors duration-150"
            >
              {user ? "Back to Dashboard" : "Start for free"}
              <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
            </button>
          </FadeUpInView>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            ContractIQ — AI Contract Intelligence
          </div>
          <span>Built with Google ADK · Gemini Pro · Firebase · Next.js</span>
        </div>
      </footer>
    </div>
  );
}
