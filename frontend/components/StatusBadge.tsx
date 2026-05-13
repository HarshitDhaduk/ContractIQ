import { type JobStatus } from "@/lib/api";

const STATUS_CONFIG: Record<JobStatus, { label: string; className: string }> = {
  QUEUED:            { label: "Queued",          className: "status-queued" },
  INGESTING:         { label: "Ingesting",       className: "status-ingesting" },
  EXTRACTING:        { label: "Extracting",      className: "status-extracting" },
  SCORING:           { label: "Scoring",         className: "status-scoring" },
  REDLINING:         { label: "Redlining",       className: "status-scoring" },
  PENDING_REVIEW:    { label: "Pending Review",  className: "status-pending_review" },
  APPROVED:          { label: "Approved",        className: "status-complete" },
  OVERRIDDEN:        { label: "Overridden",      className: "status-complete" },
  ESCALATED:         { label: "Escalated",       className: "status-pending_review" },
  AUTO_ESCALATED:    { label: "Auto-Escalated",  className: "status-pending_review" },
  FORMATTING:        { label: "Formatting",      className: "status-scoring" },
  COMPLETE:          { label: "Complete",        className: "status-complete" },
  FAILED_INGESTION:  { label: "Failed",          className: "status-failed" },
  FAILED_EXTRACTION: { label: "Failed",          className: "status-failed" },
  FAILED_SCORING:    { label: "Failed",          className: "status-failed" },
};

interface Props {
  status: JobStatus;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "sm" }: Props) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "status-queued" };
  return (
    <span
      className={`inline-flex items-center rounded-md font-medium ${cfg.className} ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      {cfg.label}
    </span>
  );
}
