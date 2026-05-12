const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/v1";

async function apiFetch(path: string, options: RequestInit = {}, token?: string | null) {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Upload ──────────────────────────────────────────────────────────────────
export async function uploadContracts(files: File[], token?: string | null) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await fetch(`${BASE}/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

// ── Jobs ────────────────────────────────────────────────────────────────────
export async function createJob(body: {
  upload_id: string;
  playbook_id: string;
  reviewer_email: string;
  sla_hours?: number;
  slack_webhook_url?: string;
}, token?: string | null) {
  return apiFetch("/jobs", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }, token);
}

export async function getJob(jobId: string, token?: string | null) {
  return apiFetch(`/jobs/${jobId}`, {}, token);
}

export async function listJobs(token?: string | null) {
  return apiFetch("/jobs", {}, token);
}

export async function listJobContracts(jobId: string, token?: string | null) {
  return apiFetch(`/jobs/${jobId}/contracts`, {}, token);
}

// ── Contracts ───────────────────────────────────────────────────────────────
export async function getClauses(contractId: string, token?: string | null) {
  return apiFetch(`/contracts/${contractId}/clauses`, {}, token);
}

export async function getRisk(contractId: string, token?: string | null) {
  return apiFetch(`/contracts/${contractId}/risk`, {}, token);
}

export async function getRedlines(contractId: string, token?: string | null) {
  return apiFetch(`/contracts/${contractId}/redlines`, {}, token);
}

// ── Review ──────────────────────────────────────────────────────────────────
export async function submitReview(
  contractId: string,
  decision: { job_id: string; contract_id: string; action: string; notes?: string; overrides?: unknown[] },
  token?: string | null
) {
  return apiFetch(`/contracts/${contractId}/review`, {
    method: "POST",
    body: JSON.stringify(decision),
    headers: { "Content-Type": "application/json" },
  }, token);
}

export async function getReviewQueue(token?: string | null) {
  return apiFetch("/review-queue", {}, token);
}

// ── Export ──────────────────────────────────────────────────────────────────
export async function getExportLinks(contractId: string, token?: string | null) {
  return apiFetch(`/contracts/${contractId}/export/links`, {}, token);
}

// ── Playbooks ───────────────────────────────────────────────────────────────
export async function listPlaybooks(token?: string | null) {
  return apiFetch("/playbooks", {}, token);
}
