"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@/lib/auth-context";
import { uploadContracts, createJob, listPlaybooks } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, X, CheckCircle, Loader2, AlertCircle } from "lucide-react";

type Stage = "select" | "uploading" | "configuring" | "submitting" | "done" | "error";

export default function UploadPage() {
  const { idToken } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [stage, setStage] = useState<Stage>("select");
  const [uploadId, setUploadId] = useState("");
  const [playbookId, setPlaybookId] = useState("nda_standard_2026");
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [slackUrl, setSlackUrl] = useState("");
  const [jobId, setJobId] = useState("");
  const [error, setError] = useState("");

  const { data: pbData } = useQuery({
    queryKey: ["playbooks"],
    queryFn: () => listPlaybooks(idToken),
    enabled: !!idToken,
  });
  const playbooks: any[] = pbData?.playbooks ?? [];

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [...prev, ...accepted].slice(0, 100));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    maxFiles: 100,
  });

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleUpload = async () => {
    if (!files.length) return;
    setStage("uploading");
    setError("");
    try {
      const result = await uploadContracts(files, idToken);
      setUploadId(result.upload_id);
      setStage("configuring");
    } catch (e: any) {
      setError(e.message);
      setStage("error");
    }
  };

  const handleSubmit = async () => {
    setStage("submitting");
    try {
      const result = await createJob({
        upload_id: uploadId,
        playbook_id: playbookId,
        reviewer_email: reviewerEmail,
        slack_webhook_url: slackUrl,
      }, idToken);
      setJobId(result.job_id);
      setStage("done");
    } catch (e: any) {
      setError(e.message);
      setStage("error");
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Upload Contracts</h1>
        <p className="text-slate-400 mt-1">Upload up to 100 PDF or DOCX files for batch AI review.</p>
      </div>

      <AnimatePresence mode="wait">
        {(stage === "select" || stage === "uploading") && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Drop zone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center cursor-pointer transition-all ${
                isDragActive ? "border-indigo-500 bg-indigo-500/10" : "border-white/15 hover:border-white/30 bg-white/2"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className={`w-12 h-12 mb-4 ${isDragActive ? "text-indigo-400" : "text-slate-500"}`} />
              <p className="text-white font-semibold mb-1">{isDragActive ? "Drop files here" : "Drag & drop contracts"}</p>
              <p className="text-sm text-slate-400">PDF or DOCX · up to 100 files</p>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                {files.map((f, i) => (
                  <div key={i} className="glass flex items-center gap-3 p-3">
                    <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="flex-1 text-sm text-slate-300 truncate">{f.name}</span>
                    <span className="text-xs text-slate-500">{(f.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => removeFile(i)} className="text-slate-500 hover:text-red-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {files.length > 0 && (
              <button
                onClick={handleUpload}
                disabled={stage === "uploading"}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition-all"
              >
                {stage === "uploading" ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading {files.length} files…</> : `Upload ${files.length} contracts`}
              </button>
            )}
          </motion.div>
        )}

        {stage === "configuring" && (
          <motion.div key="config" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass p-6 space-y-5">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-2">
              <CheckCircle className="w-4 h-4" />
              {files.length} files uploaded successfully
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Playbook</label>
              <select
                value={playbookId}
                onChange={(e) => setPlaybookId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                {playbooks.length === 0 && (
                  <>
                    <option value="nda_standard_2026">Standard NDA Playbook</option>
                    <option value="msa_standard_2026">Master Services Agreement</option>
                    <option value="vendor_compliance_2026">Vendor Compliance</option>
                  </>
                )}
                {playbooks.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Reviewer Email</label>
              <input
                type="email"
                value={reviewerEmail}
                onChange={(e) => setReviewerEmail(e.target.value)}
                placeholder="lawyer@firm.com"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Slack Webhook <span className="text-slate-500 font-normal">(optional)</span></label>
              <input
                type="url"
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-xs text-slate-500 mt-1">High-risk contracts will ping this channel</p>
            </div>
            <button
              onClick={handleSubmit}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all"
            >
              Start AI Review
            </button>
          </motion.div>
        )}

        {stage === "submitting" && (
          <motion.div key="submitting" className="glass p-12 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            <p className="text-white font-semibold">Kicking off the pipeline…</p>
          </motion.div>
        )}

        {stage === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass p-12 flex flex-col items-center gap-4 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Job Created!</h2>
            <p className="text-slate-400 text-sm">Job ID: <code className="text-indigo-300">{jobId}</code></p>
            <button onClick={() => router.push(`/dashboard/jobs/${jobId}`)} className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all">
              Track Progress →
            </button>
          </motion.div>
        )}

        {stage === "error" && (
          <motion.div key="error" className="glass p-8 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-white font-semibold">Something went wrong</p>
            <p className="text-sm text-red-300">{error}</p>
            <button onClick={() => { setStage("select"); setError(""); }} className="px-5 py-2 rounded-xl glass glass-hover text-sm text-slate-300">
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
