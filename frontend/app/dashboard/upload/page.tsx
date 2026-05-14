"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { api, type UploadRecord, type Playbook } from "@/lib/api";
import { Upload, X, FileText, Loader2, CheckCircle2 } from "lucide-react";

import { useToast } from "@/components/toast";
import { Skeleton } from "@/components/Skeleton";

export default function UploadPage() {
  const { idToken, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [playbookId, setPlaybookId] = useState("");
  const [selectedUploadIds, setSelectedUploadIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: rawPlaybooks = [], isLoading: isLoadingPlaybooks } = useQuery({
    queryKey: ["playbooks", !!idToken],
    queryFn: () => api.listPlaybooks(idToken),
    enabled: !!idToken,
  });

  const playbooks: Playbook[] = Array.isArray(rawPlaybooks) ? rawPlaybooks : [];

  const { data: rawUploads = [], isLoading: isLoadingUploads } = useQuery({
    queryKey: ["uploads", !!idToken],
    queryFn: () => api.listUploads(idToken),
    enabled: !!idToken,
  });
  const pastUploads: UploadRecord[] = Array.isArray(rawUploads) ? rawUploads : [];

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [...prev, ...accepted].slice(0, 100));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    maxFiles: 100,
  });

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));
  
  const toggleUploadSelection = (id: string) => {
    if (!id) return;
    setSelectedUploadIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (files.length === 0 && selectedUploadIds.length === 0) return;
    setUploading(true);
    try {
      let idsToSend = [...selectedUploadIds];

      if (files.length > 0) {
        toast("Step 1/3: Uploading documents to secure vault...", "loading");
        const { upload_id } = await api.uploadFiles(files, idToken);
        idsToSend.push(upload_id);
      }

      toast("Step 2/3: Registering batch review job...", "loading");
      const job = await api.createJob({
        upload_ids: idsToSend,
        playbook_id: playbookId || undefined,
        reviewer_email: user?.email || "reviewer@example.com",
      }, idToken);
      
      toast("Step 3/3: Booting multi-agent analysis swarm...", "loading");
      // Small artificial delay to let the user see the step before redirect
      await new Promise(r => setTimeout(r, 800));
      
      toast("Pipeline started! Tracking real-time progress...", "success");
      router.push(`/dashboard/jobs/${job.job_id}`);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Upload Contracts</h1>
        <p className="text-slate-400 text-sm">Combine multiple batches for a single AI review job.</p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`relative rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-150 mb-6 ${
          isDragActive
            ? "border-blue-500/60 bg-blue-500/5"
            : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isDragActive ? "bg-blue-500/20" : "bg-white/5"}`}>
            <Upload className={`w-5 h-5 ${isDragActive ? "text-blue-400" : "text-slate-400"}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200 mb-1">
              {isDragActive ? "Drop files here" : "Drag & drop new files"}
            </p>
            <p className="text-xs text-slate-500">PDF or DOCX · click to browse</p>
          </div>
        </div>
      </div>

      {/* Selected Items Summary */}
      {(files.length > 0 || selectedUploadIds.length > 0) && (
        <div className="mb-6 space-y-4">
          {/* New files */}
          {files.length > 0 && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.03] overflow-hidden">
              <div className="px-4 py-2 border-b border-blue-500/10 flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">New Upload Batch</span>
                <button onClick={() => setFiles([])} className="text-[10px] text-slate-500 hover:text-slate-300 uppercase font-bold">Clear</button>
              </div>
              <div className="max-h-32 overflow-y-auto divide-y divide-white/[0.04]">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2">
                    <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="text-[11px] text-slate-300 flex-1 truncate">{f.name}</span>
                    <button onClick={() => removeFile(i)} className="text-slate-600 hover:text-slate-400"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected previous uploads */}
          {selectedUploadIds.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Selected Previous Batches</p>
              <div className="flex flex-wrap gap-2">
                {selectedUploadIds.map(id => {
                  const u = pastUploads.find(up => up.upload_id === id);
                  const name = u?.files?.[0]?.filename || id;
                  return (
                    <div key={id} className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-[11px] text-slate-300 font-medium">{name}</span>
                      <button onClick={() => toggleUploadSelection(id)} className="p-0.5 rounded hover:bg-white/10 text-slate-500 hover:text-slate-300">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Batch Selectors Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Recent Uploads Dropdown */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Add Previous Batch</label>
          {isLoadingUploads ? (
             <Skeleton className="w-full h-10 rounded-lg" />
          ) : (
            <select
              value=""
              onChange={(e) => toggleUploadSelection(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
            >
              <option value="">-- Choose batch --</option>
              {pastUploads.filter(u => !selectedUploadIds.includes(u.upload_id)).map((u) => {
                const filenames = u.files?.map(f => f.filename).join(", ") || "Unknown";
                const label = filenames.length > 30 ? filenames.slice(0, 30) + "..." : filenames;
                return (
                  <option key={u.upload_id} value={u.upload_id}>
                    {label} ({new Date(u.created_at).toLocaleDateString()})
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {/* Playbook selector */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Playbook (optional)</label>
          {isLoadingPlaybooks ? (
            <Skeleton className="w-full h-10 rounded-lg" />
          ) : (
            <select
              value={playbookId}
              onChange={(e) => setPlaybookId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
            >
              <option value="">No playbook (Default)</option>
              {playbooks.map((p) => (
                <option key={p.playbook_id} value={p.playbook_id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={(files.length === 0 && selectedUploadIds.length === 0) || uploading}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
      >
        {uploading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Starting Batch Review…</>
        ) : (
          <><CheckCircle2 className="w-4 h-4" /> Start Review</>
        )}
      </button>
    </div>
  );
}
