import { Badge } from "@/components/ui/badge";
import { severityLabel, type Severity } from "@/lib/crashes";

const variant: Record<Severity, "critical" | "high" | "moderate" | "low"> = {
  critical: "critical",
  high: "high",
  moderate: "moderate",
  low: "low",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const key = (severity in variant ? severity : "low") as Severity;
  return <Badge variant={variant[key]}>{severityLabel(key)}</Badge>;
}
