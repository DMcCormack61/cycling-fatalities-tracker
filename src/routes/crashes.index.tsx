import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { CrashRow } from "@/components/crash-row";
import { Input } from "@/components/ui/input";
import {
  CRASH_TYPES,
  INGEST_SOURCES,
  OUTCOMES,
  REGIONS,
  SEVERITIES,
  type CrashFilters,
  ingestLabel,
  outcomeLabel,
  typeLabel,
  severityLabel,
} from "@/lib/crashes";
import { listCrashes, listStates, listYears } from "@/lib/crashes-server";
import { formatCompact } from "@/lib/format";

type Search = CrashFilters;

function parseSearch(raw: Record<string, unknown>): Search {
  const str = (key: string) => {
    const value = raw[key];
    if (typeof value === "string" && value) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return undefined;
  };
  return {
    q: str("q"),
    region: str("region"),
    type: str("type"),
    outcome: str("outcome"),
    severity: str("severity"),
    year: str("year"),
    state: str("state"),
    source: str("source"),
    queue: str("queue"),
    p: str("p"),
  };
}

export const Route = createFileRoute("/crashes/")({
  validateSearch: (raw: Record<string, unknown>) => parseSearch(raw),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [page, years, states] = await Promise.all([
      listCrashes({ data: deps }),
      listYears(),
      listStates(),
    ]);
    return { ...page, years, states };
  },
  component: Ledger,
});

function Ledger() {
  const { crashes, total, page, pageSize } = Route.useLoaderData();
  const { years, states } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/crashes/" });
  const queue = search.queue === "pending" ? "pending" : search.queue === "all" ? "all" : "";
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function patch(next: Partial<Search>, keepPage = false) {
    void navigate({
      search: (prev) => {
        const merged = { ...prev, ...next };
        if (!keepPage) delete merged.p;
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
        <h1 className="font-display text-3xl tracking-tight text-fg">
          {queue === "pending" ? "News review queue" : "All documented filings"}
        </h1>
        <p className="max-w-2xl text-muted">
          {queue === "pending"
            ? "Headlines that name a US place and an injury or death. They stay out of the totals until a reviewer promotes them."
            : "Official FARS and PennDOT filings, plus curated reports with a name when one was published. Filter by place, year, source, or outcome."}
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
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
          <FilterSelect
            label="Source"
            value={search.source ?? ""}
            onChange={(v) => patch({ source: v || undefined })}
            options={INGEST_SOURCES.map((source) => ({ value: source, label: ingestLabel(source) }))}
          />
          <FilterSelect
            label="Queue"
            value={queue}
            emptyLabel="Published"
            onChange={(v) => patch({ queue: v || undefined })}
            options={[
              { value: "pending", label: "News queue" },
              { value: "all", label: "Published and news" },
            ]}
          />
        </div>
      </div>

      <p className="tabular-nums text-sm text-muted">
        {total === 0
          ? "0 crashes"
          : `${formatCompact(start)}–${formatCompact(end)} of ${formatCompact(total)}`}
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
      {pages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="min-h-11 rounded-md border border-input px-4 text-sm text-fg disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => patch({ p: page > 2 ? String(page - 1) : undefined }, true)}
          >
            Previous
          </button>
          <p className="tabular-nums text-sm text-muted">
            Page {formatCompact(page)} of {formatCompact(pages)}
          </p>
          <button
            type="button"
            className="min-h-11 rounded-md border border-input px-4 text-sm text-fg disabled:opacity-40"
            disabled={page >= pages}
            onClick={() => patch({ p: String(page + 1) }, true)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  emptyLabel = "All",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  emptyLabel?: string;
}) {
  return (
    <label className="flex min-h-11 flex-col gap-1">
      <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-subtle">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-md border border-input bg-surface px-3 text-sm text-fg"
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
