"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BookOpen, Upload, Loader2, CheckCircle2, FileText, X } from "lucide-react";

import { useToast } from "@/components/toast";
import { Loader } from "@/components/Loader";
import { PlaybookSkeleton } from "@/components/Skeleton";

export default function PlaybooksPage() {
  const { idToken } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: playbooks = [], isLoading } = useQuery({
    queryKey: ["playbooks"],
    queryFn: () => api.listPlaybooks(idToken),
  });

  const mutation = useMutation({
    mutationFn: () => api.uploadPlaybook(file!, name, idToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playbooks"] });
      setFile(null);
      setName("");
      toast("Playbook uploaded successfully", "success");
    },
    onError: (e: unknown) => {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    },
  });

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    maxFiles: 1,
  });

  const handleSubmit = () => {
    if (!file || !name.trim()) { 
      toast("Please provide a name and select a file.", "info"); 
      return; 
    }
    mutation.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Playbooks</h1>
        <p className="text-slate-400 text-sm">Firm playbooks define acceptable clause standards for risk scoring.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr,320px] gap-6">
        {/* Playbook list */}
        <div>
          {isLoading && <PlaybookSkeleton />}

          {!isLoading && playbooks.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No playbooks yet. Upload one to get started.</p>
            </div>
          )}

          {playbooks.length > 0 && (
            <div className="rounded-xl border border-white/[0.07] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                <span className="text-xs text-slate-500 font-medium">{playbooks.length} playbook{playbooks.length > 1 ? "s" : ""}</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {playbooks.map((p) => (
                  <div key={p.playbook_id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.025] transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.contract_type || "Generic"} · {p.created_at ? new Date(p.created_at).toLocaleDateString() : "Built-in"}</p>
                    </div>
                    <span className="font-mono text-[11px] text-slate-600">{((p.playbook_id || (p as any).id) ?? "").slice(0, 8)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Upload form */}
        <div className="p-5 rounded-xl border border-white/[0.07] bg-white/[0.025] h-fit">
          <p className="text-sm font-semibold text-white mb-4">Upload Playbook</p>

          <div className="mb-4">
            <label className="block text-xs text-slate-400 font-medium mb-1.5">Playbook Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MSA Standard 2025"
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
            />
          </div>

          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-150 mb-4 ${
              isDragActive ? "border-blue-500/50 bg-blue-500/5" : "border-white/10 hover:border-white/20"
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex items-center gap-2 justify-center">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-slate-300 truncate max-w-[180px]">{file.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-5 h-5 text-slate-500" />
                <p className="text-xs text-slate-500">Drop PDF or DOCX here</p>
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={mutation.isPending || !file || !name.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {mutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
            ) : mutation.isSuccess ? (
              <><CheckCircle2 className="w-4 h-4" /> Uploaded!</>
            ) : (
              <><Upload className="w-4 h-4" /> Upload Playbook</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
