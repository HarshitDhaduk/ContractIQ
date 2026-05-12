"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listPlaybooks } from "@/lib/api";
import { useDropzone } from "react-dropzone";
import { BookOpen, Upload, Check, Loader2 } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/v1";

export default function PlaybooksPage() {
  const { idToken } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contractType, setContractType] = useState("GENERIC");
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["playbooks"],
    queryFn: () => listPlaybooks(idToken),
    enabled: !!idToken,
  });
  const playbooks: any[] = data?.playbooks ?? [];

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (files) => setFile(files[0]),
    accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    maxFiles: 1,
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !name) throw new Error("Name and file required");
      const form = new FormData();
      form.append("file", file);
      form.append("name", name);
      form.append("description", description);
      form.append("contract_type", contractType);
      const res = await fetch(`${BASE}/playbooks`, {
        method: "POST",
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["playbooks"] }); setUploaded(true); setFile(null); setName(""); },
  });

  const BUILTIN_BADGES: Record<string, string> = {
    nda_standard_2026: "NDA",
    msa_standard_2026: "MSA",
    vendor_compliance_2026: "Vendor",
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Playbooks</h1>
        <p className="text-slate-400 mt-1">Risk standards your contracts are scored against.</p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Existing playbooks */}
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Available Playbooks</h2>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 glass shimmer rounded-xl" />)}</div>
          ) : (
            <div className="space-y-2">
              {playbooks.map((p: any) => (
                <div key={p.id} className="glass p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.id}</p>
                  </div>
                  {p.builtin && (
                    <span className="text-xs text-indigo-300 bg-indigo-900/40 px-2 py-0.5 rounded-md font-semibold">
                      {BUILTIN_BADGES[p.id] ?? "Built-in"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload custom playbook */}
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Upload Custom Playbook</h2>
          <div className="glass p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Playbook Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Enterprise SaaS MSA 2026"
                className="w-full px-3 py-2 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Contract Type</label>
              <select value={contractType} onChange={(e) => setContractType(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500">
                {["NDA","MSA","VENDOR","EMPLOYMENT","SAAS","GENERIC"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description…"
                className="w-full px-3 py-2 text-sm rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
            </div>
            <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center cursor-pointer transition-all ${file ? "border-indigo-500/50 bg-indigo-500/5" : "border-white/15 hover:border-white/25"}`}>
              <input {...getInputProps()} />
              <Upload className="w-6 h-6 text-slate-500 mb-2" />
              {file ? <p className="text-sm text-indigo-300">{file.name}</p> : <p className="text-sm text-slate-400">Drop PDF or DOCX</p>}
            </div>
            <button onClick={() => upload.mutate()} disabled={upload.isPending || !name || !file}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-sm transition-all">
              {upload.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</> : uploaded ? <><Check className="w-4 h-4" />Uploaded!</> : "Upload Playbook"}
            </button>
            {upload.isError && <p className="text-xs text-red-400">{String(upload.error)}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
