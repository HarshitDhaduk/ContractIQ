type Level = "HIGH" | "MEDIUM" | "LOW";

const CONFIG: Record<Level, { label: string; className: string }> = {
  HIGH:   { label: "HIGH",   className: "risk-bg-high risk-high" },
  MEDIUM: { label: "MEDIUM", className: "risk-bg-medium risk-medium" },
  LOW:    { label: "LOW",    className: "risk-bg-low risk-low" },
};

interface Props {
  level: Level;
  showScore?: number;
  size?: "sm" | "md";
}

export function RiskBadge({ level, showScore, size = "sm" }: Props) {
  const cfg = CONFIG[level] ?? CONFIG.LOW;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-semibold ${cfg.className} ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      {cfg.label}
      {showScore !== undefined && (
        <span className="opacity-70 font-normal">&nbsp;{showScore}</span>
      )}
    </span>
  );
}
