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

// ── Types ─────────────────────────────────────────────────────────────────────

export type JobStatus =
  | "QUEUED" | "INGESTING" | "EXTRACTING" | "SCORING"
  | "REDLINING" | "PENDING_REVIEW" | "APPROVED" | "OVERRIDDEN"
  | "ESCALATED" | "AUTO_ESCALATED" | "FORMATTING" | "COMPLETE"
  | "FAILED_INGESTION" | "FAILED_EXTRACTION" | "FAILED_SCORING";

export interface Job {
  job_id: string;
  status: JobStatus;
  contract_count: number;
  completed_count: number;
  overall_risk_score?: number;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  contract_id: string;
  job_id: string;
  file_name: string;
  status: JobStatus;
  risk_score?: number;
  risk_level?: "HIGH" | "MEDIUM" | "LOW";
  parties?: string[];
  contract_type?: string;
}

export interface ClauseRisk {
  clause_type: string;
  risk_score: number;
  risk_level: "HIGH" | "MEDIUM" | "LOW";
  explanation: string;
  recommended_action: string;
}

export interface RiskReport {
  contract_id: string;
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

export interface Playbook {
  playbook_id: string;
  name: string;
  contract_type: string;
  created_at: string;
}

export interface UploadRecord {
  upload_id: string;
  file_count: number;
  files: { filename: string; size_bytes: number; gcs_uri: string }[];
  created_at: string;
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
    apiFetch<{ contracts: Contract[] }>(`/jobs/${jobId}/contracts`, token).then((res) => res.contracts),

  getContractDetails: (contractId: string, token: string | null) =>
    apiFetch<Contract>(`/contracts/${contractId}`, token),

  getContractRisk: (contractId: string, token: string | null) =>
    apiFetch<RiskReport>(`/contracts/${contractId}/risk`, token),

  getContractRedlines: (contractId: string, token: string | null) =>
    apiFetch<{ redlines: Redline[] }>(`/contracts/${contractId}/redlines`, token).then((res) => res.redlines),

  reviewContract: (
    contractId: string,
    payload: { action: "APPROVE" | "OVERRIDE" | "ESCALATE"; notes?: string },
    token: string | null
  ) =>
    apiFetch(`/contracts/${contractId}/review`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listPlaybooks: (token: string | null) =>
    apiFetch<{ playbooks: Playbook[] }>("/playbooks", token).then((res) => res.playbooks),

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
