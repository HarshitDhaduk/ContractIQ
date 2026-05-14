const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/v1";

async function apiFetch<T>(path: string, token: string | null, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Types — aligned with real backend API responses ─────────────────────────

export type JobStatus =
  | "QUEUED" | "INGESTING" | "EXTRACTING" | "SCORING"
  | "REDLINING" | "PENDING_REVIEW" | "APPROVED" | "OVERRIDDEN"
  | "ESCALATED" | "AUTO_ESCALATED" | "FORMATTING" | "COMPLETE"
  | "FAILED_INGESTION" | "FAILED_EXTRACTION" | "FAILED_SCORING" | "FAILED";

export interface Job {
  job_id: string;
  status: JobStatus;
  user_id: string;
  contract_count: number;
  contracts_complete: number;
  completed_count?: number; // alias used by worker
  overall_risk_score?: number;
  playbook_id?: string | null;
  reviewer_email?: string;
  sla_hours?: number;
  generate_redlines?: boolean;
  auto_approve_threshold?: number;
  export_formats?: string[];
  gcs_uris?: string[];
  filenames?: string[];
  error?: string | null;
  error_detail?: { stage: string; error: string; traceback?: string } | null;
  slack_webhook_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  contract_id: string;
  job_id?: string;
  filename: string;       // API returns "filename", not "file_name"
  status: string;
  gcs_uri?: string;
  file_uri?: string;
  signed_url?: string;
  mime_type?: string;
  contract_type?: string;
  parties?: string[];
  effective_date?: string;
  page_count?: number;
  risk_score?: number;
  risk_level?: "HIGH" | "MEDIUM" | "LOW";
  critical_flags?: string[];
  executive_summary?: string;
  clause_bundle?: ClauseBundle;
  risk_report?: RiskReport;
  redlines?: Redline[];
  redline_count?: number;       // returned by /jobs/:id/contracts (lightweight)
  review_decision?: ReviewDecision | null;
  exports?: { json_uri?: string; docx_uri?: string; pdf_uri?: string };
  error?: string;
  is_placeholder?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExtractedClause {
  clause_type: string;
  original_text: string;
  page_ref: number[];
  is_standard: boolean;
  deviation_summary?: string | null;
}

export interface ClauseBundle {
  contract_id: string;
  contract_type: string;
  parties: string[];
  effective_date?: string | null;
  clauses: ExtractedClause[];
  missing_clauses: string[];
}

export interface ClauseRisk {
  clause_type: string;
  risk_score: number;
  risk_level?: "HIGH" | "MEDIUM" | "LOW";
  risk_category?: "legal" | "commercial" | "operational" | "regulatory";
  explanation: string;
  recommended_action: string;
}

export interface RiskReport {
  contract_id?: string;
  contract_risk_score: number;
  clause_risks: ClauseRisk[];
  critical_flags: string[];
  executive_summary: string;
  recommended_action: string;
}

export interface Redline {
  clause_type: string;
  original_text: string;
  proposed_text: string;
  rationale: string;
}

export interface ReviewDecision {
  action: "APPROVE" | "OVERRIDE" | "ESCALATE";
  notes?: string;
  auto?: boolean;
  reviewer_id?: string;
  reviewed_at?: string;
}

export interface Playbook {
  playbook_id: string;
  name: string;
  builtin?: boolean;          // API returns this, not contract_type/created_at
  contract_type?: string;
  description?: string;
  created_at?: string;
}

export interface UploadRecord {
  upload_id: string;
  user_id?: string;
  file_count: number;
  files: { filename: string; size_bytes: number; gcs_uri: string }[];
  gcs_uris: string[];
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Get the progress count — API uses both contracts_complete and completed_count */
export function getCompletedCount(job: Job): number {
  return job.contracts_complete || job.completed_count || 0;
}

/** Determine risk level from score */
export function riskLevelFromScore(score: number): "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

/** Check if a status represents a failure */
export function isFailedStatus(status: string): boolean {
  return status.startsWith("FAILED");
}

/** Check if a status represents active processing */
export function isProcessingStatus(status: string): boolean {
  return ["QUEUED", "INGESTING", "EXTRACTING", "SCORING", "REDLINING", "FORMATTING"].includes(status);
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const api = {
  uploadFiles: async (files: File[], token: string | null) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    const res = await fetch(`${BASE}/upload`, {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
    return res.json() as Promise<{ upload_id: string; gcs_uris: string[]; file_count: number }>;
  },

  listUploads: (token: string | null) =>
    apiFetch<{ uploads: UploadRecord[] }>("/uploads", token).then((res) => res.uploads),

  rerunJob: (jobId: string, token: string | null) =>
    apiFetch<{ ok: boolean }>(`/jobs/${jobId}/rerun`, token, { method: "POST" }),

  createJob: (payload: { upload_ids: string[]; playbook_id?: string; reviewer_email: string }, token: string | null) =>
    apiFetch<Job>("/jobs", token, { method: "POST", body: JSON.stringify(payload) }),

  listJobs: (token: string | null, page: number = 1, page_size: number = 10) =>
    apiFetch<{ jobs: Job[]; total: number; page: number; page_size: number }>(`/jobs?page=${page}&page_size=${page_size}`, token),

  getJob: (jobId: string, token: string | null) =>
    apiFetch<Job>(`/jobs/${jobId}`, token),

  getJobContracts: (jobId: string, token: string | null) =>
    apiFetch<{ job_id: string; contracts: Contract[] }>(`/jobs/${jobId}/contracts`, token).then((res) => res.contracts),

  getContractDetails: (contractId: string, token: string | null) =>
    apiFetch<Contract>(`/contracts/${contractId}`, token),

  getContractRisk: (contractId: string, token: string | null) =>
    apiFetch<RiskReport>(`/contracts/${contractId}/risk`, token),

  getContractClauses: (contractId: string, token: string | null) =>
    apiFetch<ClauseBundle>(`/contracts/${contractId}/clauses`, token),

  getContractRedlines: (contractId: string, token: string | null) =>
    apiFetch<{ contract_id: string; redlines: Redline[] }>(`/contracts/${contractId}/redlines`, token).then((res) => res.redlines),

  reviewContract: (
    contractId: string,
    payload: { action: "APPROVE" | "OVERRIDE" | "ESCALATE"; notes?: string; job_id?: string },
    token: string | null
  ) =>
    apiFetch(`/contracts/${contractId}/review`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listPlaybooks: (token: string | null) =>
    apiFetch<{ playbooks: Playbook[] }>("/playbooks", token).then((res) => res.playbooks),

  getPlaybook: (playbookId: string, token: string | null) =>
    apiFetch<Playbook>(`/playbooks/${playbookId}`, token),

  uploadPlaybook: async (file: File, name: string, token: string | null) => {
    const form = new FormData();
    form.append("file", file);
    form.append("name", name);
    const res = await fetch(`${BASE}/playbooks`, {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Playbook upload failed: ${res.statusText}`);
    return res.json() as Promise<Playbook>;
  },

  syncUser: (payload: { display_name?: string | null; photo_url?: string | null; email: string }, token: string | null) =>
    apiFetch<{ status: string; user_id: string }>("/users/sync", token, { method: "POST", body: JSON.stringify(payload) }),

  getMyProfile: (token: string | null) =>
    apiFetch<any>("/users/me", token),
};
