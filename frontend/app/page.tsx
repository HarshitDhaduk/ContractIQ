"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Zap, FileCheck, ArrowRight } from "lucide-react";

export default function LandingPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.push("/dashboard");
  }, [user, loading, router]);

  const features = [
    { icon: Zap, title: "2M Token Context", desc: "Entire contract batch processed in one pass — no chunking, no retrieval loss." },
    { icon: FileCheck, title: "40+ Clause Types", desc: "Indemnity, IP, payment terms, termination rights — all extracted and scored automatically." },
    { icon: Shield, title: "Risk Playbook", desc: "Every clause scored against your firm's standard. HIGH / MEDIUM / LOW with plain-English rationale." },
  ];

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center text-center max-w-4xl"
      >
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold tracking-widest uppercase mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Powered by Google ADK + Gemini
        </div>

        <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent mb-4 leading-none">
          ContractIQ
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          AI-powered multi-agent contract intelligence. Upload 100s of contracts,
          extract all key clauses, score risk against your playbook, and get redlines
          ready for one-click human approval.
        </p>

        {/* CTA */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={signInWithGoogle}
          className="group flex items-center gap-3 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg transition-all shadow-[0_0_40px_rgba(99,102,241,0.3)] hover:shadow-[0_0_60px_rgba(99,102,241,0.5)]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" opacity="0.85" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#fff" opacity="0.7" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" opacity="0.6" />
          </svg>
          Sign in with Google
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-20 w-full">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="glass glass-hover p-6 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </main>
  );
}
