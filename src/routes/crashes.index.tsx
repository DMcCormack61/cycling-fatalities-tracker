import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { CrashRow } from "@/components/crash-row";
import { Input } from "@/components/ui/input";
import {
  CRASH_TYPES,
  OUTCOMES,
  REGIONS,
  SEVERITIES,
  type CrashFilters,
  outcomeLabel,
  typeLabel,
  severityLabel,
} from "@/lib/crashes";
import { listCrashes, listStates, listYears } from "@/lib/crashes-server";
import { formatCompact } from "@/lib/format";

type Search = CrashFilters;

function parseSearch(raw: Record<string, unknown>): Search {
  const str = (key: string) =>
    typeof raw[key] === "string" && raw[key] ? (raw[key] as string) : undefined;
  return {
    q: str("q"),
    region: str("region"),
    type: str("type"),
    outcome: str("outcome"),
    severity: str("severity"),
    year: str("year"),
    state: str("state"),
  };
}

export const Route = createFileRoute("/crashes/")({
  validateSearch: (raw: Record<string, unknown>) => parseSearch(raw),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [crashes, years, states] = await Promise.all([
      listCrashes({ data: deps }),
      listYears(),
      listStates(),
    ]);
    return { crashes, years, states };
  },
  component: Ledger,
});

function Ledger() {
  const { crashes, years, states } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/crashes/" });

  function patch(next: Partial<Search>) {
    void navigate({
      search: (prev) => {
        const merged = { ...prev, ...next };
        const cleaned: Search = {};
        for (const [k, v] of Object.entries(merged)) {
          if (v) cleaned[k as keyof Search] = v;
        }
        return cleaned;
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-[0.6875rem] uppercase tracking-[0.2em] text-subtle">Crashes</p>
        <h1 className="font-display text-3xl tracking-tight text-fg">All documented filings</h1>
        <p className="max-w-2xl text-muted">
          Filter the curated US KSI record by place, mechanism, outcome, and year.
        </p>
      </header>

      <div className="rounded-xl bg-surface p-3 shadow-[var(--shadow-border)] sm:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={search.q ?? ""}
            onChange={(e) => patch({ q: e.target.value || undefined })}
            placeholder="Search victim, city, state…"
            className="pl-10"
            aria-label="Search crashes"
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <FilterSelect
            label="Region"
            value={search.region ?? ""}
            onChange={(v) => patch({ region: v || undefined })}
            options={REGIONS.map((r) => ({ value: r, label: r }))}
          />
          <FilterSelect
            label="Type"
            value={search.type ?? ""}
            onChange={(v) => patch({ type: v || undefined })}
            options={CRASH_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))}
          />
          <FilterSelect
            label="Outcome"
            value={search.outcome ?? ""}
            onChange={(v) => patch({ outcome: v || undefined })}
            options={OUTCOMES.map((o) => ({ value: o, label: outcomeLabel(o) }))}
          />
          <FilterSelect
            label="Severity"
            value={search.severity ?? ""}
            onChange={(v) => patch({ severity: v || undefined })}
            options={SEVERITIES.map((s) => ({ value: s, label: severityLabel(s) }))}
          />
          <FilterSelect
            label="Year"
            value={search.year ?? ""}
            onChange={(v) => patch({ year: v || undefined })}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
          />
          <FilterSelect
            label="State"
            value={search.state ?? ""}
            onChange={(v) => patch({ state: v || undefined })}
            options={states.map((s) => ({ value: s, label: s }))}
          />
        </div>
      </div>

      <p className="tabular-nums text-sm text-muted">
        {formatCompact(crashes.length)}{" "}
        {crashes.length === 1 ? "crash" : "crashes"}
      </p>

      <div className="divide-y divide-border rounded-xl bg-surface p-2 shadow-[var(--shadow-border)]">
        {crashes.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted">
            No crashes match these filters.
          </p>
        ) : (
          crashes.map((c) => <CrashRow key={c.id} crash={c} />)
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-h-11 flex-col gap-1">
      <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-subtle">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-md border border-input bg-surface px-3 text-sm text-fg"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
