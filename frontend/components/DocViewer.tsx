"use client";

import { useState, useEffect } from "react";
import { Loader2, FileText, AlertTriangle, Download } from "lucide-react";

interface DocViewerProps {
  /** Signed URL or public URL to fetch the document from */
  url: string | null | undefined;
  /** Original filename for display and type detection */
  filename?: string;
  /** Label shown in header and loading states */
  label?: string;
}

/**
 * Renders PDF files via iframe and DOCX files via mammoth.js conversion.
 * Falls back to a download prompt for unsupported formats.
 */
export function DocViewer({ url, filename = "", label = "Document" }: DocViewerProps) {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const isPdf = ext === "pdf";
  const isDocx = ext === "docx" || ext === "doc";

  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url || !isDocx) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setHtml(null);

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch document (${res.status})`);
        const arrayBuffer = await res.arrayBuffer();

        // Dynamic import to avoid SSR issues with mammoth
        const mammoth = await import("mammoth");
        const result = await mammoth.convertToHtml(
          { arrayBuffer },
          {
            styleMap: [
              "p[style-name='Heading 1'] => h1.doc-h1:fresh",
              "p[style-name='Heading 2'] => h2.doc-h2:fresh",
              "p[style-name='Heading 3'] => h3.doc-h3:fresh",
            ],
          }
        );

        if (!cancelled) {
          setHtml(result.value);
          if (result.messages.length > 0) {
            console.warn("[DocViewer] Conversion warnings:", result.messages);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to render document");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [url, isDocx]);

  // ── No URL available ──
  if (!url) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center p-12">
        <div className="w-16 h-16 rounded-2xl bg-slate-500/10 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-base font-bold text-slate-300 mb-1">Preview Unavailable</h3>
        <p className="text-sm text-slate-500 max-w-sm">
          A signed URL could not be generated. Use the AI Analysis tab to review clauses.
        </p>
      </div>
    );
  }

  // ── PDF: native iframe ──
  if (isPdf) {
    return (
      <iframe
        src={`${url}#toolbar=0&navpanes=0`}
        className="w-full h-full border-none"
        title={label}
      />
    );
  }

  // ── DOCX: mammoth conversion ──
  if (isDocx) {
    if (loading) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
          <p className="text-sm text-slate-400">Rendering {filename}...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-12">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-base font-bold text-red-300 mb-1">Render Failed</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-4">{error}</p>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all">
            <Download className="w-3.5 h-3.5" /> Download Instead
          </a>
        </div>
      );
    }

    if (html) {
      return (
        <div className="w-full h-full overflow-y-auto custom-scrollbar">
          <div
            className="doc-rendered max-w-3xl mx-auto px-8 py-10"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      );
    }

    return null;
  }

  // ── Unsupported format: download fallback ──
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center p-12">
      <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4">
        <FileText className="w-8 h-8 text-blue-400" />
      </div>
      <h3 className="text-base font-bold text-white mb-1">{label}</h3>
      <p className="text-sm text-slate-400 max-w-sm mb-6">
        This file format can&apos;t be previewed inline.
      </p>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all">
        <Download className="w-3.5 h-3.5" /> Download File
      </a>
    </div>
  );
}
