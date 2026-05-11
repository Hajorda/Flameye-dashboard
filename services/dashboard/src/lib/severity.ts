export type Severity = "high" | "medium" | "low";

export function getSeverity(confidence: number): Severity {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.45) return "medium";
  return "low";
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  high: "High Severity",
  medium: "Medium Severity",
  low: "Low Severity",
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  high: "text-severity-high",
  medium: "text-severity-medium",
  low: "text-severity-low",
};

export const SEVERITY_ICON: Record<Severity, string> = {
  high: "local_fire_department",
  medium: "warning",
  low: "info",
};

export const SEVERITY_BORDER: Record<Severity, string> = {
  high: "border-severity-high/60 bg-severity-high/10",
  medium: "border-severity-medium/60 bg-severity-medium/10",
  low: "border-severity-low/60 bg-severity-low/10",
};
