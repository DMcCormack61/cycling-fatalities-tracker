import { Link } from "@tanstack/react-router";
import { SeverityBadge } from "@/components/severity-badge";
import { outcomeLabel, typeLabel, type Crash } from "@/lib/crashes";
import { formatCompact, formatDate } from "@/lib/format";

export function CrashRow({ crash }: { crash: Crash }) {
  return (
    <Link
      to="/crashes/$id"
      params={{ id: crash.id }}
      className="grid grid-cols-1 gap-2 rounded-lg px-3 py-3 transition-[background-color,box-shadow] duration-150 hover:bg-elevated sm:grid-cols-[6.5rem_1fr_auto] sm:items-center sm:gap-4"
    >
      <time dateTime={crash.occurredOn} className="tabular-nums text-xs text-subtle">
        {formatDate(crash.occurredOn)}
      </time>
      <div className="min-w-0">
        <p className="truncate font-medium text-fg">{crash.title}</p>
        <p className="truncate text-sm text-muted">
          {crash.victimName ? `${crash.victimName} · ` : ""}
          {crash.city}, {crash.stateCode}
          <span className="text-subtle"> · {typeLabel(crash.crashType)}</span>
        </p>
      </div>
      <div className="flex items-center gap-3">
        {crash.outcome === "killed" || crash.fatalities > 0 ? (
          <span className="tabular-nums text-sm text-muted">
            {formatCompact(Math.max(crash.fatalities, 1))} killed
          </span>
        ) : (
          <span className="tabular-nums text-sm text-muted">
            {outcomeLabel(crash.outcome)}
          </span>
        )}
        <SeverityBadge severity={crash.severity} />
      </div>
    </Link>
  );
}
